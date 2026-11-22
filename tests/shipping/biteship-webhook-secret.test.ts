import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

describe('verifyBiteshipSignature — secret hardening', () => {
  const prevSecret = process.env.BITESHIP_WEBHOOK_SECRET;
  const prevApiKey = process.env.BITESHIP_API_KEY;

  beforeEach(() => {
    delete process.env.BITESHIP_WEBHOOK_SECRET;
    delete process.env.BITESHIP_API_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.BITESHIP_WEBHOOK_SECRET;
    else process.env.BITESHIP_WEBHOOK_SECRET = prevSecret;
    if (prevApiKey === undefined) delete process.env.BITESHIP_API_KEY;
    else process.env.BITESHIP_API_KEY = prevApiKey;
  });

  it('rejects when only API key is set (no secret fallback)', async () => {
    process.env.BITESHIP_API_KEY = 'biteship_test.only-api-key';
    const { verifyBiteshipSignature } = await import(
      '@/lib/shipping/providers/biteship/webhook'
    );
    const body = '{"status":"delivered"}';
    const sig = crypto
      .createHmac('sha256', 'biteship_test.only-api-key')
      .update(body)
      .digest('hex');
    expect(verifyBiteshipSignature(body, sig)).toBe(false);
  });

  it('accepts HMAC when BITESHIP_WEBHOOK_SECRET is set', async () => {
    process.env.BITESHIP_WEBHOOK_SECRET = 'dedicated-webhook-secret';
    const { verifyBiteshipSignature } = await import(
      '@/lib/shipping/providers/biteship/webhook'
    );
    const body = '{"status":"delivered"}';
    const sig = crypto
      .createHmac('sha256', 'dedicated-webhook-secret')
      .update(body)
      .digest('hex');
    expect(verifyBiteshipSignature(body, sig)).toBe(true);
  });
});
