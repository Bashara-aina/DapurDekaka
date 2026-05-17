import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { b2bQuotes, b2bQuoteItems, b2bProfiles, b2bQuoteCounters } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { success, validationError, serverError, notFound, unauthorized, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CreateQuoteSchema = z.object({
  b2bProfileId: z.string().uuid('ID profil B2B tidak valid'),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
  })).min(1, 'Minimal 1 item diperlukan'),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
  validDays: z.number().min(1).default(14),
});


export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const quotes = await db.query.b2bQuotes.findMany({
      with: {
        b2bProfile: {
          with: {
            user: true,
          },
        },
        items: true,
      },
      orderBy: (quotes, { desc }) => [desc(quotes.createdAt)],
    });

    return success(quotes);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const parsed = CreateQuoteSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { b2bProfileId, items, discountAmount, notes, validDays } = parsed.data;

    // Verify B2B profile exists
    const profile = await db.query.b2bProfiles.findFirst({
      where: eq(b2bProfiles.id, b2bProfileId),
    });

    if (!profile) {
      return notFound('Profil B2B tidak ditemukan');
    }

    // Calculate subtotal and total
    const subtotal = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const totalAmount = Math.max(0, subtotal - discountAmount);

    // Generate quote number using atomic counter
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');

    const quoteNumber = await db.transaction(async (tx) => {
      const result = await tx
        .insert(b2bQuoteCounters)
        .values({ date: dateStr, lastSequence: 1 })
        .onConflictDoUpdate({
          target: b2bQuoteCounters.date,
          set: {
            lastSequence: sql`${b2bQuoteCounters.lastSequence} + 1`,
            updatedAt: new Date(),
          },
        })
        .returning({ newSequence: b2bQuoteCounters.lastSequence });

      const seq = result[0]?.newSequence ?? 1;
      return `BBQ-${dateStr}-${String(seq).padStart(4, '0')}`;
    });

    // Calculate valid until date
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    // Create quote
    const [quote] = await db.insert(b2bQuotes).values({
      quoteNumber,
      b2bProfileId,
      createdBy: profile.userId,
      status: 'draft',
      subtotal,
      discountAmount,
      totalAmount,
      validUntil,
      notesId: notes || null,
    }).returning();

    if (!quote) {
      return serverError(new Error('Failed to create quote'));
    }

    // Create quote items
    const quoteItemsData = items.map(item => ({
      quoteId: quote.id,
      variantId: item.variantId,
      productNameId: '', // Will be filled from variant
      variantNameId: '',
      sku: '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.unitPrice * item.quantity,
    }));

    await db.insert(b2bQuoteItems).values(quoteItemsData);

    return success({ id: quote.id, quoteNumber }, 201);
  } catch (error) {
    console.error('[B2B Quote API Error]', error);
    return serverError(error);
  }
}