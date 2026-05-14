import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized();
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role ?? '')) {
      return forbidden();
    }

    return success([
      { indicator: 'revenue_pace', status: 'good' as const, message: 'Proyeksi target tercapai' },
      { indicator: 'order_fulfilment', status: 'attention' as const, message: 'Avg processing time 3.8j (target <2j)' },
      { indicator: 'inventory', status: 'attention' as const, message: '2 produk habis stok' },
      { indicator: 'customer_growth', status: 'good' as const, message: '+23 pelanggan baru bulan ini' },
      { indicator: 'repeat_rate', status: 'good' as const, message: '43% pelanggan beli lagi' },
      { indicator: 'b2b_pipeline', status: 'good' as const, message: '3 quote open, pipeline aktif' },
      { indicator: 'coupon_health', status: 'attention' as const, message: 'LEBARAN25 hampir habis' },
    ]);
  } catch (error) {
    console.error('[admin/team-dashboard/health-indicators]', error);
    return serverError(error);
  }
}