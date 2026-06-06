import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductVariant, ProductImage } from './entities/product.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant, ProductImage, Vendor]),
    UploadsModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
