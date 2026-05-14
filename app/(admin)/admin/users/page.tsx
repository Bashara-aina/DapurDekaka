'use client';

import { useState, useEffect } from 'react';
import { formatWIB } from '@/lib/utils/format-date';
import { Shield, UserX, RefreshCw } from 'lucide-react';

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  pointsBalance: number | null;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer', color: 'bg-blue-100 text-blue-800' },
  { value: 'b2b', label: 'B2B', color: 'bg-amber-100 text-amber-800' },
  { value: 'warehouse', label: 'Warehouse', color: 'bg-purple-100 text-purple-800' },
  { value: 'owner', label: 'Owner', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'superadmin', label: 'Superadmin', color: 'bg-red-100 text-red-800' },
];

const ROLE_COLORS: Record<string, string> = {
  superadmin: 'bg-red-100 text-red-800',
  owner: 'bg-cyan-100 text-cyan-800',
  warehouse: 'bg-purple-100 text-purple-800',
  customer: 'bg-blue-100 text-blue-800',
  b2b: 'bg-amber-100 text-amber-800',
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        const result = await res.json();
        setUsers(result.data ?? []);
      } catch {
        alert('Gagal memuat data pengguna');
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  async function handleRoleUpdate(userId: string, newRole: string) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengupdate role');
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setEditingUserId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengupdate role');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(userId: string, currentStatus: boolean) {
    const action = currentStatus ? 'nonaktifkan' : 'aktifkan';
    if (!confirm(`Yakin ${action} pengguna ini?`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Gagal ${action} pengguna`);
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
    } catch (err) {
      alert(err instanceof Error ? err.message : `Gagal ${action} pengguna`);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pengguna</h1>
        <span className="text-sm text-gray-500">{users.length} pengguna</span>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Poin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bergabung</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-sm">{user.name || '-'}</span>
                    {user.phone && <span className="block text-xs text-gray-500">{user.phone}</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUserId === user.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={editingRole}
                          onChange={(e) => setEditingRole(e.target.value)}
                          className="h-8 px-2 rounded border border-input bg-white text-sm"
                        >
                          {ROLE_OPTIONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRoleUpdate(user.id, editingRole)}
                          disabled={isSubmitting}
                          className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditingRole(user.role);
                        }}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'} hover:opacity-80`}
                        title="Klik untuk ubah role"
                      >
                        {user.role}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {user.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-amber-600">
                    {user.pointsBalance ?? 0} pts
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatWIB(user.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleDeactivate(user.id, user.isActive)}
                      className={`p-1.5 rounded hover:bg-admin-content ${user.isActive ? 'text-red-500' : 'text-green-600'}`}
                      title={user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Belum ada pengguna
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