import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TaxZone } from './entities/tax-zone.entity';
import { CreateTaxZoneDto, UpdateTaxZoneDto } from './dto/tax.dto';

export interface Address {
  country?: string;
  state?: string;
}

@Injectable()
export class TaxService {
  constructor(
    @InjectRepository(TaxZone) private readonly repo: Repository<TaxZone>,
  ) {}

  async create(dto: CreateTaxZoneDto): Promise<TaxZone> {
    const dup = await this.repo.findOne({
      where: {
        country: dto.country.toUpperCase(),
        state: dto.state ? dto.state.toUpperCase() : IsNull() as any,
      },
    });
    if (dup) throw new ConflictException('Tax zone already exists');
    const entity = this.repo.create({
      ...dto,
      country: dto.country.toUpperCase(),
      state: dto.state ? dto.state.toUpperCase() : null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateTaxZoneDto): Promise<TaxZone> {
    const tz = await this.repo.findOne({ where: { id } });
    if (!tz) throw new NotFoundException('Tax zone not found');
    Object.assign(tz, dto);
    return this.repo.save(tz);
  }

  async list(): Promise<TaxZone[]> {
    return this.repo.find({ order: { country: 'ASC', state: 'ASC' } });
  }

  async remove(id: string) {
    const r = await this.repo.delete(id);
    if (!r.affected) throw new NotFoundException('Tax zone not found');
    return { deleted: true };
  }

  /**
   * Resolve the tax rate for an address. Picks the most specific match:
   * country+state > country only. Returns 0 if no zone matches.
   */
  async resolveRate(address: Address): Promise<number> {
    if (!address?.country) return 0;
    const country = address.country.toUpperCase();
    const state = address.state?.toUpperCase();

    if (state) {
      const exact = await this.repo.findOne({
        where: { country, state, isActive: true },
      });
      if (exact) return Number(exact.rate);
    }
    const fallback = await this.repo.findOne({
      where: { country, state: IsNull() as any, isActive: true },
    });
    return fallback ? Number(fallback.rate) : 0;
  }

  /**
   * Calculate tax owed on a taxable subtotal for an address.
   */
  async calculate(taxableAmount: number, address: Address): Promise<{
    rate: number;
    amount: number;
  }> {
    const rate = await this.resolveRate(address);
    const amount = round2(taxableAmount * rate);
    return { rate, amount };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
