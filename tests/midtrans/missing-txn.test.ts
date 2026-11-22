import { describe, it, expect } from 'vitest';
import { isMidtransTransactionMissing } from '@/lib/midtrans/status';

describe('isMidtransTransactionMissing', () => {
  it('detects Midtrans HTTP 404 transaction missing payloads', () => {
    const err = new Error(
      'Midtrans API is returning API error. HTTP status code: 404. API response: {"status_code":"404","status_message":"Transaction doesn\'t exist."}'
    );
    expect(isMidtransTransactionMissing(err)).toBe(true);
  });

  it('does not treat timeouts or 5xx as missing', () => {
    expect(isMidtransTransactionMissing(new Error('Request timed out after 15000ms'))).toBe(false);
    expect(
      isMidtransTransactionMissing(new Error('Midtrans API error. HTTP status code: 503'))
    ).toBe(false);
  });
});
