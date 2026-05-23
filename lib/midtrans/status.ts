import { withTimeout, IntegrationError } from '@/lib/utils/integration-helpers';
import Midtrans from 'midtrans-client';

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const coreApi = new Midtrans.CoreApi({
  isProduction,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
});

export interface TransactionStatusResult {
  orderId: string;
  transactionStatus: string;
  fraudStatus: string | null;
  grossAmount: number;
  paymentType: string | null;
  transactionTime: string;
}

const TIMEOUT_MS = 15000;

/**
 * Check Midtrans transaction status using Core API.
 * Used by cancel-expired-orders cron as fallback check.
 */
export async function checkTransactionStatus(
  orderId: string
): Promise<TransactionStatusResult> {
  return withTimeout(
    async () => {
      // @ts-ignore - midtrans-client types don't expose .transaction but it exists at runtime
      const response = await (coreApi as unknown as { transaction: { status(orderId: string): Promise<Record<string, unknown>> } }).transaction.status(orderId);

      if (!response) {
        throw new IntegrationError('Midtrans', 404, `No transaction found for order ${orderId}`);
      }

      return {
        orderId: String(response.order_id),
        transactionStatus: String(response.transaction_status),
        fraudStatus: response.fraud_status ? String(response.fraud_status) : null,
        grossAmount: parseInt(String(response.gross_amount), 10),
        paymentType: response.payment_type ? String(response.payment_type) : null,
        transactionTime: String(response.transaction_time),
      };
    },
    TIMEOUT_MS,
    'Midtrans.checkTransactionStatus'
  );
}

/**
 * Refund a Midtrans transaction.
 * Only call this for paid orders that are being cancelled.
 * Returns true if refund was successful, false otherwise.
 */
export async function refundTransaction(
  orderId: string,
  amount?: number
): Promise<{ success: boolean; refundId?: string; error?: string }> {
  try {
    const params: Record<string, unknown> = {
      order_id: orderId,
    };
    if (amount !== undefined) {
      params.refund_amount = { amount };
    }

    const response = await withTimeout(
      async () => {
        // @ts-ignore - midtrans-client types don't expose .transaction but it exists at runtime
        return (coreApi as unknown as { transaction: { refund(params: Record<string, unknown>): Promise<Record<string, unknown>> } }).transaction.refund(params);
      },
      TIMEOUT_MS,
      'Midtrans.refundTransaction'
    );

    return {
      success: true,
      refundId: (response as Record<string, unknown>)?.refund_id
        ? String((response as Record<string, unknown>).refund_id)
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}