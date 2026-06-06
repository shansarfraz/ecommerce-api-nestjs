import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  ShippingMethod,
  ShippingCalculator,
} from './entities/shipping-method.entity';
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from './dto/shipping.dto';

export interface ShippingContext {
  vendorId: string;
  subtotal: number;
  itemCount: number;
  country?: string;
}

export interface ShippingQuote {
  methodId: string | null;
  methodName: string;
  amount: number;
}

@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(ShippingMethod)
    private readonly repo: Repository<ShippingMethod>,
  ) {}

  async createForVendor(
    vendorId: string,
    dto: CreateShippingMethodDto,
  ): Promise<ShippingMethod> {
    const m = this.repo.create({
      ...dto,
      vendorId,
      countries: (dto.countries ?? []).map((c) => c.toUpperCase()),
    });
    return this.repo.save(m);
  }

  async updateForVendor(
    vendorId: string,
    id: string,
    dto: UpdateShippingMethodDto,
  ): Promise<ShippingMethod> {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Shipping method not found');
    if (m.vendorId !== vendorId) {
      throw new ForbiddenException('Not your shipping method');
    }
    Object.assign(m, dto);
    return this.repo.save(m);
  }

  async listForVendor(vendorId: string): Promise<ShippingMethod[]> {
    return this.repo.find({
      where: { vendorId },
      order: { position: 'ASC' },
    });
  }

  async deleteForVendor(vendorId: string, id: string) {
    const m = await this.repo.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Shipping method not found');
    if (m.vendorId !== vendorId) {
      throw new ForbiddenException('Not your shipping method');
    }
    await this.repo.delete(id);
    return { deleted: true };
  }

  /**
   * Get the best-priced active shipping quote for a vendor group.
   * Falls back to a platform-wide default ($5 flat) if vendor has no methods.
   */
  async quote(ctx: ShippingContext): Promise<ShippingQuote> {
    const country = ctx.country?.toUpperCase();
    const candidates = await this.repo.find({
      where: { vendorId: ctx.vendorId, isActive: true },
    });

    const filtered = candidates.filter(
      (m) =>
        !m.countries ||
        m.countries.length === 0 ||
        (country && m.countries.includes(country)),
    );

    if (filtered.length === 0) {
      return {
        methodId: null,
        methodName: 'Standard',
        amount: 5.0,
      };
    }

    const quotes = filtered.map((m) => ({
      methodId: m.id,
      methodName: m.name,
      amount: this.priceFor(m, ctx),
    }));

    quotes.sort((a, b) => a.amount - b.amount);
    return quotes[0];
  }

  private priceFor(m: ShippingMethod, ctx: ShippingContext): number {
    const base = Number(m.baseAmount);
    switch (m.calculator) {
      case ShippingCalculator.FLAT:
        return base;
      case ShippingCalculator.PER_ITEM:
        return round2(base * ctx.itemCount);
      case ShippingCalculator.FREE_OVER:
        return ctx.subtotal >= Number(m.freeOverSubtotal) ? 0 : base;
      default:
        return base;
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
