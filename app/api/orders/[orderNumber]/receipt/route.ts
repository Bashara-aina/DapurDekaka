import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { success, serverError, notFound, unauthorized } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { OrderReceiptPDF } from '@/components/email/OrderReceiptPDF';

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: Props
) {
  try {
    const { orderNumber } = await params;
    const searchParams = req.nextUrl.searchParams;
    const guestEmail = searchParams.get('email');

    const session = await auth();

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: { items: true },
    }) as {
      id: string;
      orderNumber: string;
      status: string;
      userId: string | null;
      recipientName: string;
      recipientEmail: string;
      recipientPhone: string;
      subtotal: number;
      shippingCost: number;
      discountAmount: number;
      pointsDiscount: number;
      totalAmount: number;
      deliveryMethod: string;
      addressLine: string | null;
      district: string | null;
      city: string | null;
      province: string | null;
      postalCode: string | null;
      courierName: string | null;
      trackingNumber: string | null;
      paidAt: Date | null;
      createdAt: Date;
      pointsEarned: number;
      items: Array<{
        productNameId: string;
        variantNameId: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
        productImageUrl: string | null;
      }>;
    } | null;

    if (!order) {
      return notFound('Order tidak ditemukan');
    }

    // Verify access: logged-in owner/admin, or guest with matching email
    let verified = false;
    if (session?.user?.id) {
      const isAdmin = session.user.role === 'superadmin' || session.user.role === 'owner';
      if (order.userId === session.user.id || isAdmin) {
        verified = true;
      }
    } else if (guestEmail && order.recipientEmail?.toLowerCase() === guestEmail.toLowerCase()) {
      verified = true;
    }

    if (!verified) {
      return unauthorized('Verifikasi diperlukan untuk mengunduh struk');
    }

    const pdfBuffer = await renderToBuffer(
      OrderReceiptPDF({
        order,
        logoUrl: `${process.env.NEXT_PUBLIC_APP_URL}/assets/logo/logo.png`,
      })
    );

    const filename = `struk-pesanan-${orderNumber}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    console.error('[orders/[orderNumber]/receipt]', error);
    return serverError(error);
  }
}