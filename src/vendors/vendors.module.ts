import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { Vendor } from './entities/vendor.entity';
import { User } from '../users/entities/user.entity';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [TypeOrmModule.forFeature([Vendor, User]), PaymentsModule],
  controllers: [VendorsController],
  providers: [VendorsService],
  exports: [VendorsService],
})
export class VendorsModule {}
