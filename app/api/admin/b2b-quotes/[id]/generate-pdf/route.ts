import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from '@/lib/db';
import { b2bQuotes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, notFound, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { B2BQuotePDF } from '@/components/pdf/B2BQuotePDF';
import { uploadBuffer } from '@/lib/cloudinary/upload';

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: NextRequest,
  { params }: Props
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return forbidden('Hanya admin yang dapat generate PDF quote');
    }

    if (session.user.role !== 'superadmin' && session.user.role !== 'owner') {
      return forbidden('Hanya superadmin dan owner yang dapat generate PDF quote');
    }

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
    }) as {
      id: string;
      quoteNumber: string;
      status: string;
      subtotal: number;
      discountAmount: number;
      totalAmount: number;
      validUntil: Date | null;
      paymentTerms: string | null;
      notesId: string | null;
      notesEn: string | null;
      createdAt: Date;
      pdfUrl: string | null;
      items: Array<{
        productNameId: string;
        variantNameId: string;
        sku: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }>;
      b2bProfile: {
        companyName: string;
        picName: string;
        picEmail: string;
        picPhone: string;
      } | null;
    } | null;

    if (!quote) {
      return notFound('Quote tidak ditemukan');
    }

    const pdfBuffer = await renderToBuffer(
      B2BQuotePDF({
        quote,
        logoUrl: `${process.env.NEXT_PUBLIC_APP_URL}/assets/logo/logo.png`,
      })
    );

    const uploadResult = await uploadBuffer(
      Buffer.from(pdfBuffer),
      'quotes',
      `quote-${quote.quoteNumber}`
    );

    await db
      .update(b2bQuotes)
      .set({ pdfUrl: uploadResult.url, updatedAt: new Date() })
      .where(eq(b2bQuotes.id, id));

    return success({ pdfUrl: uploadResult.url });

  } catch (error) {
    console.error('[b2b-quotes/generate-pdf]', error);
    return serverError(error);
  }
}