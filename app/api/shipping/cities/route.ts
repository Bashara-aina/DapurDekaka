import { NextRequest, NextResponse } from 'next/server';
import { getCitiesByProvince } from '@/lib/rajaongkir/cities';
import { z } from 'zod';

const querySchema = z.object({
  provinceId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const provinceId = searchParams.get('provinceId');

    const parsed = querySchema.safeParse({ provinceId });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'provinceId diperlukan', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const cities = await getCitiesByProvince(parsed.data.provinceId);
    return NextResponse.json({ success: true, data: cities });
  } catch (error) {
    console.error('[API/shipping/cities]', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil daftar kota', code: 'CITIES_ERROR' },
      { status: 500 }
    );
  }
}