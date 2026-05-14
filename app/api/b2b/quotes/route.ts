import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError, notFound, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bQuotes, b2bProfiles, b2bQuoteItems } from '@/lib/db/schema';
import { z } from 'zod';
import { sql } from 'drizzle-orm';

const quoteItemSchema = z.object({
  variantId: z.string().uuid(),
  productNameId: z.string(),
  variantNameId: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
  subtotal: z.number().int().nonnegative(),
});

const CreateQuoteSchema = z.object({
  b2bProfileId: z.string().uuid(),
  subtotal: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative().default(0),
  totalAmount: z.number().int().nonnegative(),
  validUntil: z.string().datetime().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  notesId: z.string().optional().nullable(),
  notesEn: z.string().optional().nullable(),
  items: z.array(quoteItemSchema).min(1, 'Quote harus memiliki minimal 1 item'),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const parsed = CreateQuoteSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const data = parsed.data;

    const profile = await db.query.b2bProfiles.findFirst({
      where: eq(b2bProfiles.id, data.b2bProfileId),
    });
    if (!profile) {
      return notFound('Profil B2B tidak ditemukan');
    }

    // Generate quote number
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(b2bQuotes)
      .execute();
    const countNum = (countResult[0]?.count ?? 0) + 1;
    const quoteNumber = `BBQ-${dateStr}-${String(countNum).padStart(4, '0')}`;

    const [createdQuote] = await db.insert(b2bQuotes).values({
      quoteNumber,
      b2bProfileId: data.b2bProfileId,
      createdBy: session.user.id,
      status: 'sent',
      subtotal: data.subtotal,
      discountAmount: data.discountAmount,
      totalAmount: data.totalAmount,
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      paymentTerms: data.paymentTerms ?? null,
      notesId: data.notesId ?? null,
      notesEn: data.notesEn ?? null,
    }).returning();

    if (!createdQuote) {
      return serverError(new Error('Gagal membuat quote'));
    }

    const quoteItems = data.items.map(item => ({
      quoteId: createdQuote.id,
      variantId: item.variantId,
      productNameId: item.productNameId,
      variantNameId: item.variantNameId,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }));

    await db.insert(b2bQuoteItems).values(quoteItems);

    return success(createdQuote, 201);
  } catch (error) {
    console.error('[B2B Quote POST]', error);
    return serverError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    // B2B customers can see their own quotes, admins see all
    if (!role || (role !== 'superadmin' && role !== 'owner' && role !== 'b2b')) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
    const offset = (page - 1) * limit;
    const status = searchParams.get('status');

    let whereClause;

    if (role === 'b2b' && session.user.id) {
      // B2B users can only see their own quotes
      const profile = await db.query.b2bProfiles.findFirst({
        where: eq(b2bProfiles.userId, session.user.id),
      });
      if (profile) {
        whereClause = eq(b2bQuotes.b2bProfileId, profile.id);
      }
    }

    const quotes = await db.query.b2bQuotes.findMany({
      where: whereClause,
      with: {
        b2bProfile: {
          with: {
            user: {
              columns: { id: true, name: true, email: true },
            },
          },
        },
        items: true,
      },
      orderBy: [desc(b2bQuotes.createdAt)],
      limit,
      offset,
    });

    return success({ quotes });
  } catch (error) {
    console.error('[B2B Quotes GET]', error);
    return serverError(error);
  }
}