import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { withRateLimit } from '@/lib/utils/rate-limit';

/**
 * NextAuth GET (session/csrf/providers/oauth callback) must not use the strict
 * auth tier — SessionProvider polls /api/auth/session and 5/15min blocks checkout.
 * POST (credentials sign-in) stays on the auth brute-force tier.
 */
async function getHandler(req: NextRequest): Promise<Response> {
  return handlers.GET(req);
}

async function postHandler(req: NextRequest): Promise<Response> {
  return handlers.POST(req);
}

export const GET = withRateLimit(getHandler, 'public');
export const POST = withRateLimit(postHandler, 'auth');
