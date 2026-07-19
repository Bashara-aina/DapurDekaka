import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/checkout/initiate/route';
import { NextRequest } from 'next/server';

const VARIANT_ID = '550e8400-e29b-41d4-a716-446655440010';
const PRODUCT_ID = '550e8400-e29b-41d4-a716-446655440011';

const mockVariant = {
  id: VARIANT_ID,
  stock: 100,
  price: 50000,
  productId: PRODUCT_ID,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  nameId: '25 pcs',
  nameEn: '25 pcs',
  sortOrder: 0,
  weightGram: 500,
  lengthCm: 30,
  widthCm: 22,
  heightCm: 12,
  sku: 'DS-25',
  b2bPrice: null,
};

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      productVariants: { findMany: vi.fn() },
      users: { findFirst: vi.fn() },
      coupons: { findFirst: vi.fn() },
      orders: { findFirst: vi.fn() },
      pointsHistory: { findMany: vi.fn() },
    },
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  getSetting: vi.fn().mockImplementation((_key: string, type?: string) => {
    if (type === 'integer') return Promise.resolve(15);
    if (_key === 'biteship_origin_lat') return Promise.resolve('-6.958');
    if (_key === 'biteship_origin_lng') return Promise.resolve('107.636');
    return Promise.resolve(null);
  }),
}));

vi.mock('@/lib/shipping', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shipping')>('@/lib/shipping');
  return {
    ...actual,
    validateSelectedQuote: vi.fn().mockResolvedValue({
      id: 'frozen_express:sicepat:REG',
      courierCode: 'sicepat',
      courierType: 'REG',
      displayName: 'SiCepat REG',
      tier: 'frozen_express',
      actualCost: 20000,
      customerCost: 24000,
      estimatedDuration: '2 hari',
      disabled: false,
      disabledReason: null,
      insuranceAvailable: true,
    }),
  };
});

function basePickupBody(overrides: Record<string, unknown> = {}) {
  return {
    items: [{
      variantId: VARIANT_ID,
      productId: PRODUCT_ID,
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
    ...overrides,
  };
}

describe('POST /api/checkout/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates stock before creating order', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.productVariants.findMany).mockResolvedValue([
      { ...mockVariant, stock: 0 },
    ] as never);
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePickupBody()),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toContain('Stok tidak mencukupi');
  });

  it('rejects invalid coupon code', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.productVariants.findMany).mockResolvedValue([mockVariant] as never);
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue(undefined);
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePickupBody({ couponCode: 'INVALID' })),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('does not allow points redemption without sufficient balance', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.productVariants.findMany).mockResolvedValue([mockVariant] as never);
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined);
    vi.mocked(db.transaction).mockImplementation(async (fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            onConflictDoUpdate: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ newSequence: 1 }]),
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              for: vi.fn().mockResolvedValue([{ balance: 5000 }]),
            }),
          }),
        }),
        update: vi.fn(),
      };
      return fn(tx as never);
    });

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePickupBody({
        pointsUsed: 60000,
        pointsDiscount: 60000,
      })),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('handles idempotent re-submission within 30 sec for logged-in user', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.productVariants.findMany).mockResolvedValue([mockVariant] as never);
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-existing',
      orderNumber: 'DDK-20260514-0001',
      status: 'pending_payment',
      midtransSnapToken: 'existing-token',
      createdAt: new Date(Date.now() - 10 * 1000),
      userId: 'user-1',
      subtotal: 100000,
    } as never);

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePickupBody()),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data?.snapToken).toBe('existing-token');
  });

  it('rejects tampered shipping cost on delivery', async () => {
    const { validateSelectedQuote } = await import('@/lib/shipping');
    vi.mocked(validateSelectedQuote).mockResolvedValue(null);

    const { db } = await import('@/lib/db');
    vi.mocked(db.query.productVariants.findMany).mockResolvedValue([mockVariant] as never);
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...basePickupBody(),
        deliveryMethod: 'delivery',
        addressLine: 'Jl Test',
        district: 'Kecamatan',
        city: 'Bandung',
        postalCode: '40111',
        selectedQuoteId: 'frozen_express:sicepat:REG',
        latitude: -6.95,
        longitude: 107.63,
        shippingTier: 'frozen_express',
        customerShippingCost: 9999,
        biteshipActualCost: 20000,
        insuranceType: 'none',
        insuranceFee: 0,
        courierInstantAck: false,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const req = new NextRequest('http://localhost/api/checkout/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(basePickupBody({
        recipientEmail: 'invalid-email',
        subtotal: 50000,
        items: [{
          variantId: VARIANT_ID,
          productId: PRODUCT_ID,
          productNameId: 'Dimsum',
          productNameEn: 'Dimsum',
          variantNameId: '25 pcs',
          variantNameEn: '25 pcs',
          sku: 'DS-25',
          unitPrice: 50000,
          quantity: 1,
          weightGram: 500,
        }],
      })),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});
