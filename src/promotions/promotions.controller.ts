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
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Promotions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/promotions')
export class PromotionsController {
  constructor(private readonly svc: PromotionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all promotions' })
  list() {
    return this.svc.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a promotion' })
  create(@Body() dto: CreatePromotionDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a promotion' })
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a promotion' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
