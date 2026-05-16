'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, CheckCircle2, X, RefreshCw, ExternalLink,
  Package, Users, DollarSign, Activity, TrendingUp, TrendingDown,
  ArrowRight, Download, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { KPICard } from '@/components/admin/dashboard/KPICard';
import { RevenueChart } from '@/components/admin/dashboard/RevenueChart';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { cn } from '@/lib/utils/cn';

// ── Types ────────────────────────────────────────────────────────────────────

interface KPIData {
  revenueToday: number;
  revenueDelta: number;
  estimatedMargin: number;
  marginPercent: number;
  ordersToday: number;
  ordersDelta: number;
  newCustomersToday: number;
  guestCheckoutsToday: number;
  systemHealth?: {
    status: string;
    midtransWebhook: string;
    neonDB: string;
    lastCronCheck: string;
  };
}

interface Alert {
  priority: number;
  message: string;
  link: string;
  dismissKey?: string;
}

interface OrderFunnel {
  pending_payment: number;
  paid: number;
  processing: number;
  packed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

interface ActionQueueItem {
  priority: number;
  type: string;
  message: string;
  entityId: string;
  actionLabel: string;
  link: string;
}

interface LiveOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  recipientName: string;
  totalAmount: number;
  courierName: string | null;
  itemSummary: { name: string; quantity: number }[];
  totalItems: number;
}

interface InventoryFlash {
  outOfStockCount: number;
  lowStockCount: number;
  healthyCount: number;
  outOfStock: { id: string; nameId: string; sku: string; stock: number; productNameId: string | null }[];
  lowStock: { id: string; nameId: string; sku: string; stock: number; productNameId: string | null }[];
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  ipAddress: string | null;
  user?: { name: string | null; email: string | null } | null;
}

