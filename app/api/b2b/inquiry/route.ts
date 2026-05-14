import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { b2bInquiries, systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, validationError, serverError } from '@/lib/utils/api-response';
import { sendEmail } from '@/lib/resend/send-email';
import { B2BInquiryNotificationEmail } from '@/lib/resend/templates/B2BInquiryNotification';
import { B2BInquiryAutoReplyEmail } from '@/lib/resend/templates/B2BInquiryAutoReply';
import { formatWIB } from '@/lib/utils/format-date';
import { logger } from '@/lib/utils/logger';

const InquirySchema = z.object({
  companyName: z.string().min(1, 'Nama perusahaan wajib diisi'),
  picName: z.string().min(1, 'Nama penanggung jawab wajib diisi'),
  picEmail: z.string().email('Format email tidak valid'),
  picPhone: z.string().min(8, 'Nomor WhatsApp tidak valid'),
  companyType: z.string().optional(),
  message: z.string().min(10, 'Pesan minimal 10 karakter'),
  estimatedVolume: z.string().optional(),
});

async function getAdminEmail(): Promise<string> {
  const adminSetting = await db.query.systemSettings.findFirst({
    where: eq(systemSettings.key, 'admin_email'),
  });
  if (adminSetting?.value) {
    return adminSetting.value;
  }
  return process.env.SEED_ADMIN_EMAIL ?? 'bashara@dapurdekaka.com';
}

async function getVolumeLabel(volumeId: string | null): Promise<string> {
  if (!volumeId) return '';
  const volumeLabels: Record<string, string> = {
    '10-50': '10-50 pcs/bulan',
    '50-100': '50-100 pcs/bulan',
    '100-500': '100-500 pcs/bulan',
    '500+': '500+ pcs/bulan',
  };
  return volumeLabels[volumeId] ?? volumeId;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = InquirySchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { companyName, picName, picEmail, picPhone, companyType, message, estimatedVolume } = parsed.data;

    // Insert inquiry into database
    const [inquiry] = await db.insert(b2bInquiries).values({
      companyName,
      picName,
      picEmail,
      picPhone,
      companyType: companyType || null,
      message,
      estimatedVolumeId: estimatedVolume || null,
      status: 'new',
    }).returning();

    if (!inquiry) {
      return serverError(new Error('Failed to create inquiry'));
    }

    // ── Send admin notification email ───────────────────────────────
    try {
      const adminEmail = await getAdminEmail();
      const adminEmailHtml = B2BInquiryNotificationEmail({
        inquiryId: inquiry.id,
        companyName,
        picName,
        picEmail,
        picPhone,
        companyType: companyType || undefined,
        message,
        estimatedVolume: estimatedVolume ? await getVolumeLabel(estimatedVolume) : undefined,
        submittedAt: formatWIB(new Date()),
      });

      await sendEmail({
        to: adminEmail,
        subject: `[DDK B2B] Inquiry baru dari ${companyName}`,
        react: adminEmailHtml,
      });
    } catch (emailError) {
      logger.error('[B2B Inquiry] Failed to send admin notification', {
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    }

    // ── Send auto-reply to customer ────────────────────────────────
    try {
      const autoReplyHtml = B2BInquiryAutoReplyEmail({
        companyName,
        picName,
        inquiryId: inquiry.id,
      });

      await sendEmail({
        to: picEmail,
        subject: `Kami telah menerima inquiry Anda — Dapur Dekaka 德卡`,
        react: autoReplyHtml,
      });
    } catch (emailError) {
      logger.error('[B2B Inquiry] Failed to send auto-reply', {
        error: emailError instanceof Error ? emailError.message : String(emailError),
      });
    }

    logger.info('[B2B Inquiry] New inquiry processed', {
      id: inquiry.id,
      companyName,
      picName,
      picEmail,
    });

    return success({ id: inquiry.id, message: 'Permintaan berhasil dikirim' }, 201);
  } catch (error) {
    logger.error('[B2B Inquiry API Error]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}