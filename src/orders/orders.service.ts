import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderItem, OrderStatus, FulfillmentStatus, PaymentStatus } from './entities/order.entity';
import { Shipment } from './entities/shipment.entity';
import { ReturnRequest, ReturnStatus } from './entities/return-request.entity';
import { OrderAdjustment, AdjustmentType } from './entities/order-adjustment.entity';
import { OrderTimelineEvent, TimelineEventType } from './entities/order-timeline-event.entity';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';
import { Product, ProductVariant } from '../products/entities/product.entity';
import { CommissionsService } from '../commissions/commissions.service';
import {
  OrderQueryDto,
  UpdateOrderStatusDto,
  UpdateFulfillmentStatusDto,
  UpdateShipmentDto,
  CancelOrderDto,
  ReturnOrderDto,
  ReviewReturnDto,
  CreateAdjustmentDto,
} from './dto/order.dto';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../payments/providers/payment-provider.interface';
import { Payment } from '../payments/entities/payment.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Shipment)
    private shipmentRepo: Repository<Shipment>,
    @InjectRepository(ReturnRequest)
    private returnRepo: Repository<ReturnRequest>,
    @InjectRepository(OrderAdjustment)
    private adjustmentRepo: Repository<OrderAdjustment>,
    @InjectRepository(OrderTimelineEvent)
    private timelineRepo: Repository<OrderTimelineEvent>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    private readonly dataSource: DataSource,
    private readonly commissions: CommissionsService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  private async restoreStock(manager: any, orderId: string) {
    const items = await manager
      .getRepository(OrderItem)
      .find({ where: { orderId } });
    for (const item of items) {
      if (item.variantId) {
        await manager
          .getRepository(ProductVariant)
          .increment({ id: item.variantId }, 'stock', item.quantity);
      } else {
        await manager
          .getRepository(Product)
          .increment({ id: item.productId }, 'stock', item.quantity);
      }
    }
  }

  // Customer methods
  async findAllForUser(userId: string, query: OrderQueryDto) {
    const { status, page = 1, limit = 10 } = query;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.product', 'product')
      .where('order.userId = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    const [orders, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('order.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneForUser(userId: string, orderId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.product', 'items.variant', 'items.vendor'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancelOrder(userId: string, orderId: string, dto: CancelOrderDto) {
    const order = await this.findOneForUser(userId, orderId);

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('Order cannot be cancelled at this stage');
    }

    await this.dataSource.transaction(async (manager) => {
      await this.restoreStock(manager, orderId);
      await this.commissions.reverseForOrder(manager, orderId);
      await manager.getRepository(Order).update(orderId, {
        status: OrderStatus.CANCELLED,
        notes: dto.reason,
      });
    });

    return this.findOneForUser(userId, orderId);
  }

  async returnOrder(userId: string, orderId: string, dto: ReturnOrderDto) {
    const order = await this.findOneForUser(userId, orderId);
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException('Only paid orders can be returned');
    }
    const existing = await this.returnRepo.findOne({ where: { orderId } });
    if (existing) {
      throw new BadRequestException('A return request already exists for this order');
    }
    const rr = this.returnRepo.create({
      orderId,
      requestedById: userId,
      reason: dto.reason,
      status: ReturnStatus.REQUESTED,
    });
    await this.returnRepo.save(rr);
    return rr;
  }

  async getReturnRequest(userId: string, orderId: string) {
    await this.findOneForUser(userId, orderId); // ownership check
    return this.returnRepo.findOne({ where: { orderId } });
  }

  async adminReviewReturn(returnId: string, dto: ReviewReturnDto) {
    const rr = await this.returnRepo.findOne({ where: { id: returnId }, relations: ['order'] });
    if (!rr) throw new NotFoundException('Return request not found');
    if (rr.status !== ReturnStatus.REQUESTED) throw new BadRequestException('Return already reviewed');

    rr.status = dto.approve ? ReturnStatus.APPROVED : ReturnStatus.REJECTED;
    rr.adminNotes = dto.notes ?? null;
    rr.refundAmount = dto.refundAmount ?? Number(rr.order.total);
    await this.returnRepo.save(rr);

    if (dto.approve) {
      await this.dataSource.transaction(async (manager) => {
        await this.restoreStock(manager, rr.orderId);
        await this.commissions.reverseForOrder(manager, rr.orderId);
        await manager.getRepository(Order).update(rr.orderId, {
          status: OrderStatus.REFUNDED,
          paymentStatus: PaymentStatus.REFUNDED,
        });
      });

      // Issue actual refund via payment provider
      const payment = await this.dataSource.getRepository(Payment)
        .findOne({ where: { orderId: rr.orderId } });
      if (payment?.providerIntentId) {
        try {
          await this.paymentProvider.refund({
            providerIntentId: payment.providerIntentId,
            amount: rr.refundAmount ?? Number(rr.order.total),
            reason: 'return_approved',
          });
        } catch (e) {
          // Log but don't fail — the ledger is already reversed
          this.logger.warn(`Refund provider call failed for order ${rr.orderId}: ${e}`);
        }
      }
    }
    return rr;
  }

  // Vendor methods
  async findAllForVendor(vendorId: string, query: OrderQueryDto) {
    const { status, page = 1, limit = 10 } = query;

    const queryBuilder = this.orderItemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.order', 'order')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('item.variant', 'variant')
      .where('item.vendorId = :vendorId', { vendorId });

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    const [items, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('order.createdAt', 'DESC')
      .getManyAndCount();

    // Group items by order
    const ordersMap = new Map<string, any>();
    items.forEach((item) => {
      const orderId = item.orderId;
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          ...item.order,
          vendorItems: [],
        });
      }
      ordersMap.get(orderId).vendorItems.push(item);
    });

    return {
      data: Array.from(ordersMap.values()),
      total: ordersMap.size,
      page,
      limit,
    };
  }

  async findOneForVendor(vendorId: string, orderId: string) {
    const items = await this.orderItemsRepository.find({
      where: { orderId, vendorId },
      relations: ['order', 'product', 'variant'],
    });

    if (items.length === 0) {
      throw new NotFoundException('Order not found for this vendor');
    }

    return {
      order: items[0].order,
      items,
    };
  }

  async updateItemFulfillment(
    vendorId: string,
    orderId: string,
    itemId: string,
    dto: UpdateFulfillmentStatusDto,
  ) {
    const item = await this.orderItemsRepository.findOne({
      where: { id: itemId, orderId, vendorId },
    });

    if (!item) {
      throw new NotFoundException('Order item not found');
    }

    await this.orderItemsRepository.update(itemId, {
      fulfillmentStatus: dto.fulfillmentStatus,
      trackingNumber: dto.trackingNumber,
    });

    // Check if all items are delivered to update order status
    const allItems = await this.orderItemsRepository.find({ where: { orderId } });
    const allDelivered = allItems.every(
      (i) => i.id === itemId
        ? dto.fulfillmentStatus === FulfillmentStatus.DELIVERED
        : i.fulfillmentStatus === FulfillmentStatus.DELIVERED,
    );

    if (allDelivered) {
      await this.ordersRepository.update(orderId, { status: OrderStatus.DELIVERED });
    } else {
      const allShipped = allItems.every(
        (i) => i.id === itemId
          ? [FulfillmentStatus.SHIPPED, FulfillmentStatus.DELIVERED].includes(dto.fulfillmentStatus)
          : [FulfillmentStatus.SHIPPED, FulfillmentStatus.DELIVERED].includes(i.fulfillmentStatus),
      );
      if (allShipped) {
        await this.ordersRepository.update(orderId, { status: OrderStatus.SHIPPED });
      }
    }

    return this.orderItemsRepository.findOne({
      where: { id: itemId },
      relations: ['product', 'variant'],
    });
  }

  async updateShipment(vendorId: string, orderId: string, shipmentId: string, dto: UpdateShipmentDto) {
    const shipment = await this.shipmentRepo.findOne({
      where: { id: shipmentId, orderId, vendorId },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    await this.shipmentRepo.update(shipmentId, dto);
    return this.shipmentRepo.findOne({ where: { id: shipmentId } });
  }

  async getVendorByUserId(userId: string) {
    return this.vendorsRepository.findOne({
      where: { ownerId: userId, status: VendorStatus.APPROVED },
    });
  }

  // Admin methods
  async findAllAdmin(query: OrderQueryDto) {
    const { status, page = 1, limit = 10 } = query;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.vendor', 'vendor');

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    const [orders, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('order.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneAdmin(orderId: string) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'items', 'items.product', 'items.variant', 'items.vendor'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async adminUpdateOrder(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOneAdmin(orderId);

    await this.ordersRepository.update(orderId, {
      status: dto.status,
      notes: dto.notes,
    });

    await this.logTimeline(orderId, TimelineEventType.STATUS_CHANGE,
      `Status changed to ${dto.status}${dto.notes ? `: ${dto.notes}` : ''}`,
      { actorRole: 'admin' },
    );

    return this.findOneAdmin(orderId);
  }

  // Adjustments
  async createAdjustment(orderId: string, dto: CreateAdjustmentDto, adminId: string) {
    await this.findOneAdmin(orderId);

    const adj = await this.adjustmentRepo.save(this.adjustmentRepo.create({
      orderId,
      type: dto.type,
      amount: dto.amount,
      label: dto.label,
      note: dto.note,
      createdByAdminId: adminId,
    }));

    const delta = dto.type === AdjustmentType.SURCHARGE ? dto.amount : -dto.amount;
    await this.ordersRepository.increment({ id: orderId }, 'total', delta);

    await this.logTimeline(orderId, TimelineEventType.ADJUSTMENT,
      `${dto.type === AdjustmentType.SURCHARGE ? 'Surcharge' : 'Discount'} applied: ${dto.label} ($${dto.amount})`,
      { actorId: adminId, actorRole: 'admin', metadata: { adjustmentId: adj.id, amount: dto.amount, type: dto.type } },
    );

    return adj;
  }

  async getAdjustments(orderId: string) {
    await this.findOneAdmin(orderId);
    return this.adjustmentRepo.find({ where: { orderId }, order: { createdAt: 'ASC' } });
  }

  async deleteAdjustment(orderId: string, adjustmentId: string, adminId: string) {
    const adj = await this.adjustmentRepo.findOne({ where: { id: adjustmentId, orderId } });
    if (!adj) throw new NotFoundException('Adjustment not found');

    const delta = adj.type === AdjustmentType.SURCHARGE ? -Number(adj.amount) : Number(adj.amount);
    await this.ordersRepository.increment({ id: orderId }, 'total', delta);
    await this.adjustmentRepo.delete(adjustmentId);

    await this.logTimeline(orderId, TimelineEventType.ADJUSTMENT,
      `Adjustment removed: ${adj.label} ($${adj.amount})`,
      { actorId: adminId, actorRole: 'admin' },
    );

    return { deleted: true };
  }

  // Timeline
  async getTimeline(orderId: string) {
    await this.findOneAdmin(orderId);
    return this.timelineRepo.find({ where: { orderId }, order: { createdAt: 'ASC' } });
  }

  async addTimelineNote(orderId: string, note: string, actorId: string, actorRole: string) {
    await this.findOneAdmin(orderId);
    return this.logTimeline(orderId, TimelineEventType.NOTE, note, { actorId, actorRole });
  }

  private async logTimeline(
    orderId: string,
    eventType: TimelineEventType,
    description: string,
    opts: { actorId?: string; actorRole?: string; metadata?: Record<string, any> } = {},
  ) {
    await this.timelineRepo.save(this.timelineRepo.create({
      orderId,
      eventType,
      description,
      actorId: opts.actorId,
      actorRole: opts.actorRole,
      metadata: opts.metadata,
    }));
  }
}
