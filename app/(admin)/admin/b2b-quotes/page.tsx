import Link from 'next/link';
import { db } from '@/lib/db';
import { b2bQuotes, b2bProfiles, users } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

async function getQuotes() {
  return await db.query.b2bQuotes.findMany({
    with: {
      b2bProfile: {
        with: {
          user: true,
        },
      },
    },
    orderBy: [desc(b2bQuotes.createdAt)],
  });
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-200 text-slate-700' },
  sent: { label: 'Terkirim', className: 'bg-info-light text-info' },
  accepted: { label: 'Diterima', className: 'bg-success-light text-success' },
  rejected: { label: 'Ditolak', className: 'bg-error-light text-error' },
  expired: { label: 'Kedaluwarsa', className: 'bg-warning-light text-warning' },
};

export default async function B2BQuotesPage() {
  const quotes = await getQuotes();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-admin-text-primary">Quotes B2B</h1>
          <p className="text-admin-text-secondary text-sm mt-1">
            Kelola penawaran untuk pelanggan B2B
          </p>
        </div>
        <Link
          href="/admin/b2b-quotes/new"
          className="inline-flex items-center h-10 px-4 bg-brand-red text-white font-medium rounded-lg hover:bg-brand-red-dark transition-colors"
        >
          + Buat Quote Baru
        </Link>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-admin-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Quote #
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Pelanggan
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Total
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Valid Until
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {quotes.map((quote) => {
                const statusInfo = STATUS_LABELS[quote.status] ?? { label: quote.status, className: 'bg-slate-200 text-slate-700' };
                return (
                  <tr key={quote.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-sm font-medium text-admin-text-primary">
                        {quote.quoteNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-admin-text-primary text-sm">
                        {quote.b2bProfile?.companyName || '-'}
                      </p>
                      <p className="text-xs text-admin-text-secondary">
                        {quote.b2bProfile?.picName}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-admin-text-primary">
                        {new Intl.NumberFormat('id-ID', {
                          style: 'currency',
                          currency: 'IDR',
                          minimumFractionDigits: 0,
                        }).format(quote.totalAmount)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusInfo.className}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-admin-text-secondary">
                        {quote.validUntil
                          ? new Date(quote.validUntil).toLocaleDateString('id-ID')
                          : '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/b2b-quotes/${quote.id}`}
                        className="text-brand-red font-medium text-sm hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {quotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-admin-text-secondary">
                    Belum ada quotes
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