import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import {
  CreateShippingMethodDto,
  UpdateShippingMethodDto,
} from './dto/shipping.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';

@ApiTags('Shipping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@Controller('vendor/shipping-methods')
export class ShippingController {
  constructor(
    private readonly svc: ShippingService,
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
  ) {}

  private async vendorId(userId: string): Promise<string> {
    const v = await this.vendorsRepo.findOne({
      where: { ownerId: userId, status: VendorStatus.APPROVED },
    });
    if (!v) throw new ForbiddenException('You are not an approved vendor');
    return v.id;
  }

  @Get()
  @ApiOperation({ summary: 'List my shipping methods' })
  async list(@CurrentUser('id') userId: string) {
    return this.svc.listForVendor(await this.vendorId(userId));
  }

  @Post()
  @ApiOperation({ summary: 'Create shipping method' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShippingMethodDto,
  ) {
    return this.svc.createForVendor(await this.vendorId(userId), dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update shipping method' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateShippingMethodDto,
  ) {
    return this.svc.updateForVendor(await this.vendorId(userId), id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete shipping method' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.svc.deleteForVendor(await this.vendorId(userId), id);
  }
}
