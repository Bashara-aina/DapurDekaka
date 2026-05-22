'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { toast } from 'sonner';
import { Search, Plus, X } from 'lucide-react';

interface CouponItem {
  id: string;
  code: string;
  nameId: string;
  type: string;
  discountValue: number | null;
  buyQuantity: number | null;
  getQuantity: number | null;
  minOrderAmount: number;
  maxUses: number | null;
  usedCount: number;
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

function getCouponStatus(coupon: CouponItem): { label: string; className: string } {
  if (!coupon.isActive) return { label: 'Nonaktif', className: 'bg-gray-100 text-gray-800' };
  const now = new Date();
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return { label: 'Expired', className: 'bg-red-100 text-red-800' };
  if (coupon.startsAt && new Date(coupon.startsAt) > now) return { label: 'Scheduled', className: 'bg-yellow-100 text-yellow-800' };
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) return { label: 'Maxed', className: 'bg-orange-100 text-orange-800' };
  return { label: 'Aktif', className: 'bg-green-100 text-green-800' };
}

function formatDiscount(coupon: CouponItem): string {
  switch (coupon.type) {
    case 'percentage': return coupon.discountValue ? `${coupon.discountValue}%` : '-';
    case 'fixed': return coupon.discountValue ? formatIDR(coupon.discountValue) : '-';
    case 'free_shipping': return 'Free Ongkir';
    case 'buy_x_get_y': return `Beli ${coupon.buyQuantity ?? '?'} Get ${coupon.getQuantity ?? '?'}`;
    default: return '-';
  }
}

type FilterTab = 'all' | 'active' | 'scheduled' | 'expired' | 'maxed' | 'inactive';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('active');

  useEffect(() => {
    async function fetchCoupons() {
      try {
        const res = await fetch('/api/admin/coupons');
        const json = await res.json();
        setCoupons(json.data ?? []);
      } catch {
        toast.error('Gagal memuat data kupon');
      } finally {
        setLoading(false);
      }
    }
    fetchCoupons();
  }, []);

  function getFilteredCoupons(): CouponItem[] {
    let filtered = coupons;
    if (searchInput.trim()) {
      const q = searchInput.toLowerCase();
      filtered = filtered.filter(c =>
        c.code.toLowerCase().includes(q) || c.nameId.toLowerCase().includes(q)
      );
    }
    if (activeTab === 'active') {
      const now = new Date();
      filtered = filtered.filter(c =>
        c.isActive &&
        (!c.expiresAt || new Date(c.expiresAt) >= now) &&
        (!c.startsAt || new Date(c.startsAt) <= now) &&
        (!c.maxUses || c.usedCount < c.maxUses)
      );
    } else if (activeTab === 'scheduled') {
      const now = new Date();
      filtered = filtered.filter(c => c.startsAt && new Date(c.startsAt) > now);
    } else if (activeTab === 'expired') {
      filtered = filtered.filter(c => c.expiresAt && new Date(c.expiresAt) < new Date());
    } else if (activeTab === 'maxed') {
      filtered = filtered.filter(c => c.maxUses && c.usedCount >= c.maxUses);
    } else if (activeTab === 'inactive') {
      filtered = filtered.filter(c => !c.isActive);
    }
    return filtered;
  }

  const filtered = getFilteredCoupons();

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'active', label: 'Aktif' },
    { key: 'scheduled', label: 'Terjadwal' },
    { key: 'expired', label: 'Expired' },
    { key: 'maxed', label: 'Maxed' },
    { key: 'inactive', label: 'Nonaktif' },
  ];

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

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

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Cari kode atau nama kupon..."
            className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-white text-sm"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeTab === tab.key
                ? 'bg-[#0F172A] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
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
              {filtered.map(coupon => {
                const status = getCouponStatus(coupon);
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
                      {formatDiscount(coupon)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatIDR(coupon.minOrderAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {coupon.maxUses ? `${coupon.usedCount} / ${coupon.maxUses}` : coupon.usedCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link href={`/admin/coupons/${coupon.id}`} className="text-brand-red hover:underline">
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Tidak ada kupon
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