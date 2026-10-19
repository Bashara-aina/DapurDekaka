import { sendEmail } from '@/lib/resend/send-email';
import { PickupReadyEmail } from '@/lib/resend/templates/PickupReady';
import { sendWhatsApp, pickupReadyMessage } from '@/lib/services/fonnte';
import { getSetting } from '@/lib/settings/get-settings';
import { scheduleBackground } from '@/lib/utils/background';
import { logger } from '@/lib/utils/logger';

export interface PickupReadyOrder {
  readonly orderNumber: string;
  readonly pickupCode: string | null;
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly recipientPhone: string;
}

/**
 * W11/M12: notify the customer that a pickup order is packed and can be
 * collected. Called when the order reaches `packed` — never at payment time.
 */
export async function sendPickupReadyNotification(order: PickupReadyOrder): Promise<void> {
  try {
    const [pickupAddress, openingHours] = await Promise.all([
      getSetting<string>('store_address', 'string').catch(() => null),
      getSetting<string>('store_opening_hours', 'string').catch(() => null),
    ]);
    const pickupCode = order.pickupCode ?? order.orderNumber;

    scheduleBackground(
      sendEmail({
        to: order.recipientEmail,
        subject: `Pesanan ${order.orderNumber} siap diambil!`,
        react: PickupReadyEmail({
          orderNumber: order.orderNumber,
          customerName: order.recipientName,
          pickupCode,
          pickupAddress: pickupAddress ?? '',
          openingHours: openingHours ?? '',
        }),
      }),
      'pickup ready email'
    );

    scheduleBackground(
      sendWhatsApp({
        phone: order.recipientPhone,
        message: pickupReadyMessage({
          orderNumber: order.orderNumber,
          address: pickupAddress ?? '',
          pickupCode,
        }),
      }),
      'pickup ready WhatsApp'
    );
  } catch (error) {
    logger.warn('[pickup-ready] notification failed', {
      orderNumber: order.orderNumber,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
