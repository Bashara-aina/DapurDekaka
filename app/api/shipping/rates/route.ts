import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { success, validationError, serverError, conflict } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { getShippingRates } from '@/lib/shipping/get-rates';
import type { ShippingItemInput } from '@/lib/shipping/types';
import { getSetting } from '@/lib/settings/get-settings';
import { WAREHOUSE_ORIGIN_LAT, WAREHOUSE_ORIGIN_LNG } from '@/lib/shipping/constants';
import { resolveEffectivePhase, applyPhaseLockToRates } from '@/lib/shipping/phase-gate';
import { isServiceable } from '@/lib/shipping/geo-policy';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ratesSchema = z.object({
  destLat: z.number(),
  destLng: z.number(),
  destAddress: z.string().optional(),
  postalCode: z.string().optional(),
  subtotal: z.number().int().min(0),
  items: z.array(
    z.object({
      variantId: z.string().uuid(),
      quantity: z.number().int().min(1).max(99),
    })
  ).min(1),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = ratesSchema.safeParse(body);
      if (!parsed.success) return validationError(parsed.error);

      const { destLat, destLng, subtotal, items } = parsed.data;
      const variantIds = items.map((i) => i.variantId);

      const dbVariants = await db.query.productVariants.findMany({
        where: inArray(productVariants.id, variantIds),
        with: { product: true },
      });

      const shippingItems: ShippingItemInput[] = [];
      for (const cartItem of items) {
        const variant = dbVariants.find((v) => v.id === cartItem.variantId);
        if (!variant) continue;
        shippingItems.push({
          variantId: variant.id,
          quantity: cartItem.quantity,
          weightGram: variant.weightGram,
          lengthCm: variant.lengthCm,
          widthCm: variant.widthCm,
          heightCm: variant.heightCm,
          name: variant.nameId,
          value: variant.price,
        });
      }

      if (shippingItems.length === 0) {
        return conflict('Item tidak ditemukan');
      }

      const originLat =
        (await getSetting<number>('biteship_origin_lat', 'number')) ??
        WAREHOUSE_ORIGIN_LAT;
      const originLng =
        (await getSetting<number>('biteship_origin_lng', 'number')) ??
        WAREHOUSE_ORIGIN_LNG;

      const effectivePhase = await resolveEffectivePhase();
      const geoCheck = isServiceable(destLat, destLng, 'pickup', 0, effectivePhase, subtotal);
      if (geoCheck.destinationClass === 'beyond') {
        return conflict('Wilayah belum didukung. Silakan hubungi kami via WhatsApp.');
      }

      const rates = await getShippingRates({
        originLat,
        originLng,
        destLat,
        destLng,
        items: shippingItems,
        subtotal,
      });

      // FD#2: lock frozen tiers not permitted by the effective phase so they are
      // shown as disabled instead of quoted-then-503'd at initiate.
      const gatedRates = applyPhaseLockToRates(rates, effectivePhase, subtotal);

      return success(gatedRates);
    } catch (error) {
      return serverError(error);
    }
  },
  'public'
);
