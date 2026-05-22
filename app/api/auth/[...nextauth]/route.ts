import { NextRequest, NextResponse } from 'next/server';
import { handlers } from '@/lib/auth';
import { withRateLimit } from '@/lib/utils/rate-limit';

// Wrap NextAuth handlers with rate limiting to prevent brute-force attacks
const wrappedHandlers = {
  GET: withRateLimit(handlers.GET as (req: NextRequest) => Promise<Response>, {
    windowMs: 60000,
    maxRequests: 10,
    keyGenerator: (req: NextRequest) =>
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown',
  }),
  POST: withRateLimit(handlers.POST as (req: NextRequest) => Promise<Response>, {
    windowMs: 60000,
    maxRequests: 10,
    keyGenerator: (req: NextRequest) =>
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown',
  }),
};

export const { GET, POST } = wrappedHandlers;