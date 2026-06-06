import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationPayload } from '../notifications/notifications.service';
import { OrderItem } from '../orders/entities/order.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { CommissionEntry, CommissionEntryStatus } from '../commissions/entities/commission-entry.entity';
import { ORDER_JOBS_QUEUE, JOB_ACCRUE_COMMISSION, JOB_SEND_NOTIFICATION } from './jobs.constants';

export { JOB_ACCRUE_COMMISSION, JOB_SEND_NOTIFICATION } from './jobs.constants';

@Processor(ORDER_JOBS_QUEUE)
export class OrderJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderJobsProcessor.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    switch (job.name) {
      case JOB_ACCRUE_COMMISSION:
        return this.handleAccrueCommission(job.data);
      case JOB_SEND_NOTIFICATION:
        return this.handleSendNotification(job.data);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private async handleAccrueCommission(data: { orderId: string }) {
    await this.dataSource.transaction(async (manager: EntityManager) => {
      await this.accrueForPaidOrder(manager, data.orderId);
    });
    this.logger.log(`Accrued commissions for order ${data.orderId}`);
  }

  private async accrueForPaidOrder(manager: EntityManager, orderId: string): Promise<void> {
    const items = await manager.getRepository(OrderItem).find({ where: { orderId } });
    if (items.length === 0) return;

    const vendorIds = Array.from(new Set(items.map((i) => i.vendorId)));
    const vendors = await manager.getRepository(Vendor).findByIds(vendorIds);
    const rateByVendor = new Map(vendors.map((v) => [v.id, Number(v.commissionRate)]));

    const entries = items.map((item) => {
      const rate = rateByVendor.get(item.vendorId) ?? 0;
      const gross = Number(item.subtotal);
      const commission = round2((gross * rate) / 100);
      const net = round2(gross - commission);
      return manager.getRepository(CommissionEntry).create({
        vendorId: item.vendorId,
        orderId: item.orderId,
        orderItemId: item.id,
        grossAmount: gross,
        commissionRate: rate,
        commissionAmount: commission,
        netAmount: net,
        status: CommissionEntryStatus.AVAILABLE,
      });
    });

    await manager.getRepository(CommissionEntry).save(entries);
  }

  private async handleSendNotification(data: NotificationPayload) {
    await this.notifications.send(data);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
