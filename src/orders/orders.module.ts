import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order, OrderItem } from './entities/order.entity';
import { ReturnRequest } from './entities/return-request.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { Product, ProductVariant } from '../products/entities/product.entity';
import { CommissionsModule } from '../commissions/commissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, ReturnRequest, Vendor, Product, ProductVariant]),
    CommissionsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
