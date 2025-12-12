import {
  Controller,
  Get,
  Post,
  Patch,
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
import { VendorsService } from './vendors.service';
import {
  ApplyVendorDto,
  UpdateVendorDto,
  VendorQueryDto,
} from './dto/vendor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Vendors')
@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply to become a vendor' })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  @ApiResponse({ status: 409, description: 'Already have an application' })
  async apply(
    @CurrentUser('id') userId: string,
    @Body() applyVendorDto: ApplyVendorDto,
  ) {
    return this.vendorsService.apply(userId, applyVendorDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get own vendor store info' })
  @ApiResponse({ status: 200, description: 'Vendor info retrieved' })
  @ApiResponse({ status: 404, description: 'No vendor store found' })
  async getMyVendor(@CurrentUser('id') userId: string) {
    return this.vendorsService.findMyVendor(userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update own vendor store' })
  @ApiResponse({ status: 200, description: 'Vendor updated' })
  async updateMyVendor(
    @CurrentUser('id') userId: string,
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    return this.vendorsService.updateMyVendor(userId, updateVendorDto);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get public vendor store info' })
  @ApiResponse({ status: 200, description: 'Vendor info retrieved' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async getBySlug(@Param('slug') slug: string) {
    return this.vendorsService.findBySlug(slug);
  }
}
