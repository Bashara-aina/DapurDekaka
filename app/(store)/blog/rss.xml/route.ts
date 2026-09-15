import { NextResponse, type NextRequest } from 'next/server';

export const revalidate = 3600;

/**
 * GET /blog/rss.xml — permanent redirect to the canonical feed (/feed.xml).
 *
 * This route previously duplicated the feed with weaker guarantees (no error
 * handling → broke `next build` without env; unescaped XML; unused relation).
 * One canonical feed; readers follow the 308 and keep their subscriptions.
 */
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/feed.xml', req.url), 308);
}
