'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { FileText, ChevronRight, Loader2, Download, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatIDR } from '@/lib/utils/format-currency';

interface QuoteItem {
  id: string;
  productNameId: string;
  variantNameId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  validUntil: string | null;
  paymentTerms: string | null;
  notesId: string | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
  items: QuoteItem[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-700', icon: Clock },
  sent: { label: 'Terkirim', className: 'bg-blue-100 text-blue-700', icon: Clock },
  accepted: { label: 'Diterima', className: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Ditolak', className: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'Kadaluarsa', className: 'bg-orange-100 text-orange-700', icon: Clock },
};

function QuoteCard({ quote, onAction }: { quote: Quote; onAction: (id: string, action: 'accept' | 'reject') => void }) {
  const statusKey = quote.status as keyof typeof STATUS_CONFIG;
  const statusConfig = STATUS_CONFIG[statusKey] ?? (STATUS_CONFIG['draft'] as { label: string; className: string; icon: React.ComponentType<{ className?: string }> });
  const StatusIcon = statusConfig.icon;
  const isActionable = quote.status === 'sent';
  const isExpired = quote.validUntil ? new Date(quote.validUntil) < new Date() : false;

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-4">
      {/* Header */}
      <div className="p-4 border-b border-brand-cream-dark">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-text-primary">{quote.quoteNumber}</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {new Date(quote.createdAt).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded ${statusConfig.className}`}>
              <StatusIcon className="w-3 h-3" />
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {/* Items Preview */}
      <div className="p-4">
        <div className="space-y-2 mb-4">
          {quote.items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {item.productNameId} - {item.variantNameId}
              </span>
              <span className="text-text-muted">x{item.quantity}</span>
            </div>
          ))}
          {quote.items.length > 3 && (
            <p className="text-xs text-text-muted">+{quote.items.length - 3} item lainnya</p>
          )}
        </div>

        {/* Total */}
        <div className="border-t border-brand-cream-dark pt-3 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary text-sm">Subtotal</span>
            <span className="text-sm">{formatIDR(quote.subtotal)}</span>
          </div>
          {quote.discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-text-secondary">Diskon</span>
              <span className="text-green-600">-{formatIDR(quote.discountAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-brand-red">{formatIDR(quote.totalAmount)}</span>
          </div>
        </div>

        {/* Valid Until */}
        {quote.validUntil && (
          <div className="text-xs text-text-muted mb-4">
            {isExpired ? (
              <span className="text-red-600">● Sudah kadaluarsa</span>
            ) : (
              <span>● Berlaku sampai {new Date(quote.validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {quote.pdfUrl && (
            <a
              href={quote.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 bg-brand-cream text-text-primary font-medium rounded-lg hover:bg-brand-cream-dark transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </a>
          )}
          {isActionable && (
            <>
              <button
                onClick={() => onAction(quote.id, 'accept')}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Terima
              </button>
              <button
                onClick={() => onAction(quote.id, 'reject')}
                className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Tolak
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function B2BAccountQuotesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const { data: quotesData, isLoading, refetch } = useQuery<{ quotes: Quote[] }>({
    queryKey: ['b2b', 'quotes'],
    queryFn: async () => {
      const res = await fetch('/api/b2b/quotes');
      const json = await res.json();
      return json.success ? json.data : { quotes: [] };
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ quoteId, action }: { quoteId: string; action: 'accept' | 'reject' }) => {
      const res = await fetch(`/api/b2b/quotes/${quoteId}/${action}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses tindakan');
      return data;
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.');
    },
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/b2b/account/quotes');
    }
  }, [status, router]);

  if (status === 'loading' || isLoading) {
    return (
      <div className="bg-brand-cream min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-red animate-spin" />
      </div>
    );
  }

  const quotes = quotesData?.quotes ?? [];

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <h1 className="font-display text-xl font-bold">Quotes B2B</h1>
          <p className="text-text-secondary text-sm mt-1">
            {quotes.length} penawaran
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 container mx-auto">
        {quotes.length > 0 ? (
          <div>
            {quotes.map((quote) => (
              <QuoteCard
                key={quote.id}
                quote={quote}
                onAction={(id, action) => actionMutation.mutate({ quoteId: id, action })}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-text-muted" />
            </div>
            <h2 className="font-display text-lg font-semibold mb-2">
              Belum Ada Quotes
            </h2>
            <p className="text-text-secondary text-sm mb-6">
              Penawaran dari tim kami akan muncul di sini.
            </p>
            <a
              href="/b2b#quote-form"
              className="inline-flex items-center h-10 px-5 bg-brand-red text-white font-medium rounded-lg hover:bg-brand-red-dark transition-colors"
            >
              Minta Penawaran
            </a>
          </div>
        )}
      </div>
    </div>
  );
}