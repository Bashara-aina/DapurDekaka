'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Search, X, Save } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatWIB } from '@/lib/utils/format-date';
import { formatIDR } from '@/lib/utils/format-currency';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface RefundRow {
  id: string;
  orderId: string;
  orderNumber: string | null;
  amount: number;
  reason: string;
  method: string;
  status: string;
  notes: string | null;
  initiatedBy: string | null;
  initiatorName: string | null;
  initiatorEmail: string | null;
  processedAt: string | Date | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
}

const STATUS_OPTIONS = ['pending', 'processing', 'completed', 'failed'] as const;
const REASON_OPTIONS = ['customer_request', 'cold_chain_failure', 'stock_out', 'fraud', 'other'] as const;
const METHOD_OPTIONS = ['midtrans', 'manual'] as const;

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

interface CreateForm {
  orderNumber: string;
  amount: number;
  reason: (typeof REASON_OPTIONS)[number];
  method: (typeof METHOD_OPTIONS)[number];
  notes: string;
}

interface EditForm {
  status: string;
  notes: string;
}

function CreateRefundModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<CreateForm>({
    orderNumber: '',
    amount: 0,
    reason: 'customer_request',
    method: 'midtrans',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, notes: form.notes || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-admin-border">
          <h2 className="font-semibold">Buat Refund</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nomor Pesanan</label>
            <Input
              value={form.orderNumber}
              onChange={(e) => setForm({ ...form, orderNumber: e.target.value })}
              placeholder="DDK-20260101-0001"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Jumlah (IDR)</label>
            <Input
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value, 10) || 0 })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Alasan</label>
            <select
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value as (typeof REASON_OPTIONS)[number] })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm bg-white"
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Metode</label>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as (typeof METHOD_OPTIONS)[number] })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm bg-white"
            >
              {METHOD_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Catatan (opsional)</label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Catatan internal..."
            />
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-admin-border">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-admin-border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => {
              if (mutation.isPending) return;
              mutation.mutate();
            }}
            disabled={mutation.isPending || !form.orderNumber || form.amount <= 0}
            className="flex-1 h-10 bg-brand-red text-white rounded-lg text-sm font-bold hover:bg-brand-red-dark transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Membuat...' : 'Buat Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-700')}>
      {status}
    </span>
  );
}

export default function RefundsClient({ initialRows }: { initialRows: RefundRow[] }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<RefundRow[]>(initialRows);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<{ id: string; form: EditForm } | null>(null);

  const filtered = rows.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesOrder = r.orderNumber?.toLowerCase().includes(q);
      const matchesReason = r.reason.toLowerCase().includes(q);
      const matchesNotes = (r.notes ?? '').toLowerCase().includes(q);
      if (!matchesOrder && !matchesReason && !matchesNotes) return false;
    }
    return true;
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: EditForm }) => {
      const res = await fetch(`/api/admin/refunds/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return { id, ...json.data };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-refunds'] });
      setRows((prev) => prev.map((r) => (r.id === data.id ? { ...r, status: data.status, notes: data.notes, processedAt: data.processedAt ?? r.processedAt } : r)));
      toast.success('Refund diperbarui');
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Refunds</h1>
          <p className="text-sm text-text-secondary mt-0.5">Daftar refund pesanan</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-sm font-bold rounded-lg hover:bg-brand-red-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Buat Refund
        </button>
      </div>

      <div className="bg-white rounded-xl border border-admin-border p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-text-secondary mb-1">Cari</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-disabled" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Order / reason / notes..."
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 border border-admin-border rounded-lg text-sm bg-white"
            >
              <option value="all">Semua status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-secondary border-b border-admin-border bg-surface-off">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Jumlah</th>
                <th className="px-4 py-3 font-medium">Alasan</th>
                <th className="px-4 py-3 font-medium">Metode</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 font-medium">Initiator</th>
                <th className="px-4 py-3 font-medium">Processed</th>
                <th className="px-4 py-3 font-medium w-20"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-text-secondary">
                    Belum ada refund
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const isEditing = editing?.id === r.id;
                  return (
                    <tr key={r.id} className="border-b border-admin-border last:border-0 hover:bg-surface-off/50">
                      <td className="px-4 py-3 font-mono text-xs">{r.orderNumber ?? '—'}</td>
                      <td className="px-4 py-3 font-medium">{formatIDR(r.amount)}</td>
                      <td className="px-4 py-3 text-xs">{r.reason}</td>
                      <td className="px-4 py-3 text-xs">{r.method}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editing!.form.status}
                            onChange={(e) => setEditing({ id: r.id, form: { ...editing!.form, status: e.target.value } })}
                            className="h-8 px-2 border border-admin-border rounded text-xs bg-white"
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        ) : (
                          <StatusBadge status={r.status} />
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {isEditing ? (
                          <Input
                            value={editing!.form.notes}
                            onChange={(e) => setEditing({ id: r.id, form: { ...editing!.form, notes: e.target.value } })}
                            placeholder="Notes..."
                          />
                        ) : (
                          <span className="text-xs text-text-secondary truncate block max-w-[180px]" title={r.notes ?? ''}>
                            {r.notes ?? '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.initiatorName ?? r.initiatorEmail ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs">{formatWIB(r.processedAt as string)}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => patchMutation.mutate({ id: r.id, form: editing!.form })}
                              disabled={patchMutation.isPending}
                              className="p-1.5 hover:bg-green-50 rounded text-green-600 disabled:opacity-50"
                              aria-label="Simpan"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="p-1.5 hover:bg-gray-100 rounded text-text-secondary"
                              aria-label="Batal"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditing({ id: r.id, form: { status: r.status, notes: r.notes ?? '' } })}
                            className="p-1.5 hover:bg-gray-100 rounded text-text-secondary"
                            aria-label="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CreateRefundModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-refunds'] });
            setShowCreate(false);
            toast.success('Refund dibuat');
          }}
        />
      )}
    </div>
  );
}