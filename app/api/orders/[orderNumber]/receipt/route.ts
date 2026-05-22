import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { success, forbidden, notFound, serverError } from '@/lib/utils/api-response';
import { OrderReceiptPDF } from '@/components/email/OrderReceiptPDF';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const session = await auth();
    const { orderNumber } = await params;
    const emailParam = req.nextUrl.searchParams.get('email');

    // Allow owner/superadmin to view any receipt
    if (session?.user) {
      const order = await db.query.orders.findFirst({
        where: eq(orders.orderNumber, orderNumber),
        with: { items: true },
      });

      if (!order) {
        return notFound('Pesanan tidak ditemukan');
      }

      if (!['superadmin', 'owner'].includes(session.user.role) && order.userId !== session.user.id) {
        return forbidden();
      }

      const logoUrl = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/assets/logo/logo.png`
        : undefined;

      const pdfBuffer = await renderToBuffer(
        OrderReceiptPDF({ order, logoUrl })
      );

      return new Response(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="struk-${orderNumber}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // Guest access: must provide email that matches order's recipientEmail
    if (!emailParam) {
      return forbidden('Email diperlukan untuk mengunduh struk');
    }

    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.orderNumber, orderNumber),
        eq(orders.recipientEmail, emailParam.toLowerCase())
      ),
      with: { items: true },
    });

    if (!order) {
      return notFound('Pesanan tidak ditemukan');
    }

    const logoUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/assets/logo/logo.png`
      : undefined;

    const pdfBuffer = await renderToBuffer(
      OrderReceiptPDF({ order, logoUrl })
    );

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="struk-${orderNumber}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('[Receipt] Error generating PDF', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}