import { Injectable, UnauthorizedException } from '@nestjs/common';
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

/**
 * Stripe-shaped mock payment provider. Mimics PaymentIntent / refund / webhook
 * signature flows so a real Stripe driver can drop in by implementing the same
 * interface. No external network calls.
 */
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  // In-memory state (process-local). Acceptable for the mock driver.
  private readonly intents = new Map<
    string,
    {
      orderId: string;
      amount: number;
      currency: string;
      status: PaymentIntentDto['status'];
      clientSecret: string;
    }
  >();

  constructor(private readonly config: ConfigService) {}

  private get webhookSecret(): string {
    return this.config.get<string>('MOCK_WEBHOOK_SECRET', 'whsec_mock_dev');
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntentDto> {
    const id = `pi_mock_${crypto.randomBytes(8).toString('hex')}`;
    const clientSecret = `${id}_secret_${crypto.randomBytes(6).toString('hex')}`;
    this.intents.set(id, {
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      status: 'requires_confirmation',
      clientSecret,
    });
    return {
      id,
      clientSecret,
      status: 'requires_confirmation',
      amount: input.amount,
      currency: input.currency,
    };
  }

  async confirmIntent(input: ConfirmIntentInput): Promise<PaymentIntentDto> {
    const intent = this.intents.get(input.intentId);
    if (!intent) {
      throw new Error('Intent not found');
    }
    intent.status = input.outcome === 'fail' ? 'failed' : 'succeeded';
    return {
      id: input.intentId,
      clientSecret: intent.clientSecret,
      status: intent.status,
      amount: intent.amount,
      currency: intent.currency,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      id: `re_mock_${crypto.randomBytes(6).toString('hex')}`,
      status: 'succeeded',
      amount: input.amount,
    };
  }

  async createConnectAccount(input: { vendorId: string; email: string }): Promise<{ accountId: string; onboardingUrl: string }> {
    const accountId = `acct_mock_${crypto.randomBytes(8).toString('hex')}`;
    return { accountId, onboardingUrl: `http://localhost:3000/mock-connect-onboarding?account=${accountId}` };
  }

  async transferToVendor(input: { stripeAccountId: string; amount: number; currency: string; payoutId: string }): Promise<{ transferId: string }> {
    return { transferId: `tr_mock_${crypto.randomBytes(8).toString('hex')}` };
  }

  /**
   * Verify an HMAC-SHA256 signature in the form `t=<unix>,v1=<hex>`,
   * computed over `<unix>.<rawBody>` with the shared webhook secret.
   * Mirrors Stripe's scheme.
   */
  verifyWebhook(input: WebhookVerifyInput): WebhookEvent {
    if (!input.signature) {
      throw new UnauthorizedException('Missing signature');
    }
    const parts = Object.fromEntries(
      input.signature.split(',').map((s) => s.split('=') as [string, string]),
    );
    if (!parts.t || !parts.v1) {
      throw new UnauthorizedException('Malformed signature');
    }
    const payload = `${parts.t}.${input.rawBody}`;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    const provided = Buffer.from(parts.v1, 'hex');
    const exp = Buffer.from(expected, 'hex');
    if (
      provided.length !== exp.length ||
      !crypto.timingSafeEqual(provided, exp)
    ) {
      throw new UnauthorizedException('Invalid signature');
    }
    const ageMs = Date.now() - Number(parts.t) * 1000;
    if (Math.abs(ageMs) > 5 * 60 * 1000) {
      throw new UnauthorizedException('Signature timestamp out of range');
    }
    const event = JSON.parse(input.rawBody);
    return event;
  }

  /**
   * Test helper — sign a payload for the mock driver. Exposed so tests and
   * dev tooling can produce valid webhooks without external services.
   */
  signPayload(rawBody: string, timestamp: number = Math.floor(Date.now() / 1000)): string {
    const payload = `${timestamp}.${rawBody}`;
    const sig = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    return `t=${timestamp},v1=${sig}`;
  }
}
