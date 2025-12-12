import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem } from '../cart/entities/cart.entity';
import { Order, OrderItem, OrderStatus, PaymentStatus } from '../orders/entities/order.entity';
import { ApplyCouponDto, CreateSessionDto } from './dto/checkout.dto';

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
  ) {}

  async getSummary(userId: string) {
    const cart = await this.cartsRepository.findOne({
      where: { userId },
      relations: ['items', 'items.product', 'items.variant', 'items.vendor'],
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Group items by vendor
    const vendorGroups = cart.items.reduce((acc, item) => {
      const vendorId = item.vendorId;
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendor: item.vendor,
          items: [],
          subtotal: 0,
          shipping: 5.00, // Flat rate per vendor for simplicity
        };
      }
      acc[vendorId].items.push({
        id: item.id,
        product: item.product,
        variant: item.variant,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      });
      acc[vendorId].subtotal += Number(item.subtotal);
      return acc;
    }, {} as Record<string, any>);

    const vendorGroupsArray = Object.values(vendorGroups);
    const subtotal = vendorGroupsArray.reduce((sum: number, g: any) => sum + g.subtotal, 0);
    const totalShipping = vendorGroupsArray.reduce((sum: number, g: any) => sum + g.shipping, 0);
    const taxRate = 0.08; // 8% tax for simplicity
    const taxAmount = subtotal * taxRate;
    const total = subtotal + totalShipping + taxAmount;

    return {
      cartId: cart.id,
      vendorGroups: vendorGroupsArray,
      subtotal,
      shipping: totalShipping,
      tax: taxAmount,
      total,
      currency: cart.currency,
    };
  }

  async applyCoupon(userId: string, applyCouponDto: ApplyCouponDto) {
    // For now, implement a simple coupon system
    // In production, you would have a coupons table
    const validCoupons: Record<string, { type: string; value: number }> = {
      'SAVE10': { type: 'percentage', value: 10 },
      'SAVE20': { type: 'percentage', value: 20 },
      'FLAT5': { type: 'fixed', value: 5 },
    };

    const coupon = validCoupons[applyCouponDto.code.toUpperCase()];

    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    const summary = await this.getSummary(userId);
    let discount = 0;

    if (coupon.type === 'percentage') {
      discount = (summary.subtotal * coupon.value) / 100;
    } else {
      discount = coupon.value;
    }

    return {
      ...summary,
      couponCode: applyCouponDto.code.toUpperCase(),
      discount,
      total: summary.total - discount,
    };
  }

  async removeCoupon(userId: string) {
    return this.getSummary(userId);
  }

  async createSession(userId: string, createSessionDto: CreateSessionDto) {
    const cart = await this.cartsRepository.findOne({
      where: { userId },
      relations: ['items', 'items.product', 'items.variant'],
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const summary = await this.getSummary(userId);

    let discount = 0;
    if (createSessionDto.couponCode) {
      const validCoupons: Record<string, { type: string; value: number }> = {
        'SAVE10': { type: 'percentage', value: 10 },
        'SAVE20': { type: 'percentage', value: 20 },
        'FLAT5': { type: 'fixed', value: 5 },
      };
      const coupon = validCoupons[createSessionDto.couponCode.toUpperCase()];
      if (coupon) {
        if (coupon.type === 'percentage') {
          discount = (summary.subtotal * coupon.value) / 100;
        } else {
          discount = coupon.value;
        }
      }
    }

    // Create order
    const order = this.ordersRepository.create({
      userId,
      status: OrderStatus.PENDING,
      total: summary.total - discount,
      currency: summary.currency,
      paymentStatus: PaymentStatus.PENDING,
      shippingAddress: createSessionDto.shippingAddress,
      billingAddress: createSessionDto.billingAddress || createSessionDto.shippingAddress,
      couponCode: createSessionDto.couponCode,
      discountAmount: discount,
      shippingCost: summary.shipping,
      taxAmount: summary.tax,
    });

    const savedOrder = await this.ordersRepository.save(order);

    // Create order items
    const orderItems = cart.items.map((item) =>
      this.orderItemsRepository.create({
        orderId: savedOrder.id,
        productId: item.productId,
        variantId: item.variantId,
        vendorId: item.vendorId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
      }),
    );

    await this.orderItemsRepository.save(orderItems);

    // Clear cart
    await this.cartItemsRepository.delete({ cartId: cart.id });
    await this.cartsRepository.update(cart.id, { total: 0 });

    return {
      orderId: savedOrder.id,
      sessionId: `session_${savedOrder.id}`, // In production, this would be from Stripe
      total: savedOrder.total,
      currency: savedOrder.currency,
      status: savedOrder.status,
    };
  }
}
