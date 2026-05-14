'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface QuantitySelectorProps {
  value: number;
  max: number;
  min?: number;
  onChange: (value: number) => void;
}

export function QuantitySelector({
  value,
  max,
  min = 1,
  onChange,
}: QuantitySelectorProps) {
  return (
    <div className="flex items-center border-2 border-brand-cream-dark rounded-button overflow-hidden">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-brand-cream hover:bg-brand-cream-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Kurangi jumlah"
      >
        <Minus size={16} />
      </button>
      <span className="w-12 text-center font-semibold text-sm select-none">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-brand-cream hover:bg-brand-cream-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Tambah jumlah"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