interface UserSummary {
  superadmin: number;
  owner: number;
  warehouse: number;
  b2b: number;
  customer: number;
  inactive: number;
  recentSignups: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Selamat Pagi';
  if (h < 15) return 'Selamat Siang';
  if (h < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

// ── Sub-components ────────────────────────────────────────────────────────────

const FUNNEL_STAGES = [
  { key: 'pending_payment', label: 'Menunggu Bayar', color: 'bg-amber-500', href: '/admin/orders?status=pending_payment' },
  { key: 'paid', label: 'Dibayar', color: 'bg-blue-500', href: '/admin/orders?status=paid' },
  { key: 'processing', label: 'Diproses', color: 'bg-indigo-500', href: '/admin/orders?status=processing' },
  { key: 'packed', label: 'Dikemas', color: 'bg-purple-500', href: '/admin/orders?status=packed' },
  { key: 'shipped', label: 'Dikirim', color: 'bg-green-500', href: '/admin/orders?status=shipped' },
];

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    pending_payment: { label: 'Menunggu', color: 'bg-amber-100 text-amber-800' },
    paid: { label: 'Dibayar', color: 'bg-blue-100 text-blue-800' },
    processing: { label: 'Diproses', color: 'bg-indigo-100 text-indigo-800' },
    packed: { label: 'Dikemas', color: 'bg-purple-100 text-purple-800' },
    shipped: { label: 'Dikirim', color: 'bg-green-100 text-green-800' },
    delivered: { label: 'Diterima', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Batal', color: 'bg-red-100 text-red-800' },
  };
  const { label, color } = config[status] ?? { label: status, color: 'bg-gray-100 text-gray-800' };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${color}`}>
      {label}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const LIVE_FEED_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'paid', label: 'Dibayar' },
  { key: 'processing', label: 'Diproses' },
  { key: 'packed', label: 'Dikemas' },
  { key: 'shipped', label: 'Dikirim' },
];

const DATE_PRESETS = [
  { label: 'Hari Ini', getValue: () => { const t = new Date(); return { from: t.toISOString().split('T')[0], to: t.toISOString().split('T')[0] }; } },
  { label: 'Minggu Ini', getValue: () => { const t = new Date(); const start = new Date(t); start.setDate(t.getDate() - 6); return { from: start.toISOString().split('T')[0], to: t.toISOString().split('T')[0] }; } },
  { label: 'Bulan Ini', getValue: () => { const t = new Date(); const start = new Date(t.getFullYear(), t.getMonth(), 1); return { from: start.toISOString().split('T')[0], to: t.toISOString().split('T')[0] }; } },
  { label: '30 Hari', getValue: () => { const t = new Date(); const start = new Date(t); start.setDate(t.getDate() - 29); return { from: start.toISOString().split('T')[0], to: t.toISOString().split('T')[0] }; } },
];

export default function SuperadminDashboardPage() {
  const { data: session } = useSession();
  const [dismissedAlert, setDismissedAlert] = useState(false);
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [funnelFilter] = useState('all');
  const [feedFilter, setFeedFilter] = useState('all');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  const { data: kpis } = useQuery<KPIData>({
    queryKey: ['superadmin-kpis', dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      const res = await fetch(`/api/admin/dashboard/kpis?${params.toString()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const { data: alerts } = useQuery<Alert[]>({
    queryKey: ['superadmin-alerts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/alerts');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const { data: orderFunnel, refetch: refetchFunnel, isFetching: funnelFetching } = useQuery<OrderFunnel>({
    queryKey: ['order-funnel'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/order-funnel');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    refetchInterval: 60000,
  });

  const { data: actionQueue } = useQuery<ActionQueueItem[]>({
    queryKey: ['action-queue'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/action-queue');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    refetchInterval: 120000,
  });

  const { data: liveFeed } = useQuery<LiveOrder[]>({
    queryKey: ['live-feed'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/live-feed?limit=20');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    refetchInterval: 30000,
  });

  const { data: inventoryFlash } = useQuery<InventoryFlash>({
    queryKey: ['inventory-flash'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/inventory-flash');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    refetchInterval: 120000,
  });

  const { data: auditLogs } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await fetch('/api/admin/audit-logs?page=1');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const { data: userSummary } = useQuery<UserSummary>({
    queryKey: ['user-summary'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users/summary');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const { data: revenueChartData } = useQuery<Array<{ date: string; label: string; revenue: number; orders: number }>>({
    queryKey: ['revenue-chart'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/revenue-chart');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    staleTime: 300000,
  });

  const isSystemHealthy = kpis?.systemHealth?.status === 'operational';
  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Top alert (highest priority = lowest number)
  const topAlert = alerts?.[0];
  const alertColor = topAlert?.priority === 0
    ? 'bg-red-50 border-red-300 text-red-800'
    : topAlert?.priority === 1
    ? 'bg-red-50 border-red-200 text-red-700'
    : topAlert?.priority === 2
    ? 'bg-amber-50 border-amber-200 text-amber-800'
    : 'bg-blue-50 border-blue-200 text-blue-700';

  const filteredFeed = feedFilter === 'all'
    ? liveFeed ?? []
    : (liveFeed ?? []).filter(o => o.status === feedFilter);

  return (
    <div className="space-y-5 pb-20 md:pb-6">

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{greeting()}, {session?.user?.name ?? 'Admin'} 👋</h1>
          <p className="text-sm text-[#6B6B6B]">{today}</p>
        </div>

        {/* Quick Action Toolbar */}
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-medium rounded-lg hover:bg-[#1E293B] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Produk
          </a>
          <a
            href="/admin/coupons/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-medium rounded-lg hover:bg-[#1E293B] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Kupon
          </a>
          <a
            href="/admin/orders"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Package className="w-3.5 h-3.5" /> Semua Pesanan
          </a>
        </div>
      </div>

      {/* ── Alert Banner ─────────────────────────────────────────────── */}
      {topAlert && !dismissedAlert && (
        <div className={cn('border rounded-xl p-4 flex items-start gap-3', alertColor)}>
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="flex-1 text-sm font-medium">{topAlert.message}</p>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a href={topAlert.link} className="text-sm font-semibold hover:underline whitespace-nowrap flex items-center gap-1">
              Lihat <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <button onClick={() => setDismissedAlert(true)} aria-label="Tutup">
              <X className="w-4 h-4 opacity-60 hover:opacity-100" />
            </button>
          </div>
        </div>
      )}

      {/* ── Date Range Filter ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 border border-admin-border">
        <span className="text-sm font-medium text-[#1A1A1A]">Periode:</span>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => setDateRange(preset.getValue())}
              className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="h-9 px-3 rounded-lg border border-admin-border bg-white text-sm"
          />
          <span className="text-gray-400">—</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="h-9 px-3 rounded-lg border border-admin-border bg-white text-sm"
          />
        </div>
        {(dateRange.from || dateRange.to) && (
          <button
            onClick={() => setDateRange({ from: '', to: '' })}
            className="text-xs text-brand-red hover:underline font-medium"
          >
            Reset
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          Default: hari ini
        </span>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard
          title="Revenue Hari Ini"
          value={kpis?.revenueToday ?? 0}
          isCurrency
          change={kpis?.revenueDelta}
          changePeriod="vs minggu lalu"
        />
        <KPICard
          title="Pesanan Hari Ini"
          value={kpis?.ordersToday ?? 0}
          change={kpis?.ordersDelta}
          changePeriod="vs minggu lalu"
        />
        <KPICard
          title="Pelanggan Baru"
          value={kpis?.newCustomersToday ?? 0}
        />
        <KPICard
          title={`Est. Margin (${kpis?.marginPercent ?? 18}%)`}
          value={kpis?.estimatedMargin ?? 0}
          isCurrency
        />
        {/* System Health card */}
        <div className="bg-white rounded-card p-5 shadow-card border border-admin-border">
          <p className="text-sm font-medium text-[#6B6B6B] mb-3">System Health</p>
          <div className="flex items-center gap-2 mb-2">
            {isSystemHealthy ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-500" />
            )}
            <span className={cn('text-sm font-bold', isSystemHealthy ? 'text-green-600' : 'text-red-600')}>
              {isSystemHealthy ? 'Operational' : 'Ada Masalah'}
            </span>
          </div>
          {kpis?.systemHealth && !isSystemHealthy && (
            <p className="text-xs text-red-500 mt-1">
              {kpis.systemHealth.midtransWebhook !== 'ok' && 'Midtrans webhook bermasalah'}
              {kpis.systemHealth.neonDB !== 'ok' && ' · DB lambat'}
            </p>
          )}
          {kpis?.systemHealth?.lastCronCheck && (
            <p className="text-xs text-[#ABABAB] mt-1">Cron: {kpis.systemHealth.lastCronCheck}</p>
          )}
        </div>
      </div>

      {/* ── Revenue Chart ─────────────────────────────────────────────────── */}
      {revenueChartData && revenueChartData.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-admin-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#1A1A1A]">Revenue 30 Hari Terakhir</h2>
            <span className="text-xs text-gray-400">Dalam IDR</span>
          </div>
          <RevenueChart data={revenueChartData} />
        </div>
      )}

      {/* ── Order Funnel + Action Queue ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Order Status Funnel */}
        <div className="bg-white rounded-xl p-5 border border-admin-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#1A1A1A]">Order Status Funnel</h2>
            <button
              onClick={() => refetchFunnel()}
              className={cn('p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500', funnelFetching && 'animate-spin')}
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          {orderFunnel ? (
            <div className="space-y-2">
              {FUNNEL_STAGES.map(stage => {
                const count = orderFunnel[stage.key as keyof OrderFunnel] ?? 0;
                const allCounts = FUNNEL_STAGES.map(s => orderFunnel[s.key as keyof OrderFunnel] ?? 0);
                const maxCount = Math.max(...allCounts, 1);
                const widthPercent = (count / maxCount) * 100;
                return (
                  <a key={stage.key} href={stage.href} className="flex items-center gap-3 group">
                    <span className="w-28 text-xs text-[#6B6B6B] shrink-0 group-hover:text-[#1A1A1A] transition-colors">
                      {stage.label}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', stage.color, !count && 'opacity-30')}
                        style={{ width: `${widthPercent}%` }}
                      />
                      {count > 0 ? (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                          {count}
                        </span>
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-400">
                          0
                        </span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {FUNNEL_STAGES.map(s => (
                <div key={s.key} className="h-7 bg-gray-100 rounded-full animate-pulse" />
              ))}
            </div>
          )}
        </div>

        {/* Action Queue */}
        <div className="bg-white rounded-xl border border-admin-border flex flex-col">
          <div className="px-5 py-4 border-b border-admin-border">
            <h2 className="font-semibold text-[#1A1A1A]">Action Queue</h2>
          </div>
          <div className="flex-1 p-3 space-y-2 max-h-72 overflow-y-auto">
            {actionQueue && actionQueue.length > 0 ? (
              actionQueue.slice(0, 8).map((item, idx) => {
                const dismissKey = `${item.type}-${item.entityId}`;
                if (dismissedActions.has(dismissKey)) return null;
                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-center justify-between gap-3 p-3 rounded-lg border text-sm',
                      item.priority === 1 ? 'border-red-200 bg-red-50' :
                      item.priority === 2 ? 'border-amber-200 bg-amber-50' :
                      'border-blue-100 bg-blue-50'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">
                        {item.priority === 1 ? '🔴' : item.priority === 2 ? '🟡' : '🔵'}
                      </span>
                      <p className="text-gray-700 truncate">{item.message}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setDismissedActions(prev => new Set(prev).add(dismissKey))}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        aria-label="Abaikan"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={item.link}
                        className="text-xs font-semibold text-brand-red hover:underline whitespace-nowrap"
                      >
                        {item.actionLabel}
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <CheckCircle2 className="w-8 h-8 mb-2 text-green-400" />
                <p className="text-sm">Tidak ada action yang diperlukan</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Live Order Feed ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-admin-border">
        <div className="px-5 py-4 border-b border-admin-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[#1A1A1A]">Live Order Feed</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              refresh 30s
            </span>
          </div>
          <a href="/admin/orders" className="text-xs text-brand-red hover:underline flex items-center gap-1">
            Lihat semua <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Filter chips */}
        <div className="px-5 py-2.5 border-b border-admin-border flex gap-1.5 overflow-x-auto">
          {LIVE_FEED_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFeedFilter(f.key)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                feedFilter === f.key
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Waktu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Pelanggan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredFeed.slice(0, 15).map(order => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono font-medium text-[#1A1A1A] whitespace-nowrap">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {getRelativeTime(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[120px] truncate">
                    {order.recipientName}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {order.totalItems} item
                    {order.itemSummary?.[0] && (
                      <span className="text-gray-400"> · {order.itemSummary[0].name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-red whitespace-nowrap">
                    {formatIDR(order.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/admin/orders/${order.id}`}
                      className="text-xs text-brand-red hover:underline font-medium"
                    >
                      Detail
                    </a>
                  </td>
                </tr>
              ))}
              {filteredFeed.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Tidak ada pesanan
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Inventory Flash + Users Summary ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Inventory Flash */}
        <div className="bg-white rounded-xl p-5 border border-admin-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#1A1A1A]">Inventory Flash</h2>
            <a href="/admin/inventory" className="text-xs text-brand-red hover:underline flex items-center gap-1">
              Lihat Semua <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {inventoryFlash ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-2xl font-bold text-red-500">{inventoryFlash.outOfStockCount}</p>
                  <p className="text-xs text-red-600 mt-0.5">Habis</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-2xl font-bold text-amber-500">{inventoryFlash.lowStockCount}</p>
                  <p className="text-xs text-amber-600 mt-0.5">Menipis</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-2xl font-bold text-green-600">{inventoryFlash.healthyCount}</p>
                  <p className="text-xs text-green-700 mt-0.5">Sehat</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {inventoryFlash.outOfStock.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm text-red-600 font-medium">{item.productNameId} — {item.nameId}</p>
                      <p className="text-xs text-gray-400">{item.sku}</p>
                    </div>
                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded">0 unit</span>
                  </div>
                ))}
                {inventoryFlash.lowStock.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm text-amber-600 font-medium">{item.productNameId} — {item.nameId}</p>
                      <p className="text-xs text-gray-400">{item.sku}</p>
                    </div>
                    <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded">{item.stock} unit</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          )}
        </div>

        {/* Platform Users */}
        <div className="bg-white rounded-xl p-5 border border-admin-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[#1A1A1A]">Platform Users</h2>
            <a href="/admin/users" className="text-xs text-brand-red hover:underline flex items-center gap-1">
              Kelola <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          {userSummary ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Superadmin', value: userSummary.superadmin, color: 'text-purple-600' },
                  { label: 'Owner', value: userSummary.owner, color: 'text-blue-600' },
                  { label: 'Warehouse', value: userSummary.warehouse, color: 'text-green-600' },
                  { label: 'B2B', value: userSummary.b2b, color: 'text-amber-600' },
                  { label: 'Customer', value: userSummary.customer, color: 'text-gray-700' },
                  { label: 'Inactive', value: userSummary.inactive, color: 'text-red-400' },
                ].map(u => (
                  <div key={u.label} className="text-center py-2">
                    <p className={cn('text-xl font-bold', u.color)}>{u.value}</p>
                    <p className="text-xs text-gray-500">{u.label}</p>
                  </div>
                ))}
              </div>
              {userSummary.recentSignups > 0 && (
                <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                  📈 <span className="font-medium">{userSummary.recentSignups} customer baru</span> dalam 7 hari terakhir
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <a
                  href="/admin/users?role=warehouse"
                  className="flex-1 text-center px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  + Tambah Staf Gudang
                </a>
                <a
                  href="/admin/users"
                  className="flex-1 text-center px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Kelola Role
                </a>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Admin Audit Log ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-admin-border">
        <div className="px-5 py-4 border-b border-admin-border flex items-center justify-between">
          <h2 className="font-semibold text-[#1A1A1A]">Admin Audit Log</h2>
          <button
            onClick={async () => {
              setDownloading(true);
              try {
                const res = await fetch('/api/admin/audit-logs?export=csv');
                if (!res.ok) throw new Error('Download failed');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit-log-${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Audit log berhasil diunduh');
              } catch {
                toast.error('Gagal mengunduh audit log');
              } finally {
                setDownloading(false);
              }
            }}
            disabled={downloading}
            className="flex items-center gap-1.5 text-xs text-brand-red hover:underline font-medium disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> {downloading ? 'Mengunduh...' : 'Download CSV'}
          </button>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full min-w-[500px]">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Waktu</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Action</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Entity</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs?.logs.slice(0, 15).map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {formatWIB(new Date(log.createdAt))}
                  </td>
                  <td className="px-5 py-3 text-xs font-mono font-medium text-[#1A1A1A]">{log.action}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {log.entityType}{log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {log.user?.name ?? log.user?.email ?? '—'}
                  </td>
                </tr>
              ))}
              {(!auditLogs || auditLogs.logs.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">Belum ada log</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Platform Health (stub) ────────────────────────────────────── */}
      <div className="bg-white rounded-xl p-5 border border-admin-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[#1A1A1A]">Platform Health</h2>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', isSystemHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
            {isSystemHealthy ? '✓ Semua normal' : '✗ Ada masalah'}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Midtrans Webhook', value: kpis?.systemHealth?.midtransWebhook ?? 'checking…' },
            { label: 'Database (Neon)', value: kpis?.systemHealth?.neonDB ?? 'checking…' },
            { label: 'Cron Jobs', value: kpis?.systemHealth?.lastCronCheck ?? 'checking…' },
          ].map(service => (
            <div key={service.label} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500 mb-1">{service.label}</p>
              <p className={cn('text-xs font-semibold', service.value === 'ok' || service.value === 'operational' ? 'text-green-600' : 'text-amber-600')}>
                {service.value === 'ok' ? '✓ Operasional' : service.value}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
