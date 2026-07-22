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
  GET: withRateLimit(rateLimitedGet, 'auth'),
  POST: withRateLimit(rateLimitedPost, 'auth'),
} as const;

export const GET: typeof handlers.GET = wrappedHandlers.GET;
export const POST: typeof handlers.POST = wrappedHandlers.POST;