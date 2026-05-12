import Link from 'next/link';
import { db } from '@/lib/db';
import { coupons } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';

export const dynamic = 'force-dynamic';

export default async function AdminCouponsPage() {
  const allCoupons = await db.query.coupons.findMany({
    orderBy: [desc(coupons.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kupon</h1>
        <Link
          href="/admin/coupons/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red-dark transition-colors text-sm font-medium"
        >
          + Buat Kupon
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diskon</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min. Belanja</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {allCoupons.map((coupon) => {
                const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                const isNotStarted = coupon.startsAt && new Date(coupon.startsAt) > new Date();
                const isMaxed = coupon.maxUses && coupon.usedCount >= coupon.maxUses;
                
                return (
                  <tr key={coupon.id} className="hover:bg-admin-content">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono font-medium text-sm bg-gray-100 px-2 py-1 rounded">
                        {coupon.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{coupon.nameId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm capitalize">{coupon.type.replace('_', ' ')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-red">
                      {coupon.type === 'percentage' && coupon.discountValue ? `${coupon.discountValue}%` : ''}
                      {coupon.type === 'fixed' && coupon.discountValue ? formatIDR(coupon.discountValue) : ''}
                      {coupon.type === 'free_shipping' ? 'Free Ship' : ''}
                      {coupon.type === 'buy_x_get_y' ? `Beli ${coupon.buyQuantity} Get ${coupon.getQuantity}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatIDR(coupon.minOrderAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {coupon.maxUses
                        ? `${coupon.usedCount} / ${coupon.maxUses}`
                        : coupon.usedCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                        !coupon.isActive
                          ? 'bg-gray-100 text-gray-800'
                          : isExpired
                          ? 'bg-red-100 text-red-800'
                          : isNotStarted
                          ? 'bg-yellow-100 text-yellow-800'
                          : isMaxed
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {!coupon.isActive ? 'Nonaktif' : isExpired ? 'Expired' : isNotStarted ? 'Scheduled' : isMaxed ? 'Maxed' : 'Aktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/admin/coupons/${coupon.id}`}
                        className="text-brand-red hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {allCoupons.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Belum ada kupon
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}