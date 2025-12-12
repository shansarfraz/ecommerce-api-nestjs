import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Product,
  ProductVariant,
  ProductImage,
  ProductStatus,
} from './entities/product.entity';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateProductVariantDto,
  UpdateProductVariantDto,
  ProductQueryDto,
} from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private variantsRepository: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private imagesRepository: Repository<ProductImage>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
  ) {}

  async create(vendorId: string, createProductDto: CreateProductDto) {
    const existingSlug = await this.productsRepository.findOne({
      where: { slug: createProductDto.slug },
    });

    if (existingSlug) {
      throw new ConflictException('Product slug already exists');
    }

    const { variants, images, ...productData } = createProductDto;

    const product = this.productsRepository.create({
      ...productData,
      vendorId,
    });

    const savedProduct = await this.productsRepository.save(product);

    if (variants && variants.length > 0) {
      const variantEntities = variants.map((v) =>
        this.variantsRepository.create({
          ...v,
          productId: savedProduct.id,
        }),
      );
      await this.variantsRepository.save(variantEntities);
    }

    if (images && images.length > 0) {
      const imageEntities = images.map((img) =>
        this.imagesRepository.create({
          ...img,
          productId: savedProduct.id,
        }),
      );
      await this.imagesRepository.save(imageEntities);
    }

    return this.findOne(savedProduct.id);
  }

  async findAll(query: ProductQueryDto) {
    const { q, category, vendor, minPrice, maxPrice, sort, page = 1, limit = 10 } = query;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.images', 'images')
      .where('product.status = :status', { status: ProductStatus.ACTIVE });

    if (q) {
      queryBuilder.andWhere(
        '(product.title ILIKE :q OR product.description ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    if (category) {
      queryBuilder.andWhere('product.categoryId = :category', { category });
    }

    if (vendor) {
      queryBuilder.andWhere('product.vendorId = :vendor', { vendor });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.basePrice >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.basePrice <= :maxPrice', { maxPrice });
    }

    switch (sort) {
      case 'price_asc':
        queryBuilder.orderBy('product.basePrice', 'ASC');
        break;
      case 'price_desc':
        queryBuilder.orderBy('product.basePrice', 'DESC');
        break;
      case 'rating':
        queryBuilder.orderBy('product.averageRating', 'DESC');
        break;
      case 'newest':
      default:
        queryBuilder.orderBy('product.createdAt', 'DESC');
    }

    const [products, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: ['vendor', 'category', 'variants', 'images'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async findByVendor(vendorId: string, query: ProductQueryDto) {
    const { page = 1, limit = 10 } = query;

    const [products, total] = await this.productsRepository.findAndCount({
      where: { vendorId },
      relations: ['category', 'images'],
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, vendorId: string, updateProductDto: UpdateProductDto) {
    const product = await this.productsRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    await this.productsRepository.update(id, updateProductDto);
    return this.findOne(id);
  }

  async remove(id: string, vendorId: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    await this.productsRepository.update(id, { status: ProductStatus.ARCHIVED });
    return { message: 'Product archived successfully' };
  }

  async createVariant(productId: string, vendorId: string, dto: CreateProductVariantDto) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    const variant = this.variantsRepository.create({
      ...dto,
      productId,
    });

    return this.variantsRepository.save(variant);
  }

  async updateVariant(
    productId: string,
    variantId: string,
    vendorId: string,
    dto: UpdateProductVariantDto,
  ) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    const variant = await this.variantsRepository.findOne({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    await this.variantsRepository.update(variantId, dto);
    return this.variantsRepository.findOne({ where: { id: variantId } });
  }

  async removeVariant(productId: string, variantId: string, vendorId: string) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.vendorId !== vendorId) {
      throw new ForbiddenException('You do not own this product');
    }

    const variant = await this.variantsRepository.findOne({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    await this.variantsRepository.delete(variantId);
    return { message: 'Variant deleted successfully' };
  }

  async getVendorByUserId(userId: string) {
    return this.vendorsRepository.findOne({
      where: { ownerId: userId, status: VendorStatus.APPROVED },
    });
  }

  async findAllAdmin(query: ProductQueryDto) {
    const { q, category, vendor, page = 1, limit = 10 } = query;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.vendor', 'vendor')
      .leftJoinAndSelect('product.category', 'category');

    if (q) {
      queryBuilder.andWhere(
        '(product.title ILIKE :q OR product.description ILIKE :q)',
        { q: `%${q}%` },
      );
    }

    if (category) {
      queryBuilder.andWhere('product.categoryId = :category', { category });
    }

    if (vendor) {
      queryBuilder.andWhere('product.vendorId = :vendor', { vendor });
    }

    const [products, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('product.createdAt', 'DESC')
      .getManyAndCount();

    return {
      data: products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async adminUpdate(id: string, updateProductDto: UpdateProductDto & { isFeatured?: boolean }) {
    const product = await this.findOne(id);
    await this.productsRepository.update(id, updateProductDto);
    return this.findOne(id);
  }

  async adminDelete(id: string) {
    const product = await this.findOne(id);
    await this.productsRepository.delete(id);
    return { message: 'Product deleted permanently' };
  }
}
