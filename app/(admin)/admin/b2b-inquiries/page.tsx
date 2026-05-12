import { db } from '@/lib/db';
import { b2bInquiries } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getInquiries() {
  return await db.query.b2bInquiries.findMany({
    orderBy: [desc(b2bInquiries.createdAt)],
  });
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new: { label: 'Baru', className: 'bg-warning-light text-warning' },
  contacted: { label: 'Ditindaklanjuti', className: 'bg-info-light text-info' },
  converted: { label: 'Terjadwal', className: 'bg-success-light text-success' },
  rejected: { label: 'Ditolak', className: 'bg-slate-200 text-slate-600' },
};

export default async function B2BInquiriesPage() {
  const inquiries = await getInquiries();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-admin-text-primary">Inquiries B2B</h1>
          <p className="text-admin-text-secondary text-sm mt-1">
            {inquiries.length} inquiry masuk
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-admin-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Perusahaan
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Kontak
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Volume
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {inquiries.map((inquiry) => {
                const statusInfo = STATUS_LABELS[inquiry.status] ?? { label: inquiry.status, className: 'bg-slate-200 text-slate-700' };
                return (
                  <tr key={inquiry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-admin-text-primary text-sm">
                          {inquiry.companyName}
                        </p>
                        {inquiry.companyType && (
                          <p className="text-xs text-admin-text-secondary">
                            {inquiry.companyType}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-admin-text-primary">{inquiry.picName}</p>
                        <p className="text-xs text-admin-text-secondary">{inquiry.picEmail}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-admin-text-secondary">
                        {inquiry.estimatedVolumeId || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-admin-text-secondary">
                        {new Date(inquiry.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/b2b-inquiries/${inquiry.id}`}
                        className="text-brand-red font-medium text-sm hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {inquiries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-admin-text-secondary">
                    Tidak ada inquiry B2B
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