'use client';

import { useState } from 'react';
import { Coins } from 'lucide-react';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';
import { POINTS_MIN_REDEEM, POINTS_VALUE_IDR } from '@/lib/constants/points';

interface PointsRedeemerProps {
  pointsBalance: number;
  subtotal: number;
  usedPoints: number;
  onToggle: (use: boolean) => void;
  className?: string;
}

export function PointsRedeemer({
  pointsBalance,
  subtotal,
  usedPoints,
  onToggle,
  className,
}: PointsRedeemerProps) {
  const [usePoints, setUsePoints] = useState(usedPoints > 0);

  // Max points that can be redeemed: 50% of subtotal
  const maxPointsValue = Math.floor(subtotal * 0.5);
  const maxPoints = Math.min(pointsBalance, maxPointsValue);
  const maxPointsToRedeem = Math.floor(maxPointsValue / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;

  const pointsValue = Math.floor(usedPoints / POINTS_VALUE_IDR) * POINTS_VALUE_IDR;

  const handleToggle = (checked: boolean) => {
    setUsePoints(checked);
    onToggle(checked);
  };

  if (pointsBalance < POINTS_MIN_REDEEM) {
    return null;
  }

  return (
    <div className={cn('p-4 border border-brand-cream-dark rounded-lg', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-gold" />
          <div>
            <p className="text-sm font-medium">Gunakan Poin</p>
            <p className="text-xs text-text-secondary">
              Saldo: {pointsBalance.toLocaleString('id-ID')} poin
            </p>
          </div>
        </div>

        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={usePoints}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only"
            aria-label={`Gunakan poin (${pointsBalance.toLocaleString('id-ID')} poin tersedia)`}
          />
          <div className="w-11 h-6 bg-brand-cream-dark rounded-full peer peer-checked:bg-brand-red peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all" />
        </label>
      </div>

      {usePoints && (
        <div className="mt-3 pt-3 border-t border-brand-cream-dark">
          <p className="text-xs text-text-secondary mb-1">
            Maks. {maxPointsToRedeem.toLocaleString('id-ID')} poin (
            {formatIDR(maxPointsToRedeem * POINTS_VALUE_IDR)})
          </p>
          {pointsValue > 0 && (
            <p className="text-sm font-bold text-success">
              -{formatIDR(pointsValue)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}