import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bQuotes, b2bProfiles, b2bQuoteItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/api-response';
import { sendEmail } from '@/lib/resend/send-email';
import { B2BQuoteApprovedEmail } from '@/lib/resend/templates/B2BQuoteApproved';
import { B2BQuoteRejectedEmail } from '@/lib/resend/templates/B2BQuoteRejected';
import { formatWIB } from '@/lib/utils/format-date';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Login diperlukan');

    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin' && session.user.role !== 'owner') {
      return forbidden('Akses ditolak');
    }

    const { id, action } = await params;

    if (action !== 'accept' && action !== 'reject') {
      return notFound('Action tidak valid');
    }

    const quote = await db.query.b2bQuotes.findFirst({
      where: eq(b2bQuotes.id, id),
      with: { items: true, b2bProfile: true },
    });

    if (!quote) {
      return notFound('Quote tidak ditemukan');
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    await db
      .update(b2bQuotes)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(b2bQuotes.id, id));

    // Send email notification to B2B customer
    if (action === 'accept') {
      await sendEmail({
        to: quote.b2bProfile.picEmail,
        subject: `Penawaran #${quote.quoteNumber} Telah Disetujui`,
        react: B2BQuoteApprovedEmail({
          quoteNumber: quote.quoteNumber,
          companyName: quote.b2bProfile.companyName,
          items: quote.items.map((item) => ({
            name: item.productNameId,
            variant: item.variantNameId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal,
          })),
          subtotal: quote.subtotal,
          discountAmount: quote.discountAmount,
          totalAmount: quote.totalAmount,
          validUntil: quote.validUntil ? formatWIB(quote.validUntil) : '',
        }),
      });
    } else if (action === 'reject') {
      await sendEmail({
        to: quote.b2bProfile.picEmail,
        subject: `Penawaran #${quote.quoteNumber} Tidak Dapat Diproses`,
        react: B2BQuoteRejectedEmail({
          quoteNumber: quote.quoteNumber,
          companyName: quote.b2bProfile.companyName,
        }),
      });
    }

    return success({ id, status: newStatus });
  } catch (error) {
    console.error('[B2B Quote Action POST]', error);
    return serverError(error);
  }
}