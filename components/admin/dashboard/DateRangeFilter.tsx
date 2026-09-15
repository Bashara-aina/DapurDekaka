'use client';

import { DATE_PRESETS } from './types';

export interface DateRangeFilterProps {
  dateRange: { from: string; to: string };
  onChange: (range: { from: string; to: string }) => void;
}

export function DateRangeFilter({ dateRange, onChange }: DateRangeFilterProps) {
  const hasValue = Boolean(dateRange.from || dateRange.to);

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 border border-admin-border">
      <span className="text-sm font-medium text-text-primary">Periode:</span>
      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onChange(preset.getValue())}
            className="px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => onChange({ ...dateRange, from: e.target.value })}
          className="h-9 px-3 rounded-lg border border-admin-border bg-white text-sm"
        />
        <span className="text-gray-400">—</span>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => onChange({ ...dateRange, to: e.target.value })}
          className="h-9 px-3 rounded-lg border border-admin-border bg-white text-sm"
        />
      </div>
      {hasValue && (
        <button
          onClick={() => onChange({ from: '', to: '' })}
          className="text-xs text-brand-red hover:underline font-medium"
        >
          Reset
        </button>
      )}
      <span className="text-xs text-gray-400 ml-auto">Default: hari ini</span>
    </div>
  );
}