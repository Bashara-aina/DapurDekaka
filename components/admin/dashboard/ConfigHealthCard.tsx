'use client';

import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export interface ConfigHealthData {
  ok: boolean;
  appUrl: string;
  issues: string[];
  env: Array<{ key: string; present: boolean; hint?: string }>;
  settings: Array<{ key: string; present: boolean }>;
}

/**
 * BLOCKER 4: production configuration health (presence only, never values).
 * Replaces guessing why payments/notifications silently fail after deploy.
 */
export function ConfigHealthCard({ data }: { data: ConfigHealthData | null }) {
  if (!data) return null;

  return (
    <div className="bg-white rounded-xl p-5 border border-admin-border">
      <div className="flex items-center gap-2 mb-3">
        {data.ok ? (
          <CheckCircle2 className="w-5 h-5 text-green-600" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        )}
        <h2 className="font-semibold text-text-primary">Konfigurasi Produksi</h2>
      </div>

      {data.ok ? (
        <p className="text-sm text-text-secondary">
          Semua env wajib dan setting operasional terdeteksi.
        </p>
      ) : (
        <>
          <p className="text-sm text-text-secondary mb-3">
            {data.issues.length} masalah konfigurasi terdeteksi — perbaiki sebelum menerima pesanan.
          </p>
          <ul className="space-y-1.5">
            {data.env
              .filter((e) => !e.present || e.hint)
              .map((e) => (
                <li key={e.key} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="font-mono text-xs">{e.key}</span>
                  <span className="text-text-secondary">
                    {!e.present ? 'belum diset' : e.hint}
                  </span>
                </li>
              ))}
            {data.settings
              .filter((s) => !s.present)
              .map((s) => (
                <li key={s.key} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <span className="font-mono text-xs">{s.key}</span>
                  <span className="text-text-secondary">setting belum diisi</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}
