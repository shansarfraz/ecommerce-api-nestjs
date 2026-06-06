import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TaxService } from './tax.service';
import { CreateTaxZoneDto, UpdateTaxZoneDto } from './dto/tax.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Tax')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/tax-zones')
export class TaxController {
  constructor(private readonly svc: TaxService) {}

  @Get()
  @ApiOperation({ summary: 'List tax zones' })
  list() {
    return this.svc.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create tax zone' })
  create(@Body() dto: CreateTaxZoneDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tax zone' })
  update(@Param('id') id: string, @Body() dto: UpdateTaxZoneDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete tax zone' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
