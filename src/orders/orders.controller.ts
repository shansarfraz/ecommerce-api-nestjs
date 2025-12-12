import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  OrderQueryDto,
  UpdateFulfillmentStatusDto,
  CancelOrderDto,
  ReturnOrderDto,
} from './dto/order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Customer endpoints
  @Get('orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  async findMyOrders(
    @CurrentUser('id') userId: string,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.findAllForUser(userId, query);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order detail' })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.ordersService.findOneForUser(userId, id);
  }

  @Post('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request order cancellation' })
  @ApiResponse({ status: 200, description: 'Cancellation requested' })
  async cancelOrder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(userId, id, dto);
  }

  @Post('orders/:id/return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request order return' })
  @ApiResponse({ status: 200, description: 'Return requested' })
  async returnOrder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ReturnOrderDto,
  ) {
    return this.ordersService.returnOrder(userId, id, dto);
  }

  // Vendor endpoints
  @Get('vendor/orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List vendor orders' })
  @ApiResponse({ status: 200, description: 'Vendor orders retrieved' })
  async findVendorOrders(
    @CurrentUser('id') userId: string,
    @Query() query: OrderQueryDto,
  ) {
    const vendor = await this.ordersService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.ordersService.findAllForVendor(vendor.id, query);
  }

  @Get('vendor/orders/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get vendor order detail' })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  async findVendorOrder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    const vendor = await this.ordersService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.ordersService.findOneForVendor(vendor.id, id);
  }

  @Patch('vendor/orders/:id/items/:itemId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update item fulfillment status' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  async updateFulfillment(
    @CurrentUser('id') userId: string,
    @Param('id') orderId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateFulfillmentStatusDto,
  ) {
    const vendor = await this.ordersService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.ordersService.updateItemFulfillment(vendor.id, orderId, itemId, dto);
  }
}
