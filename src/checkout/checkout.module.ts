import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { Cart, CartItem } from '../cart/entities/cart.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { Shipment } from '../orders/entities/shipment.entity';
import { PromotionsModule } from '../promotions/promotions.module';
import { ShippingModule } from '../shipping/shipping.module';
import { TaxModule } from '../tax/tax.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cart, CartItem, Order, OrderItem, Shipment]),
    PromotionsModule,
    ShippingModule,
    TaxModule,
    PaymentsModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
