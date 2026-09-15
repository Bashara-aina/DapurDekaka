'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Flag, Info, Save } from 'lucide-react';
import { formatWIB } from '@/lib/utils/format-date';
import { Switch } from '@/components/ui/switch';

type FlagConfig = {
  readonly default: boolean;
  readonly envKey: string;
  readonly note: string;
};

interface StoredSetting {
  id: string;
  key: string;
  value: string;
  type: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string | Date;
}

interface FlagRow {
  name: string;
  config: FlagConfig;
  value: boolean;
  stored: StoredSetting | null;
  isPending: boolean;
}

export default function FeatureFlagsClient({
  flags,
  stored,
}: {
  flags: Record<string, FlagConfig>;
  stored: StoredSetting[];
}) {
  const queryClient = useQueryClient();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const storedByKey = useMemo(() => {
    const map: Record<string, StoredSetting> = {};
    for (const s of stored) {
      map[s.key] = s;
    }
    return map;
  }, [stored]);

  const rows: FlagRow[] = useMemo(() => {
    return Object.entries(flags).map(([name, config]) => {
      const key = `feature_flag_${name}`;
      const row = storedByKey[key] ?? null;
      const dbValue = row ? row.value === 'true' : config.default;
      const value = optimistic[name] ?? dbValue;
      return { name, config, value, stored: row, isPending: name in optimistic };
    });
  }, [flags, storedByKey, optimistic]);

  const mutation = useMutation({
    mutationFn: async (payload: { name: string; value: boolean }) => {
      const res = await fetch(`/api/admin/feature-flags/${payload.name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: payload.value }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (_data, variables) => {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[variables.name];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      toast.success(`Flag ${variables.name} disimpan`);
    },
    onError: (err: Error, variables) => {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[variables.name];
        return next;
      });
      toast.error(err.message);
    },
  });

  const requestToggle = (name: string, currentValue: boolean) => {
    const next = !currentValue;
    const flag = flags[name];
    const message = next
      ? `Aktifkan flag "${name}"?`
      : `Nonaktifkan flag "${name}"?`;
    if (typeof window !== 'undefined' && !window.confirm(message)) return;
    setOptimistic((prev) => ({ ...prev, [name]: next }));
    mutation.mutate({ name, value: next });
  };

  const dirty = Object.keys(optimistic).length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Feature Flags</h1>
          <p className="text-sm text-text-secondary mt-0.5">Toggle pengaktifan fitur secara runtime</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">
            {dirty ? 'Menyimpan perubahan...' : `${rows.length} flag`}
          </span>
          {mutation.isPending && (
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
              <Save className="w-3.5 h-3.5 animate-pulse" />
              saving
            </span>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800">
          <p className="font-medium mb-1">Catatan Kill List (L4)</p>
          <p>
            Daftar di bawah mengikuti registri terpusat di <code className="bg-amber-100 px-1 rounded">lib/config/feature-flags.ts</code>.
            Flag yang bernilai <code>false</code> untuk sementara waktu terikat kill list dan tidak boleh diaktifkan tanpa keputusan founder.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.name}
            className="bg-white rounded-xl border border-admin-border p-5 flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${row.value ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Flag className={`w-5 h-5 ${row.value ? 'text-green-700' : 'text-gray-500'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-text-primary">{row.name}</p>
                  <code className="text-[10px] text-text-secondary bg-surface-off px-1.5 py-0.5 rounded">
                    {row.config.envKey}
                  </code>
                </div>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">{row.config.note}</p>
                <p className="text-[11px] text-text-disabled mt-1.5">
                  {row.stored
                    ? <>Last modified: <span className="font-mono">{formatWIB(row.stored.updatedAt as string)}</span></>
                    : <>Default: <span className="font-mono">{String(row.config.default)}</span> • belum ada di DB</>}
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <Switch
                checked={row.value}
                onCheckedChange={() => requestToggle(row.name, row.value)}
                disabled={mutation.isPending}
                aria-label={`Toggle ${row.name}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}