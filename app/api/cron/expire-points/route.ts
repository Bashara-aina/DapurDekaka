import { NextRequest } from 'next/server';
import { expireOverduePoints } from '@/lib/services/points.service';
import { badRequest } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const count = await expireOverduePoints();
    return new Response(`Points expiry complete. Expired: ${count} users.`, { status: 200 });
  } catch (e: any) {
    console.error('[CRON] Expire points error:', e);
    return badRequest(e.message);
  }
}