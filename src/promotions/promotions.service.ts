import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  Promotion,
  PromotionRedemption,
  PromotionStatus,
  PromotionType,
} from './entities/promotion.entity';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';

export interface DiscountResult {
  promotion: Promotion;
  discountAmount: number;
  freeShipping: boolean;
}

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionsRepo: Repository<Promotion>,
    @InjectRepository(PromotionRedemption)
    private readonly redemptionsRepo: Repository<PromotionRedemption>,
  ) {}

  async create(dto: CreatePromotionDto): Promise<Promotion> {
    const code = dto.code.toUpperCase();
    const existing = await this.promotionsRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException('Promotion code already exists');
    }
    const promo = this.promotionsRepo.create({
      ...dto,
      code,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
    });
    return this.promotionsRepo.save(promo);
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<Promotion> {
    const promo = await this.promotionsRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Promotion not found');
    Object.assign(promo, {
      ...dto,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : promo.endsAt,
    });
    return this.promotionsRepo.save(promo);
  }

  async findAll() {
    return this.promotionsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findByCode(code: string): Promise<Promotion | null> {
    return this.promotionsRepo.findOne({ where: { code: code.toUpperCase() } });
  }

  async remove(id: string) {
    const r = await this.promotionsRepo.delete(id);
    if (!r.affected) throw new NotFoundException('Promotion not found');
    return { deleted: true };
  }

  async getAnalytics(id: string) {
    const promotion = await this.promotionsRepo.findOne({ where: { id } });
    if (!promotion) throw new NotFoundException('Promotion not found');

    const redemptions = await this.redemptionsRepo.find({
      where: { promotionId: id },
      order: { createdAt: 'DESC' },
    });

    const totalDiscount = redemptions.reduce(
      (sum, r) => sum + Number(r.discountAmount),
      0,
    );

    const dailyUsage: Record<string, number> = {};
    for (const r of redemptions) {
      const day = r.createdAt.toISOString().split('T')[0];
      dailyUsage[day] = (dailyUsage[day] ?? 0) + 1;
    }

    return {
      promotion: {
        id: promotion.id,
        code: promotion.code,
        type: promotion.type,
        value: promotion.value,
        usageCount: promotion.usageCount,
        usageLimit: promotion.usageLimit,
      },
      totalRedemptions: redemptions.length,
      totalDiscountGiven: Math.round(totalDiscount * 100) / 100,
      dailyUsage,
    };
  }

  /**
   * Validate a coupon code against an order context. Returns the resolved
   * discount (and whether shipping is free) without recording usage.
   */
  async preview(input: {
    code: string;
    userId: string;
    subtotal: number;
    vendorIds: string[];
  }): Promise<DiscountResult> {
    const promo = await this.findByCode(input.code);
    if (!promo) throw new BadRequestException('Invalid coupon code');
    return this.validate(promo, input);
  }

  private async validate(
    promo: Promotion,
    input: { userId: string; subtotal: number; vendorIds: string[] },
  ): Promise<DiscountResult> {
    if (promo.status !== PromotionStatus.ACTIVE) {
      throw new BadRequestException('Coupon is not active');
    }
    const now = new Date();
    if (promo.startsAt && promo.startsAt > now) {
      throw new BadRequestException('Coupon is not yet active');
    }
    if (promo.endsAt && promo.endsAt < now) {
      throw new BadRequestException('Coupon has expired');
    }
    if (
      promo.usageLimit !== null &&
      promo.usageCount >= promo.usageLimit
    ) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (Number(promo.minOrderSubtotal) > input.subtotal) {
      throw new BadRequestException(
        `Order subtotal must be at least ${promo.minOrderSubtotal}`,
      );
    }
    if (promo.vendorId && !input.vendorIds.includes(promo.vendorId)) {
      throw new BadRequestException(
        'Coupon does not apply to vendors in this order',
      );
    }
    if (promo.perUserLimit !== null) {
      const userCount = await this.redemptionsRepo.count({
        where: { promotionId: promo.id, userId: input.userId },
      });
      if (userCount >= promo.perUserLimit) {
        throw new BadRequestException(
          'You have already used this coupon the maximum number of times',
        );
      }
    }

    let discountAmount = 0;
    let freeShipping = false;
    switch (promo.type) {
      case PromotionType.PERCENT:
        discountAmount = round2((input.subtotal * Number(promo.value)) / 100);
        break;
      case PromotionType.FIXED:
        discountAmount = Math.min(Number(promo.value), input.subtotal);
        break;
      case PromotionType.FREE_SHIPPING:
        freeShipping = true;
        break;
    }

    return { promotion: promo, discountAmount, freeShipping };
  }

  /**
   * Atomically validate + record redemption inside an active transaction.
   */
  async redeem(
    manager: EntityManager,
    input: {
      code: string;
      userId: string;
      orderId: string;
      subtotal: number;
      vendorIds: string[];
    },
  ): Promise<DiscountResult> {
    const promoRow = await manager
      .getRepository(Promotion)
      .createQueryBuilder('p')
      .setLock('pessimistic_write')
      .where('p.code = :code', { code: input.code.toUpperCase() })
      .getOne();

    if (!promoRow) throw new BadRequestException('Invalid coupon code');

    const result = await this.validate(promoRow, input);

    promoRow.usageCount += 1;
    await manager.getRepository(Promotion).save(promoRow);

    const redemption = manager.getRepository(PromotionRedemption).create({
      promotionId: promoRow.id,
      userId: input.userId,
      orderId: input.orderId,
      discountAmount: result.discountAmount,
    });
    await manager.getRepository(PromotionRedemption).save(redemption);

    return result;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
