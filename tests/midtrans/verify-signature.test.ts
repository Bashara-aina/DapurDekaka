import { describe, it, expect } from 'vitest';
import { computeMidtransSignature, verifyMidtransSignature } from '@/lib/midtrans/verify-signature';

const SERVER_KEY = 'SB-Mid-server-TESTKEY';

describe('verifyMidtransSignature — P0#1 body signature scheme', () => {
  const orderId = 'DDK-20260720-0001';
  const statusCode = '200';
  const grossAmount = '120000.00';
  const validSig = computeMidtransSignature(orderId, statusCode, grossAmount, SERVER_KEY);

  it('accepts a correctly signed body', () => {
    expect(
      verifyMidtransSignature(
        { orderId, statusCode, grossAmount, signatureKey: validSig },
        SERVER_KEY
      )
    ).toBe(true);
  });

  it('rejects a tampered gross_amount', () => {
    expect(
      verifyMidtransSignature(
        { orderId, statusCode, grossAmount: '999999.00', signatureKey: validSig },
        SERVER_KEY
      )
    ).toBe(false);
  });

  it('rejects a missing signature_key', () => {
    expect(
      verifyMidtransSignature({ orderId, statusCode, grossAmount, signatureKey: undefined }, SERVER_KEY)
    ).toBe(false);
  });

  it('rejects an empty signature_key', () => {
    expect(
      verifyMidtransSignature({ orderId, statusCode, grossAmount, signatureKey: '' }, SERVER_KEY)
    ).toBe(false);
  });

  it('rejects when the server key is undefined', () => {
    expect(
      verifyMidtransSignature({ orderId, statusCode, grossAmount, signatureKey: validSig }, undefined)
    ).toBe(false);
  });

  it('rejects the wrong (old) header scheme sha512(serverKey + rawBody)', () => {
    // The legacy scheme is not the body signature — must not validate.
    const legacy = computeMidtransSignature(SERVER_KEY, '', '', '');
    expect(
      verifyMidtransSignature({ orderId, statusCode, grossAmount, signatureKey: legacy }, SERVER_KEY)
    ).toBe(false);
  });

  it('rejects non-string fields', () => {
    expect(
      verifyMidtransSignature(
        { orderId: 123, statusCode, grossAmount, signatureKey: validSig },
        SERVER_KEY
      )
    ).toBe(false);
  });
});
