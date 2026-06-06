import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderJobsProcessor } from './order-jobs.processor';
import { JobsService } from './jobs.service';
import { ORDER_JOBS_QUEUE } from './jobs.constants';

export { ORDER_JOBS_QUEUE } from './jobs.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: ORDER_JOBS_QUEUE }),
  ],
  providers: [OrderJobsProcessor, JobsService],
  exports: [BullModule, JobsService],
})
export class JobsModule {}
