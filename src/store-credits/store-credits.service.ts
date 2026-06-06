import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StoreCredit, StoreCreditStatus, StoreCreditType } from './entities/store-credit.entity';
import { StoreCreditTransaction, StoreCreditTxType } from './entities/store-credit-transaction.entity';
import { IssueStoreCreditDto, RedeemStoreCreditDto, StoreCreditQueryDto } from './dto/store-credit.dto';

@Injectable()
export class StoreCreditsService {
  constructor(
    @InjectRepository(StoreCredit)
    private readonly creditRepo: Repository<StoreCredit>,
    @InjectRepository(StoreCreditTransaction)
    private readonly txRepo: Repository<StoreCreditTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  async getBalance(userId: string): Promise<{ available: number; currency: string }> {
    const now = new Date();
    const credits = await this.creditRepo
      .createQueryBuilder('c')
      .where('c.userId = :userId', { userId })
      .andWhere('c.status = :status', { status: StoreCreditStatus.ACTIVE })
      .andWhere('(c.expiresAt IS NULL OR c.expiresAt > :now)', { now })
      .getMany();

    const available = credits.reduce((sum, c) => {
      return sum + (Number(c.amount) - Number(c.usedAmount));
    }, 0);

    return { available: round2(available), currency: 'USD' };
  }

  async issue(dto: IssueStoreCreditDto, issuedByAdminId?: string): Promise<StoreCredit> {
    const credit = this.creditRepo.create({
      userId: dto.userId,
      amount: dto.amount,
      usedAmount: 0,
      type: dto.type ?? StoreCreditType.ISSUED,
      status: StoreCreditStatus.ACTIVE,
      reason: dto.reason,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      issuedByAdminId,
    });
    const saved = await this.creditRepo.save(credit);

    await this.txRepo.save(this.txRepo.create({
      creditId: saved.id,
      userId: dto.userId,
      txType: StoreCreditTxType.CREDIT,
      amount: dto.amount,
      note: dto.reason ?? 'Store credit issued',
    }));

    return saved;
  }

  async redeem(userId: string, dto: RedeemStoreCreditDto): Promise<{ applied: number }> {
    return this.dataSource.transaction(async (manager) => {
      const now = new Date();
      const credits = await manager
        .getRepository(StoreCredit)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.userId = :userId', { userId })
        .andWhere('c.status = :status', { status: StoreCreditStatus.ACTIVE })
        .andWhere('(c.expiresAt IS NULL OR c.expiresAt > :now)', { now })
        .orderBy('c.createdAt', 'ASC')
        .getMany();

      let remaining = dto.amount;
      let totalApplied = 0;

      for (const credit of credits) {
        if (remaining <= 0) break;
        const available = round2(Number(credit.amount) - Number(credit.usedAmount));
        if (available <= 0) continue;

        const toUse = Math.min(available, remaining);
        const newUsed = round2(Number(credit.usedAmount) + toUse);
        const fullyUsed = newUsed >= Number(credit.amount) - 0.001;

        await manager.getRepository(StoreCredit).update(credit.id, {
          usedAmount: newUsed,
          status: fullyUsed ? StoreCreditStatus.USED : StoreCreditStatus.ACTIVE,
        });

        await manager.getRepository(StoreCreditTransaction).save(
          manager.getRepository(StoreCreditTransaction).create({
            creditId: credit.id,
            userId,
            txType: StoreCreditTxType.DEBIT,
            amount: toUse,
            orderId: dto.orderId,
            note: `Applied to order ${dto.orderId}`,
          }),
        );

        totalApplied = round2(totalApplied + toUse);
        remaining = round2(remaining - toUse);
      }

      if (totalApplied === 0) {
        throw new BadRequestException('No available store credit balance');
      }

      return { applied: totalApplied };
    });
  }

  async void(creditId: string): Promise<StoreCredit> {
    const credit = await this.creditRepo.findOne({ where: { id: creditId } });
    if (!credit) throw new NotFoundException('Store credit not found');
    if (credit.status !== StoreCreditStatus.ACTIVE) {
      throw new BadRequestException('Only active credits can be voided');
    }
    await this.creditRepo.update(creditId, { status: StoreCreditStatus.VOIDED });
    return this.creditRepo.findOne({ where: { id: creditId } });
  }

  async getCreditsForUser(userId: string, query: StoreCreditQueryDto) {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await this.creditRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getTransactionsForUser(userId: string, query: StoreCreditQueryDto) {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await this.txRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async issueRefundCredit(userId: string, orderId: string, amount: number): Promise<StoreCredit> {
    return this.issue({
      userId,
      amount,
      type: StoreCreditType.REFUND,
      reason: `Refund credit for order ${orderId}`,
    });
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
