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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateProductVariantDto,
  UpdateProductVariantDto,
  ProductQueryDto,
} from './dto/product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Public endpoints
  @Get('products')
  @ApiOperation({ summary: 'List products with filters' })
  @ApiResponse({ status: 200, description: 'Products retrieved' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get('vendors/:vendorId/products')
  @ApiOperation({ summary: 'List vendor products' })
  @ApiResponse({ status: 200, description: 'Vendor products retrieved' })
  async findByVendor(
    @Param('vendorId') vendorId: string,
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findByVendor(vendorId, query);
  }

  // Vendor endpoints
  @Get('vendor/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List own products (vendor)' })
  @ApiResponse({ status: 200, description: 'Products retrieved' })
  async findMyProducts(
    @CurrentUser('id') userId: string,
    @Query() query: ProductQueryDto,
  ) {
    const vendor = await this.productsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.productsService.findByVendor(vendor.id, query);
  }

  @Post('vendor/products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product (vendor)' })
  @ApiResponse({ status: 201, description: 'Product created' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    const vendor = await this.productsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.productsService.create(vendor.id, createProductDto);
  }

  @Patch('vendor/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product (vendor)' })
  @ApiResponse({ status: 200, description: 'Product updated' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    const vendor = await this.productsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.productsService.update(id, vendor.id, updateProductDto);
  }

  @Delete('vendor/products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Archive a product (vendor)' })
  @ApiResponse({ status: 200, description: 'Product archived' })
  async remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    const vendor = await this.productsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.productsService.remove(id, vendor.id);
  }

  // Variant endpoints
  @Post('vendor/products/:id/variants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a product variant' })
  @ApiResponse({ status: 201, description: 'Variant created' })
  async createVariant(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    const vendor = await this.productsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.productsService.createVariant(productId, vendor.id, dto);
  }

  @Patch('vendor/products/:id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a product variant' })
  @ApiResponse({ status: 200, description: 'Variant updated' })
  async updateVariant(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    const vendor = await this.productsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.productsService.updateVariant(productId, variantId, vendor.id, dto);
  }

  @Delete('vendor/products/:id/variants/:variantId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.VENDOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a product variant' })
  @ApiResponse({ status: 200, description: 'Variant deleted' })
  async removeVariant(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string,
    @Param('variantId') variantId: string,
  ) {
    const vendor = await this.productsService.getVendorByUserId(userId);
    if (!vendor) {
      throw new ForbiddenException('You are not an approved vendor');
    }
    return this.productsService.removeVariant(productId, variantId, vendor.id);
  }
}
