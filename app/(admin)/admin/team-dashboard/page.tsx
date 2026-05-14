'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KPICard } from '@/components/admin/dashboard/KPICard';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { cn } from '@/lib/utils/cn';
import {
  TrendingUp, TrendingDown, ExternalLink, AlertTriangle,
  CheckCircle2, ArrowRight, Clock, Tag, FileText, MessageSquare
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

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

interface PointsSummary {
  totalPoints: number;
  expiringSoon30d: number;
  expiringSoon7d: number;
  expiredThisMonth: number;
  topBalances: { name: string; points: number }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Selamat Pagi';
  if (h < 15) return 'Selamat Siang';
  if (h < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

function getRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
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
    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${color}`}>
      {label}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'pending_payment', label: 'Menunggu Bayar', color: 'bg-amber-500', href: '/admin/orders?status=pending_payment' },
  { key: 'paid', label: 'Sudah Bayar', color: 'bg-blue-500', href: '/admin/orders?status=paid' },
  { key: 'processing', label: 'Diproses', color: 'bg-indigo-500', href: '/admin/orders?status=processing' },
  { key: 'packed', label: 'Dikemas', color: 'bg-purple-500', href: '/admin/orders?status=packed' },
  { key: 'shipped', label: 'Dikirim', color: 'bg-green-500', href: '/admin/orders?status=shipped' },
];

export default function TeamDashboardPage() {
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // ── Queries ──────────────────────────────────────────────────────────────

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

  const { data: pointsSummary } = useQuery<PointsSummary>({
    queryKey: ['points-summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/team-dashboard/points-summary');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">{greeting()} 👋</h1>
        <p className="text-sm text-[#6B6B6B]">{today}</p>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
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

      {/* ── Monthly Progress ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-5 border border-admin-border">
        <h2 className="font-semibold text-[#1A1A1A] mb-4">Progres Bulan Ini</h2>
        {monthlyProgress ? (
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-500">Target</p>
                <p className="text-lg font-bold text-[#1A1A1A]">{formatIDR(monthlyProgress.monthlyTarget)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Tercapai</p>
                <p className="text-lg font-bold text-brand-red">{formatIDR(monthlyProgress.currentRevenue)}</p>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={cn(
                  'h-3 rounded-full transition-all duration-700',
                  monthlyProgress.progress >= 80 ? 'bg-green-500' :
                  monthlyProgress.progress >= 50 ? 'bg-amber-500' : 'bg-brand-red'
                )}
                style={{ width: `${Math.min(monthlyProgress.progress, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                Hari {monthlyProgress.daysElapsed}/{monthlyProgress.daysInMonth} ·{' '}
                Pace: <span className="font-medium">{formatIDR(monthlyProgress.pace)}/hari</span>
              </span>
              <span className={cn(
                'font-semibold',
                monthlyProgress.isOnTrack === 'on_track' ? 'text-green-600' :
                monthlyProgress.isOnTrack === 'below' ? 'text-amber-500' : 'text-red-500'
              )}>
                {monthlyProgress.isOnTrack === 'on_track' ? '✅ On track' :
                 monthlyProgress.isOnTrack === 'below' ? '⚠️ Sedikit di bawah' : '🔴 Perlu akselerasi'}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-500">
                Proyeksi akhir bulan:{' '}
                <span className={cn('font-bold', monthlyProgress.projectedRevenue >= monthlyProgress.monthlyTarget ? 'text-green-600' : 'text-amber-600')}>
                  {formatIDR(monthlyProgress.projectedRevenue)}
                </span>
                {monthlyProgress.projectedRevenue >= monthlyProgress.monthlyTarget
                  ? ' ✅ Kemungkinan tercapai'
                  : ` (kurang ${formatIDR(monthlyProgress.monthlyTarget - monthlyProgress.projectedRevenue)})`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-3 bg-gray-100 rounded animate-pulse" />
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
          </div>
        )}
      </div>

      {/* ── Order Pipeline + Action Orders ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Order Status Pipeline */}
        <div className="bg-white rounded-xl p-5 border border-admin-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#1A1A1A]">Pipeline Pesanan</h2>
            <a href="/admin/orders" className="text-xs text-brand-red hover:underline flex items-center gap-1">
              Lihat semua <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {pipeline ? (
            <div className="space-y-2">
              {PIPELINE_STAGES.map(stage => {
                const count = pipeline[stage.key as keyof OrderPipeline] ?? 0;
                const allCounts = PIPELINE_STAGES.map(s => pipeline[s.key as keyof OrderPipeline] ?? 0);
                const maxCount = Math.max(...allCounts, 1);
                const widthPct = (count / maxCount) * 100;
                return (
                  <a key={stage.key} href={stage.href} className="flex items-center gap-3 group">
                    <span className="w-24 text-xs text-gray-500 group-hover:text-gray-800 transition-colors shrink-0">
                      {stage.label}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', stage.color, !count && 'opacity-20')}
                        style={{ width: `${widthPct}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                        {count}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {PIPELINE_STAGES.map(s => <div key={s.key} className="h-6 bg-gray-100 rounded animate-pulse" />)}
            </div>
          )}
        </div>

        {/* Orders Needing Action */}
        <div className="bg-white rounded-xl border border-admin-border flex flex-col">
          <div className="px-5 py-4 border-b border-admin-border flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1A1A]">Pesanan Butuh Tindakan</h2>
            <a href="/admin/orders" className="text-xs text-brand-red hover:underline flex items-center gap-1">
              Semua <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full min-w-[480px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Pesanan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Pelanggan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nilai</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Sejak</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {actionOrders?.slice(0, 8).map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono font-semibold text-[#1A1A1A] whitespace-nowrap">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[100px] truncate">{order.recipientName}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-red whitespace-nowrap">{formatIDR(order.totalAmount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{getRelativeTime(order.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/admin/orders?id=${order.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline whitespace-nowrap"
                      >
                        Proses <ArrowRight className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
                {(!actionOrders || actionOrders.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      <p className="text-sm text-gray-400">Semua pesanan sudah diproses</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Top Products + Inventory Alerts ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Top 10 Products */}
        <div className="bg-white rounded-xl border border-admin-border">
          <div className="px-5 py-4 border-b border-admin-border flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1A1A]">Top 10 Produk Bulan Ini</h2>
            <a href="/admin/products" className="text-xs text-brand-red hover:underline">Lihat semua</a>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="w-full min-w-[400px]">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terjual</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topProducts?.map((product, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-[#1A1A1A]">{product.productNameId}</p>
                      <p className="text-xs text-gray-400">{product.variantNameId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{product.unitsSold} pcs</td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-red">{formatIDR(product.revenue)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'text-sm font-semibold',
                        product.stock === 0 ? 'text-red-500' :
                        product.stock < 10 ? 'text-amber-500' : 'text-green-600'
                      )}>
                        {product.stock === 0 ? '🔴' : product.stock < 10 ? '🟡' : '🟢'} {product.stock}
                      </span>
                    </td>
                  </tr>
                ))}
                {!topProducts || topProducts.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">Belum ada data produk</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Alerts */}
        <div className="bg-white rounded-xl p-5 border border-admin-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#1A1A1A]">Inventori Alerts</h2>
            <a href="/admin/inventory" className="text-xs text-brand-red hover:underline flex items-center gap-1">
              Kelola <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {inventoryAlerts ? (
            <div className="space-y-4">
              {inventoryAlerts.outOfStock.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase mb-2">🔴 Habis Stok — Restock Segera</p>
                  <ul className="space-y-1.5">
                    {inventoryAlerts.outOfStock.slice(0, 4).map(item => (
                      <li key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <p className="text-sm text-gray-700">{item.productNameId} — {item.nameId}</p>
                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">0 unit</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {inventoryAlerts.lowStock.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-500 uppercase mb-2">🟡 Stok Menipis</p>
                  <ul className="space-y-1.5">
                    {inventoryAlerts.lowStock.slice(0, 5).map(item => (
                      <li key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <p className="text-sm text-gray-700">{item.productNameId} — {item.nameId}</p>
                        <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">{item.stock} unit</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {inventoryAlerts.outOfStock.length === 0 && inventoryAlerts.lowStock.length === 0 && (
                <div className="flex flex-col items-center py-6 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
                  <p className="text-sm text-green-600 font-medium">Semua produk dalam kondisi sehat</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          )}
        </div>
      </div>

      {/* ── B2B Pipeline ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-5 border border-admin-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#1A1A1A]">Pipeline B2B</h2>
          <a href="/admin/b2b-inquiries" className="text-xs text-brand-red hover:underline flex items-center gap-1">
            Buka B2B <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {b2bPipeline ? (
          <>
            {/* Kanban-style row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Inquiry Baru', value: b2bPipeline.newInquiries, color: 'bg-amber-50 border-amber-200 text-amber-700', href: '/admin/b2b-inquiries?status=new' },
                { label: 'Quote Dikirim', value: b2bPipeline.openQuotes, color: 'bg-blue-50 border-blue-200 text-blue-700', href: '/admin/b2b-quotes?status=sent' },
                { label: 'Quote Disetujui', value: b2bPipeline.acceptedQuotes, color: 'bg-green-50 border-green-200 text-green-700', href: '/admin/b2b-quotes?status=accepted' },
                { label: 'Pesanan B2B (MTD)', value: b2bPipeline.b2bOrdersThisMonth ?? 0, color: 'bg-indigo-50 border-indigo-200 text-indigo-700', href: '/admin/orders?type=b2b' },
              ].map(card => (
                <a
                  key={card.label}
                  href={card.href}
                  className={cn('border rounded-xl p-4 text-center hover:opacity-80 transition-opacity', card.color)}
                >
                  <p className="text-2xl font-bold">{card.value}</p>
                  <p className="text-xs mt-1 font-medium">{card.label}</p>
                </a>
              ))}
            </div>

            {/* Summary row */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div>
                <p className="text-xs text-gray-500">Revenue B2B Bulan Ini</p>
                <p className="text-lg font-bold text-brand-red">{formatIDR(b2bPipeline.b2bRevenueThisMonth)}</p>
              </div>
              {b2bPipeline.recentInquiries.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-500">Inquiry terbaru</p>
                  <p className="text-sm font-medium text-gray-700">{b2bPipeline.recentInquiries[0]?.companyName}</p>
                  <p className="text-xs text-gray-400">{b2bPipeline.recentInquiries[0]?.createdAt ? getRelativeTime(b2bPipeline.recentInquiries[0].createdAt) : ''}</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}</div>
        )}
      </div>

      {/* ── Loyalty Points Summary ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-5 border border-admin-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#1A1A1A]">Program Poin Loyalitas</h2>
          <a href="/admin/customers" className="text-xs text-brand-red hover:underline flex items-center gap-1">
            Lihat Pelanggan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {pointsSummary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xl font-bold text-blue-700">{(pointsSummary.totalPoints).toLocaleString('id-ID')}</p>
                <p className="text-xs text-blue-600 mt-0.5">Total Poin Beredar</p>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xl font-bold text-amber-700">{pointsSummary.expiringSoon30d.toLocaleString('id-ID')}</p>
                <p className="text-xs text-amber-600 mt-0.5">Kadaluarsa &lt;30 hari</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xl font-bold text-red-600">{pointsSummary.expiringSoon7d.toLocaleString('id-ID')}</p>
                <p className="text-xs text-red-600 mt-0.5">Kadaluarsa &lt;7 hari</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xl font-bold text-gray-600">{pointsSummary.expiredThisMonth.toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-500 mt-0.5">Expired Bulan Ini</p>
              </div>
            </div>
            {pointsSummary.topBalances.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Pelanggan Poin Tertinggi</p>
                <div className="space-y-1">
                  {pointsSummary.topBalances.slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700">{c.name}</span>
                      <span className="font-semibold text-blue-600">{c.points.toLocaleString('id-ID')} poin</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {pointsSummary.expiringSoon7d > 0 && (
              <button
                onClick={() => fetch('/api/admin/points/expiry-reminders', { method: 'POST' })}
                className="w-full py-2 border border-brand-red text-brand-red text-sm font-medium rounded-lg hover:bg-red-50 transition-colors"
              >
                📧 Kirim Reminder Email ke {pointsSummary.expiringSoon7d.toLocaleString()} poin yang hampir kadaluarsa
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
        )}
      </div>

      {/* ── Active Coupons + Blog Status ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Active Coupons */}
        <div className="bg-white rounded-xl border border-admin-border">
          <div className="px-5 py-4 border-b border-admin-border flex items-center justify-between">
            <h2 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <Tag className="w-4 h-4" /> Kupon Aktif
            </h2>
            <a href="/admin/coupons/new" className="text-xs font-medium text-brand-red hover:underline">
              + Buat Kupon
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terpakai</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {coupons?.slice(0, 6).map(coupon => {
                  const usagePct = coupon.maxUses ? (coupon.usedCount / coupon.maxUses) * 100 : 0;
                  const isAlmostFull = usagePct >= 80;
                  const isFull = coupon.maxUses ? coupon.usedCount >= coupon.maxUses : false;
                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-[#1A1A1A]">{coupon.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ''}
                        {coupon.maxUses && (
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                            <div
                              className={cn('h-1.5 rounded-full', isFull ? 'bg-red-500' : isAlmostFull ? 'bg-amber-500' : 'bg-green-500')}
                              style={{ width: `${Math.min(usagePct, 100)}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          'inline-flex px-2 py-0.5 text-xs font-semibold rounded-full',
                          isFull ? 'bg-red-100 text-red-700' :
                          isAlmostFull ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                        )}>
                          {isFull ? '🔴 Habis' : isAlmostFull ? '🟡 Hampir Habis' : '🟢 Aktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/admin/coupons/${coupon.id}`} className="text-xs text-brand-red hover:underline">Edit</a>
                      </td>
                    </tr>
                  );
                })}
                {!coupons || coupons.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">Tidak ada kupon aktif</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* Blog Status */}
        <div className="bg-white rounded-xl p-5 border border-admin-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#1A1A1A] flex items-center gap-2">
              <FileText className="w-4 h-4" /> Konten Blog
            </h2>
            <a href="/admin/blog" className="text-xs text-brand-red hover:underline flex items-center gap-1">
              Kelola <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {blogStatus ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                  <p className="text-2xl font-bold text-green-600">{blogStatus.publishedCount}</p>
                  <p className="text-xs text-green-600 mt-0.5">Dipublish</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-2xl font-bold text-amber-500">{blogStatus.draftCount}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Draft</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <p className="text-2xl font-bold text-blue-500">{blogStatus.scheduledCount}</p>
                  <p className="text-xs text-blue-600 mt-0.5">Terjadwal</p>
                </div>
              </div>
              {blogStatus.drafts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Draft Perlu Diselesaikan</p>
                  <div className="space-y-2">
                    {blogStatus.drafts.slice(0, 3).map(draft => (
                      <div key={draft.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-sm text-gray-700 font-medium">{draft.titleId}</p>
                          <p className="text-xs text-gray-400">Draft {getRelativeTime(draft.updatedAt)}</p>
                        </div>
                        <a
                          href={`/admin/blog/${draft.id}`}
                          className="text-xs font-semibold text-brand-red hover:underline whitespace-nowrap ml-3"
                        >
                          Edit →
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}</div>
          )}
        </div>
      </div>

      {/* ── Health Indicators ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-5 border border-admin-border">
        <h2 className="font-semibold text-[#1A1A1A] mb-4">Indikator Kesehatan Bisnis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {healthIndicators?.map(indicator => (
            <div
              key={indicator.indicator}
              className={cn(
                'p-3 rounded-xl border flex items-start gap-3',
                indicator.status === 'good' ? 'border-green-200 bg-green-50' :
                indicator.status === 'attention' ? 'border-amber-200 bg-amber-50' :
                'border-red-200 bg-red-50'
              )}
            >
              <span className="text-lg shrink-0">
                {indicator.status === 'good' ? '🟢' : indicator.status === 'attention' ? '🟡' : '🔴'}
              </span>
              <p className={cn(
                'text-sm font-medium leading-snug',
                indicator.status === 'good' ? 'text-green-800' :
                indicator.status === 'attention' ? 'text-amber-800' : 'text-red-800'
              )}>
                {indicator.message}
              </p>
            </div>
          ))}
          {(!healthIndicators || healthIndicators.length === 0) && (
            <div className="col-span-3">
              <div className="h-12 bg-gray-100 rounded animate-pulse" />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
