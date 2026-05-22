'use client';

import { useState } from 'react';
import { formatWIB } from '@/lib/utils/format-date';
import { Shield, UserX, RefreshCw, UserPlus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

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

async function fetchUsers(): Promise<UserItem[]> {
  const res = await fetch('/api/admin/users');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch users');
  return json.data ?? [];
}

async function updateUserRole(userId: string, role: string): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update role');
}

async function updateUserStatus(userId: string, isActive: boolean): Promise<void> {
  const res = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to update status');
}

async function inviteUser(data: { email: string; name: string; role: string }): Promise<{ message: string }> {
  const res = await fetch('/api/admin/users/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Failed to invite user');
  return json.data;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', name: '', role: 'warehouse' });

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEditingUserId(null);
      toast.success('Role berhasil diupdate');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) => updateUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Status berhasil diupdate');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(data.message);
      setShowInviteModal(false);
      setInviteForm({ email: '', name: '', role: 'warehouse' });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleRoleEdit(user: UserItem) {
    toast.warning(`Yakin ubah role "${user.name || user.email}" menjadi "${ROLE_OPTIONS.find(r => r.value === editingRole)?.label}"?`, {
      action: {
        label: 'Ya, lanjutkan',
        onClick: () => roleMutation.mutate({ userId: user.id, role: editingRole }),
      },
    });
    setEditingUserId(null);
  }

  function handleDeactivate(user: UserItem) {
    const action = user.isActive ? 'nonaktifkan' : 'aktifkan';
    toast.warning(`Yakin ${action} pengguna "${user.name || user.email}"?`, {
      action: {
        label: 'Ya, lanjutkan',
        onClick: () => statusMutation.mutate({ userId: user.id, isActive: !user.isActive }),
      },
    });
  }

  if (isLoading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Gagal memuat data pengguna</p>
        <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-users'] })} className="mt-2">
          Coba Lagi
        </Button>
      </div>
    );
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
                          onClick={() => handleRoleEdit(user)}
                          disabled={roleMutation.isPending}
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
                      onClick={() => handleDeactivate(user)}
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
                  required
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
                onClick={() => inviteMutation.mutate(inviteForm)}
                disabled={inviteMutation.isPending}
                className="flex-1 h-10 bg-[#0F172A] text-white rounded-lg text-sm font-medium hover:bg-[#1E293B] transition-colors disabled:opacity-50"
              >
                {inviteMutation.isPending ? 'Memproses...' : 'Undang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}