'use client';

import { useState } from 'react';
import { Tag } from 'lucide-react';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';
import { Input } from '@/components/ui/input';

interface CouponInputProps {
  code: string;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  discountAmount: number;
  error?: string;
  isLoading?: boolean;
  className?: string;
}

export function CouponInput({
  code,
  onCodeChange,
  onApply,
  discountAmount,
  error,
  isLoading,
  className,
}: CouponInputProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-sm font-medium">Kode Kupon</label>

      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={code}
            onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
            placeholder="Masukkan kode kupon"
            className="uppercase"
            disabled={isLoading}
          />
        </div>
        <button
          type="button"
          onClick={onApply}
          disabled={!code || isLoading}
          className="h-10 px-4 bg-brand-red text-white font-medium rounded-lg hover:bg-brand-red-dark transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <Tag className="w-4 h-4" />
          Terapkan
        </button>
      </div>

      {error && (
        <p className="text-xs text-error">{error}</p>
      )}

      {discountAmount > 0 && (
        <p className="text-sm text-success font-medium">
          Kupon berhasil! -{formatIDR(discountAmount)}
        </p>
      )}
    </div>
  );
}