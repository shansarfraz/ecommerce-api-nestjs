import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  CreateIntentInput,
  PaymentIntentDto,
  ConfirmIntentInput,
  RefundInput,
  RefundResult,
  WebhookVerifyInput,
  WebhookEvent,
} from './payment-provider.interface';

// Stripe SDK is loaded dynamically so the app boots without it when using
// the mock driver. When PAYMENT_DRIVER=stripe the SDK must be installed.
@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  private readonly logger = new Logger(StripePaymentProvider.name);
  private stripe: any;

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    if (key) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Stripe = require('stripe');
        this.stripe = new Stripe(key, { apiVersion: '2024-06-20' });
      } catch {
        this.logger.warn('stripe package not installed — StripePaymentProvider will throw on use');
      }
    }
  }

  private get webhookSecret(): string {
    return this.config.get<string>('STRIPE_WEBHOOK_SECRET', '');
  }

  private assertStripe() {
    if (!this.stripe) throw new Error('Stripe SDK not initialised — set STRIPE_SECRET_KEY and install the stripe package');
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntentDto> {
    this.assertStripe();
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(input.amount * 100),
      currency: input.currency.toLowerCase(),
      receipt_email: input.customerEmail,
      metadata: { orderId: input.orderId, ...input.metadata },
    });
    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status === 'succeeded' ? 'succeeded' : 'requires_confirmation',
      amount: input.amount,
      currency: input.currency,
    };
  }

  async confirmIntent(input: ConfirmIntentInput): Promise<PaymentIntentDto> {
    this.assertStripe();
    const intent = await this.stripe.paymentIntents.confirm(input.intentId, {
      payment_method: input.paymentMethodId,
    });
    return {
      id: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status === 'succeeded' ? 'succeeded' : 'requires_confirmation',
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.assertStripe();
    const refund = await this.stripe.refunds.create({
      payment_intent: input.providerIntentId,
      amount: Math.round(input.amount * 100),
      reason: (input.reason as any) ?? 'requested_by_customer',
    });
    return {
      id: refund.id,
      status: refund.status === 'succeeded' ? 'succeeded' : 'failed',
      amount: refund.amount / 100,
    };
  }

  async createConnectAccount(input: { vendorId: string; email: string; }): Promise<{ accountId: string; onboardingUrl: string }> {
    this.assertStripe();
    const account = await this.stripe.accounts.create({
      type: 'express',
      email: input.email,
      metadata: { vendorId: input.vendorId },
    });
    const link = await this.stripe.accountLinks.create({
      account: account.id,
      refresh_url: this.config.get('STRIPE_CONNECT_REFRESH_URL', 'http://localhost:3000/vendor/connect/refresh'),
      return_url: this.config.get('STRIPE_CONNECT_RETURN_URL', 'http://localhost:3000/vendor/connect/return'),
      type: 'account_onboarding',
    });
    return { accountId: account.id, onboardingUrl: link.url };
  }

  async transferToVendor(input: { stripeAccountId: string; amount: number; currency: string; payoutId: string; }): Promise<{ transferId: string }> {
    this.assertStripe();
    const transfer = await this.stripe.transfers.create({
      amount: Math.round(input.amount * 100),
      currency: input.currency.toLowerCase(),
      destination: input.stripeAccountId,
      metadata: { payoutId: input.payoutId },
    });
    return { transferId: transfer.id };
  }

  verifyWebhook(input: WebhookVerifyInput): WebhookEvent {
    if (!this.webhookSecret) throw new UnauthorizedException('Stripe webhook secret not configured');
    this.assertStripe();
    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(
        input.rawBody,
        input.signature,
        this.webhookSecret,
      );
    } catch {
      throw new UnauthorizedException('Invalid Stripe webhook signature');
    }
    // Normalise to our internal event shape
    const type = event.type === 'payment_intent.succeeded'
      ? 'payment.succeeded'
      : event.type === 'payment_intent.payment_failed'
      ? 'payment.failed'
      : event.type;
    return {
      id: event.id,
      type,
      data: { intentId: event.data?.object?.id },
    };
  }
}
