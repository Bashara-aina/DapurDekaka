import { NextResponse } from 'next/server';
import { getProvinces } from '@/lib/rajaongkir/provinces';

export async function GET() {
  try {
    const provinces = await getProvinces();
    return NextResponse.json({ success: true, data: provinces });
  } catch (error) {
    console.error('[API/shipping/provinces]', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil daftar provinsi', code: 'PROVINCES_ERROR' },
      { status: 500 }
    );
  }
}