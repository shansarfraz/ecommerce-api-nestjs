import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
  UpdateShipmentDto,
  CancelOrderDto,
  ReturnOrderDto,
  ReviewReturnDto,
  CreateAdjustmentDto,
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
  @Get('orders/guest')
  @ApiOperation({ summary: 'Track a guest order by order number and email' })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findGuestOrder(
    @Query('orderNumber') orderNumber: string,
    @Query('email') email: string,
  ) {
    return this.ordersService.findGuestOrder(orderNumber, email);
  }

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

  @Get('orders/:id/return')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get return request for an order' })
  async getReturn(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.ordersService.getReturnRequest(userId, id);
  }

  @Patch('admin/returns/:returnId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or reject a return request' })
  async reviewReturn(@Param('returnId') returnId: string, @Body() dto: ReviewReturnDto) {
    return this.ordersService.adminReviewReturn(returnId, dto);
  }

  // Admin: order timeline
  @Get('admin/orders/:id/timeline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order audit timeline' })
  async getTimeline(@Param('id') id: string) {
    return this.ordersService.getTimeline(id);
  }

  @Post('admin/orders/:id/timeline/notes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add agent note to order timeline' })
  async addNote(
    @Param('id') id: string,
    @Body('note') note: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.ordersService.addTimelineNote(id, note, adminId, 'admin');
  }

  // Admin: order adjustments
  @Post('admin/orders/:id/adjustments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add manual adjustment (discount or surcharge) to order' })
  async createAdjustment(
    @Param('id') id: string,
    @Body() dto: CreateAdjustmentDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.ordersService.createAdjustment(id, dto, adminId);
  }

  @Get('admin/orders/:id/adjustments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List adjustments for an order' })
  async getAdjustments(@Param('id') id: string) {
    return this.ordersService.getAdjustments(id);
  }

  @Delete('admin/orders/:id/adjustments/:adjustmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an adjustment from an order' })
  async deleteAdjustment(
    @Param('id') id: string,
    @Param('adjustmentId') adjustmentId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.ordersService.deleteAdjustment(id, adjustmentId, adminId);
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

  @Patch('vendor/orders/:orderId/shipments/:shipmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update shipment tracking and status' })
  async updateShipment(
    @CurrentUser('id') userId: string,
    @Param('orderId') orderId: string,
    @Param('shipmentId') shipmentId: string,
    @Body() dto: UpdateShipmentDto,
  ) {
    const vendor = await this.ordersService.getVendorByUserId(userId);
    if (!vendor) throw new ForbiddenException('Not an approved vendor');
    return this.ordersService.updateShipment(vendor.id, orderId, shipmentId, dto);
  }
}
