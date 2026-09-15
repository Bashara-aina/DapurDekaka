'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { FUNNEL_STAGES, type OrderFunnel } from './types';

export interface OrderFunnelCardProps {
  funnel: OrderFunnel | null | undefined;
  onRefresh?: () => Promise<unknown> | unknown;
}

export function OrderFunnelCard({ funnel, onRefresh }: OrderFunnelCardProps) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-admin-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">Order Status Funnel</h2>
        {onRefresh && (
          <button
            onClick={handleRefresh}
            className={cn(
              'p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500',
              refreshing && 'animate-spin'
            )}
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
      {funnel ? (
        <div className="space-y-2">
          {FUNNEL_STAGES.map((stage) => {
            const count = funnel[stage.key] ?? 0;
            const allCounts = FUNNEL_STAGES.map((s) => funnel[s.key] ?? 0);
            const maxCount = Math.max(...allCounts, 1);
            const widthPercent = (count / maxCount) * 100;
            return (
              <a
                key={stage.key}
                href={stage.href}
                className="flex items-center gap-3 group"
              >
                <span className="w-28 text-xs text-text-secondary shrink-0 group-hover:text-text-primary transition-colors">
                  {stage.label}
                </span>
                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      stage.color,
                      !count && 'opacity-30'
                    )}
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
          {FUNNEL_STAGES.map((s) => (
            <div key={s.key} className="h-7 bg-gray-100 rounded-full animate-pulse" />
          ))}
        </div>
      )}
    </div>
  );
}