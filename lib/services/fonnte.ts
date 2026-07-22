import { logger } from '@/lib/utils/logger';

interface SendWhatsAppInput {
  phone: string;
  message: string;
}

/**
 * Normalize Indonesian phone to international 62 format for Fonnte.
 */
export function normalizePhoneForFonnte(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

/**
 * Send WhatsApp message via Fonnte API (non-blocking caller pattern).
 */
export async function sendWhatsApp(input: SendWhatsAppInput): Promise<boolean> {
  const apiKey = process.env.FONNTE_API_KEY;
  if (!apiKey) {
    logger.warn('[Fonnte] FONNTE_API_KEY not configured');
    return false;
  }

  const target = normalizePhoneForFonnte(input.phone);
  const body: Record<string, string> = {
    target,
    message: input.message,
  };

  if (process.env.FONNTE_DEVICE_ID) {
    body.device = process.env.FONNTE_DEVICE_ID;
  }

  try {
    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.error('[Fonnte] Send failed', { status: res.status, body: text });
      return false;
    }
    return true;
  } catch (error) {
    logger.error('[Fonnte] Send error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Dispatch notification template (ID). */
export function dispatchMessage(params: {
  orderNumber: string;
  courier: string;
  awb: string;
  trackUrl: string;
}): string {
  return (
    `Pesanan ${params.orderNumber} dikirim via ${params.courier}. ` +
    `Resi: ${params.awb}. Lacak: ${params.trackUrl}`
  );
}

/** Delivered notification template (ID). */
export function deliveredMessage(orderNumber: string): string {
  return `Pesanan ${orderNumber} telah sampai. Terima kasih!`;
}

/** Pickup ready notification template (ID). */
export function pickupReadyMessage(params: {
  orderNumber: string;
  address: string;
  pickupCode: string;
}): string {
  return (
    `Pesanan ${params.orderNumber} siap diambil di ${params.address}. ` +
    `Kode: ${params.pickupCode}`
  );
}

/** Pickup 24h reminder (P4 backlog #7). */
export function pickupReminderMessage(name: string, orderNumber: string): string {
  return (
    `Halo ${name}! Pesanan pickup ${orderNumber} sudah siap >24 jam. ` +
    `Silakan ambil sebelum stok kami lepas. Balas WA jika butuh bantuan.`
  );
}

/**
 * D+2 follow-up template (P5 backlog #6).
 *
 * P5 strategy: manual-but-templated is acceptable at <60 orders/week.
 * The cron route (`/api/cron/d-plus2-followup`) will be created once
 * weekly volume exceeds that threshold. For now, use this function
 * directly from the admin panel to send manual follow-ups.
 */
export function dPlus2FollowUpMessage(params: {
  name: string;
  product: string;
  testimonialUrl: string;
}): string {
  return (
    `Halo Kak ${params.name}! Gimana ${params.product}-nya? ` +
    `Kalau ada yang kurang pas, bilang aja — kami ganti. ` +
    `Kalau puas, boleh banget cerita di sini 🙏 ${params.testimonialUrl}`
  );
}

/** Ops alert for failed dispatch (ID). */
export function opsDispatchFailedMessage(params: {
  orderNumber: string;
  error: string;
}): string {
  return `GAGAL dispatch ${params.orderNumber}: ${params.error}. Cek dashboard.`;
}
