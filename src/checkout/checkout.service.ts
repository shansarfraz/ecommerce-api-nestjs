import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cart, CartItem } from '../cart/entities/cart.entity';
import {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
} from '../orders/entities/order.entity';
import { Product, ProductVariant } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { ApplyCouponDto, CreateSessionDto } from './dto/checkout.dto';
import { PromotionsService } from '../promotions/promotions.service';
import { ShippingService } from '../shipping/shipping.service';
import { TaxService } from '../tax/tax.service';
import { PaymentsService } from '../payments/payments.service';
import { Payment } from '../payments/entities/payment.entity';
import { NotificationsService } from '../notifications/notifications.service';

interface VendorGroup {
  vendorId: string;
  vendor: any;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

@Injectable()
export class CheckoutService {
  constructor(
    @InjectRepository(Cart)
    private cartsRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemsRepository: Repository<CartItem>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    private readonly dataSource: DataSource,
    private readonly promotions: PromotionsService,
    private readonly shipping: ShippingService,
    private readonly tax: TaxService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
  ) {}

  private groupByVendor(items: CartItem[]): VendorGroup[] {
    const map = new Map<string, VendorGroup>();
    for (const item of items) {
      if (!map.has(item.vendorId)) {
        map.set(item.vendorId, {
          vendorId: item.vendorId,
          vendor: item.vendor,
          items: [],
          subtotal: 0,
          itemCount: 0,
        });
      }
      const g = map.get(item.vendorId)!;
      g.items.push(item);
      g.subtotal = round2(g.subtotal + Number(item.subtotal));
      g.itemCount += item.quantity;
    }
    return Array.from(map.values());
  }

