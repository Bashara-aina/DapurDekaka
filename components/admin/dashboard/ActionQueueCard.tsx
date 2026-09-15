'use client';

import { useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ActionQueueItem } from './types';

export interface ActionQueueCardProps {
  items: ActionQueueItem[] | null | undefined;
}

export function ActionQueueCard({ items }: ActionQueueCardProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  return (
    <div className="bg-white rounded-xl border border-admin-border flex flex-col">
      <div className="px-5 py-4 border-b border-admin-border">
        <h2 className="font-semibold text-text-primary">Action Queue</h2>
      </div>
      <div className="flex-1 p-3 space-y-2 max-h-72 overflow-y-auto">
        {items && items.length > 0 ? (
          items.slice(0, 8).map((item, idx) => {
            const dismissKey = `${item.type}-${item.entityId}`;
            if (dismissed.has(dismissKey)) return null;
            return (
              <div
                key={idx}
                className={cn(
                  'flex items-center justify-between gap-3 p-3 rounded-lg border text-sm',
                  item.priority === 1
                    ? 'border-red-200 bg-red-50'
                    : item.priority === 2
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-blue-100 bg-blue-50'
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
                    onClick={() => setDismissed((prev) => new Set(prev).add(dismissKey))}
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
  );
}