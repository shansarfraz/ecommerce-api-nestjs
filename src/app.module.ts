import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VendorsModule } from './vendors/vendors.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { ContentModule } from './content/content.module';
import { AdminModule } from './admin/admin.module';
import { PromotionsModule } from './promotions/promotions.module';
import { ShippingModule } from './shipping/shipping.module';
import { TaxModule } from './tax/tax.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CommissionsModule } from './commissions/commissions.module';
import { HealthModule } from './health/health.module';
import { UploadsModule } from './uploads/uploads.module';
import { JobsModule } from './jobs/jobs.module';
import { StoreCreditsModule } from './store-credits/store-credits.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', '127.0.0.1'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD', undefined),
          tls: config.get<string>('REDIS_TLS', 'false') === 'true' ? {} : undefined,
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize:
          configService.get<string>('TYPEORM_SYNC', 'false') === 'true',
        migrationsRun:
          configService.get<string>('TYPEORM_MIGRATIONS_RUN', 'true') ===
          'true',
        migrations: [__dirname + '/database/migrations/*.{ts,js}'],
        ssl: {
          rejectUnauthorized: false,
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    VendorsModule,
    CategoriesModule,
    ProductsModule,
    CartModule,
    CheckoutModule,
    OrdersModule,
    PaymentsModule,
    ReviewsModule,
    WishlistModule,
    ContentModule,
    AdminModule,
    PromotionsModule,
    ShippingModule,
    TaxModule,
    NotificationsModule,
    CommissionsModule,
    HealthModule,
    UploadsModule,
    JobsModule,
    StoreCreditsModule,
    SearchModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
