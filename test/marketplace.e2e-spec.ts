import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as bodyParser from 'body-parser';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { MockPaymentProvider } from '../src/payments/providers/mock-payment.provider';
import { UserRole, User } from '../src/users/entities/user.entity';
import {
  Vendor,
  VendorStatus,
} from '../src/vendors/entities/vendor.entity';

// Shared state across the suite
let app: INestApplication;
let server: any;
let ds: DataSource;
let mockProvider: MockPaymentProvider;

const uniq = (s: string) => `${s}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

async function register(payload: { email: string; password: string }) {
  const res = await request(server).post('/auth/register').send({
    email: payload.email,
    password: payload.password,
    firstName: 'Test',
    lastName: 'User',
  });
  expect(res.status).toBe(201);
  return res.body as { accessToken: string; user: { id: string } };
}

async function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication({ bodyParser: false });
  app.use(
    bodyParser.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(bodyParser.urlencoded({ extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
  server = app.getHttpServer();
  ds = app.get(DataSource);
  mockProvider = app.get(MockPaymentProvider);
});

afterAll(async () => {
  await app?.close();
});

describe('Marketplace flow (e2e)', () => {
  const customerEmail = uniq('customer') + '@test.io';
  const vendorEmail = uniq('vendor') + '@test.io';
  const password = 'Sup3rSecret!';
  let customer: { id: string; token: string };
  let vendor: { id: string; token: string; vendorRowId: string };
  let productId: string;
  let promotionCode: string;
  let orderId: string;
  let intentId: string;

  it('registers a customer and a vendor user', async () => {
    const c = await register({ email: customerEmail, password });
    customer = { id: c.user.id, token: c.accessToken };

    const v = await register({ email: vendorEmail, password });
    vendor = { id: v.user.id, token: v.accessToken, vendorRowId: '' };

    // Promote the vendor user manually to VENDOR + ADMIN roles for the test.
    await ds
      .getRepository(User)
      .update(vendor.id, { roles: [UserRole.VENDOR, UserRole.ADMIN] });

    // Re-login to get a token with new roles
    const relog = await request(server)
      .post('/auth/login')
      .send({ email: vendorEmail, password });
    expect([200, 201]).toContain(relog.status);
    vendor.token = relog.body.accessToken;
  });

  it('creates and approves a vendor', async () => {
    const slug = uniq('shop').toLowerCase();
    const apply = await request(server)
      .post('/vendors/apply')
      .set(await bearer(vendor.token))
      .send({
        name: 'Test Shop',
        slug,
        description: 'A test shop',
      });
    expect(apply.status).toBe(201);
    vendor.vendorRowId = apply.body.id;

    await ds
      .getRepository(Vendor)
      .update(vendor.vendorRowId, { status: VendorStatus.APPROVED });
  });

  it('vendor creates a product with stock=5', async () => {
    const slug = uniq('widget').toLowerCase();
    const r = await request(server)
      .post('/vendor/products')
      .set(await bearer(vendor.token))
      .send({
        title: 'Test Widget',
        slug,
        description: 'A widget',
        basePrice: 20.0,
        stock: 5,
        status: 'active',
      });
    expect(r.status).toBe(201);
    productId = r.body.id;
  });

  it('admin creates a tax zone (US/CA = 8.75%)', async () => {
    const r = await request(server)
      .post('/admin/tax-zones')
      .set(await bearer(vendor.token))
      .send({
        country: 'US',
        state: 'CA',
        name: 'California',
        rate: 0.0875,
      });
    // 201 on first run, 409 if a prior run already created the zone — both acceptable
    expect([201, 409]).toContain(r.status);
  });

  it('vendor creates a flat $7 shipping method', async () => {
    const r = await request(server)
      .post('/vendor/shipping-methods')
      .set(await bearer(vendor.token))
      .send({
        name: 'Standard US',
        calculator: 'flat',
        baseAmount: 7.0,
        countries: ['US'],
      });
    expect(r.status).toBe(201);
  });

  it('admin creates a 10% promotion code', async () => {
    promotionCode = uniq('SAVE').toUpperCase();
    const r = await request(server)
      .post('/admin/promotions')
      .set(await bearer(vendor.token))
      .send({
        code: promotionCode,
        type: 'percent',
        value: 10,
        usageLimit: 100,
      });
    expect(r.status).toBe(201);
  });

  it('customer adds 2 widgets to cart', async () => {
    const r = await request(server)
      .post('/cart/items')
      .set(await bearer(customer.token))
      .send({ productId, quantity: 2 });
    expect(r.status).toBe(201);
  });

  it('checkout summary computes shipping + tax + discount correctly', async () => {
    const r = await request(server)
      .post('/checkout/summary')
      .set(await bearer(customer.token))
      .send({
        shippingAddress: { country: 'US', state: 'CA' },
        couponCode: promotionCode,
      });
    expect(r.status).toBe(201);
    expect(Number(r.body.subtotal)).toBe(40);
    expect(Number(r.body.shipping)).toBe(7);
    expect(Number(r.body.discount)).toBe(4); // 10% of 40
    // Taxable = 40 - 4 = 36, tax = 36 * 0.0875 = 3.15
    expect(Number(r.body.tax)).toBe(3.15);
    // Total = 36 + 7 + 3.15 = 46.15
    expect(Number(r.body.total)).toBe(46.15);
  });

  it('creates an order — stock decrements, intent is created', async () => {
    const r = await request(server)
      .post('/checkout/create-session')
      .set(await bearer(customer.token))
      .send({
        shippingAddress: { country: 'US', state: 'CA', street: '1 a', city: 'LA', postalCode: '90001' },
        couponCode: promotionCode,
      });
    expect(r.status).toBe(201);
    orderId = r.body.orderId;
    intentId = r.body.paymentIntentId;
    expect(intentId).toMatch(/^pi_mock_/);
    expect(Number(r.body.total)).toBe(46.15);

    // stock should be 5 -> 3
    const prodRow = await ds
      .getRepository('products' as any)
      .findOne({ where: { id: productId } });
    expect(prodRow.stock).toBe(3);
  });

  it('rejects an oversell (try to buy 10 when only 3 left)', async () => {
    // Need a second cart entry for a new customer to test oversell.
    const c2 = await register({
      email: uniq('cust2') + '@test.io',
      password,
    });
    await request(server)
      .post('/cart/items')
      .set({ Authorization: `Bearer ${c2.accessToken}` })
      .send({ productId, quantity: 10 });

    const r = await request(server)
      .post('/checkout/create-session')
      .set({ Authorization: `Bearer ${c2.accessToken}` })
      .send({
        shippingAddress: { country: 'US', state: 'CA' },
      });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/Insufficient stock/i);

    // stock unchanged
    const prodRow = await ds
      .getRepository('products' as any)
      .findOne({ where: { id: productId } });
    expect(prodRow.stock).toBe(3);
  });

  it('signed webhook marks order paid and accrues commission', async () => {
    const payload = JSON.stringify({
      id: 'evt_test_1',
      type: 'payment.succeeded',
      data: { intentId },
    });
    const signature = mockProvider.signPayload(payload);

    const r = await request(server)
      .post('/payments/webhook')
      .set('x-payment-signature', signature)
      .set('content-type', 'application/json')
      .send(payload);
    expect(r.status).toBe(200);

    // Verify order is paid
    const order = await ds
      .getRepository('orders' as any)
      .findOne({ where: { id: orderId } });
    expect(order.paymentStatus).toBe('paid');

    // Verify commission entries exist
    const entries = await ds.query(
      'SELECT * FROM commission_entries WHERE "orderId" = $1',
      [orderId],
    );
    expect(entries.length).toBeGreaterThan(0);
    expect(Number(entries[0].grossAmount)).toBe(40);
    // Default vendor commission rate is 10
    expect(Number(entries[0].commissionAmount)).toBe(4);
    expect(Number(entries[0].netAmount)).toBe(36);
    expect(entries[0].status).toBe('available');
  });

  it('webhook with bad signature is rejected', async () => {
    const payload = JSON.stringify({
      id: 'evt_test_2',
      type: 'payment.succeeded',
      data: { intentId },
    });
    const r = await request(server)
      .post('/payments/webhook')
      .set('x-payment-signature', 't=1,v1=deadbeef')
      .set('content-type', 'application/json')
      .send(payload);
    expect(r.status).toBe(401);
  });

  it('vendor sees the right earnings balance', async () => {
    const r = await request(server)
      .get('/vendor/earnings/balance')
      .set(await bearer(vendor.token));
    expect(r.status).toBe(200);
    expect(Number(r.body.available)).toBe(36);
  });

  it('vendor requests a payout — reserves the balance', async () => {
    const r = await request(server)
      .post('/vendor/payouts/request')
      .set(await bearer(vendor.token))
      .send({ notes: 'first payout' });
    expect(r.status).toBe(201);
    expect(Number(r.body.amount)).toBe(36);

    const after = await request(server)
      .get('/vendor/earnings/balance')
      .set(await bearer(vendor.token));
    expect(Number(after.body.available)).toBe(0);
    expect(Number(after.body.paid)).toBe(36);
  });

  it('admin refunds the order — payment status updates and commissions reverse', async () => {
    const r = await request(server)
      .post(`/payments/${orderId}/refund`)
      .set(await bearer(vendor.token))
      .send({ reason: 'customer request' });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('refunded');

    const order = await ds
      .getRepository('orders' as any)
      .findOne({ where: { id: orderId } });
    expect(order.paymentStatus).toBe('refunded');

    const remaining = await ds.query(
      `SELECT status FROM commission_entries WHERE "orderId" = $1`,
      [orderId],
    );
    // Status either reversed or paid (paid entries are kept as paid; new entries would be reversed)
    expect(remaining.every((r: any) => ['reversed', 'paid'].includes(r.status))).toBe(true);
  });

  it('rejects unknown coupon code', async () => {
    const r = await request(server)
      .post('/checkout/apply-coupon')
      .set(await bearer(customer.token))
      .send({ code: 'NOPE-XYZ' });
    expect(r.status).toBe(400);
  });
});
