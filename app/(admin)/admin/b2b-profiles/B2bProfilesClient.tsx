'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { Check, X } from 'lucide-react';

interface B2bProfileUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

interface B2bProfileRow {
  id: string;
  companyName: string;
  companyType: string | null;
  picName: string;
  picEmail: string;
  picPhone: string;
  isApproved: boolean;
  isNet30Approved: boolean;
  createdAt: string;
  user: B2bProfileUser | null;
}

interface ProfilesResponse {
  profiles: B2bProfileRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function B2bProfilesClient() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved'>('all');

  const queryUrl =
    statusFilter === 'all'
      ? '/api/admin/b2b-profiles'
      : `/api/admin/b2b-profiles?status=${statusFilter}`;

  const { data, isLoading } = useQuery<ProfilesResponse>({
    queryKey: ['admin-b2b-profiles', statusFilter],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, isApproved }: { id: string; isApproved: boolean }) => {
      const res = await fetch(`/api/admin/b2b-profiles/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved, isNet30Approved: false }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['admin-b2b-profiles'] });
      toast.success(vars.isApproved ? 'Profil B2B disetujui' : 'Profil B2B ditolak');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const profiles = data?.profiles ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Profil B2B</h1>
        <p className="text-sm text-text-secondary mt-0.5">Tinjau dan setujui pendaftaran akun B2B</p>
      </div>

      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        className="h-10 px-3 border border-admin-border rounded-lg text-sm bg-white"
      >
        <option value="all">Semua status</option>
        <option value="pending">Menunggu persetujuan</option>
        <option value="approved">Disetujui</option>
      </select>

      {isLoading ? (
        <div className="h-48 bg-white rounded-xl border border-admin-border animate-pulse" />
      ) : (
        <div className="bg-white rounded-xl border border-admin-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-admin-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Perusahaan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">PIC</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Akun</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">{profile.companyName}</p>
                      {profile.companyType && (
                        <p className="text-xs text-text-secondary">{profile.companyType}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm">{profile.picName}</p>
                      <p className="text-xs text-text-secondary">{profile.picEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {profile.user?.email ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-0.5 rounded',
                          profile.isApproved
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-800'
                        )}
                      >
                        {profile.isApproved ? 'Disetujui' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!profile.isApproved ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => approveMutation.mutate({ id: profile.id, isApproved: true })}
                            disabled={approveMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            <Check className="w-3.5 h-3.5" /> Setujui
                          </button>
                          <button
                            onClick={() => approveMutation.mutate({ id: profile.id, isApproved: false })}
                            disabled={approveMutation.isPending}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200"
                          >
                            <X className="w-3.5 h-3.5" /> Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-text-secondary">
                      Tidak ada profil B2B
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
