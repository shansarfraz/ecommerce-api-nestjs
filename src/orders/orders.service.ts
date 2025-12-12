import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderItem, OrderStatus, FulfillmentStatus } from './entities/order.entity';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';
import {
  OrderQueryDto,
  UpdateOrderStatusDto,
  UpdateFulfillmentStatusDto,
  CancelOrderDto,
  ReturnOrderDto,
} from './dto/order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
  ) {}

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

    await this.ordersRepository.update(orderId, {
      status: OrderStatus.CANCELLED,
      notes: dto.reason,
    });

    return this.findOneForUser(userId, orderId);
  }

  async returnOrder(userId: string, orderId: string, dto: ReturnOrderDto) {
    const order = await this.findOneForUser(userId, orderId);

    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException('Only delivered orders can be returned');
    }

    // Mark all items as returned
    await this.orderItemsRepository.update(
      { orderId },
      { fulfillmentStatus: FulfillmentStatus.RETURNED },
    );

    await this.ordersRepository.update(orderId, {
      notes: `Return requested: ${dto.reason}`,
    });

    return this.findOneForUser(userId, orderId);
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

    return this.findOneAdmin(orderId);
  }
}
