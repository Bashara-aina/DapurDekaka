import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { success, serverError, validationError } from '@/lib/utils/api-response';
import { checkRateLimitAsync } from '@/lib/utils/rate-limit';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const cartValidateQuerySchema = z.object({
  variantIds: z.string().optional(),
  quantities: z.string().optional(),
});

const cartValidateBodySchema = z.object({
  items: z.array(z.object({
    variantId: z.string().uuid('variantId harus UUID yang valid'),
    quantity: z.number().int().min(1).max(99).optional().default(1),
  })).min(1, 'Minimal 1 item'),
});

async function handleValidate(req: NextRequest) {
  try {
    const variantIdsParam = req.nextUrl.searchParams.get('variantIds');

    if (variantIdsParam) {
      const parsedQuery = cartValidateQuerySchema.safeParse({
        variantIds: variantIdsParam,
        quantities: req.nextUrl.searchParams.get('quantities'),
      });
      if (!parsedQuery.success) {
        return validationError(parsedQuery.error);
      }

      const variantIds = variantIdsParam.split(',').filter(Boolean);
      const cartQtysParam = parsedQuery.data.quantities;
      const cartQtys = cartQtysParam ? cartQtysParam.split(',').map(Number) : [];

      if (variantIds.length === 0) {
        return success({ items: [] });
      }

      const variants = await db.query.productVariants.findMany({
        where: inArray(productVariants.id, variantIds),
        columns: {
          id: true,
          stock: true,
          isActive: true,
        },
      });

      const variantMap = new Map(variants.map((v) => [v.id, v]));

      const items = variantIds.map((variantId, index) => {
        const variant = variantMap.get(variantId);
        const cartQty = cartQtys[index] ?? 1;

        if (!variant) {
          return {
            variantId,
            cartQty,
            availableStock: 0,
            available: false,
          };
        }

        const availableStock = variant.isActive ? variant.stock : 0;
        const available = availableStock >= cartQty;

        return {
          variantId,
          cartQty,
          availableStock,
          available,
        };
      });

      return success({ items });
    } else {
      const body = await req.json().catch(() => null);
      if (!body?.items || !Array.isArray(body.items)) {
        return success({ items: [] });
      }

      const parsed = cartValidateBodySchema.safeParse(body);
      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const variantIds = parsed.data.items.map((i) => i.variantId);
      const cartQtys = parsed.data.items.map((i) => i.quantity);

      const variants = await db.query.productVariants.findMany({
        where: inArray(productVariants.id, variantIds),
        columns: {
          id: true,
          stock: true,
          isActive: true,
        },
      });

      const variantMap = new Map(variants.map((v) => [v.id, v]));

      const items = parsed.data.items.map((item, index) => {
        const variant = variantMap.get(item.variantId);
        const cartQty = cartQtys[index] ?? 1;

        if (!variant) {
          return {
            variantId: item.variantId,
            cartQty,
            availableStock: 0,
            available: false,
          };
        }

        const availableStock = variant.isActive ? variant.stock : 0;
        const available = availableStock >= cartQty;

        return {
          variantId: item.variantId,
          cartQty,
          availableStock,
          available,
        };
      });

      return success({ items });
    }
  } catch (error) {
    console.error('[cart/validate]', error);
    return serverError(error);
  }
}

export async function GET(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rateLimit = await checkRateLimitAsync(ip, 30, '1 m');
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      },
      { status: 429 }
    );
  }
  return handleValidate(req);
}

export async function POST(req: NextRequest) {
  const ip = req.ip || req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const rateLimit = await checkRateLimitAsync(ip, 30, '1 m');
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
      },
      { status: 429 }
    );
  }
  return handleValidate(req);
}