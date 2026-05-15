import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/webhooks/midtrans/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      orders: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn(),
  },
}));

vi.mock('@/lib/resend/send-email', () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

function createValidWebhook(body: Record<string, unknown>) {
  const orderId = body.order_id as string;
  const statusCode = body.status_code as string;
  const grossAmount = body.gross_amount as string;
  const serverKey = 'test-server-key';
  const signature = crypto
    .createHash('sha512')
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest('hex');
  return { ...body, signature_key: signature };
}

describe('POST /api/webhooks/midtrans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects webhook with invalid signature', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'DDK-TEST-001',
        status_code: '200',
        gross_amount: '100000',
        signature_key: 'invalid-signature',
        transaction_status: 'settlement',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('is idempotent for duplicate settlement webhooks', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DDK-TEST-001',
      status: 'paid',
      totalAmount: 100000,
      midtransOrderId: 'DDK-TEST-001',
      createdAt: new Date(),
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
      deliveryMethod: 'pickup' as const,
      recipientEmail: 'budi@example.com',
      couponId: null,
      couponCode: null,
      pointsUsed: 0,
      pointsEarned: 100,
      customerNote: null,
      paymentExpiresAt: new Date(),
      paymentRetryCount: 0,
      midtransPaymentType: null,
      midtransVaNumber: null,
      paidAt: null,
      cancelledAt: null,
    } as any);

    const body = createValidWebhook({
      order_id: 'DDK-TEST-001',
      status_code: '200',
      gross_amount: '100000',
      transaction_status: 'settlement',
      payment_type: 'bank_transfer',
    });

    const req = new NextRequest('http://localhost/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.note).toBe('already_processed');
  });

  it('handles cancellation idempotency', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DDK-TEST-001',
      status: 'cancelled',
      totalAmount: 100000,
      midtransOrderId: 'DDK-TEST-001',
      createdAt: new Date(),
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
      deliveryMethod: 'pickup' as const,
      recipientEmail: 'budi@example.com',
      couponId: null,
      couponCode: null,
      pointsUsed: 0,
      pointsEarned: 0,
      customerNote: null,
      paymentExpiresAt: new Date(),
      paymentRetryCount: 0,
      midtransPaymentType: null,
      midtransVaNumber: null,
      paidAt: null,
      cancelledAt: null,
    } as any);

    const body = createValidWebhook({
      order_id: 'DDK-TEST-001',
      status_code: '200',
      gross_amount: '100000',
      transaction_status: 'cancel',
      payment_type: 'bank_transfer',
    });

    const req = new NextRequest('http://localhost/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.note).toBe('already_cancelled');
  });

  it('rejects amount mismatch on settlement', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.orders.findFirst).mockResolvedValue({
      id: 'order-1',
      orderNumber: 'DDK-TEST-001',
      status: 'pending_payment',
      totalAmount: 100000,
      midtransOrderId: 'DDK-TEST-001',
      createdAt: new Date(),
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
      deliveryMethod: 'pickup' as const,
      recipientEmail: 'budi@example.com',
      couponId: null,
      couponCode: null,
      pointsUsed: 0,
      pointsEarned: 100,
      customerNote: null,
      paymentExpiresAt: new Date(),
      paymentRetryCount: 0,
      midtransPaymentType: null,
      midtransVaNumber: null,
      paidAt: null,
      cancelledAt: null,
    } as any);

    const body = createValidWebhook({
      order_id: 'DDK-TEST-001',
      status_code: '200',
      gross_amount: '50000',
      transaction_status: 'settlement',
      payment_type: 'bank_transfer',
    });

    const req = new NextRequest('http://localhost/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown order', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.orders.findFirst).mockResolvedValue(undefined as any);

    const body = createValidWebhook({
      order_id: 'DDK-UNKNOWN-001',
      status_code: '200',
      gross_amount: '100000',
      transaction_status: 'settlement',
      payment_type: 'bank_transfer',
    });

    const req = new NextRequest('http://localhost/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});