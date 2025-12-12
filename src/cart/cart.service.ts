import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart, CartItem } from './entities/cart.entity';
import { Product, ProductVariant } from '../products/entities/product.entity';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartsRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private cartItemsRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private variantsRepository: Repository<ProductVariant>,
  ) {}

  async getOrCreateCart(userId: string): Promise<Cart> {
    let cart = await this.cartsRepository.findOne({
      where: { userId },
      relations: ['items', 'items.product', 'items.variant', 'items.vendor'],
    });

    if (!cart) {
      cart = this.cartsRepository.create({
        userId,
        total: 0,
        currency: 'USD',
      });
      cart = await this.cartsRepository.save(cart);
      cart.items = [];
    }

    return cart;
  }

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);
    return this.formatCart(cart);
  }

  async addItem(userId: string, addToCartDto: AddToCartDto) {
    const cart = await this.getOrCreateCart(userId);

    const product = await this.productsRepository.findOne({
      where: { id: addToCartDto.productId },
      relations: ['vendor'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let price = Number(product.basePrice);
    let variant: ProductVariant | null = null;

    if (addToCartDto.variantId) {
      variant = await this.variantsRepository.findOne({
        where: { id: addToCartDto.variantId, productId: product.id },
      });

      if (!variant) {
        throw new NotFoundException('Product variant not found');
      }

      price = Number(variant.price);
    }

    // Check if item already in cart
    const existingItem = await this.cartItemsRepository.findOne({
      where: {
        cartId: cart.id,
        productId: product.id,
        variantId: addToCartDto.variantId || null,
      },
    });

    if (existingItem) {
      existingItem.quantity += addToCartDto.quantity;
      existingItem.subtotal = existingItem.quantity * existingItem.unitPrice;
      await this.cartItemsRepository.save(existingItem);
    } else {
      const cartItem = this.cartItemsRepository.create({
        cartId: cart.id,
        productId: product.id,
        variantId: addToCartDto.variantId || null,
        vendorId: product.vendorId,
        quantity: addToCartDto.quantity,
        unitPrice: price,
        subtotal: price * addToCartDto.quantity,
      });
      await this.cartItemsRepository.save(cartItem);
    }

    await this.updateCartTotal(cart.id);
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, updateDto: UpdateCartItemDto) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.cartItemsRepository.findOne({
      where: { id: itemId, cartId: cart.id },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    item.quantity = updateDto.quantity;
    item.subtotal = item.quantity * Number(item.unitPrice);
    await this.cartItemsRepository.save(item);

    await this.updateCartTotal(cart.id);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const item = await this.cartItemsRepository.findOne({
      where: { id: itemId, cartId: cart.id },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartItemsRepository.delete(itemId);
    await this.updateCartTotal(cart.id);

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    await this.cartItemsRepository.delete({ cartId: cart.id });
    await this.cartsRepository.update(cart.id, { total: 0 });

    return { message: 'Cart cleared successfully' };
  }

  private async updateCartTotal(cartId: string) {
    const items = await this.cartItemsRepository.find({
      where: { cartId },
    });

    const total = items.reduce((sum, item) => sum + Number(item.subtotal), 0);

    await this.cartsRepository.update(cartId, { total });
  }

  private formatCart(cart: Cart) {
    const itemsByVendor = cart.items.reduce((acc, item) => {
      const vendorId = item.vendorId;
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendor: item.vendor,
          items: [],
          subtotal: 0,
        };
      }
      acc[vendorId].items.push(item);
      acc[vendorId].subtotal += Number(item.subtotal);
      return acc;
    }, {} as Record<string, any>);

    return {
      id: cart.id,
      userId: cart.userId,
      total: cart.total,
      currency: cart.currency,
      itemCount: cart.items.length,
      vendorGroups: Object.values(itemsByVendor),
      items: cart.items,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }
}
