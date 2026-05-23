import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { b2bQuotes, b2bQuoteItems, b2bProfiles, b2bQuoteCounters, users } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { success, validationError, serverError, notFound, unauthorized, forbidden, badRequest } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CreateQuoteSchema = z.discriminatedUnion('customerType', [
  z.object({
    customerType: z.literal('existing'),
    b2bProfileId: z.string().uuid('ID profil B2B tidak valid'),
    items: z.array(z.object({
      variantId: z.string().uuid(),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
    })).min(1, 'Minimal 1 item diperlukan'),
    discountAmount: z.number().min(0).default(0),
    notes: z.string().optional(),
    validDays: z.number().min(1).default(14),
  }),
  z.object({
    customerType: z.literal('new'),
    newCustomer: z.object({
      companyName: z.string().min(1),
      picName: z.string().min(1),
      picEmail: z.string().email(),
      picPhone: z.string().min(1),
    }),
    items: z.array(z.object({
      variantId: z.string().uuid(),
      quantity: z.number().min(1),
      unitPrice: z.number().min(0),
    })).min(1, 'Minimal 1 item diperlukan'),
    discountAmount: z.number().min(0).default(0),
    notes: z.string().optional(),
    validDays: z.number().min(1).default(14),
  }),
]);


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

    // Determine customer type and normalize payload
    let b2bProfileId = '';
    let isNewCustomerFlow = false;

    if (body.newCustomer) {
      isNewCustomerFlow = true;
      // Validate newCustomer fields
      if (!body.newCustomer.companyName || !body.newCustomer.picName ||
          !body.newCustomer.picEmail || !body.newCustomer.picPhone) {
        return validationError(new (await import('zod')).ZodError([{
          code: 'custom', path: ['newCustomer'], message: 'Semua field pelanggan baru wajib diisi',
        }]));
      }
    } else if (!body.b2bProfileId) {
      return badRequest('Pilih pelanggan atau isi data pelanggan baru');
    } else {
      b2bProfileId = body.b2bProfileId;
    }

    if (!body.items || body.items.length === 0) {
      return validationError(new (await import('zod')).ZodError([{
        code: 'custom', path: ['items'], message: 'Minimal 1 item diperlukan',
      }]));
    }

    const items = body.items;
    const discountAmount = body.discountAmount ?? 0;
    const notes = body.notes ?? '';
    const validDays = body.validDays ?? 14;

    let profile = null;

    if (isNewCustomerFlow) {
      // Create a placeholder user for the new B2B profile
      const [newUser] = await db.insert(users).values({
        email: body.newCustomer.picEmail,
        name: body.newCustomer.picName,
        passwordHash: '', // no password — they reset via email
        role: 'b2b',
        isActive: true,
        pointsBalance: 0,
        languagePreference: 'id',
      }).returning();

      if (!newUser) {
        return serverError(new Error('Failed to create B2B user'));
      }

      const [newProfile] = await db.insert(b2bProfiles).values({
        userId: newUser.id,
        companyName: body.newCustomer.companyName,
        picName: body.newCustomer.picName,
        picEmail: body.newCustomer.picEmail,
        picPhone: body.newCustomer.picPhone,
        isApproved: true,
      }).returning();

      if (!newProfile) {
        return serverError(new Error('Failed to create B2B profile'));
      }

      b2bProfileId = newProfile.id;
      profile = newProfile;
    } else {
      profile = await db.query.b2bProfiles.findFirst({
        where: eq(b2bProfiles.id, b2bProfileId),
      });
      if (!profile) {
        return notFound('Profil B2B tidak ditemukan');
      }
    }

    // Calculate subtotal and total
    const subtotal = items.reduce((sum: number, item: { unitPrice: number; quantity: number }) => sum + (item.unitPrice * item.quantity), 0);
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

    // Create quote and items in a single transaction
    const [quote] = await db.transaction(async (tx) => {
      const [newQuote] = await tx.insert(b2bQuotes).values({
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

      if (!newQuote) {
        throw new Error('Failed to create quote');
      }

      const quoteItemsData = items.map((item: { variantId: string; quantity: number; unitPrice: number }) => ({
        quoteId: newQuote.id,
        variantId: item.variantId,
        productNameId: '',
        variantNameId: '',
        sku: '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      }));

      await tx.insert(b2bQuoteItems).values(quoteItemsData);

      return [newQuote];
    });

    return success({ id: quote.id, quoteNumber }, 201);
  } catch (error) {
    console.error('[B2B Quote API Error]', error);
    return serverError(error);
  }
}