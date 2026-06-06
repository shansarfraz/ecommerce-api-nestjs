import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreCreditsService } from './store-credits.service';
import { IssueStoreCreditDto, RedeemStoreCreditDto, StoreCreditQueryDto } from './dto/store-credit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Store Credits')
@Controller()
export class StoreCreditsController {
  constructor(private readonly service: StoreCreditsService) {}

  // Customer: view own balance + history
  @Get('store-credits/balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my store credit balance' })
  getBalance(@CurrentUser('id') userId: string) {
    return this.service.getBalance(userId);
  }

  @Get('store-credits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my store credits' })
  getMyCredits(@CurrentUser('id') userId: string, @Query() query: StoreCreditQueryDto) {
    return this.service.getCreditsForUser(userId, query);
  }

  @Get('store-credits/transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my store credit transactions' })
  getMyTransactions(@CurrentUser('id') userId: string, @Query() query: StoreCreditQueryDto) {
    return this.service.getTransactionsForUser(userId, query);
  }

  @Post('store-credits/redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redeem store credit against an order' })
  redeem(@CurrentUser('id') userId: string, @Body() dto: RedeemStoreCreditDto) {
    return this.service.redeem(userId, dto);
  }

  // Admin: issue and void
  @Post('admin/store-credits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue store credit to a user' })
  issue(@CurrentUser('id') adminId: string, @Body() dto: IssueStoreCreditDto) {
    return this.service.issue(dto, adminId);
  }

  @Get('admin/store-credits/users/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List store credits for a user (admin)' })
  getUserCredits(@Param('userId') userId: string, @Query() query: StoreCreditQueryDto) {
    return this.service.getCreditsForUser(userId, query);
  }

  @Delete('admin/store-credits/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Void a store credit' })
  void(@Param('id') id: string) {
    return this.service.void(id);
  }
}
