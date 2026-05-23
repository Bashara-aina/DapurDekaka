import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { generateProductCaption } from '@/lib/services/minimax';
import { IntegrationError } from '@/lib/utils/integration-helpers';
import { success, serverError, unauthorized, forbidden, validationError } from '@/lib/utils/api-response';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    if (session.user.role !== 'superadmin') {
      return forbidden('Hanya superadmin yang dapat mengakses');
    }

    const body = await req.json();
    const AICaptionSchema = z.object({
      productName: z.string().min(1),
      productDescription: z.string().min(10),
      language: z.enum(['id', 'en']).default('id'),
      tone: z.enum(['professional', 'playful', 'luxurious', 'warm']).default('warm'),
    });
    const parsed = AICaptionSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const caption = await generateProductCaption(parsed.data);

    return success({ caption });
  } catch (error) {
    console.error('[AI Caption POST]', error);
    if (error instanceof IntegrationError || (error as Error).message.includes('Minimax')) {
      return serverError(new Error('AI service unavailable, please try again later'));
    }
    return serverError(error);
  }
}