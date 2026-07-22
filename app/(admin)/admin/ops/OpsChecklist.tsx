'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { formatIDR } from '@/lib/utils/format-currency';
import type { HiringTriggerResult } from '@/lib/ops/hiring-trigger';

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

interface WalletFloorCheck {
  readonly balance: number;
  readonly floorAmount: number;
  readonly ok: boolean;
  readonly shortfall: number;
  readonly weeklyDispatchCost: number;
  readonly source: 'env' | 'fallback';
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
  weeklyDispatchCostIdr: number;
  wallet: WalletFloorCheck | null;
  recentRefunds: ReadonlyArray<RecentRefund>;
  disputesOpenOver24h: number;
  pendingRefundsTotalIdr: number;
  refundReserveTargetIdr: number;
  refundReserveOk: boolean;
  ordersThisWeek: number;
  soloOpsCeiling: number;
  helperTriggerCeiling: number;
  needsAttentionCount: number;
  packedUnbookedOver2h: number;
  shippedNoScanOver6h: number;
  pickupUnclaimedOver24h: number;
  paidOrdersToday: number;
  hiringTrigger: HiringTriggerResult | null;
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
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="text-xs text-text-secondary space-y-1">
            <p>
              Pesanan minggu ini: <strong>{data.ordersThisWeek}</strong>
              {' \u00B7 '}
              Solo ceiling: <strong>{data.soloOpsCeiling}</strong>
              {' \u00B7 '}
              Helper trigger: <strong>{data.helperTriggerCeiling}</strong>
            </p>
            {data.ordersThisWeek > data.soloOpsCeiling && (
              <p className="text-amber-600 font-medium">
                Melebihi solo ceiling -- evaluasi perlambatan atau rekrut
              </p>
            )}
            {data.hiringTrigger && (data.hiringTrigger.triggered || data.hiringTrigger.weeksOverEighty > 0) && (
              <p className={data.hiringTrigger.triggered ? 'text-amber-600 font-medium' : 'text-green-600 text-xs'}>
                {data.hiringTrigger.recommendation}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

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
    </div>
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
    case 4: {
      const total = d.packedUnbookedOver2h + d.shippedNoScanOver6h;
      const parts = [
        `${d.packedUnbookedOver2h} packed belum dibooking > 2 jam`,
        `${d.shippedNoScanOver6h} shipped tanpa scan > 6 jam`,
      ];
      if (d.pickupUnclaimedOver24h > 0) parts.push(`${d.pickupUnclaimedOver24h} pickup > 24 jam`);
      return {
        tone: total === 0 && d.pickupUnclaimedOver24h === 0 ? 'ok' : 'warn',
        label: parts.join(' \u00B7 '),
      };
    }
    case 5: {
      if (!d.wallet) {
        return { tone: 'warn', label: 'Wallet: data tidak tersedia' };
      }
      const status = d.wallet.ok ? 'OK' : 'PERLU TOP UP';
      return {
        tone: d.wallet.ok ? 'ok' : 'warn',
        label: `Wallet: ${status} -- saldo ${formatIDR(d.wallet.balance)} / floor ${formatIDR(d.wallet.floorAmount)} -- Dispatch 7hari: ${formatIDR(d.weeklyDispatchCostIdr)}`,
      };
    }
    case 6:
      return {
        tone: d.needsAttentionCount === 0 ? 'ok' : 'warn',
        label: `${d.needsAttentionCount} pesanan perlu perhatian`,
      };
    case 7:
      return {
        tone: 'ok',
        label: 'Tandai setelah semua WA terjawab',
      };
    case 8:
      return d.paidOrdersToday > 0
        ? { tone: 'ok', label: `${d.paidOrdersToday} pesanan dibayar hari ini` }
        : { tone: 'ok', label: 'Belum ada pesanan dibayar hari ini' };
    case 9: {
      const parts = [`${d.refundsOverdue3d} refund overdue > 3 hari`];
      if (d.pendingRefundsTotalIdr > 0 || d.refundReserveTargetIdr > 0) {
        parts.push(`Total pending: ${formatIDR(d.pendingRefundsTotalIdr)}`);
        parts.push(`Reserve: ${formatIDR(d.refundReserveTargetIdr)}`);
        parts.push(d.refundReserveOk ? 'OK' : 'Melebihi reserve');
      }
      return {
        tone: d.refundsOverdue3d === 0 && d.refundReserveOk ? 'ok' : 'warn',
        label: parts.join(' \u00B7 '),
      };
    }
    default:
      return null;
  }
}
