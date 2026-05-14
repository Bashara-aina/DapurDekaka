'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Clock, Package, Truck, Users, DollarSign, Activity, RefreshCw, Settings } from 'lucide-react';
import { KPICard } from '@/components/admin/dashboard/KPICard';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { cn } from '@/lib/utils/cn';

interface KPIData {
  revenueToday: number;
  revenueDelta: number;
  estimatedMargin: number;
  ordersToday: number;
  ordersDelta: number;
  newCustomersToday: number;
  guestCheckoutsToday: number;
  systemHealth: {
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

export default function SuperadminDashboardPage() {
  const { data: kpis } = useQuery<KPIData>({
    queryKey: ['superadmin-kpis'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard/kpis');
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

  const { data: orderFunnel } = useQuery<OrderFunnel>({
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

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selapat Malam';
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const isSystemHealthy = kpis?.systemHealth?.status === 'operational';

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{greeting()}, Bashara 👋</h1>
          <p className="text-sm text-[#6B6B6B]">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <Settings className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {alerts && alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          {alerts.slice(0, 2).map((alert, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800">{alert.message}</p>
              <a href={alert.link} className="text-sm font-medium text-amber-600 hover:underline ml-auto">
                Lihat →
              </a>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
          title="Estimasi Margin"
          value={kpis?.estimatedMargin ?? 0}
          isCurrency
        />
        <div className="bg-white rounded-xl p-5 shadow-card border border-admin-border">
          <p className="text-sm font-medium text-[#6B6B6B] mb-2">System Health</p>
          <div className="flex items-center gap-2">
            {isSystemHealthy ? (
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            )}
            <span className={cn(
              'text-sm font-bold',
              isSystemHealthy ? 'text-green-600' : 'text-red-600'
            )}>
              {isSystemHealthy ? 'Operational' : 'Issues Detected'}
            </span>
          </div>
        </div>
      </div>

      {/* Order Funnel */}
      <div className="bg-white rounded-xl p-6 border border-admin-border">
        <h2 className="font-semibold text-lg mb-4">Order Status Funnel</h2>
        {orderFunnel && (
          <div className="space-y-2">
            {[
              { key: 'pending_payment', label: 'Menunggu Bayar', color: 'bg-amber-500' },
              { key: 'paid', label: 'Dibayar', color: 'bg-blue-500' },
              { key: 'processing', label: 'Diproses', color: 'bg-indigo-500' },
              { key: 'packed', label: 'Dikemas', color: 'bg-purple-500' },
              { key: 'shipped', label: 'Dikirim', color: 'bg-green-500' },
            ].map(stage => {
              const count = orderFunnel[stage.key as keyof OrderFunnel] ?? 0;
              const maxCount = Math.max(...Object.values(orderFunnel).filter(v => typeof v === 'number') as number[], 1);
              const widthPercent = (count / maxCount) * 100;
              return (
                <div key={stage.key} className="flex items-center gap-4">
                  <div className="w-32 text-sm text-[#6B6B6B]">{stage.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                    <div 
                      className={cn('h-full rounded-full transition-all', stage.color)}
                      style={{ width: `${widthPercent}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                      {count}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Feed + Action Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Order Feed */}
        <div className="bg-white rounded-xl border border-admin-border">
          <div className="px-6 py-4 border-b border-admin-border flex items-center justify-between">
            <h2 className="font-semibold">Live Order Feed</h2>
            <span className="text-xs text-gray-400">Auto-refresh 30s</span>
          </div>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {liveFeed?.slice(0, 10).map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatWIB(order.createdAt).split(',')[1]?.trim() ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.recipientName}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-brand-red">{formatIDR(order.totalAmount)}</td>
                  </tr>
                ))}
                {(!liveFeed || liveFeed.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Tidak ada pesanan terbaru</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Queue */}
        <div className="bg-white rounded-xl border border-admin-border">
          <div className="px-6 py-4 border-b border-admin-border">
            <h2 className="font-semibold">Action Queue</h2>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {actionQueue?.slice(0, 8).map((item, idx) => (
              <div key={idx} className={cn(
                'flex items-center justify-between p-3 rounded-lg border',
                item.priority === 1 ? 'border-red-200 bg-red-50' :
                item.priority === 2 ? 'border-amber-200 bg-amber-50' :
                'border-gray-200 bg-gray-50'
              )}>
                <div className="flex items-center gap-3">
                  {item.priority === 1 ? (
                    <span className="text-lg">🔴</span>
                  ) : item.priority === 2 ? (
                    <span className="text-lg">🟡</span>
                  ) : (
                    <span className="text-lg">🔵</span>
                  )}
                  <p className="text-sm text-gray-700">{item.message}</p>
                </div>
                <a 
                  href={item.link}
                  className="text-sm font-medium text-brand-red hover:underline whitespace-nowrap"
                >
                  {item.actionLabel}
                </a>
              </div>
            ))}
            {(!actionQueue || actionQueue.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">Tidak ada action yang diperlukan</p>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Flash */}
      <div className="bg-white rounded-xl p-6 border border-admin-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Inventory Flash</h2>
          <a href="/admin/inventory" className="text-sm text-brand-red hover:underline">Lihat Semua →</a>
        </div>
        {inventoryFlash && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-3xl font-bold text-red-500">{inventoryFlash.outOfStockCount}</p>
              <p className="text-xs text-red-600 mt-1">Out of Stock</p>
            </div>
            <div className="text-center p-4 bg-amber-50 rounded-lg">
              <p className="text-3xl font-bold text-amber-500">{inventoryFlash.lowStockCount}</p>
              <p className="text-xs text-amber-600 mt-1">Low Stock</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-3xl font-bold text-green-600">{inventoryFlash.healthyCount}</p>
              <p className="text-xs text-green-600 mt-1">Healthy</p>
            </div>
          </div>
        )}
        {inventoryFlash && (
          <div className="space-y-2">
            {inventoryFlash.outOfStock.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-red-600">{item.productNameId} — {item.nameId}</p>
                  <p className="text-xs text-gray-400">{item.sku}</p>
                </div>
                <span className="text-sm font-bold text-red-500">0 unit</span>
              </div>
            ))}
            {inventoryFlash.lowStock.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-amber-600">{item.productNameId} — {item.nameId}</p>
                  <p className="text-xs text-gray-400">{item.sku}</p>
                </div>
                <span className="text-sm font-bold text-amber-500">{item.stock} unit</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Users Summary */}
      <div className="bg-white rounded-xl p-6 border border-admin-border">
        <h2 className="font-semibold text-lg mb-4">Platform Users</h2>
        {userSummary && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">{userSummary.superadmin}</p>
              <p className="text-xs text-gray-500">Superadmin</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{userSummary.owner}</p>
              <p className="text-xs text-gray-500">Owner</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{userSummary.warehouse}</p>
              <p className="text-xs text-gray-500">Warehouse</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{userSummary.b2b}</p>
              <p className="text-xs text-gray-500">B2B</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-600">{userSummary.customer}</p>
              <p className="text-xs text-gray-500">Customers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{userSummary.inactive}</p>
              <p className="text-xs text-gray-500">Inactive</p>
            </div>
          </div>
        )}
      </div>

      {/* Audit Log */}
      <div className="bg-white rounded-xl border border-admin-border">
        <div className="px-6 py-4 border-b border-admin-border flex items-center justify-between">
          <h2 className="font-semibold">Admin Audit Log</h2>
          <a href="/admin/settings" className="text-sm text-brand-red hover:underline">Download CSV →</a>
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waktu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {auditLogs?.logs.slice(0, 10).map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-xs text-gray-400">
                    {formatWIB(log.createdAt)}
                  </td>
                  <td className="px-6 py-3 text-sm font-medium">{log.action}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">
                    {log.entityType} {log.entityId ? `#${log.entityId.slice(0, 8)}` : ''}
                  </td>
                </tr>
              ))}
              {(!auditLogs || auditLogs.logs.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400">Tidak ada log</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 border border-admin-border">
        <h2 className="font-semibold text-lg mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/admin/products/new" className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
            + New Product
          </a>
          <a href="/admin/coupons/new" className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
            + New Coupon
          </a>
          <a href="/admin/users/new?role=warehouse" className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700">
            + Add Warehouse Staff
          </a>
        </div>
      </div>
    </div>
  );
}

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
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${color}`}>
      {label}
    </span>
  );
}