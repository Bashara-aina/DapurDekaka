'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { KPICard } from './KPICard';
import type { KPIData } from './types';

export interface SystemHealthCardProps {
  health: KPIData['systemHealth'] | undefined;
}

export function SystemHealthCard({ health }: SystemHealthCardProps) {
  const isHealthy = health?.status === 'operational';

  return (
    <div className="bg-white rounded-card p-5 shadow-card border border-admin-border">
      <p className="text-sm font-medium text-text-secondary mb-3">System Health</p>
      <div className="flex items-center gap-2 mb-2">
        {isHealthy ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-red-500" />
        )}
        <span
          className={cn(
            'text-sm font-bold',
            isHealthy ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isHealthy ? 'Operational' : 'Ada Masalah'}
        </span>
      </div>
      {health && !isHealthy && (
        <p className="text-xs text-red-500 mt-1">
          {health.midtransWebhook !== 'ok' && 'Midtrans webhook bermasalah'}
          {health.neonDB !== 'ok' && ' · DB lambat'}
        </p>
      )}
      {health?.lastCronCheck && (
        <p className="text-xs text-text-disabled mt-1">Cron: {health.lastCronCheck}</p>
      )}
    </div>
  );
}

export function KpiRow({ kpis }: { kpis: KPIData | null | undefined }) {
  return (
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
      <KPICard title="Pelanggan Baru" value={kpis?.newCustomersToday ?? 0} />
      <KPICard
        title={`Est. Margin (${kpis?.marginPercent ?? 18}%)`}
        value={kpis?.estimatedMargin ?? 0}
        isCurrency
      />
      <SystemHealthCard health={kpis?.systemHealth} />
    </div>
  );
}