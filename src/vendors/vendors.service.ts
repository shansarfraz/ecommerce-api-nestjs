import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor, VendorStatus } from './entities/vendor.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  ApplyVendorDto,
  UpdateVendorDto,
  AdminUpdateVendorStatusDto,
  AdminUpdateVendorCommissionDto,
  VendorQueryDto,
} from './dto/vendor.dto';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
}
