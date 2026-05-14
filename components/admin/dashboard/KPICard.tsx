import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';

interface KPICardProps {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  change?: number;
  changePeriod?: string;
  icon?: React.ReactNode;
  isCurrency?: boolean;
}

export function KPICard({
  title,
  value,
  prefix,
  suffix,
  change,
  changePeriod,
  icon,
  isCurrency = false,
}: KPICardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  const displayValue = typeof value === 'number' && isCurrency
    ? formatIDR(value)
    : typeof value === 'number'
    ? value.toLocaleString('id-ID')
    : value;

  return (
    <div className="bg-white rounded-card p-5 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-[#6B6B6B]">{title}</p>
        {icon && <div className="text-brand-red">{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-[#1A1A1A] mb-2">
        {prefix}{displayValue}{suffix}
      </p>
      {change !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isPositive
              ? 'text-[#16A34A]'
              : isNegative
              ? 'text-[#DC2626]'
              : 'text-[#6B6B6B]'
          )}
        >
          {isPositive ? (
            <TrendingUp size={14} />
          ) : isNegative ? (
            <TrendingDown size={14} />
          ) : (
            <Minus size={14} />
          )}
          <span>
            {isPositive ? '+' : ''}
            {change.toFixed(1)}%
          </span>
          {changePeriod && (
            <span className="text-[#ABABAB] font-normal">{changePeriod}</span>
          )}
        </div>
      )}
    </div>
  );
}
