'use client';

import { Check, X, Edit2, Trash2 } from 'lucide-react';

export interface SystemSettingRow {
  id: string;
  key: string;
  value: string;
  description: string | null;
  type: 'string' | 'number' | 'boolean' | 'integer';
  updatedAt: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  string: 'Teks',
  number: 'Angka',
  integer: 'Angka',
  boolean: 'Ya/Tidak',
};

interface SettingsTableProps {
  settings: SystemSettingRow[];
  editingKey: string | null;
  editValue: string;
  isSubmitting: boolean;
  readOnly: boolean;
  deletableKeys: Set<string>;
  onEditValueChange: (value: string) => void;
  onStartEdit: (setting: SystemSettingRow) => void;
  onSave: (key: string) => void;
  onCancelEdit: () => void;
  onToggleBoolean: (key: string, current: string) => void;
  onDelete: (setting: SystemSettingRow) => void;
}

export function SettingsTable({
  settings,
  editingKey,
  editValue,
  isSubmitting,
  readOnly,
  deletableKeys,
  onEditValueChange,
  onStartEdit,
  onSave,
  onCancelEdit,
  onToggleBoolean,
  onDelete,
}: SettingsTableProps) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {settings.map((setting) => {
              const isEditing = editingKey === setting.key;
              const isBoolean = setting.type === 'boolean';
              return (
                <tr key={setting.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-mono text-sm text-gray-700">{setting.key}</span>
                  </td>
                  <td className="px-6 py-4">
                    {isEditing && !isBoolean ? (
                      <input
                        type={setting.type === 'number' || setting.type === 'integer' ? 'number' : 'text'}
                        value={editValue}
                        onChange={(e) => onEditValueChange(e.target.value)}
                        className="w-64 h-8 px-2 rounded border text-sm"
                      />
                    ) : isBoolean ? (
                      <span
                        className={`inline-flex px-3 py-1 text-sm font-medium rounded ${
                          setting.value === 'true'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {setting.value === 'true' ? 'Ya' : 'Tidak'}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-700 max-w-xs truncate block">
                        {setting.value}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {TYPE_LABELS[setting.type] ?? setting.type}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400 max-w-xs truncate">
                    {setting.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onSave(setting.key)}
                            disabled={isSubmitting}
                            className="p-1.5 bg-green-600 text-white rounded disabled:opacity-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEdit}
                            className="p-1.5 text-gray-500 rounded hover:bg-gray-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : isBoolean && !readOnly ? (
                        <button
                          type="button"
                          onClick={() => onToggleBoolean(setting.key, setting.value)}
                          disabled={isSubmitting}
                          className={`px-3 py-1.5 text-sm font-medium rounded ${
                            setting.value === 'true'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          } disabled:opacity-50`}
                        >
                          {setting.value === 'true' ? 'Matikan' : 'Aktifkan'}
                        </button>
                      ) : readOnly ? (
                        <span className="p-1.5 text-gray-400">
                          <Edit2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onStartEdit(setting)}
                          className="p-1.5 text-gray-500 rounded hover:bg-gray-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {deletableKeys.has(setting.key) && !readOnly && (
                        <button
                          type="button"
                          onClick={() => onDelete(setting)}
                          disabled={isSubmitting}
                          className="p-1.5 text-red-400 rounded hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {settings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Tidak ada pengaturan di grup ini
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
