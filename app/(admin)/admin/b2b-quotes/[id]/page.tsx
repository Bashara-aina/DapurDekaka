import { db } from '@/lib/db';
import { b2bQuotes, b2bQuoteItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getQuote(id: string) {
  return await db.query.b2bQuotes.findFirst({
    where: eq(b2bQuotes.id, id),
    with: {
      items: {
        with: {
          variant: {
            with: {
              product: true,
            },
          },
        },
      },
      b2bProfile: {
        with: {
          user: true,
        },
      },
    },
  });
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-slate-200 text-slate-700' },
  sent: { label: 'Terkirim', className: 'bg-info-light text-info' },
  accepted: { label: 'Diterima', className: 'bg-success-light text-success' },
  rejected: { label: 'Ditolak', className: 'bg-error-light text-error' },
  expired: { label: 'Kedaluwarsa', className: 'bg-warning-light text-warning' },
};

export default async function B2BQuoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const quote = await getQuote(id) as NonNullable<Awaited<ReturnType<typeof getQuote>>>;

  if (!quote) {
    notFound();
  }

  const statusInfo = STATUS_LABELS[quote.status] ?? { label: quote.status, className: 'bg-slate-200 text-slate-700' };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/b2b-quotes"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            ←
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-admin-text-primary">
              {quote.quoteNumber}
            </h1>
            <p className="text-admin-text-secondary text-sm mt-1">
              {quote.b2bProfile?.companyName}
            </p>
          </div>
        </div>
        <span className={`inline-flex px-3 py-1.5 text-sm font-medium rounded-full ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <div className="bg-white rounded-xl border border-admin-border overflow-hidden">
            <div className="px-6 py-4 border-b border-admin-border">
              <h2 className="font-semibold text-admin-text-primary">Item Quote</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                    Produk
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                    Qty
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                    Harga Unit
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-admin-text-secondary uppercase tracking-wider">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border">
                {quote.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-admin-text-primary text-sm">
                        {item.productNameId}
                      </p>
                      <p className="text-xs text-admin-text-secondary">
                        {item.variantNameId} | {item.sku}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="font-medium">{item.quantity}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {formatIDR(item.unitPrice)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-medium">
                        {formatIDR(item.subtotal)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="px-6 py-4 bg-slate-50 border-t border-admin-border">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-admin-text-secondary">Subtotal</span>
                  <span className="font-medium">{formatIDR(quote.subtotal)}</span>
                </div>
                {quote.discountAmount > 0 && (
                  <div className="flex justify-between text-error">
                    <span>Diskon</span>
                    <span>-{formatIDR(quote.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-admin-border font-bold text-lg">
                  <span>Total</span>
                  <span className="text-brand-red">{formatIDR(quote.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {(quote.notesId || quote.notesEn) && (
            <div className="bg-white rounded-xl border border-admin-border p-6">
              <h2 className="font-semibold text-admin-text-primary mb-3">Catatan</h2>
              <p className="text-admin-text-secondary text-sm whitespace-pre-wrap">
                {quote.notesId || quote.notesEn}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Informasi Pelanggan</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-admin-text-secondary">Perusahaan</p>
                <p className="font-medium">{quote.b2bProfile?.companyName}</p>
              </div>
              <div>
                <p className="text-admin-text-secondary">PIC</p>
                <p className="font-medium">{quote.b2bProfile?.picName}</p>
              </div>
              <div>
                <p className="text-admin-text-secondary">Email</p>
                <p className="font-medium">{quote.b2bProfile?.picEmail}</p>
              </div>
              <div>
                <p className="text-admin-text-secondary">WhatsApp</p>
                <p className="font-medium">{quote.b2bProfile?.picPhone}</p>
              </div>
            </div>
          </div>

          {/* Quote Info */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Info Quote</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-admin-text-secondary">Quote Number</p>
                <p className="font-mono font-medium">{quote.quoteNumber}</p>
              </div>
              <div>
                <p className="text-admin-text-secondary">Dibuat</p>
                <p className="font-medium">
                  {new Date(quote.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              {quote.validUntil && (
                <div>
                  <p className="text-admin-text-secondary">Valid Until</p>
                  <p className="font-medium">
                    {new Date(quote.validUntil).toLocaleDateString('id-ID')}
                  </p>
                </div>
              )}
              {quote.paymentTerms && (
                <div>
                  <p className="text-admin-text-secondary">Terms</p>
                  <p className="font-medium">{quote.paymentTerms}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Aksi</h2>
            <div className="space-y-2">
              <button className="w-full h-10 bg-brand-red text-white font-medium rounded-lg hover:bg-brand-red-dark transition-colors">
                Kirim Quote via Email
              </button>
              <button className="w-full h-10 border border-admin-border text-admin-text-primary font-medium rounded-lg hover:bg-slate-50 transition-colors">
                Download PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}