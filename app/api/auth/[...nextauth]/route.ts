import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { withRateLimit } from '@/lib/utils/rate-limit';
import type { NextResponse } from 'next/server';

// Wrap NextAuth handlers with rate limiting to prevent brute-force attacks
async function rateLimitedGet(req: NextRequest): Promise<Response> {
  return handlers.GET(req);
}

async function rateLimitedPost(req: NextRequest): Promise<Response> {
  return handlers.POST(req);
}

const wrappedHandlers = {
  GET: withRateLimit(rateLimitedGet, {
    windowMs: 60000,
    maxRequests: 10,
    keyGenerator: (req: NextRequest) =>
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown',
  }),
  POST: withRateLimit(rateLimitedPost, {
    windowMs: 60000,
    maxRequests: 10,
    keyGenerator: (req: NextRequest) =>
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown',
  }),
} as const;

export const GET: typeof handlers.GET = wrappedHandlers.GET;
export const POST: typeof handlers.POST = wrappedHandlers.POST;