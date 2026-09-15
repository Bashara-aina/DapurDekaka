'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { UserSummary } from './types';

export interface PlatformUsersCardProps {
  data: UserSummary | null | undefined;
}

const ROLE_CONFIG = [
  { key: 'superadmin', label: 'Superadmin', color: 'text-purple-600' },
  { key: 'owner', label: 'Owner', color: 'text-blue-600' },
  { key: 'warehouse', label: 'Warehouse', color: 'text-green-600' },
  { key: 'b2b', label: 'B2B', color: 'text-amber-600' },
  { key: 'customer', label: 'Customer', color: 'text-gray-700' },
  { key: 'inactive', label: 'Inactive', color: 'text-red-400' },
] as const;

export function PlatformUsersCard({ data }: PlatformUsersCardProps) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl p-5 border border-admin-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-primary">Platform Users</h2>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-admin-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">Platform Users</h2>
        <a
          href="/admin/users"
          className="text-xs text-brand-red hover:underline flex items-center gap-1"
        >
          Kelola <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {ROLE_CONFIG.map((r) => (
          <div key={r.key} className="text-center py-2">
            <p className={cn('text-xl font-bold', r.color)}>{data[r.key]}</p>
            <p className="text-xs text-gray-500">{r.label}</p>
          </div>
        ))}
      </div>

      {data.recentSignups > 0 && (
        <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
          📈 <span className="font-medium">{data.recentSignups} customer baru</span> dalam
          7 hari terakhir
        </p>
      )}

      <div className="flex gap-2 mt-3">
        <a
          href="/admin/users?role=warehouse"
          className="flex-1 text-center px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
        >
          + Tambah Staf Gudang
        </a>
        <a
          href="/admin/users"
          className="flex-1 text-center px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Kelola Role
        </a>
      </div>
    </div>
  );
}