'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatWIB } from '@/lib/utils/format-date';
import type { DashboardAuditLog } from './types';

export interface AuditLogPanelProps {
  logs: DashboardAuditLog[] | null | undefined;
  total?: number;
}

export function AuditLogPanel({ logs, total }: AuditLogPanelProps) {
  const [downloading, setDownloading] = useState(false);

  async function downloadCsv() {
    setDownloading(true);
    try {
      const res = await fetch('/api/admin/audit-logs?export=csv');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Audit log berhasil diunduh');
    } catch {
      toast.error('Gagal mengunduh audit log');
    } finally {
      setDownloading(false);
    }
  }

  const list = (logs ?? []).slice(0, 15);

  return (
    <div className="bg-white rounded-xl border border-admin-border">
      <div className="px-5 py-4 border-b border-admin-border flex items-center justify-between">
        <h2 className="font-semibold text-text-primary">Admin Audit Log</h2>
        <button
          onClick={downloadCsv}
          disabled={downloading}
          className="flex items-center gap-1.5 text-xs text-brand-red hover:underline font-medium disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" /> {downloading ? 'Mengunduh...' : 'Download CSV'}
        </button>
      </div>
      <div className="overflow-x-auto max-h-64 overflow-y-auto">
        <table className="w-full min-w-[500px]">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Waktu
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Action
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Entity
              </th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Actor
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">
                  {formatWIB(new Date(log.createdAt))}
                </td>
                <td className="px-5 py-3 text-xs font-mono font-medium text-text-primary">
                  {log.action}
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  {log.entityType}
                  {log.entityId ? ` #${log.entityId.slice(0, 8)}` : ''}
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {log.user?.name ?? log.user?.email ?? '—'}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-gray-400 text-sm"
                >
                  Belum ada log{total !== undefined ? ` (${total} total)` : ''}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}