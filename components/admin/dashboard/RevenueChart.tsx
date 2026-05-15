'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatIDR } from '@/lib/utils/format-currency';

interface RevenueDataPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  className?: string;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-brand-cream-dark rounded-lg shadow-card p-3 text-sm">
      <p className="font-semibold text-[#1A1A1A] mb-1">{label}</p>
      <p className="text-brand-red font-bold">{formatIDR(payload[0]?.value ?? 0)}</p>
      <p className="text-text-secondary text-xs">{payload[0]?.value ? `${Math.round(payload[0].value / 1000)}rb` : '0'} revenue</p>
    </div>
  );
}

export function RevenueChart({ data, className }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E8DFC8" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#8A8A8A' }}
          tickLine={false}
          axisLine={{ stroke: '#E8DFC8' }}
          interval={4}
        />
        <YAxis
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}rb`}
          tick={{ fontSize: 10, fill: '#8A8A8A' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(200, 16, 46, 0.05)' }} />
        <Bar
          dataKey="revenue"
          fill="#C8102E"
          radius={[4, 4, 0, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}