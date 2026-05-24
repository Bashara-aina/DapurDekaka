import { snap } from './client';
import { getMidtransOrderId } from '@/lib/utils/generate-order-number';
import { getSetting } from '@/lib/settings/get-settings';

export interface MidtransItemDetail {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface CreateMidtransTransactionParams {
  orderNumber: string;
  retryCount: number;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: MidtransItemDetail[];
}

export async function createMidtransTransaction(
  params: CreateMidtransTransactionParams
): Promise<{ snapToken: string; midtransOrderId: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL environment variable is not set. ' +
        'Expected value: https://dapurdekaka.com'
    );
  }
  const midtransOrderId = getMidtransOrderId(params.orderNumber, params.retryCount);

  const expiryMinutesStr = await getSetting<string>('payment_expiry_minutes', 'string');
  const expiryMinutes = Math.min(parseInt(expiryMinutesStr ?? '15', 10), 15);

  const transactionParams = {
    transaction_details: {
      order_id: midtransOrderId,
      gross_amount: params.grossAmount,
    },
    customer_details: {
      first_name: params.customerName.split(' ')[0] ?? params.customerName,
      email: params.customerEmail,
      phone: params.customerPhone,
    },
    item_details: params.items,
    expiry: {
      unit: 'minute' as const,
      duration: expiryMinutes,
    },
    callbacks: {
      finish: `${appUrl}/checkout/success`,
      error: `${appUrl}/checkout/failed`,
      pending: `${appUrl}/checkout/pending`,
    },
  };

  const response = await snap.createTransaction(transactionParams);

  return { snapToken: response.token, midtransOrderId };
}