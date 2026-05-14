'use client';

import { cn } from '@/lib/utils/cn';

interface StockIndicatorProps {
  stock: number;
}

export function StockIndicator({ stock }: StockIndicatorProps) {
  if (stock === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
        <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
        Stok habis
      </div>
    );
  }

  if (stock <= 3) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#DC2626] font-medium">
        <div className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse" />
        Sisa {stock} item — hampir habis!
      </div>
    );
  }

  if (stock <= 10) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#D97706]">
        <div className="w-2 h-2 rounded-full bg-[#D97706]" />
        Stok terbatas
      </div>
    );
  }

  return null;
}
