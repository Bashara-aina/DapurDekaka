'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Package, Truck, Users, Tag, FileText, MessageSquare, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { KPICard } from '@/components/admin/dashboard/KPICard';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { cn } from '@/lib/utils/cn';

interface SnapshotData {
  revenueToday: number;
  revenueDelta: number;
  avgOrderValue: number;
  estimatedMargin: number;
  ordersToday: number;
  ordersDelta: number;
  activeCustomersMTD: number;
  newCustomersToday: number;
  guestCheckoutsToday: number;
  monthRevenue: number;
}

interface MonthlyProgress {
  monthlyTarget: number;
  currentRevenue: number;
  progress: number;
  daysElapsed: number;
  daysInMonth: number;
  pace: number;
  projectedRevenue: number;
  isOnTrack: 'on_track' | 'below' | 'needs_attention';
}

interface OrderPipeline {
  pending_payment: number;
  paid: number;
  processing: number;
  packed: number;
  shipped: number;
}

interface ActionOrder {
  id: string;
  orderNumber: string;
  status: string;
  recipientName: string;
  totalItems: number;
  totalAmount: number;
  courierName: string | null;
  createdAt: string;
}

interface TopProduct {
  productNameId: string;
  variantNameId: string;
  unitsSold: number;
  revenue: number;
  stock: number;
  revenuePercent: number;
}

interface InventoryAlert {
  outOfStock: { id: string; nameId: string; sku: string; stock: number; productNameId: string | null }[];
  lowStock: { id: string; nameId: string; sku: string; stock: number; productNameId: string | null }[];
}

interface B2BPipeline {
  newInquiries: number;
  inProgressInquiries: number;
  openQuotes: number;
  acceptedQuotes: number;
  b2bOrdersThisMonth: number;
  b2bRevenueThisMonth: number;
  recentInquiries: { id: string; companyName: string; picName: string; createdAt: string }[];
}

interface HealthIndicator {
  indicator: string;
  status: 'good' | 'attention' | 'critical';
  message: string;
}

interface CouponData {
  id: string;
  code: string;
  type: string;
  discountValue: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
}

interface BlogStatus {
  publishedCount: number;
  draftCount: number;
  scheduledCount: number;
  drafts: { id: string; titleId: string; updatedAt: string }[];
}

