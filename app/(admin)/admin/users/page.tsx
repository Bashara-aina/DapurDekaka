'use client';

import { useState, useEffect } from 'react';
import { formatWIB } from '@/lib/utils/format-date';
import { Shield, UserX, RefreshCw, UserPlus, X, Check } from 'lucide-react';
import { toast } from 'sonner';

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

const INVITE_ROLE_OPTIONS = ROLE_OPTIONS.filter((r) =>
  ['warehouse', 'owner', 'b2b', 'customer'].includes(r.value)
);

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'warehouse' });
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        const result = await res.json();
        setUsers(result.data ?? []);
      } catch {
        toast.error('Gagal memuat data pengguna');
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

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setEditingUserId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengupdate role');
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

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !currentStatus } : u))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Gagal ${action} pengguna`);
    }
  }

  async function handleInvite() {
    if (!inviteForm.email || !inviteForm.name || !inviteForm.role) {
      toast.error('Lengkapi semua field');
      return;
    }

    setInviteLoading(true);
    try {
      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengundang pengguna');
      }

      toast.success(data.data.message);
      setShowInviteModal(false);
      setInviteForm({ email: '', name: '', role: 'warehouse' });

      // Refresh user list
      const userRes = await fetch('/api/admin/users');
      const userResult = await userRes.json();
      setUsers(userResult.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengundang pengguna');
    } finally {
      setInviteLoading(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pengguna</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{users.length} pengguna</span>
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-medium rounded-lg hover:bg-[#1E293B] transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Undang Pengguna
          </button>
        </div>
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
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRoleUpdate(user.id, editingRole)}
                          disabled={isSubmitting}
                          className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setEditingUserId(null)}
                          className="p-1 text-gray-500 hover:text-gray-700"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingUserId(user.id);
                          setEditingRole(user.role);
                        }}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                          ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-800'
                        } hover:opacity-80`}
                        title="Klik untuk ubah role"
                      >
                        {user.role}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
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
                      className={`p-1.5 rounded hover:bg-admin-content ${
                        user.isActive ? 'text-red-500' : 'text-green-600'
                      }`}
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Undang Pengguna Baru</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="john@example.com"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red bg-white"
                >
                  {INVITE_ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-500">
                Password sementara akan dibuat otomatis dan ditampilkan setelah akun dibuat.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleInvite}
                disabled={inviteLoading}
                className="flex-1 h-10 bg-[#0F172A] text-white rounded-lg text-sm font-medium hover:bg-[#1E293B] transition-colors disabled:opacity-50"
              >
                {inviteLoading ? 'Memproses...' : 'Undang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}