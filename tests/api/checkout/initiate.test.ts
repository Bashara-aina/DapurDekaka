import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/checkout/initiate/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      productVariants: {
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
      coupons: {
        findFirst: vi.fn(),
      },
      orders: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', role: 'customer' } }),
}));

vi.mock('@/lib/midtrans/create-transaction', () => ({
  createMidtransTransaction: vi.fn().mockResolvedValue({
    snapToken: 'test-snap-token',
    midtransOrderId: 'DDK-20260514-0001',
  }),
}));

vi.mock('@/lib/settings/get-settings', () => ({
  getSetting: vi.fn().mockResolvedValue(15),
}));

describe('POST /api/checkout/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates stock before creating order', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.productVariants.findMany).mockResolvedValue([
      {
        id: 'variant-1',
        stock: 0,
        price: 50000,
        productId: 'prod-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        nameId: '25 pcs',
        nameEn: '25 pcs',
        sortOrder: 0,
        weightGram: 500,
        sku: 'DS-25',
        b2bPrice: null,
      },
    ] as any);

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          variantId: 'variant-1',
          productId: 'prod-1',
          productNameId: 'Dimsum',
          productNameEn: 'Dimsum',
          variantNameId: '25 pcs',
          variantNameEn: '25 pcs',
          sku: 'DS-25',
          unitPrice: 50000,
          quantity: 2,
          weightGram: 500,
        }],
        deliveryMethod: 'delivery',
        recipientName: 'Budi',
        recipientEmail: 'budi@example.com',
        recipientPhone: '08123456789',
        addressLine: 'Jl Test',
        district: 'Kecamatan',
        city: 'Bandung',
        cityId: '23',
        province: 'Jawa Barat',
        provinceId: '9',
        postalCode: '40111',
        courierCode: 'sicepat',
        courierService: 'FROZEN',
        courierName: 'SiCepat FROZEN',
        shippingCost: 25000,
        subtotal: 100000,
        discountAmount: 0,
        pointsDiscount: 0,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Stok tidak mencukupi');
  });

  it('applies percentage coupon correctly', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.productVariants.findMany).mockResolvedValue([
      {
        id: 'variant-1',
        stock: 100,
        price: 50000,
        productId: 'prod-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        nameId: '25 pcs',
        nameEn: '25 pcs',
        sortOrder: 0,
        weightGram: 500,
        sku: 'DS-25',
        b2bPrice: null,
      },
    ] as any);
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'coupon-1',
      code: 'DISKON10',
      type: 'percentage' as const,
      discountValue: 10,
      maxDiscountAmount: 5000,
      isActive: true,
      minOrderAmount: 0,
      usedCount: 0,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startsAt: null,
      expiresAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Diskon 10%',
      nameEn: '10% Discount',
      createdBy: 'system',
    } as any);
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined as any);

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          variantId: 'variant-1',
          productId: 'prod-1',
          productNameId: 'Dimsum',
          productNameEn: 'Dimsum',
          variantNameId: '25 pcs',
          variantNameEn: '25 pcs',
          sku: 'DS-25',
          unitPrice: 50000,
          quantity: 2,
          weightGram: 500,
        }],
        deliveryMethod: 'pickup',
        recipientName: 'Budi',
        recipientEmail: 'budi@example.com',
        recipientPhone: '08123456789',
        subtotal: 100000,
        couponCode: 'DISKON10',
        discountAmount: 10000,
        pointsDiscount: 0,
      }),
    });

    const res = await POST(req);
    expect([200, 201]).toContain(res.status);
  });

  it('does not allow points redemption without sufficient balance', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.productVariants.findMany).mockResolvedValue([
      {
        id: 'variant-1',
        stock: 100,
        price: 50000,
        productId: 'prod-1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        nameId: '25 pcs',
        nameEn: '25 pcs',
        sortOrder: 0,
        weightGram: 500,
        sku: 'DS-25',
        b2bPrice: null,
      },
    ] as any);
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: 'user-1',
      pointsBalance: 5000,
      name: 'Budi',
      email: 'budi@example.com',
      emailVerified: null,
      image: null,
      passwordHash: null,
      phone: null,
      role: 'customer' as const,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined as any);

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          variantId: 'variant-1',
          productId: 'prod-1',
          productNameId: 'Dimsum',
          productNameEn: 'Dimsum',
          variantNameId: '25 pcs',
          variantNameEn: '25 pcs',
          sku: 'DS-25',
          unitPrice: 50000,
          quantity: 2,
          weightGram: 500,
        }],
        deliveryMethod: 'pickup',
        recipientName: 'Budi',
        recipientEmail: 'budi@example.com',
        recipientPhone: '08123456789',
        subtotal: 100000,
        pointsUsed: 60000,
        pointsDiscount: 60000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Saldo poin tidak mencukupi');
  });

  it('handles idempotent re-submission within 5 min', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-existing',
      orderNumber: 'DDK-20260514-0001',
      status: 'pending_payment',
      midtransSnapToken: 'existing-token',
      createdAt: new Date(Date.now() - 2 * 60 * 1000),
      updatedAt: new Date(),
      userId: null,
      recipientName: 'Budi',
      recipientPhone: '08123456789',
      addressLine: null,
      district: null,
      city: null,
      cityId: null,
      province: null,
      provinceId: null,
      postalCode: null,
      courierCode: null,
      courierService: null,
      courierName: null,
      shippingCost: 0,
      subtotal: 100000,
      discountAmount: 0,
      pointsDiscount: 0,
      totalAmount: 100000,
      deliveryMethod: 'pickup' as const,
      recipientEmail: 'budi@example.com',
      couponId: null,
      couponCode: null,
      pointsUsed: 0,
      pointsEarned: 100,
      customerNote: null,
      paymentExpiresAt: new Date(),
      paymentRetryCount: 0,
      midtransOrderId: null,
      midtransPaymentType: null,
      midtransVaNumber: null,
      paidAt: null,
      cancelledAt: null,
    } as any);

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          variantId: 'variant-1',
          productId: 'prod-1',
          productNameId: 'Dimsum',
          productNameEn: 'Dimsum',
          variantNameId: '25 pcs',
          variantNameEn: '25 pcs',
          sku: 'DS-25',
          unitPrice: 50000,
          quantity: 2,
          weightGram: 500,
        }],
        deliveryMethod: 'pickup',
        recipientName: 'Budi',
        recipientEmail: 'budi@example.com',
        recipientPhone: '08123456789',
        subtotal: 100000,
      }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data?.snapToken).toBe('existing-token');
  });

  it('rejects invalid email format', async () => {
    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          variantId: '550e8400-e29b-41d4-a716-446655440000',
          productId: '550e8400-e29b-41d4-a716-446655440001',
          productNameId: 'Dimsum',
          productNameEn: 'Dimsum',
          variantNameId: '25 pcs',
          variantNameEn: '25 pcs',
          sku: 'DS-25',
          unitPrice: 50000,
          quantity: 1,
          weightGram: 500,
        }],
        deliveryMethod: 'pickup',
        recipientName: 'Budi',
        recipientEmail: 'invalid-email',
        recipientPhone: '08123456789',
        subtotal: 50000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});