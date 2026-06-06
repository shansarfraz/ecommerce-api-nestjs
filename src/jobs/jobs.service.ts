import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ORDER_JOBS_QUEUE, JOB_ACCRUE_COMMISSION, JOB_SEND_NOTIFICATION } from './jobs.constants';
import { NotificationPayload } from '../notifications/notifications.service';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(ORDER_JOBS_QUEUE) private readonly orderQueue: Queue,
  ) {}

  async enqueueAccrueCommission(orderId: string) {
    await this.orderQueue.add(JOB_ACCRUE_COMMISSION, { orderId }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  async enqueueNotification(payload: NotificationPayload) {
    await this.orderQueue.add(JOB_SEND_NOTIFICATION, payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}
