import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import {
  RefundDto,
  PayoutRequestDto,
  PayoutQueryDto,
  ConfirmIntentDto,
  SavePaymentMethodDto,
} from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from './providers/payment-provider.interface';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    @Inject(PAYMENT_PROVIDER)
    private readonly provider: PaymentProvider,
  ) {}

  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Payment provider webhook (signed)' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async webhook(
    @Req() req: Request,
    @Headers('x-payment-signature') signature: string,
  ) {
    const raw =
      (req as any).rawBody?.toString('utf8') ??
      JSON.stringify((req as any).body ?? {});
    return this.paymentsService.handleWebhook(raw, signature);
  }

  @Post('payments/intents/:intentId/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a payment intent (mock driver)' })
  async confirm(
    @Param('intentId') intentId: string,
    @Body() dto: ConfirmIntentDto,
  ) {
    return this.provider.confirmIntent({
      intentId,
      outcome: dto.outcome ?? 'succeed',
    });
  }

  @Get('payments/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment info for order' })
  async getPayment(@Param('orderId') orderId: string) {
    return this.paymentsService.getPaymentForOrder(orderId);
  }

  @Post('payments/:orderId/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create refund' })
  async refund(@Param('orderId') orderId: string, @Body() dto: RefundDto) {
    return this.paymentsService.refund(orderId, dto);
  }

  @Get('vendor/payouts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get vendor payout history' })
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

  @Patch('admin/payouts/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve and disburse vendor payout' })
  async approvePayout(@Param('id') id: string) {
    return this.paymentsService.approveAndDisbursePayout(id);
  }

  @Get('payment-methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List saved payment methods' })
  async getSavedMethods(@CurrentUser('id') userId: string) {
    return this.paymentsService.getSavedPaymentMethods(userId);
  }

  @Post('payment-methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save a payment method' })
  async saveMethod(@CurrentUser('id') userId: string, @Body() dto: SavePaymentMethodDto) {
    return this.paymentsService.savePaymentMethod(userId, dto);
  }

  @Delete('payment-methods/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a saved payment method' })
  async deleteMethod(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.paymentsService.deleteSavedPaymentMethod(userId, id);
  }
}
