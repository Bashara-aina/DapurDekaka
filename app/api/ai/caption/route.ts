import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateProductCaption } from '@/lib/services/minimax';
import { IntegrationError } from '@/lib/utils/integration-helpers';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (session.user.role !== 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Superadmin only', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const schema = z.object({
      productName: z.string().min(1),
      productDescription: z.string().min(10),
      language: z.enum(['id', 'en']).default('id'),
      tone: z.enum(['professional', 'playful', 'luxurious', 'warm']).default('warm'),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const caption = await generateProductCaption({
      productName: parsed.data.productName,
      productDescription: parsed.data.productDescription,
      language: parsed.data.language,
      tone: parsed.data.tone,
    });

    return NextResponse.json({ success: true, data: { caption } });
  } catch (error) {
    console.error('[AI Caption POST]', error);
    if (error instanceof IntegrationError || (error as Error).message.includes('Minimax')) {
      return NextResponse.json(
        { success: false, error: 'AI service unavailable, please try again later', code: 'AI_SERVICE_ERROR' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}