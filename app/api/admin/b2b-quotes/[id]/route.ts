import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { b2bQuotes, b2bQuoteItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, notFound, serverError } from '@/lib/utils/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quote = await db.query.b2bQuotes.findFirst({
      where: eq(b2bQuotes.id, id),
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: true,
              },
            },
          },
        },
        b2bProfile: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!quote) {
      return notFound('Quote tidak ditemukan');
    }

    return success(quote);
  } catch (error) {
    return serverError(error);
  }
}

const UpdateQuoteSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  discountAmount: z.number().min(0).optional(),
  notesId: z.string().optional(),
  notesEn: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateQuoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Data tidak valid' },
        { status: 422 }
      );
    }

    const existing = await db.query.b2bQuotes.findFirst({
      where: eq(b2bQuotes.id, id),
    });

    if (!existing) {
      return notFound('Quote tidak ditemukan');
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status) {
      updateData.status = parsed.data.status;
    }
    if (parsed.data.discountAmount !== undefined) {
      updateData.discountAmount = parsed.data.discountAmount;
      // Recalculate total
      updateData.totalAmount = Math.max(0, existing.subtotal - parsed.data.discountAmount);
    }
    if (parsed.data.notesId !== undefined) {
      updateData.notesId = parsed.data.notesId;
    }
    if (parsed.data.notesEn !== undefined) {
      updateData.notesEn = parsed.data.notesEn;
    }

    await db.update(b2bQuotes)
      .set(updateData)
      .where(eq(b2bQuotes.id, id));

    return success({ message: 'Quote berhasil diupdate' });
  } catch (error) {
    return serverError(error);
  }
}