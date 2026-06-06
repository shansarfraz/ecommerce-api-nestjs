import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Vendor, VendorStatus } from './entities/vendor.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  ApplyVendorDto,
  UpdateVendorDto,
  AdminUpdateVendorStatusDto,
  AdminUpdateVendorCommissionDto,
  VendorQueryDto,
} from './dto/vendor.dto';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../payments/providers/payment-provider.interface';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async apply(userId: string, applyVendorDto: ApplyVendorDto) {
    const existingVendor = await this.vendorsRepository.findOne({
      where: { ownerId: userId },
    });

    if (existingVendor) {
      throw new ConflictException('You already have a vendor application');
    }

    const slugExists = await this.vendorsRepository.findOne({
      where: { slug: applyVendorDto.slug },
    });

    if (slugExists) {
      throw new ConflictException('This store slug is already taken');
    }

    const vendor = this.vendorsRepository.create({
      ...applyVendorDto,
      ownerId: userId,
      status: VendorStatus.PENDING,
    });

    return this.vendorsRepository.save(vendor);
  }

  async findMyVendor(userId: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { ownerId: userId },
    });

    if (!vendor) {
      throw new NotFoundException('You do not have a vendor store');
    }

    return vendor;
  }

  async updateMyVendor(userId: string, updateVendorDto: UpdateVendorDto) {
    const vendor = await this.findMyVendor(userId);

    await this.vendorsRepository.update(vendor.id, updateVendorDto);

    return this.vendorsRepository.findOne({ where: { id: vendor.id } });
  }

  async findBySlug(slug: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { slug, status: VendorStatus.APPROVED },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async findAll(query: VendorQueryDto) {
    const { search, status, page = 1, limit = 10 } = query;

    const queryBuilder = this.vendorsRepository.createQueryBuilder('vendor');

    if (search) {
      queryBuilder.andWhere(
        '(vendor.name LIKE :search OR vendor.slug LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('vendor.status = :status', { status });
    }

    const [vendors, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('vendor.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: vendors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const vendor = await this.vendorsRepository.findOne({ where: { id } });

    if (!vendor) {
      throw new NotFoundException('Vendor not found');
    }

    return vendor;
  }

  async updateStatus(id: string, dto: AdminUpdateVendorStatusDto) {
    const vendor = await this.findOne(id);

    await this.vendorsRepository.update(id, { status: dto.status });

    // If approved, add vendor role to user
    if (dto.status === VendorStatus.APPROVED) {
      const user = await this.usersRepository.findOne({
        where: { id: vendor.ownerId },
      });

      if (user && !user.roles.includes(UserRole.VENDOR)) {
        user.roles.push(UserRole.VENDOR);
        await this.usersRepository.save(user);
      }
    }

    return this.findOne(id);
  }

  async updateCommission(id: string, dto: AdminUpdateVendorCommissionDto) {
    await this.findOne(id);

    await this.vendorsRepository.update(id, {
      commissionRate: dto.commissionRate,
    });

    return this.findOne(id);
  }

  async findVendorByUserId(userId: string) {
    return this.vendorsRepository.findOne({
      where: { ownerId: userId, status: VendorStatus.APPROVED },
    });
  }

  async connectStripe(userId: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { ownerId: userId, status: VendorStatus.APPROVED },
      relations: ['owner'],
    });
    if (!vendor) throw new NotFoundException('Approved vendor not found');
    const provider = this.paymentProvider as any;
    if (!provider.createConnectAccount) throw new BadRequestException('Connect not supported by active payment driver');
    const result = await provider.createConnectAccount({ vendorId: vendor.id, email: vendor.owner?.email ?? vendor.businessEmail });
    await this.vendorsRepository.update(vendor.id, { stripeAccountId: result.accountId });
    return { onboardingUrl: result.onboardingUrl, accountId: result.accountId };
  }

  async getStorefront(slug: string) {
    const vendor = await this.vendorsRepository.findOne({
      where: { slug, status: VendorStatus.APPROVED },
    });
    if (!vendor) throw new NotFoundException('Store not found');
    const { commissionRate, ...publicFields } = vendor as any;
    return publicFields;
  }

  async getAnalytics(vendorId: string, days: number = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // GMV: sum of order item subtotals for this vendor in period
    const gmvRow = await this.dataSource.query(
      `SELECT COALESCE(SUM(oi.subtotal), 0) as gmv, COUNT(DISTINCT oi."orderId") as orders
       FROM order_items oi
       JOIN orders o ON o.id = oi."orderId"
       WHERE oi."vendorId" = $1 AND o."paymentStatus" = 'paid' AND o."createdAt" >= $2`,
      [vendorId, since],
    );

    // Top products
    const topProducts = await this.dataSource.query(
      `SELECT oi."productId", p.title, SUM(oi.quantity) as units_sold, SUM(oi.subtotal) as revenue
       FROM order_items oi
       JOIN products p ON p.id = oi."productId"
       JOIN orders o ON o.id = oi."orderId"
       WHERE oi."vendorId" = $1 AND o."paymentStatus" = 'paid' AND o."createdAt" >= $2
       GROUP BY oi."productId", p.title
       ORDER BY revenue DESC
       LIMIT 5`,
      [vendorId, since],
    );

    // Commission summary
    const commRow = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'available' THEN "netAmount" ELSE 0 END), 0) as available,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN "netAmount" ELSE 0 END), 0) as paid,
         COALESCE(SUM("commissionAmount"), 0) as total_commission
       FROM commission_entries
       WHERE "vendorId" = $1 AND "createdAt" >= $2`,
      [vendorId, since],
    );

    return {
      period: { days, since },
      gmv: Number(gmvRow[0]?.gmv ?? 0),
      orders: Number(gmvRow[0]?.orders ?? 0),
      topProducts,
      earnings: {
        available: Number(commRow[0]?.available ?? 0),
        paid: Number(commRow[0]?.paid ?? 0),
        totalCommission: Number(commRow[0]?.total_commission ?? 0),
      },
    };
  }
}
