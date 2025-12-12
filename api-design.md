# NestJS Multi‑Vendor Ecommerce API

This document describes the architecture, modules, entities, and REST API endpoints for a multi‑vendor ecommerce backend built with NestJS, designed to be “Refine‑friendly” for later admin/dashboard integration.[web:5][web:61]  

The API follows a resource‑oriented REST design (`/users`, `/products`, `/orders`, etc.) so it can be consumed easily by Refine data providers such as `@refinedev/simple-rest` or `@refinedev/nestjsx-crud`.[web:44][web:47][web:58]  

## Tech stack

- Node.js + NestJS (modular monolith)[web:5]  
- PostgreSQL (via TypeORM or Prisma)[web:5]  
- JWT‑based auth (access + refresh tokens)[web:64]  
- Optional: Swagger/OpenAPI docs via `@nestjs/swagger`[web:69]  

---

## Modules overview

- `AuthModule` – authentication, registration, password reset  
- `UsersModule` – user profiles, roles (customer, vendor, admin)  
- `VendorsModule` – vendor stores, onboarding, commission  
- `CategoriesModule` – product categories and tree  
- `ProductsModule` – products, variants, inventory, media  
- `CartModule` – shopping cart per user  
- `CheckoutModule` – checkout summary, coupon application  
- `OrdersModule` – order lifecycle, per‑vendor fulfillment  
- `PaymentsModule` – payment sessions, webhooks, refunds  
- `ReviewsModule` – product reviews and ratings  
- `WishlistModule` – wishlists per user  
- `ContentModule` – CMS‑style pages, blog posts  
- `AdminModule` – metrics and reports for internal dashboard[web:5][web:61][web:64]  

---

## Core entities

- `User` (id, email, passwordHash, roles[], status)  
- `Vendor` (id, ownerId, name, slug, logoUrl, description, commissionRate, status)  
- `Category` (id, name, slug, parentId, position)  
- `Product` (id, vendorId, title, slug, description, basePrice, currency, sku, status, categoryId)  
- `ProductVariant` (id, productId, name, sku, price, stock, attributes JSON)  
- `ProductImage` (id, productId, url, altText, position)  
- `Cart` (id, userId, total, currency)  
- `CartItem` (id, cartId, productId, variantId, vendorId, quantity, unitPrice, subtotal)  
- `Order` (id, userId, status, total, currency, paymentStatus, shippingAddress JSON, billingAddress JSON)  
- `OrderItem` (id, orderId, productId, variantId, vendorId, quantity, unitPrice, subtotal, fulfillmentStatus)  
- `Payment` (id, orderId, provider, providerSessionId, amount, status)  
- `Payout` (id, vendorId, amount, status, periodStart, periodEnd)  
- `Review` (id, userId, productId, rating, title, body, status)  
- `WishlistItem` (id, userId, productId, addedAt)  
- `Page` (id, slug, title, content, status)  
- `BlogPost` (id, slug, title, excerpt, content, status)[web:5][web:61][web:62]  

---

## API endpoints by module

### Auth & users

- `POST /auth/register` – register customer  
- `POST /auth/login` – login, returns tokens  
- `POST /auth/logout` – logout/invalidate refresh  
- `POST /auth/refresh` – refresh access token  
- `GET /auth/me` – current user profile  

- `PATCH /users/me` – update own profile  
- `PATCH /users/me/password` – change password  
- `POST /auth/forgot-password` – request reset email  
- `POST /auth/reset-password` – reset with token[web:2][web:24]  

Admin user management:

- `GET /admin/users`  
- `GET /admin/users/:id`  
- `PATCH /admin/users/:id` – update roles, status  
- `DELETE /admin/users/:id` – disable/soft delete[web:24][web:64]  

---

### Vendors

- `POST /vendors/apply` – user applies as vendor  
- `GET /vendors/me` – vendor’s own store info  
- `PATCH /vendors/me` – update store profile  
- `GET /vendors/:slug` – public store info  
- `GET /vendors/:vendorId/products` – list vendor products[web:6][web:33]  

Admin vendor controls:

- `GET /admin/vendors` – list with status filters  
- `PATCH /admin/vendors/:id/status` – approve/reject  
- `PATCH /admin/vendors/:id/commission` – set commission rate[web:6][web:33]  

---

### Categories

- `GET /categories` – list all / tree  
- `GET /categories/:id` – category detail[web:5][web:61]  

Admin:

- `POST /admin/categories` – create  
- `PATCH /admin/categories/:id` – update  
- `DELETE /admin/categories/:id` – delete/disable  

---

### Products & variants

Public:

- `GET /products` – list + filters (`q`, `category`, `vendor`, `minPrice`, `maxPrice`, `sort`, pagination)  
- `GET /products/:id` – product detail  
- `GET /products/:id/reviews` – reviews for product[web:5][web:27][web:29]  

Vendor product CRUD:

