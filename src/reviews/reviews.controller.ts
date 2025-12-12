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
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, UpdateReviewDto, ReviewQueryDto } from './dto/review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Reviews')
@Controller('products/:productId')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('reviews')
  @ApiOperation({ summary: 'Get reviews for product' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved' })
  async findAll(
    @Param('productId') productId: string,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.findAllForProduct(productId, query);
  }

  @Get('ratings')
  @ApiOperation({ summary: 'Get rating summary for product' })
  @ApiResponse({ status: 200, description: 'Rating summary retrieved' })
  async getRatings(@Param('productId') productId: string) {
    return this.reviewsService.getRatingSummary(productId);
  }

  @Post('reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create review (after purchase)' })
  @ApiResponse({ status: 201, description: 'Review created' })
  @ApiResponse({ status: 403, description: 'Must purchase product first' })
  async create(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(userId, productId, dto);
  }

  @Patch('reviews/:reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit own review' })
  @ApiResponse({ status: 200, description: 'Review updated' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(userId, productId, reviewId, dto);
  }

  @Delete('reviews/:reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own review' })
  @ApiResponse({ status: 200, description: 'Review deleted' })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('productId') productId: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviewsService.remove(userId, productId, reviewId);
  }
}
