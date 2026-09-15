'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { Coupon } from '@/lib/db/schema';
import { formatIDR } from '@/lib/utils/format-currency';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  coupons: Coupon[];
}

export default function CouponsTableClient({ coupons }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [targetDelete, setTargetDelete] = useState<Coupon | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success('Kupon dihapus');
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kupon</h1>
        <Link
          href="/admin/coupons/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red-dark transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Buat Kupon
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
              {coupons.map((coupon) => {
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
                      {(() => {
                        switch (coupon.type) {
                          case 'percentage':
                            return coupon.discountValue ? `${coupon.discountValue}%` : '-';
                          case 'fixed':
                            return coupon.discountValue ? formatIDR(coupon.discountValue) : '-';
                          case 'free_shipping':
                            return 'Free Ongkir';
                          case 'buy_x_get_y':
                            return `Beli ${coupon.buyQuantity ?? '?'} Get ${coupon.getQuantity ?? '?'}`;
                          default:
                            return '-';
                        }
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatIDR(coupon.minOrderAmount ?? 0)}
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
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/admin/coupons/${coupon.id}`}
                          className="text-brand-red hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => { setTargetDelete(coupon); setShowDeleteDialog(true); }}
                          disabled={deleteMutation.isPending}
                          className="p-1 hover:bg-red-50 rounded transition-colors text-red-400 hover:text-red-600 disabled:opacity-50"
                          aria-label="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 && (
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

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Kupon?</DialogTitle>
            <DialogDescription>
              Kupon &quot;{targetDelete?.code}&quot; akan dihapus. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowDeleteDialog(false); setTargetDelete(null); }}
              className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (targetDelete) deleteMutation.mutate(targetDelete.id);
                setShowDeleteDialog(false);
                setTargetDelete(null);
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Hapus
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}