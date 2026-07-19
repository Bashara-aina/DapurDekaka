'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  className?: string;
}

function Checkbox({ checked, onToggle, className }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onToggle}
      aria-label="Tandai selesai"
      className={cn(
        'h-5 w-5 rounded border-gray-300 text-brand-red focus:ring-brand-red cursor-pointer',
        className
      )}
    />
  );
}

interface RecentRefund {
  id: string;
  amount: number;
  status: string;
  createdAt: Date | null;
}

interface OpsData {
  webhookErrorCount24h: number;
  pendingOrdersOver1h: number;
  paidNotPacked: number;
  refundsOverdue3d: number;
  weeklyGrossIdr: number;
  recentRefunds: ReadonlyArray<RecentRefund>;
}

export function OpsChecklist({ data }: { data: OpsData }) {
  const t = useTranslations('opsCard');
  const [done, setDone] = useState<Set<number>>(new Set());

  const lineCount = 10;

  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <Card>
      <CardContent className="p-4 divide-y divide-brand-cream-dark">
        {Array.from({ length: lineCount }).map((_, i) => {
          const idx = i + 1;
          const status = resolveStatus(idx, data);
          return (
            <label key={idx} className="flex items-start gap-3 py-3 cursor-pointer">
              <Checkbox checked={done.has(idx)} onToggle={() => toggle(idx)} className="mt-1" />
              <div className="flex-1">
                <p className="text-sm text-text-primary">{t(`line${idx}` as `line${number}`)}</p>
                {status ? (
                  <p className={status.tone === 'ok' ? 'text-xs text-green-600 mt-0.5' : 'text-xs text-amber-600 mt-0.5'}>
                    {status.label}
                  </p>
                ) : null}
              </div>
            </label>
          );
        })}
      </CardContent>
    </Card>
  );
}

function resolveStatus(idx: number, d: OpsData): { label: string; tone: 'ok' | 'warn' } | null {
  switch (idx) {
    case 1:
      return {
        tone: d.webhookErrorCount24h === 0 ? 'ok' : 'warn',
        label: `${d.webhookErrorCount24h} error dalam 24 jam terakhir`,
      };
    case 2:
      return {
        tone: d.pendingOrdersOver1h === 0 ? 'ok' : 'warn',
        label: `${d.pendingOrdersOver1h} pesanan pending_payment > 1 jam`,
      };
    case 3:
      return {
        tone: d.paidNotPacked === 0 ? 'ok' : 'warn',
        label: `${d.paidNotPacked} paid belum masuk antrian packing`,
      };
    case 5: {
      const floorAmt = Math.floor(d.weeklyGrossIdr * 0.05);
      return {
        tone: 'ok',
        label: `Reserve mingguan (5%): ${formatIDR(floorAmt)} · Weekly gross: ${formatIDR(d.weeklyGrossIdr)}`,
      };
    }
    case 9:
      return {
        tone: d.refundsOverdue3d === 0 ? 'ok' : 'warn',
        label: `${d.refundsOverdue3d} refund obligation > 3 hari belum diproses`,
      };
    default:
      return null;
  }
}
