import Midtrans from 'midtrans-client';

export const snap = new Midtrans.Snap({
  isProduction: process.env.NODE_ENV === 'production',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
});

export interface MidtransItemDetail {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export async function createMidtransTransaction(params: {
  orderId: string;
  orderNumber: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemDetails: MidtransItemDetail[];
}): Promise<{ token: string; redirectUrl: string }> {
  const { orderId, orderNumber, grossAmount, customerName, customerEmail, customerPhone, itemDetails } = params;

  const itemSum = itemDetails.reduce((sum, item) => sum + item.price * item.quantity, 0);
  if (itemSum !== grossAmount) {
    throw new Error(
      `Midtrans item_details sum (${itemSum}) !== gross_amount (${grossAmount}). Fix calculation.`
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const result = await snap.createTransaction({
    transaction_details: {
      order_id: orderNumber,
      gross_amount: grossAmount,
    },
    item_details: itemDetails,
    customer_details: {
      first_name: customerName,
      email: customerEmail,
      phone: customerPhone,
    },
    custom_field1: orderId,
    callbacks: {
      finish: `${appUrl}/pesanan/${orderNumber}?payment=finish`,
      unfinish: `${appUrl}/pesanan/${orderNumber}?payment=unfinish`,
      error: `${appUrl}/pesanan/${orderNumber}?payment=error`,
    },
  } as any);

  return { token: result.token, redirectUrl: result.redirect_url };
}

export function verifyMidtransWebhook(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const { createHash } = require('crypto');
  const hash = createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
  return hash === signatureKey;
}
