import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  success,
  serverError,
  validationError,
} from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { searchAreas } from '@/lib/shipping';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const schema = z.object({
  query: z.string().min(3).max(200),
});

export const GET = withRateLimit(
  async (req: NextRequest) => {
    try {
      const query = req.nextUrl.searchParams.get('query') ?? '';
      const parsed = schema.safeParse({ query });

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const areas = await searchAreas(parsed.data.query);
      return success({ areas });
    } catch (error) {
      logger.error('[shipping/maps/autocomplete]', {
        error: error instanceof Error ? error.message : String(error),
      });
      return serverError(error);
    }
  },
  'public'
);
