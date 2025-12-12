import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, Payout, PaymentProviderStatus, PayoutStatus } from './entities/payment.entity';
import { Order, PaymentStatus } from '../orders/entities/order.entity';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';
import { RefundDto, PayoutRequestDto, PayoutQueryDto, WebhookDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
  ) {}

  async handleWebhook(dto: WebhookDto) {
    // In production, verify webhook signature
    // Process different event types
    switch (dto.type) {
      case 'payment.success':
        await this.handlePaymentSuccess(dto.data);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(dto.data);
        break;
      default:
        console.log(`Unhandled webhook type: ${dto.type}`);
    }

    return { received: true };
  }

  private async handlePaymentSuccess(data: any) {
    const payment = await this.paymentsRepository.findOne({
      where: { providerSessionId: data.sessionId },
    });

    if (payment) {
      await this.paymentsRepository.update(payment.id, {
        status: PaymentProviderStatus.COMPLETED,
      });

      await this.ordersRepository.update(payment.orderId, {
        paymentStatus: PaymentStatus.PAID,
      });
    }
  }

  private async handlePaymentFailed(data: any) {
    const payment = await this.paymentsRepository.findOne({
      where: { providerSessionId: data.sessionId },
    });

    if (payment) {
      await this.paymentsRepository.update(payment.id, {
        status: PaymentProviderStatus.FAILED,
      });

      await this.ordersRepository.update(payment.orderId, {
        paymentStatus: PaymentStatus.FAILED,
      });
    }
  }

  async getPaymentForOrder(orderId: string) {
    const payment = await this.paymentsRepository.findOne({
      where: { orderId },
      relations: ['order'],
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this order');
    }

    return payment;
  }

  async refund(orderId: string, dto: RefundDto) {
    const order = await this.ordersRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException('Order has not been paid');
    }

    const refundAmount = dto.amount || order.total;

    // In production, process refund with payment provider
    // For now, just update status
    const isPartial = dto.amount && dto.amount < Number(order.total);

    await this.ordersRepository.update(orderId, {
      paymentStatus: isPartial
        ? PaymentStatus.PARTIALLY_REFUNDED
        : PaymentStatus.REFUNDED,
    });

    return {
      orderId,
      refundAmount,
      status: isPartial ? 'partially_refunded' : 'refunded',
      reason: dto.reason,
    };
  }

  // Vendor payout methods
  async getVendorPayouts(vendorId: string, query: PayoutQueryDto) {
    const { page = 1, limit = 10 } = query;

    const [payouts, total] = await this.payoutsRepository.findAndCount({
      where: { vendorId },
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: payouts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async requestPayout(vendorId: string, dto: PayoutRequestDto) {
    // In production, calculate pending balance from orders
    // For now, create a sample payout request
    const payout = this.payoutsRepository.create({
      vendorId,
      amount: 100, // In production, calculate from sales
      status: PayoutStatus.PENDING,
      periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      periodEnd: new Date(),
      details: { notes: dto.notes },
    });

    return this.payoutsRepository.save(payout);
  }

  async getVendorByUserId(userId: string) {
    return this.vendorsRepository.findOne({
      where: { ownerId: userId, status: VendorStatus.APPROVED },
    });
  }

  // Admin payout methods
  async getAllPayouts(query: PayoutQueryDto) {
    const { page = 1, limit = 10 } = query;

    const [payouts, total] = await this.payoutsRepository.findAndCount({
      relations: ['vendor'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: payouts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
