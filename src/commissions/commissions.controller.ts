import { Controller, Get, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CommissionsService } from './commissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';

@ApiTags('Vendor Earnings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
@Controller('vendor/earnings')
export class CommissionsController {
  constructor(
    private readonly svc: CommissionsService,
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
  ) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get current earnings balance' })
  async balance(@CurrentUser('id') userId: string) {
    const v = await this.vendorsRepo.findOne({
      where: { ownerId: userId, status: VendorStatus.APPROVED },
    });
    if (!v) throw new ForbiddenException('You are not an approved vendor');
    return this.svc.getBalance(v.id);
  }
}
