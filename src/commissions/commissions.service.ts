import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  CommissionEntry,
  CommissionEntryStatus,
} from './entities/commission-entry.entity';
import { OrderItem } from '../orders/entities/order.entity';
import { Vendor } from '../vendors/entities/vendor.entity';

@Injectable()
export class CommissionsService {
  constructor(
    @InjectRepository(CommissionEntry)
    private readonly entriesRepo: Repository<CommissionEntry>,
  ) {}

  /**
   * Called when an order is paid. Creates an entry per OrderItem in AVAILABLE
   * status, using the vendor's current commission rate.
   */
  async accrueForPaidOrder(
    manager: EntityManager,
    orderId: string,
  ): Promise<void> {
    const items = await manager.getRepository(OrderItem).find({
      where: { orderId },
    });
    if (items.length === 0) return;

    const vendorIds = Array.from(new Set(items.map((i) => i.vendorId)));
    const vendors = await manager.getRepository(Vendor).findByIds(vendorIds);
    const rateByVendor = new Map(
      vendors.map((v) => [v.id, Number(v.commissionRate)]),
    );

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

  /**
   * Reverse all entries for an order (refund / cancel). Already-PAID entries
   * are reversed but cannot be unpaid; this records the negative balance.
   */
  async reverseForOrder(
    manager: EntityManager,
    orderId: string,
  ): Promise<void> {
    await manager
      .getRepository(CommissionEntry)
      .createQueryBuilder()
      .update(CommissionEntry)
      .set({ status: CommissionEntryStatus.REVERSED })
      .where('orderId = :orderId', { orderId })
      .andWhere('status IN (:...statuses)', {
        statuses: [
          CommissionEntryStatus.PENDING,
          CommissionEntryStatus.AVAILABLE,
        ],
      })
      .execute();
  }

  async getBalance(vendorId: string): Promise<{
    available: number;
    pending: number;
    paid: number;
  }> {
    const rows = await this.entriesRepo
      .createQueryBuilder('e')
      .select('e.status', 'status')
      .addSelect('SUM(e.netAmount)', 'sum')
      .where('e.vendorId = :vendorId', { vendorId })
      .groupBy('e.status')
      .getRawMany();

    const out = { available: 0, pending: 0, paid: 0 };
    for (const r of rows) {
      const sum = Number(r.sum) || 0;
      if (r.status === CommissionEntryStatus.AVAILABLE) out.available = sum;
      if (r.status === CommissionEntryStatus.PENDING) out.pending = sum;
      if (r.status === CommissionEntryStatus.PAID) out.paid = sum;
    }
    return out;
  }

  /**
   * Reserve available entries totaling up to `amount` and attach them to a payout.
   * Returns the actual amount reserved (may be less than requested if balance is short).
   */
  async reserveForPayout(
    manager: EntityManager,
    vendorId: string,
    payoutId: string,
    amount: number,
  ): Promise<number> {
    const available = await manager
      .getRepository(CommissionEntry)
      .createQueryBuilder('e')
      .setLock('pessimistic_write')
      .where('e.vendorId = :vendorId', { vendorId })
      .andWhere('e.status = :status', {
        status: CommissionEntryStatus.AVAILABLE,
      })
      .orderBy('e.createdAt', 'ASC')
      .getMany();

    let remaining = amount;
    const toAttach: CommissionEntry[] = [];
    for (const entry of available) {
      if (remaining <= 0) break;
      toAttach.push(entry);
      remaining = round2(remaining - Number(entry.netAmount));
    }

    if (toAttach.length === 0) {
      throw new BadRequestException('No available balance to pay out');
    }

    const reserved = round2(
      toAttach.reduce((s, e) => s + Number(e.netAmount), 0),
    );

    await manager
      .getRepository(CommissionEntry)
      .createQueryBuilder()
      .update(CommissionEntry)
      .set({ status: CommissionEntryStatus.PAID, payoutId })
      .whereInIds(toAttach.map((e) => e.id))
      .execute();

    return reserved;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
