import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderItem } from './entities/order.entity';
import { Shipment } from './entities/shipment.entity';
import { ReturnRequest } from './entities/return-request.entity';
import { OrderAdjustment } from './entities/order-adjustment.entity';
import { OrderTimelineEvent } from './entities/order-timeline-event.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { Product, ProductVariant } from '../products/entities/product.entity';
import { CommissionsModule } from '../commissions/commissions.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order, OrderItem, Shipment, ReturnRequest,
      OrderAdjustment, OrderTimelineEvent,
      Vendor, Product, ProductVariant,
    ]),
    CommissionsModule,
    PaymentsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
