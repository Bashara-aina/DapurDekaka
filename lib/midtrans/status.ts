import { withTimeout, IntegrationError } from '@/lib/utils/integration-helpers';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const Midtrans = require('midtrans-client');

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
      const response = await (coreApi.transaction as { status(orderId: string): Promise<Record<string, unknown>> }).status(orderId);

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