  /**
   * Calculate the full checkout summary with real shipping/tax against an
   * (optional) address. Used both by GET /checkout/summary and createSession.
   */
  async getSummary(
    userId: string,
    address?: { country?: string; state?: string },
    couponCode?: string,
  ) {
    const cart = await this.cartsRepository.findOne({
      where: { userId },
      relations: [
        'items',
        'items.product',
        'items.variant',
        'items.vendor',
      ],
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const groups = this.groupByVendor(cart.items);
    const subtotal = round2(groups.reduce((s, g) => s + g.subtotal, 0));

    // Shipping per vendor
    const shippingByVendor = await Promise.all(
      groups.map(async (g) => {
        const q = await this.shipping.quote({
          vendorId: g.vendorId,
          subtotal: g.subtotal,
          itemCount: g.itemCount,
          country: address?.country,
        });
        return { vendorId: g.vendorId, ...q };
      }),
    );
    let totalShipping = round2(
      shippingByVendor.reduce((s, q) => s + q.amount, 0),
    );

    // Discount
    let discount = 0;
    let freeShipping = false;
    let promoCode: string | undefined;
    if (couponCode) {
      const res = await this.promotions.preview({
        code: couponCode,
        userId,
        subtotal,
        vendorIds: groups.map((g) => g.vendorId),
      });
      discount = res.discountAmount;
      freeShipping = res.freeShipping;
      promoCode = res.promotion.code;
      if (freeShipping) totalShipping = 0;
    }

    const taxableAmount = Math.max(0, subtotal - discount);
    const taxCalc = address
      ? await this.tax.calculate(taxableAmount, address)
      : { rate: 0, amount: 0 };

    const total = round2(
      Math.max(0, subtotal - discount) + totalShipping + taxCalc.amount,
    );

    return {
      cartId: cart.id,
      vendorGroups: groups.map((g) => ({
        vendor: g.vendor,
        items: g.items.map((i) => ({
          id: i.id,
          product: i.product,
          variant: i.variant,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subtotal: i.subtotal,
        })),
        subtotal: g.subtotal,
        shipping: shippingByVendor.find((q) => q.vendorId === g.vendorId)!
          .amount,
      })),
      subtotal,
      shipping: totalShipping,
      tax: taxCalc.amount,
      taxRate: taxCalc.rate,
      discount,
      couponCode: promoCode,
      freeShipping,
      total,
      currency: cart.currency,
    };
  }

  async applyCoupon(userId: string, dto: ApplyCouponDto) {
    return this.getSummary(userId, undefined, dto.code);
  }

  async removeCoupon(userId: string) {
    return this.getSummary(userId);
  }

  /**
   * Place the order: in one DB transaction we
   *   1. lock products/variants and verify + decrement stock,
   *   2. recompute totals server-side (never trust the client),
   *   3. redeem the promotion code (increments usage),
   *   4. persist order + order items,
   *   5. clear the cart,
   *   6. create a payment intent with the provider.
   */
  async createSession(userId: string, dto: CreateSessionDto) {
    if (dto.idempotencyKey) {
      const existing = await this.ordersRepository.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        const payment = await this.cartsRepository.manager
          .getRepository(Payment)
          .findOne({ where: { orderId: existing.id } });
        return {
          orderId: existing.id,
          paymentIntentId: payment?.providerIntentId ?? null,
          clientSecret: (payment?.metadata as any)?.clientSecret ?? null,
          total: existing.total,
          currency: existing.currency,
          status: existing.status,
        };
      }
    }

    const cart = await this.cartsRepository.findOne({
      where: { userId },
      relations: ['items', 'items.product', 'items.variant', 'items.vendor'],
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const address = dto.shippingAddress as any;
    const groups = this.groupByVendor(cart.items);
    const subtotal = round2(groups.reduce((s, g) => s + g.subtotal, 0));

    // Shipping
    const shippingByVendor = await Promise.all(
      groups.map(async (g) => {
        const q = await this.shipping.quote({
          vendorId: g.vendorId,
          subtotal: g.subtotal,
          itemCount: g.itemCount,
          country: address?.country,
        });
        return { vendorId: g.vendorId, ...q };
      }),
    );

    const { order, payment } = await this.dataSource.transaction(
      async (manager) => {
        // 1. lock stock rows
        const variantIds = cart.items
          .map((i) => i.variantId)
          .filter((v): v is string => !!v);
        const productIds = cart.items.map((i) => i.productId);

        if (variantIds.length) {
          await manager
            .getRepository(ProductVariant)
            .createQueryBuilder('v')
            .setLock('pessimistic_write')
            .whereInIds(variantIds)
            .getMany();
        }
        const lockedProducts = await manager
          .getRepository(Product)
          .createQueryBuilder('p')
          .setLock('pessimistic_write')
          .whereInIds(productIds)
          .getMany();

        // 2. verify + decrement
        for (const item of cart.items) {
          if (item.variantId) {
            const variant = await manager
              .getRepository(ProductVariant)
              .findOne({ where: { id: item.variantId } });
            if (!variant) {
              throw new BadRequestException(
                `Variant not found: ${item.variantId}`,
              );
            }
            if (variant.stock < item.quantity) {
              throw new BadRequestException(
                `Insufficient stock for variant ${variant.name}`,
              );
            }
            await manager
              .getRepository(ProductVariant)
              .update(variant.id, { stock: variant.stock - item.quantity });
          } else {
            const product = lockedProducts.find((p) => p.id === item.productId);
            if (!product) {
              throw new BadRequestException(
                `Product not found: ${item.productId}`,
              );
            }
            if (product.stock < item.quantity) {
              throw new BadRequestException(
                `Insufficient stock for ${product.title}`,
              );
            }
            const newStock = product.stock - item.quantity;
            await manager
              .getRepository(Product)
              .update(product.id, { stock: newStock });
            if (newStock <= 5) {
              await this.notifications.send({
                template: 'product.low-stock',
                to: 'admin@marketplace.com',
                subject: `Low stock alert: ${product.title}`,
                data: { productId: product.id, title: product.title, stock: newStock },
              });
            }
          }
        }

        let totalShipping = round2(
          shippingByVendor.reduce((s, q) => s + q.amount, 0),
        );

        // 3. discount (preview-style validation; final redemption after order id)
        let discount = 0;
        let freeShipping = false;
        if (dto.couponCode) {
          const res = await this.promotions.preview({
            code: dto.couponCode,
            userId,
            subtotal,
            vendorIds: groups.map((g) => g.vendorId),
          });
          discount = res.discountAmount;
          freeShipping = res.freeShipping;
          if (freeShipping) totalShipping = 0;
        }

        const taxableAmount = Math.max(0, subtotal - discount);
        const taxCalc = await this.tax.calculate(taxableAmount, address);

        const total = round2(
          Math.max(0, subtotal - discount) + totalShipping + taxCalc.amount,
        );

        // 4. order
        const order = manager.getRepository(Order).create({
          userId,
          status: OrderStatus.PENDING,
          total,
          currency: cart.currency,
          paymentStatus: PaymentStatus.PENDING,
          shippingAddress: dto.shippingAddress,
          billingAddress: dto.billingAddress ?? dto.shippingAddress,
          couponCode: dto.couponCode?.toUpperCase(),
          discountAmount: discount,
          shippingCost: totalShipping,
          taxAmount: taxCalc.amount,
          idempotencyKey: dto.idempotencyKey ?? null,
        });
        const savedOrder = await manager.getRepository(Order).save(order);

        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        await manager.getRepository(Order).update(savedOrder.id, { orderNumber });
        savedOrder.orderNumber = orderNumber;

        const orderItems = cart.items.map((item) =>
          manager.getRepository(OrderItem).create({
            orderId: savedOrder.id,
            productId: item.productId,
            variantId: item.variantId,
            vendorId: item.vendorId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          }),
        );
        await manager.getRepository(OrderItem).save(orderItems);

        // 5. redeem the coupon now that the order exists
        if (dto.couponCode) {
          await this.promotions.redeem(manager, {
            code: dto.couponCode,
            userId,
            orderId: savedOrder.id,
            subtotal,
            vendorIds: groups.map((g) => g.vendorId),
          });
        }

        // 6. clear cart
        await manager
          .getRepository(CartItem)
          .delete({ cartId: cart.id });
        await manager.getRepository(Cart).update(cart.id, { total: 0 });

        return { order: savedOrder, payment: null };
      },
    );

    // 7. payment intent (outside the tx so we don't roll back on provider errors)
    const user = await this.cartsRepository.manager
      .getRepository(User)
      .findOne({ where: { id: userId } });
    const intent = await this.payments.createIntentForOrder(order, user?.email);

    if (user?.email) {
      await this.notifications.send({
        template: 'order.placed',
        to: user.email,
        subject: `Order ${order.id} placed`,
        data: {
          orderId: order.id,
          total: order.total,
          currency: order.currency,
        },
      });
    }

    return {
      orderId: order.id,
      paymentIntentId: intent.providerIntentId,
      clientSecret: intent.clientSecret,
      total: order.total,
      currency: order.currency,
      status: order.status,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
