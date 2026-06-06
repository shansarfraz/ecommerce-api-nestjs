import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, Payout } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { MockPaymentProvider } from './providers/mock-payment.provider';
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
    {
      provide: PAYMENT_PROVIDER,
      useExisting: MockPaymentProvider,
    },
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER, MockPaymentProvider],
})
export class PaymentsModule {}
