import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../products/entities/product.entity';
import { Vendor, VendorStatus } from '../vendors/entities/vendor.entity';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(Vendor)
    private readonly vendorsRepo: Repository<Vendor>,
  ) {}

  async search(q: string, limit = 20) {
    if (!q || q.trim().length === 0) {
      return { products: [], vendors: [] };
    }

    const term = q.trim();

    const productsQb = this.productsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.images', 'images')
      .leftJoinAndSelect('p.vendor', 'vendor')
      .where('p.status = :status', { status: ProductStatus.ACTIVE })
      .take(limit);

    if (term.length >= 3) {
      productsQb.andWhere(
        `to_tsvector('english', coalesce(p.title,'') || ' ' || coalesce(p.description,'')) @@ plainto_tsquery('english', :q)`,
        { q: term },
      );
    } else {
      productsQb.andWhere('p.title ILIKE :q', { q: `%${term}%` });
    }

    const vendorsQb = this.vendorsRepo
      .createQueryBuilder('v')
      .where('v.status = :status', { status: VendorStatus.APPROVED })
      .andWhere('(v.name ILIKE :q OR v.description ILIKE :q)', { q: `%${term}%` })
      .take(10);

    const [products, vendors] = await Promise.all([
      productsQb.getMany(),
      vendorsQb.getMany(),
    ]);

    return {
      products: products.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        basePrice: p.basePrice,
        currency: p.currency,
        averageRating: p.averageRating,
        reviewCount: p.reviewCount,
        image: p.images?.[0]?.url ?? null,
        vendor: { id: p.vendor?.id, name: p.vendor?.name, slug: p.vendor?.slug },
      })),
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        slug: v.slug,
        logoUrl: v.logoUrl,
        description: v.description,
      })),
    };
  }

  async suggestions(q: string) {
    if (!q || q.trim().length < 2) {
      return { suggestions: [] };
    }

    const term = q.trim();

    const products = await this.productsRepo
      .createQueryBuilder('p')
      .select(['p.id', 'p.title', 'p.slug'])
      .where('p.status = :status', { status: ProductStatus.ACTIVE })
      .andWhere('p.title ILIKE :q', { q: `${term}%` })
      .orderBy('p.reviewCount', 'DESC')
      .take(8)
      .getMany();

    const vendors = await this.vendorsRepo
      .createQueryBuilder('v')
      .select(['v.id', 'v.name', 'v.slug'])
      .where('v.status = :status', { status: VendorStatus.APPROVED })
      .andWhere('v.name ILIKE :q', { q: `${term}%` })
      .take(4)
      .getMany();

    const suggestions = [
      ...products.map((p) => ({ type: 'product' as const, id: p.id, label: p.title, slug: p.slug })),
      ...vendors.map((v) => ({ type: 'vendor' as const, id: v.id, label: v.name, slug: v.slug })),
    ];

    return { suggestions };
  }
}
