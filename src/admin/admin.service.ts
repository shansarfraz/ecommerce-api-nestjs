import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { Product } from '../products/entities/product.entity';
import { Order, OrderItem } from '../orders/entities/order.entity';
import { Category } from '../categories/entities/category.entity';
import { Page, BlogPost } from '../content/entities/content.entity';
import { Payout } from '../payments/entities/payment.entity';
import { UsersService } from '../users/users.service';
import { VendorsService } from '../vendors/vendors.service';
import { CategoriesService } from '../categories/categories.service';
import { ProductsService } from '../products/products.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { ContentService } from '../content/content.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vendor)
    private vendorsRepository: Repository<Vendor>,
    @InjectRepository(Product)
    private productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepository: Repository<OrderItem>,
    private usersService: UsersService,
    private vendorsService: VendorsService,
    private categoriesService: CategoriesService,
    private productsService: ProductsService,
    private ordersService: OrdersService,
    private paymentsService: PaymentsService,
    private contentService: ContentService,
  ) {}

  async getDashboardMetrics() {
    const [totalUsers, totalVendors, totalProducts, totalOrders] =
      await Promise.all([
        this.usersRepository.count(),
        this.vendorsRepository.count(),
        this.productsRepository.count(),
        this.ordersRepository.count(),
      ]);

    const gmvResult = await this.ordersRepository
      .createQueryBuilder('order')
      .select('SUM(order.total)', 'gmv')
      .where("order.paymentStatus = 'paid'")
      .getRawOne();

    const pendingVendors = await this.vendorsRepository.count({
      where: { status: 'pending' as any },
    });

    const recentOrders = await this.ordersRepository.find({
      take: 5,
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    return {
      totalUsers,
      totalVendors,
      activeVendors: totalVendors - pendingVendors,
      pendingVendors,
      totalProducts,
      totalOrders,
      gmv: gmvResult?.gmv || 0,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        total: o.total,
        status: o.status,
        user: o.user ? { email: o.user.email } : null,
        createdAt: o.createdAt,
      })),
    };
  }

  async getSalesReport(query: any) {
    const { startDate, endDate, groupBy = 'day' } = query;

    const queryBuilder = this.ordersRepository
      .createQueryBuilder('order')
      .select([
        "DATE_TRUNC(:groupBy, order.createdAt) as period",
        'COUNT(*) as orders',
        'SUM(order.total) as revenue',
      ])
      .setParameter('groupBy', groupBy)
      .where("order.paymentStatus = 'paid'");

    if (startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', { endDate });
    }

    const result = await queryBuilder
      .groupBy('period')
      .orderBy('period', 'DESC')
      .getRawMany();

    return {
      data: result,
      groupBy,
      startDate,
      endDate,
    };
  }

  async getProductsReport() {
    // Best sellers
    const bestSellers = await this.orderItemsRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.product', 'product')
      .select([
        'item.productId',
        'product.title',
        'SUM(item.quantity) as totalSold',
        'SUM(item.subtotal) as revenue',
      ])
      .groupBy('item.productId')
      .addGroupBy('product.title')
      .orderBy('totalSold', 'DESC')
      .take(10)
      .getRawMany();

    // Low stock
    const lowStock = await this.productsRepository.find({
      where: {},
      take: 10,
      order: { stock: 'ASC' },
      select: ['id', 'title', 'stock', 'sku'],
    });

    return {
      bestSellers,
      lowStock,
    };
  }

  // User management
  async getUsers(query: any) {
    return this.usersService.findAll(query);
  }

  async getUser(id: string) {
    return this.usersService.findOne(id);
  }

  async updateUser(id: string, dto: any) {
    return this.usersService.adminUpdate(id, dto);
  }

  async deleteUser(id: string) {
    return this.usersService.softDelete(id);
  }

  // Vendor management
  async getVendors(query: any) {
    return this.vendorsService.findAll(query);
  }

  async updateVendorStatus(id: string, dto: any) {
    return this.vendorsService.updateStatus(id, dto);
  }

  async updateVendorCommission(id: string, dto: any) {
    return this.vendorsService.updateCommission(id, dto);
  }

  // Category management
  async createCategory(dto: any) {
    return this.categoriesService.create(dto);
  }

  async updateCategory(id: string, dto: any) {
    return this.categoriesService.update(id, dto);
  }

  async deleteCategory(id: string) {
    return this.categoriesService.remove(id);
  }

  // Product management
  async getProducts(query: any) {
    return this.productsService.findAllAdmin(query);
  }

  async updateProduct(id: string, dto: any) {
    return this.productsService.adminUpdate(id, dto);
  }

  async deleteProduct(id: string) {
    return this.productsService.adminDelete(id);
  }

  // Order management
  async getOrders(query: any) {
    return this.ordersService.findAllAdmin(query);
  }

  async getOrder(id: string) {
    return this.ordersService.findOneAdmin(id);
  }

  async updateOrder(id: string, dto: any) {
    return this.ordersService.adminUpdateOrder(id, dto);
  }

  // Payout management
  async getPayouts(query: any) {
    return this.paymentsService.getAllPayouts(query);
  }

  // Content management
  async createPage(dto: any) {
    return this.contentService.createPage(dto);
  }

  async updatePage(id: string, dto: any) {
    return this.contentService.updatePage(id, dto);
  }

  async deletePage(id: string) {
    return this.contentService.deletePage(id);
  }

  async createBlogPost(dto: any) {
    return this.contentService.createBlogPost(dto);
  }

  async updateBlogPost(id: string, dto: any) {
    return this.contentService.updateBlogPost(id, dto);
  }

  async deleteBlogPost(id: string) {
    return this.contentService.deleteBlogPost(id);
  }
}
