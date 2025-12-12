import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review, ReviewStatus } from './entities/review.entity';
import { Product } from '../products/entities/product.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { CreateReviewDto, UpdateReviewDto, ReviewQueryDto } from './dto/review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewsRepository: Repository<Review>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  async findAllForProduct(productId: string, query: ReviewQueryDto) {
    const { page = 1, limit = 10 } = query;

    const [reviews, total] = await this.reviewsRepository.findAndCount({
      where: { productId, status: ReviewStatus.APPROVED },
      relations: ['user'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        user: {
          id: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
        },
        createdAt: r.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRatingSummary(productId: string) {
    const reviews = await this.reviewsRepository.find({
      where: { productId, status: ReviewStatus.APPROVED },
    });

    if (reviews.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    reviews.forEach((r) => {
      distribution[r.rating]++;
      totalRating += r.rating;
    });

    return {
      averageRating: totalRating / reviews.length,
      totalReviews: reviews.length,
      distribution,
    };
  }

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if user has purchased this product (delivered order)
    const hasPurchased = await this.ordersRepository
      .createQueryBuilder('order')
      .leftJoin('order.items', 'item')
      .where('order.userId = :userId', { userId })
      .andWhere('item.productId = :productId', { productId })
      .andWhere('order.status = :status', { status: OrderStatus.DELIVERED })
      .getOne();

    if (!hasPurchased) {
      throw new ForbiddenException('You can only review products you have purchased');
    }

    // Check if user already reviewed this product
    const existingReview = await this.reviewsRepository.findOne({
      where: { userId, productId },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this product');
    }

    const review = this.reviewsRepository.create({
      userId,
      productId,
      ...dto,
      status: ReviewStatus.APPROVED, // Auto-approve for simplicity
    });

    await this.reviewsRepository.save(review);

    // Update product rating
    await this.updateProductRating(productId);

    return review;
  }

  async update(userId: string, productId: string, reviewId: string, dto: UpdateReviewDto) {
    const review = await this.reviewsRepository.findOne({
      where: { id: reviewId, productId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only edit your own reviews');
    }

    await this.reviewsRepository.update(reviewId, dto);

    // Update product rating if rating changed
    if (dto.rating !== undefined) {
      await this.updateProductRating(productId);
    }

    return this.reviewsRepository.findOne({ where: { id: reviewId } });
  }

  async remove(userId: string, productId: string, reviewId: string) {
    const review = await this.reviewsRepository.findOne({
      where: { id: reviewId, productId },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.reviewsRepository.delete(reviewId);

    // Update product rating
    await this.updateProductRating(productId);

    return { message: 'Review deleted successfully' };
  }

  private async updateProductRating(productId: string) {
    const result = await this.reviewsRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('review.productId = :productId', { productId })
      .andWhere('review.status = :status', { status: ReviewStatus.APPROVED })
      .getRawOne();

    await this.productsRepository.update(productId, {
      averageRating: result.avg || 0,
      reviewCount: parseInt(result.count) || 0,
    });
  }
}
