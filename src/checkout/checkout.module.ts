import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { Cart, CartItem } from '../cart/entities/cart.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cart, CartItem, Order, OrderItem])],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
