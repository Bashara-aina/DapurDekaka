'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';

import { AlertBanner } from '@/components/admin/dashboard/AlertBanner';
import { DateRangeFilter } from '@/components/admin/dashboard/DateRangeFilter';
import { KpiRow } from '@/components/admin/dashboard/KpiRow';
import { RevenueChart } from '@/components/admin/dashboard/RevenueChart';
import { OrderFunnelCard } from '@/components/admin/dashboard/OrderFunnelCard';
import { ActionQueueCard } from '@/components/admin/dashboard/ActionQueueCard';
import { LiveOrderFeed } from '@/components/admin/dashboard/LiveOrderFeed';
import { InventoryFlashCard } from '@/components/admin/dashboard/InventoryFlashCard';
import { PlatformUsersCard } from '@/components/admin/dashboard/PlatformUsersCard';
import { AuditLogPanel } from '@/components/admin/dashboard/AuditLogPanel';
import { PlatformHealthCard } from '@/components/admin/dashboard/PlatformHealthCard';
import { QuickActionsToolbar } from '@/components/admin/dashboard/QuickActionsToolbar';

import {
  greeting,
  safeFetchJson,
  type KPIData,
  type DashboardAlert,
  type OrderFunnel,
  type ActionQueueItem,
  type LiveOrder,
  type InventoryFlash,
  type DashboardAuditLog,
  type UserSummary,
  type RevenueChartPoint,
} from '@/components/admin/dashboard/types';

export default function SuperadminDashboardClient() {
  const { data: session } = useSession();
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  const kpisQuery = useQuery<KPIData | null>({
    queryKey: ['superadmin-kpis', dateRange.from, dateRange.to],
    queryFn: () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set('from', dateRange.from);
      if (dateRange.to) params.set('to', dateRange.to);
      return safeFetchJson<KPIData>(`/api/admin/dashboard/kpis?${params.toString()}`);
    },
    staleTime: 60000,
    refetchInterval: 30000,
  });

  const alertsQuery = useQuery<DashboardAlert[] | null>({
    queryKey: ['superadmin-alerts'],
    queryFn: () => safeFetchJson<DashboardAlert[]>('/api/admin/dashboard/alerts'),
    staleTime: 300000,
  });

  const funnelQuery = useQuery<OrderFunnel | null>({
    queryKey: ['order-funnel'],
    queryFn: () => safeFetchJson<OrderFunnel>('/api/admin/dashboard/order-funnel'),
    refetchInterval: 60000,
  });

  const actionsQuery = useQuery<ActionQueueItem[] | null>({
    queryKey: ['action-queue'],
    queryFn: () => safeFetchJson<ActionQueueItem[]>('/api/admin/dashboard/action-queue'),
    refetchInterval: 120000,
  });

  const liveFeedQuery = useQuery<{ orders: LiveOrder[]; count: number } | null>({
    queryKey: ['live-feed'],
    queryFn: () =>
      safeFetchJson<{ orders: LiveOrder[]; count: number }>(
        '/api/admin/dashboard/live-feed?limit=20'
      ),
    refetchInterval: 30000,
  });

  const inventoryQuery = useQuery<InventoryFlash | null>({
    queryKey: ['inventory-flash'],
    queryFn: () => safeFetchJson<InventoryFlash>('/api/admin/dashboard/inventory-flash'),
    refetchInterval: 120000,
  });

  const auditQuery = useQuery<{ logs: DashboardAuditLog[]; total: number } | null>({
    queryKey: ['audit-logs'],
    queryFn: () => safeFetchJson<{ logs: DashboardAuditLog[]; total: number }>(
      '/api/admin/audit-logs?page=1'
    ),
    staleTime: 300000,
  });

  const usersQuery = useQuery<UserSummary | null>({
    queryKey: ['user-summary'],
    queryFn: () => safeFetchJson<UserSummary>('/api/admin/users/summary'),
    staleTime: 300000,
  });

  const revenueQuery = useQuery<RevenueChartPoint[] | null>({
    queryKey: ['revenue-chart'],
    queryFn: () => safeFetchJson<RevenueChartPoint[]>('/api/admin/dashboard/revenue-chart'),
    staleTime: 300000,
  });

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {greeting()}, {session?.user?.name ?? 'Admin'} 👋
          </h1>
          <p className="text-sm text-text-secondary">{today}</p>
        </div>
        <QuickActionsToolbar />
      </div>

      {/* ── Alert Banner ─────────────────────────────────────────────── */}
      <AlertBanner alert={alertsQuery.data?.[0]} />

      {/* ── Date Range Filter ─────────────────────────────────────────── */}
      <DateRangeFilter dateRange={dateRange} onChange={setDateRange} />

      {/* ── KPI Cards ────────────────────────────────────────────────── */}
      <KpiRow kpis={kpisQuery.data} />

      {/* ── Revenue Chart ─────────────────────────────────────────────── */}
      {revenueQuery.data && revenueQuery.data.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-admin-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-text-primary">Revenue 30 Hari Terakhir</h2>
            <span className="text-xs text-gray-400">Dalam IDR</span>
          </div>
          <RevenueChart data={revenueQuery.data} />
        </div>
      )}

      {/* ── Order Funnel + Action Queue ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <OrderFunnelCard
          funnel={funnelQuery.data}
          onRefresh={() => funnelQuery.refetch()}
        />
        <ActionQueueCard items={actionsQuery.data} />
      </div>

      {/* ── Live Order Feed ──────────────────────────────────────────── */}
      <LiveOrderFeed orders={liveFeedQuery.data?.orders ?? null} />

      {/* ── Inventory + Users Summary ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <InventoryFlashCard data={inventoryQuery.data} />
        <PlatformUsersCard data={usersQuery.data} />
      </div>

      {/* ── Admin Audit Log ─────────────────────────────────────────── */}
      <AuditLogPanel logs={auditQuery.data?.logs ?? null} total={auditQuery.data?.total} />

      {/* ── Platform Health ─────────────────────────────────────────── */}
      <PlatformHealthCard systemHealth={kpisQuery.data?.systemHealth} />
    </div>
  );
}