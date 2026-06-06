import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, Payout } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Payout, Order, Vendor]),
    CommissionsModule,
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    StripePaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (config: ConfigService, mock: MockPaymentProvider, stripe: StripePaymentProvider) => {
        return config.get('PAYMENT_DRIVER', 'mock') === 'stripe' ? stripe : mock;
      },
      inject: [ConfigService, MockPaymentProvider, StripePaymentProvider],
    },
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER, MockPaymentProvider],
})
export class PaymentsModule {}
