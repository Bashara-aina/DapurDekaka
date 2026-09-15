'use client';

import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { KPIData } from './types';

export interface PlatformHealthCardProps {
  systemHealth: KPIData['systemHealth'] | undefined;
}

export function PlatformHealthCard({ systemHealth }: PlatformHealthCardProps) {
  const isHealthy = systemHealth?.status === 'operational';

  const services = [
    { label: 'Midtrans Webhook', value: systemHealth?.midtransWebhook ?? 'checking…' },
    { label: 'Database (Neon)', value: systemHealth?.neonDB ?? 'checking…' },
    { label: 'Cron Jobs', value: systemHealth?.lastCronCheck ?? 'checking…' },
  ];

  return (
    <div className="bg-white rounded-xl p-5 border border-admin-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">Platform Health</h2>
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isHealthy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          )}
        >
          {isHealthy ? '✓ Semua normal' : '✗ Ada masalah'}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {services.map((service) => {
          const ok = service.value === 'ok' || service.value === 'operational';
          return (
            <div
              key={service.label}
              className="p-3 rounded-lg border border-gray-100 bg-gray-50"
            >
              <div className="flex items-center gap-1.5 mb-1">
                {ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                )}
                <p className="text-xs text-gray-500">{service.label}</p>
              </div>
              <p
                className={cn(
                  'text-xs font-semibold',
                  ok ? 'text-green-600' : 'text-amber-600'
                )}
              >
                {ok ? '✓ Operasional' : service.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}