export default function TeamDashboardPage() {
  const { data: snapshot } = useQuery<SnapshotData>({
    queryKey: ['team-snapshot'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/snapshot');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 60000,
  });

  const { data: monthlyProgress } = useQuery<MonthlyProgress>({
    queryKey: ['monthly-progress'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/monthly-progress');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const { data: pipeline } = useQuery<OrderPipeline>({
    queryKey: ['order-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/order-pipeline');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    refetchInterval: 60000,
  });

  const { data: actionOrders } = useQuery<ActionOrder[]>({
    queryKey: ['action-orders'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/action-orders');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    refetchInterval: 60000,
  });

  const { data: topProducts } = useQuery<TopProduct[]>({
    queryKey: ['top-products'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/top-products');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const { data: inventoryAlerts } = useQuery<InventoryAlert>({
    queryKey: ['inventory-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/inventory-alerts');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    refetchInterval: 120000,
  });

  const { data: b2bPipeline } = useQuery<B2BPipeline>({
    queryKey: ['b2b-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/b2b-pipeline');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 120000,
  });

  const { data: coupons } = useQuery<CouponData[]>({
    queryKey: ['coupons'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/coupons');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const { data: blogStatus } = useQuery<BlogStatus>({
    queryKey: ['blog-status'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/blog-status');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const { data: healthIndicators } = useQuery<HealthIndicator[]>({
    queryKey: ['health-indicators'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/health-indicators');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{greeting()} 👋</h1>
          <p className="text-sm text-[#6B6B6B]">{today}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Pendapatan Hari Ini"
          value={snapshot?.revenueToday ?? 0}
          isCurrency
          change={snapshot?.revenueDelta}
          changePeriod="vs minggu lalu"
        />
        <KPICard
          title="Pesanan Hari Ini"
          value={snapshot?.ordersToday ?? 0}
          change={snapshot?.ordersDelta}
          changePeriod="vs minggu lalu"
        />
        <KPICard
          title="Estimasi Margin"
          value={snapshot?.estimatedMargin ?? 0}
          isCurrency
          suffix=" (18%)"
        />
        <KPICard
          title="Pelanggan Aktif MTD"
          value={snapshot?.activeCustomersMTD ?? 0}
        />
        <KPICard
          title="Pelanggan Baru"
          value={snapshot?.newCustomersToday ?? 0}
        />
      </div>

      {/* Monthly Progress */}
      <div className="bg-white rounded-xl p-6 border border-admin-border">
        <h2 className="font-semibold text-lg mb-4">Progres Bulanan</h2>
        {monthlyProgress && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#6B6B6B]">Target: {formatIDR(monthlyProgress.monthlyTarget)}</span>
              <span className="text-sm font-medium text-[#1A1A1A]">{formatIDR(monthlyProgress.currentRevenue)} ({monthlyProgress.progress}%)</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div 
                className={cn(
                  'h-3 rounded-full transition-all',
                  monthlyProgress.progress >= 80 ? 'bg-green-500' : monthlyProgress.progress >= 50 ? 'bg-amber-500' : 'bg-brand-red'
                )}
                style={{ width: `${Math.min(monthlyProgress.progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#6B6B6B]">Hari berjalan: {monthlyProgress.daysElapsed}/{monthlyProgress.daysInMonth}</span>
              <span className={cn(
                'font-medium',
                monthlyProgress.isOnTrack === 'on_track' ? 'text-green-600' : monthlyProgress.isOnTrack === 'below' ? 'text-amber-500' : 'text-red-500'
              )}>
                {monthlyProgress.isOnTrack === 'on_track' ? '✅ On track' : monthlyProgress.isOnTrack === 'below' ? '⚠️ Sedikit di bawah' : '🔴 Perlu akselerasi'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Order Pipeline */}
      <div className="bg-white rounded-xl p-6 border border-admin-border">
        <h2 className="font-semibold text-lg mb-4">Pipeline Pesanan</h2>
        {pipeline && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {[
              { key: 'pending_payment', label: 'Menunggu Bayar', color: 'bg-amber-500' },
              { key: 'paid', label: 'Sudah Bayar', color: 'bg-blue-500' },
              { key: 'processing', label: 'Diproses', color: 'bg-indigo-500' },
              { key: 'packed', label: 'Dikemas', color: 'bg-purple-500' },
              { key: 'shipped', label: 'Dikirim', color: 'bg-green-500' },
            ].map(stage => (
              <div key={stage.key} className="flex-shrink-0">
                <div className="flex flex-col items-center">
                  <div className={cn('w-16 rounded-t-lg h-2', stage.color)} />
                  <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-lg p-3 min-w-[80px]">
                    <p className="text-2xl font-bold text-center">{pipeline[stage.key as keyof OrderPipeline]}</p>
                    <p className="text-xs text-center text-[#6B6B6B] mt-1">{stage.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Orders */}
      <div className="bg-white rounded-xl border border-admin-border">
        <div className="px-6 py-4 border-b border-admin-border">
          <h2 className="font-semibold">Pesanan Butuh Tindakan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {actionOrders?.slice(0, 5).map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{order.orderNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.recipientName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.totalItems} items</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
              {(!actionOrders || actionOrders.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">Tidak ada pesanan需要 tindakan</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white rounded-xl border border-admin-border">
        <div className="px-6 py-4 border-b border-admin-border">
          <h2 className="font-semibold">Top 10 Produk Bulan Ini</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terjual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {topProducts?.map((product, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{idx + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium">{product.productNameId}</p>
                    <p className="text-xs text-gray-400">{product.variantNameId}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{product.unitsSold} pcs</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-red">{formatIDR(product.revenue)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      'text-sm font-medium',
                      product.stock === 0 ? 'text-red-500' : product.stock < 10 ? 'text-amber-500' : 'text-green-600'
                    )}>
                      {product.stock} unit
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Alerts */}
      <div className="bg-white rounded-xl border border-admin-border p-6">
        <h2 className="font-semibold mb-4">Inventori Alerts</h2>
        {inventoryAlerts && (
          <div className="space-y-4">
            {inventoryAlerts.outOfStock.length > 0 && (
              <div>
                <p className="text-sm font-medium text-red-500 mb-2">🔴 Habis Stok:</p>
                <ul className="space-y-1">
                  {inventoryAlerts.outOfStock.slice(0, 5).map(item => (
                    <li key={item.id} className="text-sm text-gray-600">
                      {item.productNameId} — {item.nameId} — 0 unit
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inventoryAlerts.lowStock.length > 0 && (
              <div>
                <p className="text-sm font-medium text-amber-500 mb-2">🟡 Stok Menipis:</p>
                <ul className="space-y-1">
                  {inventoryAlerts.lowStock.slice(0, 5).map(item => (
                    <li key={item.id} className="text-sm text-gray-600">
                      {item.productNameId} — {item.nameId} — {item.stock} unit
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {inventoryAlerts.outOfStock.length === 0 && inventoryAlerts.lowStock.length === 0 && (
              <p className="text-sm text-green-600">✅ Semua produk dalam kondisi sehat</p>
            )}
          </div>
        )}
      </div>

      {/* B2B Pipeline */}
      <div className="bg-white rounded-xl border border-admin-border p-6">
        <h2 className="font-semibold mb-4">Pipeline B2B</h2>
        {b2bPipeline && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{b2bPipeline.newInquiries}</p>
              <p className="text-xs text-gray-500">Inquiry Baru</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{b2bPipeline.openQuotes}</p>
              <p className="text-xs text-gray-500">Quote Terbuka</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-500">{b2bPipeline.b2bOrdersThisMonth ?? 0}</p>
              <p className="text-xs text-gray-500">Pesanan B2B</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-brand-red">{formatIDR(b2bPipeline.b2bRevenueThisMonth)}</p>
              <p className="text-xs text-gray-500">Revenue B2B</p>
            </div>
          </div>
        )}
      </div>

      {/* Health Indicators */}
      <div className="bg-white rounded-xl border border-admin-border p-6">
        <h2 className="font-semibold mb-4">Indikator Kesehatan Bisnis</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {healthIndicators?.map(indicator => (
            <div key={indicator.indicator} className={cn(
              'p-4 rounded-lg border',
              indicator.status === 'good' ? 'border-green-200 bg-green-50' :
              indicator.status === 'attention' ? 'border-amber-200 bg-amber-50' :
              'border-red-200 bg-red-50'
            )}>
              <p className={cn(
                'text-lg font-bold',
                indicator.status === 'good' ? 'text-green-600' :
                indicator.status === 'attention' ? 'text-amber-600' :
                'text-red-600'
              )}>
                {indicator.status === 'good' ? '🟢' : indicator.status === 'attention' ? '🟡' : '🔴'}
              </p>
              <p className="text-sm font-medium mt-1">{indicator.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Coupons */}
      <div className="bg-white rounded-xl border border-admin-border">
        <div className="px-6 py-4 border-b border-admin-border flex items-center justify-between">
          <h2 className="font-semibold">Kupon Aktif</h2>
          <button className="text-sm text-brand-red hover:underline">+ Buat Kupon Baru</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terpakai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {coupons?.slice(0, 5).map(coupon => (
                <tr key={coupon.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{coupon.code}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{coupon.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      'inline-flex px-2 py-1 text-xs font-semibold rounded',
                      !coupon.maxUses || coupon.usedCount < coupon.maxUses * 0.8 ? 'bg-green-100 text-green-800' :
                      coupon.usedCount < coupon.maxUses ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    )}>
                      {coupon.usedCount >= (coupon.maxUses ?? 0) ? 'Habis' : 'Aktif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blog Status */}
      <div className="bg-white rounded-xl border border-admin-border p-6">
        <h2 className="font-semibold mb-4">Konten Blog</h2>
        {blogStatus && (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{blogStatus.publishedCount}</p>
              <p className="text-xs text-gray-500">Dipublish</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{blogStatus.draftCount}</p>
              <p className="text-xs text-gray-500">Draft</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-500">{blogStatus.scheduledCount}</p>
              <p className="text-xs text-gray-500">Dijadwalkan</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending_payment: { label: 'Menunggu Bayar', color: 'bg-amber-100 text-amber-800' },
    paid: { label: 'Sudah Bayar', color: 'bg-blue-100 text-blue-800' },
    processing: { label: 'Diproses', color: 'bg-indigo-100 text-indigo-800' },
    packed: { label: 'Dikemas', color: 'bg-purple-100 text-purple-800' },
    shipped: { label: 'Dikirim', color: 'bg-green-100 text-green-800' },
    delivered: { label: 'Diterima', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-800' },
  };

  const { label, color } = config[status] ?? { label: status, color: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${color}`}>
      {label}
    </span>
  );
}