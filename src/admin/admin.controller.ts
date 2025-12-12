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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { UserQueryDto, AdminUpdateUserDto } from '../users/dto/user.dto';
import {
  VendorQueryDto,
  AdminUpdateVendorStatusDto,
  AdminUpdateVendorCommissionDto,
} from '../vendors/dto/vendor.dto';
import { CreateCategoryDto, UpdateCategoryDto } from '../categories/dto/category.dto';
import { ProductQueryDto, UpdateProductDto } from '../products/dto/product.dto';
import { OrderQueryDto, UpdateOrderStatusDto } from '../orders/dto/order.dto';
import { PayoutQueryDto } from '../payments/dto/payment.dto';
import {
  CreatePageDto,
  UpdatePageDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from '../content/dto/content.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Dashboard & Reports
  @Get('dashboard/metrics')
  @ApiOperation({ summary: 'Get dashboard KPIs' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved' })
  async getMetrics() {
    return this.adminService.getDashboardMetrics();
  }

  @Get('reports/sales')
  @ApiOperation({ summary: 'Get sales report' })
  @ApiResponse({ status: 200, description: 'Sales report retrieved' })
  async getSalesReport(@Query() query: any) {
    return this.adminService.getSalesReport(query);
  }

  @Get('reports/products')
  @ApiOperation({ summary: 'Get products report' })
  @ApiResponse({ status: 200, description: 'Products report retrieved' })
  async getProductsReport() {
    return this.adminService.getProductsReport();
  }

  // User Management
  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved' })
  async getUsers(@Query() query: UserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved' })
  async getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user roles/status' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async updateUser(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Disable/soft delete user' })
  @ApiResponse({ status: 200, description: 'User disabled' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // Vendor Management
  @Get('vendors')
  @ApiOperation({ summary: 'List all vendors' })
  @ApiResponse({ status: 200, description: 'Vendors retrieved' })
  async getVendors(@Query() query: VendorQueryDto) {
    return this.adminService.getVendors(query);
  }

  @Patch('vendors/:id/status')
  @ApiOperation({ summary: 'Approve/reject vendor' })
  @ApiResponse({ status: 200, description: 'Vendor status updated' })
  async updateVendorStatus(
    @Param('id') id: string,
    @Body() dto: AdminUpdateVendorStatusDto,
  ) {
    return this.adminService.updateVendorStatus(id, dto);
  }

  @Patch('vendors/:id/commission')
  @ApiOperation({ summary: 'Set vendor commission rate' })
  @ApiResponse({ status: 200, description: 'Commission rate updated' })
  async updateVendorCommission(
    @Param('id') id: string,
    @Body() dto: AdminUpdateVendorCommissionDto,
  ) {
    return this.adminService.updateVendorCommission(id, dto);
  }

  // Category Management
  @Post('categories')
  @ApiOperation({ summary: 'Create category' })
  @ApiResponse({ status: 201, description: 'Category created' })
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  async deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  // Product Management
  @Get('products')
  @ApiOperation({ summary: 'List all products' })
  @ApiResponse({ status: 200, description: 'Products retrieved' })
  async getProducts(@Query() query: ProductQueryDto) {
    return this.adminService.getProducts(query);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Moderate/feature product' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  async updateProduct(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Hard delete product' })
  @ApiResponse({ status: 200, description: 'Product deleted' })
  async deleteProduct(@Param('id') id: string) {
    return this.adminService.deleteProduct(id);
  }

  // Order Management
  @Get('orders')
  @ApiOperation({ summary: 'List all orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved' })
  async getOrders(@Query() query: OrderQueryDto) {
    return this.adminService.getOrders(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get order details' })
  @ApiResponse({ status: 200, description: 'Order retrieved' })
  async getOrder(@Param('id') id: string) {
    return this.adminService.getOrder(id);
  }

  @Patch('orders/:id')
  @ApiOperation({ summary: 'Update order status/notes' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  async updateOrder(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.adminService.updateOrder(id, dto);
  }

  // Payout Management
  @Get('payouts')
  @ApiOperation({ summary: 'List all payouts' })
  @ApiResponse({ status: 200, description: 'Payouts retrieved' })
  async getPayouts(@Query() query: PayoutQueryDto) {
    return this.adminService.getPayouts(query);
  }

  // Content Management - Pages
  @Post('pages')
  @ApiOperation({ summary: 'Create page' })
  @ApiResponse({ status: 201, description: 'Page created' })
  async createPage(@Body() dto: CreatePageDto) {
    return this.adminService.createPage(dto);
  }

  @Patch('pages/:id')
  @ApiOperation({ summary: 'Update page' })
  @ApiResponse({ status: 200, description: 'Page updated' })
  async updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto) {
    return this.adminService.updatePage(id, dto);
  }

  @Delete('pages/:id')
  @ApiOperation({ summary: 'Delete page' })
  @ApiResponse({ status: 200, description: 'Page deleted' })
  async deletePage(@Param('id') id: string) {
    return this.adminService.deletePage(id);
  }

  // Content Management - Blog Posts
  @Post('blog/posts')
  @ApiOperation({ summary: 'Create blog post' })
  @ApiResponse({ status: 201, description: 'Blog post created' })
  async createBlogPost(@Body() dto: CreateBlogPostDto) {
    return this.adminService.createBlogPost(dto);
  }

  @Patch('blog/posts/:id')
  @ApiOperation({ summary: 'Update blog post' })
  @ApiResponse({ status: 200, description: 'Blog post updated' })
  async updateBlogPost(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
    return this.adminService.updateBlogPost(id, dto);
  }

  @Delete('blog/posts/:id')
  @ApiOperation({ summary: 'Delete blog post' })
  @ApiResponse({ status: 200, description: 'Blog post deleted' })
  async deleteBlogPost(@Param('id') id: string) {
    return this.adminService.deleteBlogPost(id);
  }
}
