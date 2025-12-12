import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { ApplyCouponDto, CreateSessionDto } from './dto/checkout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Checkout')
@Controller('checkout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('summary')
  @ApiOperation({ summary: 'Get checkout summary grouped by vendor' })
  @ApiResponse({ status: 200, description: 'Checkout summary retrieved' })
  async getSummary(@CurrentUser('id') userId: string) {
    return this.checkoutService.getSummary(userId);
  }

  @Post('apply-coupon')
  @ApiOperation({ summary: 'Apply promo code to checkout' })
  @ApiResponse({ status: 200, description: 'Coupon applied' })
  @ApiResponse({ status: 400, description: 'Invalid coupon code' })
  async applyCoupon(
    @CurrentUser('id') userId: string,
    @Body() applyCouponDto: ApplyCouponDto,
  ) {
    return this.checkoutService.applyCoupon(userId, applyCouponDto);
  }

  @Post('remove-coupon')
  @ApiOperation({ summary: 'Remove promo code from checkout' })
  @ApiResponse({ status: 200, description: 'Coupon removed' })
  async removeCoupon(@CurrentUser('id') userId: string) {
    return this.checkoutService.removeCoupon(userId);
  }

  @Post('create-session')
  @ApiOperation({ summary: 'Create payment session and order' })
  @ApiResponse({ status: 201, description: 'Payment session created' })
  async createSession(
    @CurrentUser('id') userId: string,
    @Body() createSessionDto: CreateSessionDto,
  ) {
    return this.checkoutService.createSession(userId, createSessionDto);
  }
}
