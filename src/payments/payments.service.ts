import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Payment,
  Payout,
  PaymentProviderStatus,
  PayoutStatus,
} from './entities/payment.entity';
import { Order, PaymentStatus } from '../orders/entities/order.entity';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';
import {
  RefundDto,
  PayoutRequestDto,
  PayoutQueryDto,
} from './dto/payment.dto';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
  WebhookEvent,
} from './providers/payment-provider.interface';
import { CommissionsService } from '../commissions/commissions.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private paymentsRepository: Repository<Payment>,
    @InjectRepository(Payout)
    private payoutsRepository: Repository<Payout>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: PaymentProvider,
    private readonly dataSource: DataSource,
    private readonly commissions: CommissionsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Called by the checkout flow once an Order is created. Creates a provider
   * payment intent and a Payment row tracking it.
   */
  async createIntentForOrder(order: Order, customerEmail?: string) {
    const intent = await this.provider.createIntent({
      orderId: order.id,
      amount: Number(order.total),
      currency: order.currency,
      customerEmail,
    });

    const payment = this.paymentsRepository.create({
      orderId: order.id,
      provider: this.provider.name,
      providerIntentId: intent.id,
      providerSessionId: intent.id,
      amount: Number(order.total),
      status: PaymentProviderStatus.PENDING,
      metadata: { clientSecret: intent.clientSecret },
    });
    await this.paymentsRepository.save(payment);

    return {
      paymentId: payment.id,
      providerIntentId: intent.id,
      clientSecret: intent.clientSecret,
      status: intent.status,
    };
  }

  /**
   * Webhook entry. Verifies signature against the configured provider, then
   * dispatches by event type.
   */
  async handleWebhook(rawBody: string, signature: string) {
    let event: WebhookEvent;
    try {
      event = this.provider.verifyWebhook({ rawBody, signature });
    } catch (e) {
      this.logger.warn(`Rejected webhook: ${e}`);
      throw e;
    }

    switch (event.type) {
      case 'payment.succeeded':
        await this.markPaid(event.data?.intentId);
        break;
      case 'payment.failed':
        await this.markFailed(event.data?.intentId);
        break;
      case 'refund.succeeded':
        // Inbound async refund confirmations; ignored for now since refund()
        // is synchronous in the mock driver.
        break;
      default:
        this.logger.log(`Unhandled webhook type: ${event.type}`);
    }
    return { received: true };
  }

  private async markPaid(providerIntentId: string) {
    if (!providerIntentId) return;
    await this.dataSource.transaction(async (manager) => {
      const payment = await manager
        .getRepository(Payment)
        .findOne({ where: { providerIntentId } });
      if (!payment || payment.status === PaymentProviderStatus.COMPLETED) {
        return;
      }
      payment.status = PaymentProviderStatus.COMPLETED;
      await manager.getRepository(Payment).save(payment);

      await manager
        .getRepository(Order)
        .update(payment.orderId, { paymentStatus: PaymentStatus.PAID });

      await this.commissions.accrueForPaidOrder(manager, payment.orderId);

      const order = await manager
        .getRepository(Order)
        .findOne({ where: { id: payment.orderId }, relations: ['user'] });
      if (order?.user?.email) {
        await this.notifications.send({
          template: 'order.paid',
          to: order.user.email,
          subject: `Payment received for order ${order.id}`,
          data: { orderId: order.id, amount: order.total },
        });
      }
    });
  }

  private async markFailed(providerIntentId: string) {
    if (!providerIntentId) return;
    const payment = await this.paymentsRepository.findOne({
      where: { providerIntentId },
    });
    if (!payment) return;
    payment.status = PaymentProviderStatus.FAILED;
    await this.paymentsRepository.save(payment);
    await this.ordersRepository.update(payment.orderId, {
      paymentStatus: PaymentStatus.FAILED,
    });
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
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.paymentStatus !== PaymentStatus.PAID &&
      order.paymentStatus !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException('Order has not been paid');
    }

    const payment = await this.paymentsRepository.findOne({
      where: { orderId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const orderTotal = Number(order.total);
    const alreadyRefunded = Number(payment.refundedAmount);
    const requested = dto.amount ?? orderTotal - alreadyRefunded;
    const refundable = orderTotal - alreadyRefunded;
    if (requested <= 0 || requested > refundable) {
      throw new BadRequestException(
        `Refund amount must be between 0 and ${refundable}`,
      );
    }

    const result = await this.provider.refund({
      providerIntentId: payment.providerIntentId,
      amount: requested,
      reason: dto.reason,
    });
    if (result.status !== 'succeeded') {
      throw new BadRequestException('Refund failed at provider');
    }

    await this.dataSource.transaction(async (manager) => {
      const newRefunded = round2(alreadyRefunded + requested);
      const fullyRefunded = newRefunded >= orderTotal - 0.005;

      await manager.getRepository(Payment).update(payment.id, {
        refundedAmount: newRefunded,
        status: fullyRefunded
          ? PaymentProviderStatus.REFUNDED
          : PaymentProviderStatus.PARTIALLY_REFUNDED,
      });
      await manager.getRepository(Order).update(orderId, {
        paymentStatus: fullyRefunded
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED,
      });

      if (fullyRefunded) {
        await this.commissions.reverseForOrder(manager, orderId);
      }
    });

    return {
      orderId,
      refundAmount: requested,
      status:
        round2(alreadyRefunded + requested) >= orderTotal - 0.005
          ? 'refunded'
          : 'partially_refunded',
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
    const balance = await this.commissions.getBalance(vendorId);
    if (balance.available <= 0) {
      throw new BadRequestException('No available balance to pay out');
    }

    return this.dataSource.transaction(async (manager) => {
      const payout = manager.getRepository(Payout).create({
        vendorId,
        amount: 0,
        status: PayoutStatus.PENDING,
        periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        periodEnd: new Date(),
        details: { notes: dto.notes ?? null },
      });
      const saved = await manager.getRepository(Payout).save(payout);

      const reserved = await this.commissions.reserveForPayout(
        manager,
        vendorId,
        saved.id,
        balance.available,
      );
      saved.amount = reserved;
      return manager.getRepository(Payout).save(saved);
    });
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
