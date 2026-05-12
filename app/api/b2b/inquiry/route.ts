import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { b2bInquiries } from '@/lib/db/schema';
import { success, validationError, serverError } from '@/lib/utils/api-response';

const InquirySchema = z.object({
  companyName: z.string().min(1, 'Nama perusahaan wajib diisi'),
  picName: z.string().min(1, 'Nama penanggung jawab wajib diisi'),
  picEmail: z.string().email('Format email tidak valid'),
  picPhone: z.string().min(8, 'Nomor WhatsApp tidak valid'),
  companyType: z.string().optional(),
  message: z.string().min(10, 'Pesan minimal 10 karakter'),
  estimatedVolume: z.string().optional(),
});

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

    // TODO: Send email notification to admin
    // For now, just log it
    console.log('[B2B Inquiry] New inquiry:', {
      id: inquiry.id,
      companyName,
      picName,
      picEmail,
    });

    return success({ id: inquiry.id, message: 'Permintaan berhasil dikirim' }, 201);
  } catch (error) {
    console.error('[B2B Inquiry API Error]', error);
    return serverError(error);
  }
}