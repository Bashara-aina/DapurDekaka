import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const cancelGet = vi.fn();
const reconcileGet = vi.fn();
const retryGet = vi.fn();

vi.mock('@/lib/utils/cron-auth', () => ({
  verifyCronAuth: () => true,
}));

vi.mock('@/app/api/cron/cancel-expired-orders/route', () => ({
  GET: (...args: unknown[]) => cancelGet(...args),
}));

vi.mock('@/app/api/cron/reconcile-payments/route', () => ({
  GET: (...args: unknown[]) => reconcileGet(...args),
}));

vi.mock('@/app/api/cron/retry-dispatch/route', () => ({
  GET: (...args: unknown[]) => retryGet(...args),
}));

describe('cron/hourly consolidation', () => {
  beforeEach(() => {
    cancelGet.mockReset();
    reconcileGet.mockReset();
    retryGet.mockReset();
  });

  it('runs all three money/ops jobs in one wake and reports allOk', async () => {
    const okJson = (data: unknown) =>
      new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

    cancelGet.mockResolvedValue(okJson({ cancelled: 0 }));
    reconcileGet.mockResolvedValue(okJson({ checked: 0 }));
    retryGet.mockResolvedValue(okJson({ retried: 0 }));

    const { GET } = await import('@/app/api/cron/hourly/route');
    const req = new NextRequest('http://localhost/api/cron/hourly');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.allOk).toBe(true);
    expect(body.data.results).toHaveLength(3);
    expect(cancelGet).toHaveBeenCalledTimes(1);
    expect(reconcileGet).toHaveBeenCalledTimes(1);
    expect(retryGet).toHaveBeenCalledTimes(1);
    // Sequential single-wake: cancel before reconcile before retry
    const cancelOrder = cancelGet.mock.invocationCallOrder[0] ?? 0;
    const reconcileOrder = reconcileGet.mock.invocationCallOrder[0] ?? 0;
    const retryOrder = retryGet.mock.invocationCallOrder[0] ?? 0;
    expect(cancelOrder).toBeLessThan(reconcileOrder);
    expect(reconcileOrder).toBeLessThan(retryOrder);
  });

  it('continues remaining jobs if one sub-job fails', async () => {
    cancelGet.mockRejectedValue(new Error('boom'));
    reconcileGet.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    retryGet.mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );

    const { GET } = await import('@/app/api/cron/hourly/route');
    const req = new NextRequest('http://localhost/api/cron/hourly');
    const res = await GET(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data.allOk).toBe(false);
    expect(body.data.results[0].ok).toBe(false);
    expect(reconcileGet).toHaveBeenCalled();
    expect(retryGet).toHaveBeenCalled();
  });
});
