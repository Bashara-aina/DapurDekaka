'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { DashboardAlert } from './types';

export interface AlertBannerProps {
  alert: DashboardAlert | undefined;
}

export function AlertBanner({ alert }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!alert || dismissed) return null;

  const colorClass =
    alert.priority === 0
      ? 'bg-red-50 border-red-300 text-red-800'
      : alert.priority === 1
      ? 'bg-red-50 border-red-200 text-red-700'
      : alert.priority === 2
      ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-blue-50 border-blue-200 text-blue-700';

  return (
    <div className={cn('border rounded-xl p-4 flex items-start gap-3', colorClass)}>
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-medium">{alert.message}</p>
      <div className="flex items-center gap-3 flex-shrink-0">
        <a
          href={alert.link}
          className="text-sm font-semibold hover:underline whitespace-nowrap flex items-center gap-1"
        >
          Lihat <ArrowRight className="w-3.5 h-3.5" />
        </a>
        <button onClick={() => setDismissed(true)} aria-label="Tutup">
          <X className="w-4 h-4 opacity-60 hover:opacity-100" />
        </button>
      </div>
    </div>
  );
}