- `GET /vendor/products` – list own products  
- `POST /vendor/products` – create product  
- `PATCH /vendor/products/:id` – update product  
- `DELETE /vendor/products/:id` – archive product  

Variants:

- `POST /vendor/products/:id/variants`  
- `PATCH /vendor/products/:id/variants/:variantId`  
- `DELETE /vendor/products/:id/variants/:variantId`[web:27]  

Admin:

- `GET /admin/products` – all products  
- `PATCH /admin/products/:id` – moderate/feature/disable  
- `DELETE /admin/products/:id` – hard delete  

---

### Cart & checkout

Cart:

- `GET /cart` – current user cart  
- `POST /cart/items` – add item `{ productId, variantId?, quantity }`  
- `PATCH /cart/items/:itemId` – update quantity  
- `DELETE /cart/items/:itemId` – remove line  
- `DELETE /cart` – clear cart[web:2][web:27]  

Checkout:

- `POST /checkout/summary` – totals grouped by vendor, shipping, taxes  
- `POST /checkout/apply-coupon` – apply promo code  
- `POST /checkout/remove-coupon` – remove promo  
- `POST /checkout/create-session` – create payment session (Stripe/other)[web:5][web:25]  

---

### Orders & vendor fulfillment

Customer:

- `GET /orders` – list user orders  
- `GET /orders/:id` – order detail  
- `POST /orders/:id/cancel` – request cancel  
- `POST /orders/:id/return` – request return[web:2][web:24]  

Vendor:

- `GET /vendor/orders` – orders containing vendor items  
- `GET /vendor/orders/:id` – vendor view (filtered to vendor items)  
- `PATCH /vendor/orders/:id/items/:itemId/status` – update line fulfillment status (e.g. `pending`, `packed`, `shipped`, `delivered`)[web:6][web:33]  

Admin:

- `GET /admin/orders` – all orders  
- `GET /admin/orders/:id` – full view  
- `PATCH /admin/orders/:id` – override statuses, internal notes  

---

### Payments & payouts

- `POST /payments/webhook` – payment provider webhook  
- `GET /payments/:orderId` – payment info for order  
- `POST /payments/:orderId/refund` – create refund / partial refund[web:5][web:25]  

Vendor payouts:

- `GET /vendor/payouts` – vendor payout history  
- `POST /vendor/payouts/request` – request payout (if manual)  
- `GET /admin/payouts` – admin view of all payouts  

---

### Reviews & wishlist

Reviews:

- `POST /products/:id/reviews` – create review (after purchase)  
- `PATCH /products/:id/reviews/:reviewId` – edit own review  
- `DELETE /products/:id/reviews/:reviewId` – delete own review  
- `GET /products/:id/ratings` – aggregate rating summary[web:5][web:24]  

Wishlist:

- `GET /wishlist` – list wishlist items  
- `POST /wishlist` – add product to wishlist  
- `DELETE /wishlist/:productId` – remove product from wishlist[web:5][web:24]  

---

### Search & content

Search:

- `GET /search` – global search (products, vendors)  
- `GET /search/suggestions` – autocomplete suggestions[web:5][web:61]  

Content:

- `GET /pages/:slug` – CMS page  
- `GET /blog/posts` – list posts  
- `GET /blog/posts/:slug` – blog post detail  

Admin content:

- `POST /admin/pages` / `PATCH /admin/pages/:id` / `DELETE /admin/pages/:id`  
- `POST /admin/blog/posts` / `PATCH /admin/blog/posts/:id` / `DELETE /admin/blog/posts/:id`[web:61]  

---

### Admin dashboard & analytics

- `GET /admin/dashboard/metrics` – KPIs (GMV, orders, active vendors, etc.)  
- `GET /admin/reports/sales` – sales by range/vendor/category  
- `GET /admin/reports/products` – best sellers, low stock[web:10][web:64]  

---

## Refine dashboard integration

This API is intentionally designed so an admin/vendor dashboard can be built later with Refine by mapping each resource to a data provider.[web:44][web:47][web:58]  

For a basic REST setup:

- Use `@refinedev/simple-rest` and point it to your API URL, assuming standard CRUD paths (`GET /resource`, `GET /resource/:id`, `POST /resource`, `PATCH /resource/:id`, `DELETE /resource/:id`).[web:47][web:67]  
- Register resources in Refine such as `"products"`, `"orders"`, `"vendors"`, `"users"`, `"categories"`, mapped to their respective endpoints.[web:44][web:50]  

If you adopt `@nestjsx/crud` decorators for some controllers:

- You can instead use `@refinedev/nestjsx-crud` which understands NestJSX CRUD conventions out of the box and reduces custom mapping.[web:39][web:42][web:58]  

Authentication and roles:

- Implement JWT auth in NestJS and configure a Refine `authProvider` plus an Axios instance adding `Authorization: Bearer <token>`, while Nest guards enforce roles (admin, vendor, customer) per route.[web:39][web:46][web:50]  
