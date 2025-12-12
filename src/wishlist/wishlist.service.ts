import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WishlistItem } from './entities/wishlist.entity';
import { Product } from '../products/entities/product.entity';
import { AddToWishlistDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private wishlistRepository: Repository<WishlistItem>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
  ) {}

  async findAll(userId: string) {
    const items = await this.wishlistRepository.find({
      where: { userId },
      relations: ['product', 'product.images', 'product.vendor'],
      order: { addedAt: 'DESC' },
    });

    return items.map((item) => ({
      id: item.id,
      productId: item.productId,
      product: item.product,
      addedAt: item.addedAt,
    }));
  }

  async add(userId: string, dto: AddToWishlistDto) {
    const product = await this.productsRepository.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.wishlistRepository.findOne({
      where: { userId, productId: dto.productId },
    });

    if (existing) {
      throw new ConflictException('Product already in wishlist');
    }

    const item = this.wishlistRepository.create({
      userId,
      productId: dto.productId,
    });

    await this.wishlistRepository.save(item);

    return this.findAll(userId);
  }

  async remove(userId: string, productId: string) {
    const item = await this.wishlistRepository.findOne({
      where: { userId, productId },
    });

    if (!item) {
      throw new NotFoundException('Item not found in wishlist');
    }

    await this.wishlistRepository.delete(item.id);

    return { message: 'Item removed from wishlist' };
  }
}
