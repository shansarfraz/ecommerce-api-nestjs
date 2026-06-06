export interface CreateIntentInput {
  orderId: string;
  amount: number;
  currency: string;
  customerEmail?: string;
  metadata?: Record<string, any>;
}

export interface PaymentIntentDto {
  id: string;
  clientSecret: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'failed';
  amount: number;
  currency: string;
}

export interface ConfirmIntentInput {
  intentId: string;
  paymentMethodId?: string;
  outcome?: 'succeed' | 'fail';
}

export interface RefundInput {
  providerIntentId: string;
  amount: number;
  reason?: string;
}

export interface RefundResult {
  id: string;
  status: 'succeeded' | 'failed';
  amount: number;
}

export interface WebhookVerifyInput {
  rawBody: string;
  signature: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: any;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProvider {
  readonly name: string;
  createIntent(input: CreateIntentInput): Promise<PaymentIntentDto>;
  confirmIntent(input: ConfirmIntentInput): Promise<PaymentIntentDto>;
  refund(input: RefundInput): Promise<RefundResult>;
  verifyWebhook(input: WebhookVerifyInput): WebhookEvent;
}
