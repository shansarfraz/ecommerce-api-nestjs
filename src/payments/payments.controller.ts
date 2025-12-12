import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RefundDto, PayoutRequestDto, PayoutQueryDto, WebhookDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('payments/webhook')
  @ApiOperation({ summary: 'Payment provider webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async webhook(@Body() dto: WebhookDto) {
    return this.paymentsService.handleWebhook(dto);
  }

  @Get('payments/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment info for order' })
  @ApiResponse({ status: 200, description: 'Payment info retrieved' })
  async getPayment(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentForOrder(orderId);
  }

  @Post('payments/:orderId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create refund' })
  @ApiResponse({ status: 200, description: 'Refund processed' })
  async refund(@Param('orderId') orderId: string, @Body() dto: RefundDto) {
    return this.paymentsService.refund(orderId, dto);
  }

  // Vendor payout endpoints
  @Get('vendor/payouts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get vendor payout history' })
  @ApiResponse({ status: 200, description: 'Payouts retrieved' })
  async getVendorPayouts(
    @CurrentUser('id') userId: string,
    @Query() query: PayoutQueryDto,
  ) {
    const vendor = await this.paymentsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.paymentsService.getVendorPayouts(vendor.id, query);
  }

  @Post('vendor/payouts/request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request payout' })
  @ApiResponse({ status: 201, description: 'Payout requested' })
  async requestPayout(
    @CurrentUser('id') userId: string,
    @Body() dto: PayoutRequestDto,
  ) {
    const vendor = await this.paymentsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.paymentsService.requestPayout(vendor.id, dto);
  }
}
