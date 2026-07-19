'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatWIB } from '@/lib/utils/format-date';
import { formatIDR } from '@/lib/utils/format-currency';

interface DisputeRow {
  id: string;
  orderId: string;
  orderNumber: string | null;
  category: string;
  customerMessage: string;
  ownerNotes: string | null;
  status: string;
  createdAt: Date | null;
  resolvedAt: Date | null;
}

const CATEGORIES = ['spoilage', 'ongkir', 'lost', 'wrongItem', 'other'] as const;

function disputeOpenHours(createdAt: Date | null): number {
  if (!createdAt) return 0;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (60 * 60 * 1000));
}

/**
 * Client island for the dispute admin — new-dispute form + status updates.
 */
export function DisputesAdminClient({ initial }: { initial: DisputeRow[] }) {
  const t = useTranslations('disputes');
  const tDispute = useTranslations('promise.disputePlaybook');
  const tAdmin = useTranslations('adminDisputes');
  const [rows, setRows] = useState<DisputeRow[]>(initial);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    orderNumber: '',
    category: 'spoilage' as (typeof CATEGORIES)[number],
    message: '',
    refundAmount: 0,
  });

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/disputes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.success) {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, resolvedAt: status === 'resolved' ? new Date() : r.resolvedAt } : r))
      );
    }
  };

  const saveNote = async (id: string) => {
    const note = editing[id];
    if (note === undefined) return;
    const res = await fetch(`/api/admin/disputes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerNotes: note }),
    });
    const json = await res.json();
    if (json.success) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ownerNotes: note } : r)));
    }
  };

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: form.orderNumber,
          category: form.category,
          customerMessage: form.message,
          refundAmount: form.refundAmount,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setRows((prev) => [
          {
            id: json.data.disputeId,
            orderId: json.data.orderId,
            orderNumber: form.orderNumber,
            category: form.category,
            customerMessage: form.message,
            ownerNotes: '',
            status: 'open',
            createdAt: new Date(),
            resolvedAt: null,
          },
          ...prev,
        ]);
        setForm({ orderNumber: '', category: 'spoilage', message: '', refundAmount: 0 });
        setOpenForm(false);
        alert(tAdmin('savedSuccess'));
      } else {
        alert(json.error ?? 'Gagal menyimpan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpenForm((v) => !v)} className="bg-brand-red hover:bg-brand-red-dark">
          {t('newButton')}
        </Button>
      </div>

      {openForm && (
        <Card className="border-amber-200">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs text-text-muted italic">{t('formHint')}</p>
            <form onSubmit={submitNew} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="orderNumber" className="text-xs">Order Number</Label>
                  <Input
                    id="orderNumber"
                    value={form.orderNumber}
                    onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
                    placeholder="DDK-20260701-0001"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category" className="text-xs">{t('category')}</Label>
                  <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as typeof form.category }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{tDispute(c === 'wrongItem' ? 'wrongItem' : c === 'ongkir' ? 'ongkir' : c === 'lost' ? 'lost' : c === 'spoilage' ? 'spoilage' : 'spoilage')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-text-muted mt-1">{tAdmin('category_hint')}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="message" className="text-xs">{t('customerMessage')}</Label>
                <Textarea
                  id="message"
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="refundAmount" className="text-xs">{t('refundAmount')} (IDR)</Label>
                <Input
                  id="refundAmount"
                  type="number"
                  min={0}
                  value={form.refundAmount}
                  onChange={(e) => setForm((f) => ({ ...f, refundAmount: Number(e.target.value) }))}
                />
                <p className="text-xs text-text-muted mt-1">Isi 0 jika tidak ada refund.</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpenForm(false)}>{tAdmin('cancel')}</Button>
                <Button type="submit" disabled={submitting} className="bg-brand-red hover:bg-brand-red-dark">{tAdmin('save')}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-text-muted">
            <p>{t('empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-text-muted">{row.orderNumber ?? row.orderId}</p>
                    <p className="text-sm font-semibold text-text-primary mt-0.5 capitalize">{row.category}</p>
                    {row.createdAt && (
                      <p className="text-xs text-text-muted mt-1">{formatWIB(new Date(row.createdAt))}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      variant={row.status === 'open' ? 'destructive' : row.status === 'resolved' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {t(row.status)}
                    </Badge>
                    {row.status === 'open' && row.createdAt && (
                      <Badge
                        variant={disputeOpenHours(row.createdAt) >= 24 ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {tAdmin('slaHours', { hours: disputeOpenHours(row.createdAt) })}
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase">{t('customerMessage')}</p>
                  <p className="text-sm text-text-secondary whitespace-pre-wrap">{row.customerMessage}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-muted uppercase">{t('ownerNotes')}</p>
                  <Textarea
                    rows={2}
                    value={editing[row.id] ?? row.ownerNotes ?? ''}
                    onChange={(e) => setEditing((p) => ({ ...p, [row.id]: e.target.value }))}
                    className="mt-1"
                  />
                  <Button size="sm" variant="outline" onClick={() => saveNote(row.id)} className="mt-1">
                    {t('saveNote')}
                  </Button>
                </div>
                {row.status !== 'resolved' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStatus(row.id, 'resolved')} className="bg-green-600 hover:bg-green-700">
                      {t('markResolved')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
