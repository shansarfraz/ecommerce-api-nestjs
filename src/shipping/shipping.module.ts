import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { ShippingMethod } from './entities/shipping-method.entity';
import { Vendor } from '../vendors/entities/vendor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShippingMethod, Vendor])],
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService],
})
export class ShippingModule {}
