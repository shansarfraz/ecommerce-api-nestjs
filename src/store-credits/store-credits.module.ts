import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreCreditsService } from './store-credits.service';
import { StoreCreditsController } from './store-credits.controller';
import { StoreCredit } from './entities/store-credit.entity';
import { StoreCreditTransaction } from './entities/store-credit-transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StoreCredit, StoreCreditTransaction])],
  controllers: [StoreCreditsController],
  providers: [StoreCreditsService],
  exports: [StoreCreditsService],
})
export class StoreCreditsModule {}
