import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/coupons/validate/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      coupons: { findFirst: vi.fn() },
    },
    select: vi.fn(),
  },
}));

describe('POST /api/coupons/validate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects expired coupon with generic message', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'c1',
      code: 'EXPIRED',
      type: 'percentage' as const,
      discountValue: 10,
      isActive: true,
      minOrderAmount: 0,
      usedCount: 0,
      expiresAt: new Date('2020-01-01'),
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startsAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Expired',
      nameEn: 'Expired',
      createdBy: 'system',
    } as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'EXPIRED', subtotal: 100000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(['Kupon tidak valid', 'Kupon tidak valid untuk pesanan ini']).toContain(json.error);
  });

  it('rejects inactive coupon with generic message', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue(undefined as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'NOTEXIST', subtotal: 100000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Kupon tidak valid');
  });

  it('rejects coupon when not yet started', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'c1',
      code: 'FUTURE',
      type: 'percentage' as const,
      discountValue: 15,
      isActive: true,
      minOrderAmount: 0,
      usedCount: 0,
      startsAt: new Date('2099-01-01'),
      expiresAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      maxUses: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Future',
      nameEn: 'Future',
      createdBy: 'system',
    } as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'FUTURE', subtotal: 100000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Kupon tidak valid');
  });

  it('rejects coupon when max uses exceeded', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'c1',
      code: 'MAXEDOUT',
      type: 'percentage' as const,
      discountValue: 10,
      isActive: true,
      minOrderAmount: 0,
      usedCount: 100,
      maxUses: 100,
      expiresAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startsAt: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Maxed',
      nameEn: 'Maxed',
      createdBy: 'system',
    } as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MAXEDOUT', subtotal: 100000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Kupon tidak valid');
  });

  it('rejects coupon when subtotal below minimum order', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'c1',
      code: 'MINORDER',
      type: 'percentage' as const,
      discountValue: 10,
      isActive: true,
      minOrderAmount: 200000,
      usedCount: 0,
      expiresAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startsAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Min Order',
      nameEn: 'Min Order',
      createdBy: 'system',
    } as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'MINORDER', subtotal: 50000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe('Kupon tidak valid untuk pesanan ini');
  });

  it('accepts valid percentage coupon and calculates discount', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'c1',
      code: 'DISKON20',
      type: 'percentage' as const,
      discountValue: 20,
      isActive: true,
      minOrderAmount: 50000,
      usedCount: 0,
      expiresAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startsAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Diskon 20%',
      nameEn: '20% Discount',
      createdBy: 'system',
    } as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'DISKON20', subtotal: 100000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data?.discountAmount).toBe(20000);
  });

  it('accepts valid fixed discount coupon', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'c1',
      code: 'FLAT50K',
      type: 'fixed' as const,
      discountValue: 50000,
      isActive: true,
      minOrderAmount: 0,
      usedCount: 0,
      expiresAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startsAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Flat 50k',
      nameEn: 'Flat 50k',
      createdBy: 'system',
    } as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'FLAT50K', subtotal: 100000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data?.discountAmount).toBe(50000);
  });

  it('caps percentage discount at maxDiscountAmount', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'c1',
      code: 'CAPPED50',
      type: 'percentage' as const,
      discountValue: 50,
      maxDiscountAmount: 15000,
      isActive: true,
      minOrderAmount: 0,
      usedCount: 0,
      expiresAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startsAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Capped 50',
      nameEn: 'Capped 50',
      createdBy: 'system',
    } as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'CAPPED50', subtotal: 100000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data?.discountAmount).toBe(15000);
  });

  it('handles buy_x_get_y coupon type', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.coupons.findFirst).mockResolvedValue({
      id: 'c1',
      code: 'BUY2GET1',
      type: 'buy_x_get_y' as const,
      buyQuantity: 2,
      getQuantity: 1,
      isActive: true,
      minOrderAmount: 0,
      usedCount: 0,
      expiresAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      startsAt: null,
      maxUses: null,
      maxUsesPerUser: null,
      applicableProductIds: null,
      applicableCategoryIds: null,
      freeShipping: false,
      nameId: 'Buy 2 Get 1',
      nameEn: 'Buy 2 Get 1',
      createdBy: 'system',
    } as any);

    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'BUY2GET1', subtotal: 100000 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data?.type).toBe('buy_x_get_y');
    expect(json.data?.buyXgetY).toEqual({ buyQuantity: 2, getQuantity: 1 });
    expect(json.data?.discountAmount).toBe(0);
  });

  it('returns 422 for invalid request body', async () => {
    const req = new NextRequest('http://localhost/api/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '', subtotal: -100 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});