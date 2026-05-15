'use client';

import { useState, useEffect } from 'react';
import { formatWIB } from '@/lib/utils/format-date';
import { Check, X, Edit2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SystemSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean';
  updatedAt: string | null;
}

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
}

const TYPE_LABELS: Record<string, string> = {
  string: 'Teks',
  number: 'Angka',
  boolean: 'Ya/Tidak',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [settingsRes, sessionRes] = await Promise.all([
          fetch('/api/admin/settings'),
          fetch('/api/admin/session'),
        ]);

        if (!settingsRes.ok) throw new Error('Failed to fetch settings');
        const result = await settingsRes.json();
        setSettings(result.data ?? []);

        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          const role = sessionData?.user?.role;
          setUserRole(role ?? null);
          setReadOnly(role === 'owner');
        }
      } catch {
        toast.error('Gagal memuat pengaturan');
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  function startEdit(setting: SystemSetting) {
    setEditingKey(setting.key);
    setEditValue(setting.value);
  }

  async function handleSave(key: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editValue }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan pengaturan');
      }

      setSettings(prev => prev.map(s => s.key === key ? { ...s, value: editValue, updatedAt: new Date().toISOString() } : s));
      setEditingKey(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleBooleanToggle(key: string, currentValue: string) {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/settings/${key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newValue }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal toggle pengaturan');
      }

      setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue, updatedAt: new Date().toISOString() } : s));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal toggle pengaturan');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pengaturan Sistem</h1>
        <span className="text-sm text-gray-500">{settings.length} pengaturan</span>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {settings.map((setting) => {
                const isEditing = editingKey === setting.key;
                const isBoolean = setting.type === 'boolean';

                return (
                  <tr key={setting.id} className="hover:bg-admin-content">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-700">{setting.key}</span>
                    </td>
                    <td className="px-6 py-4">
                      {isEditing ? (
                        isBoolean ? (
                          <span className="text-sm text-gray-500">Tidak bisa diedit langsung</span>
                        ) : setting.type === 'number' ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-40 h-8 px-2 rounded border border-input bg-white text-sm"
                          />
                        ) : (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-64 h-8 px-2 rounded border border-input bg-white text-sm"
                          />
                        )
                      ) : isBoolean ? (
                        <span className={`inline-flex px-3 py-1 text-sm font-medium rounded ${
                          setting.value === 'true' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {setting.value === 'true' ? 'Ya' : 'Tidak'}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-700 max-w-xs truncate block">{setting.value}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {TYPE_LABELS[setting.type] ?? setting.type}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 max-w-xs truncate">
                      {setting.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSave(setting.key)}
                            disabled={isSubmitting}
                            className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            title="Simpan"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingKey(null)}
                            className="p-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                            title="Batal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : isBoolean ? (
                        readOnly ? (
                          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded ${
                            setting.value === 'true'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {setting.value === 'true' ? 'Ya' : 'Tidak'}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBooleanToggle(setting.key, setting.value)}
                            disabled={isSubmitting}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                              setting.value === 'true'
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            } disabled:opacity-50`}
                          >
                            {setting.value === 'true' ? 'Matikan' : 'Aktifkan'}
                          </button>
                        )
                      ) : readOnly ? (
                        <span className="p-1.5 text-gray-400 rounded" title="Hanya superadmin yang dapat mengedit">
                          <Edit2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <button
                          onClick={() => startEdit(setting)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {settings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada pengaturan sistem
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}