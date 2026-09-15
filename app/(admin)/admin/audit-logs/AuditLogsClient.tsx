'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, Download, ChevronLeft, ChevronRight, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatWIB } from '@/lib/utils/format-date';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AuditUser {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeState: unknown;
  afterState: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | Date;
  user: AuditUser | null;
}

function SummaryCell({ before, after }: { before: unknown; after: unknown }) {
  if (before == null && after == null) return <span className="text-text-secondary">—</span>;
  const beforeStr = before == null ? '' : JSON.stringify(before);
  const afterStr = after == null ? '' : JSON.stringify(after);
  const summary = (afterStr || beforeStr).slice(0, 80);
  return <span className="font-mono text-xs">{summary}</span>;
}

export default function AuditLogsClient({ initialLogs }: { initialLogs: AuditLog[] }) {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const buildParams = () => {
    const sp = new URLSearchParams();
    if (action) sp.set('action', action);
    if (entityType) sp.set('entityType', entityType);
    if (userId) sp.set('userId', userId);
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    sp.set('limit', String(limit));
    sp.set('offset', String((page - 1) * limit));
    return sp.toString();
  };

  const { data, isLoading, isFetching } = useQuery<{ logs: AuditLog[]; pagination?: { total: number; totalPages: number } }>({
    queryKey: ['admin-audit-logs', action, entityType, userId, from, to, page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/audit-logs?${buildParams()}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    initialData: page === 1 && !action && !entityType && !userId && !from && !to ? { logs: initialLogs } : undefined,
  });

  const logs = data?.logs ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  const handleExport = async () => {
    try {
      const sp = new URLSearchParams();
      sp.set('export', 'csv');
      if (action) sp.set('action', action);
      if (entityType) sp.set('entityType', entityType);
      if (userId) sp.set('userId', userId);
      if (from) sp.set('from', from);
      if (to) sp.set('to', to);
      const res = await fetch(`/api/admin/audit-logs?${sp.toString()}`);
      if (!res.ok) throw new Error('Gagal mengunduh CSV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV diunduh');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const clearFilters = () => {
    setAction('');
    setEntityType('');
    setUserId('');
    setFrom('');
    setTo('');
    setPage(1);
  };

  const isFiltered = useMemo(
    () => Boolean(action || entityType || userId || from || to),
    [action, entityType, userId, from, to]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Audit Logs</h1>
          <p className="text-sm text-text-secondary mt-0.5">Riwayat aktivitas admin & owner</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-sm font-bold rounded-lg hover:bg-brand-red-dark transition-colors"
        >
          <Download className="w-4 h-4" /> Download CSV
        </button>
      </div>

      <div className="bg-white rounded-xl border border-admin-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Action</label>
            <Input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="create / update / ..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Entity Type</label>
            <Input value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} placeholder="order / product / ..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">User ID</label>
            <Input value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1); }} placeholder="uuid" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
            <Input type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
            <Input type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
        </div>
        {isFiltered && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-text-secondary">Filter aktif</span>
            <button onClick={clearFilters} className="text-xs text-brand-red hover:underline">
              Reset filter
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary border-b border-admin-border bg-surface-off">
                <th className="px-4 py-3 font-medium">Waktu</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Summary</th>
              </tr>
            </thead>
            <tbody>
              {isLoading || isFetching ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-admin-border last:border-0">
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-text-secondary">
                    Tidak ada log ditemukan
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setDetailLog(log)}
                    className="border-b border-admin-border last:border-0 hover:bg-surface-off transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{formatWIB(log.createdAt as string)}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium">{log.user?.name ?? '—'}</div>
                      <div className="text-xs text-text-secondary">{log.user?.email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium">{log.entityType}</div>
                      <div className="text-xs text-text-secondary font-mono">{log.entityId?.slice(0, 8) ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <SummaryCell before={log.beforeState} after={log.afterState} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-admin-border">
          <span className="text-xs text-text-secondary">Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 h-8 border border-admin-border rounded text-xs font-medium disabled:opacity-50 hover:bg-gray-50"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3 h-8 border border-admin-border rounded text-xs font-medium disabled:opacity-50 hover:bg-gray-50"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="w-4 h-4" />
              Detail Log
            </DialogTitle>
            <DialogDescription>
              {detailLog && (
                <span className="block text-xs">
                  {detailLog.action} • {detailLog.entityType} • {formatWIB(detailLog.createdAt as string)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1">Before</p>
                <pre className={cn('text-xs bg-surface-off p-3 rounded-lg overflow-x-auto')}>
                  {detailLog.beforeState == null ? 'null' : JSON.stringify(detailLog.beforeState, null, 2)}
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium text-text-secondary mb-1">After</p>
                <pre className="text-xs bg-surface-off p-3 rounded-lg overflow-x-auto">
                  {detailLog.afterState == null ? 'null' : JSON.stringify(detailLog.afterState, null, 2)}
                </pre>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-medium text-text-secondary mb-1">User</p>
                  <p>{detailLog.user?.name ?? '—'}</p>
                  <p className="text-text-secondary">{detailLog.user?.email ?? '—'}</p>
                </div>
                <div>
                  <p className="font-medium text-text-secondary mb-1">IP / UA</p>
                  <p className="font-mono">{detailLog.ipAddress ?? '—'}</p>
                  <p className="text-text-secondary truncate">{detailLog.userAgent ?? '—'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}