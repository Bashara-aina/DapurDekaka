import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';
import { checkRateLimitAsync } from '@/lib/utils/rate-limit';

async function handleValidate(req: NextRequest) {
  try {
    const variantIdsParam = req.nextUrl.searchParams.get('variantIds');

    let variantIds: string[] = [];
    let cartQtys: number[] = [];

    if (variantIdsParam) {
      variantIds = variantIdsParam.split(',').filter(Boolean);
      const cartQtysParam = req.nextUrl.searchParams.get('quantities');
      cartQtys = cartQtysParam ? cartQtysParam.split(',').map(Number) : [];
    } else {
      const body = await req.json().catch(() => null);
      if (body?.items && Array.isArray(body.items)) {
        variantIds = body.items.map((i: { variantId: string; quantity?: number }) => i.variantId).filter(Boolean);
        cartQtys = body.items.map((i: { variantId: string; quantity?: number }) => i.quantity ?? 1);
      }
    }

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