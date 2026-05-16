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
  sparkData?: number[]; // 7 values for sparkline, most recent last
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
  sparkData,
}: KPICardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  const displayValue = typeof value === 'number' && isCurrency
    ? formatIDR(value)
    : typeof value === 'number'
    ? value.toLocaleString('id-ID')
    : value;

  function renderSparkline(data: number[]) {
    if (!data || data.length < 2) return null;
    const w = 64, h = 24;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    });
    const lastY = h - ((data[data.length - 1] - min) / range) * h;
    const lastX = w;
    const color = data[data.length - 1] >= data[0] ? '#16A34A' : '#DC2626';
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="flex-shrink-0">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={lastX} cy={lastY} r="2" fill={color} />
      </svg>
    );
  }

  return (
    <div className="bg-white rounded-card p-5 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-[#6B6B6B]">{title}</p>
        {icon && <div className="text-brand-red">{icon}</div>}
      </div>
      <div className="flex items-end justify-between">
        <p className="text-2xl font-bold text-[#1A1A1A] mb-2">
          {prefix}{displayValue}{suffix}
        </p>
        {sparkData && renderSparkline(sparkData)}
      </div>
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
