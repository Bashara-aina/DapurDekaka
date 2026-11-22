import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { isSameOriginRequest } from '@/lib/utils/same-origin';

describe('isSameOriginRequest — admin mutation gate', () => {
  it('rejects cross-origin POST', () => {
    const req = new NextRequest('https://www.dapurdekaka.com/api/admin/orders', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        host: 'www.dapurdekaka.com',
      },
    });
    expect(isSameOriginRequest(req)).toBe(false);
  });

  it('allows same-origin POST', () => {
    const req = new NextRequest('https://www.dapurdekaka.com/api/admin/orders', {
      method: 'POST',
      headers: {
        origin: 'https://www.dapurdekaka.com',
        host: 'www.dapurdekaka.com',
      },
    });
    expect(isSameOriginRequest(req)).toBe(true);
  });
});
