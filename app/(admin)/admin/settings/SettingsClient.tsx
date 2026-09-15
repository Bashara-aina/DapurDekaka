'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { SETTING_GROUPS, SETTING_KEYS } from '@/lib/settings/canonical-keys';
import { SettingsTable, type SystemSettingRow } from './SettingsTable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const TABS = [
  { id: 'all', label: 'Semua' },
  ...Object.entries(SETTING_GROUPS).map(([id, g]) => ({ id, label: g.label })),
] as const;

interface Props {
  initialSettings: SystemSettingRow[];
  initialRole: string;
}

export function SettingsClient({ initialSettings, initialRole }: Props) {
  const [settings, setSettings] = useState<SystemSettingRow[]>(initialSettings);
  const [tab, setTab] = useState<string>('store');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'string' | 'number' | 'boolean'>('string');
  const [newDesc, setNewDesc] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [targetDelete, setTargetDelete] = useState<SystemSettingRow | null>(null);
  const readOnly = initialRole !== 'superadmin';

  const deletableKeys = useMemo(() => {
    const canonical = new Set<string>(Object.values(SETTING_KEYS));
    return new Set(settings.filter((s) => !canonical.has(s.key)).map((s) => s.key));
  }, [settings]);

  const visible = useMemo(() => {
    if (tab === 'all') return settings;
    const group = SETTING_GROUPS[tab];
    if (!group) return settings;
    const keySet = new Set(group.keys as readonly string[]);
    return settings.filter((s) => keySet.has(s.key));
  }, [settings, tab]);

  async function handleSave(key: string): Promise<void> {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editValue }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Gagal menyimpan pengaturan');
      }
      setSettings((prev) =>
        prev.map((s) =>
          s.key === key ? { ...s, value: editValue, updatedAt: new Date().toISOString() } : s
        )
      );
      setEditingKey(null);
      toast.success('Pengaturan disimpan');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBooleanToggle(key: string, currentValue: string): Promise<void> {
    const next = currentValue === 'true' ? 'false' : 'true';
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error || 'Gagal toggle pengaturan');
      }
      setSettings((prev) =>
        prev.map((s) =>
          s.key === key ? { ...s, value: next, updatedAt: new Date().toISOString() } : s
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal toggle pengaturan');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreate(): Promise<void> {
    if (!newKey.trim()) {
      toast.error('Key wajib diisi');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: newKey.trim(),
          value: newValue,
          type: newType,
          description: newDesc || null,
        }),
      });
      const json = await res.json() as { success: boolean; data?: SystemSettingRow; error?: string };
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || 'Gagal membuat pengaturan');
      }
      setSettings((prev) => [...prev, json.data!].sort((a, b) => a.key.localeCompare(b.key)));
      setShowCreate(false);
      setNewKey('');
      setNewValue('');
      setNewDesc('');
      toast.success('Pengaturan dibuat');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat pengaturan');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(setting: SystemSettingRow): Promise<void> {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/settings/${setting.key}`, { method: 'DELETE' });
      const json = await res.json() as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal menghapus pengaturan');
      }
      setSettings((prev) => prev.filter((s) => s.key !== setting.key));
      if (editingKey === setting.key) {
        setEditingKey(null);
      }
      toast.success('Pengaturan dihapus');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus pengaturan');
    } finally {
      setIsSubmitting(false);
    }
  }

  const promoTitle = settings.find((s) => s.key === 'promo_title')?.value ?? '';
  const promoSubtitle = settings.find((s) => s.key === 'promo_subtitle')?.value ?? '';
  const promoCode = settings.find((s) => s.key === 'promo_code')?.value ?? '';
  const promoActive = settings.find((s) => s.key === 'promo_active')?.value === 'true';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Pengaturan Sistem</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{settings.length} pengaturan</span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-900 text-white text-sm"
            >
              <Plus className="w-4 h-4" />
              Tambah Key
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              tab === t.id ? 'bg-slate-900 text-white' : 'bg-white border text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(promoTitle || promoCode) && (
        <div className="border rounded-xl p-5 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Preview Promo Banner</p>
          <div className="bg-brand-red rounded-lg p-4 text-white">
            {promoActive && (
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full mb-2 inline-block">
                ACTIVE
              </span>
            )}
            <p className="font-display text-lg font-bold">{promoTitle || '(Judul promo)'}</p>
            {promoSubtitle && <p className="text-sm opacity-90 mt-1">{promoSubtitle}</p>}
            {promoCode && <p className="font-mono font-bold mt-2">{promoCode}</p>}
          </div>
        </div>
      )}

      {showCreate && !readOnly && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold">Buat pengaturan baru</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="h-9 px-3 border rounded text-sm"
              placeholder="key (snake_case)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
            />
            <input
              className="h-9 px-3 border rounded text-sm"
              placeholder="value"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            <select
              className="h-9 px-3 border rounded text-sm"
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'string' | 'number' | 'boolean')}
            >
              <option value="string">string</option>
              <option value="number">number</option>
              <option value="boolean">boolean</option>
            </select>
            <input
              className="h-9 px-3 border rounded text-sm"
              placeholder="deskripsi (opsional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handleCreate()}
            className="h-9 px-4 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50"
          >
            Simpan Key Baru
          </button>
        </div>
      )}

      <SettingsTable
        settings={visible}
        editingKey={editingKey}
        editValue={editValue}
        isSubmitting={isSubmitting}
        readOnly={readOnly}
        deletableKeys={deletableKeys}
        onEditValueChange={setEditValue}
        onStartEdit={(s) => {
          setEditingKey(s.key);
          setEditValue(s.value);
        }}
        onSave={(key) => void handleSave(key)}
        onCancelEdit={() => setEditingKey(null)}
        onToggleBoolean={(key, current) => void handleBooleanToggle(key, current)}
        onDelete={(s) => { setTargetDelete(s); setShowDeleteDialog(true); }}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Pengaturan?</DialogTitle>
            <DialogDescription>
              Pengaturan dengan key &quot;{targetDelete?.key}&quot; akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowDeleteDialog(false); setTargetDelete(null); }}
              className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (targetDelete) void handleDelete(targetDelete);
                setShowDeleteDialog(false);
                setTargetDelete(null);
              }}
              disabled={isSubmitting}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Hapus
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
