import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxService } from './tax.service';
import { TaxController } from './tax.controller';
import { TaxZone } from './entities/tax-zone.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TaxZone])],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
