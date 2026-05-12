import { db } from '@/lib/db';
import { b2bInquiries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';
import { InquiryStatusUpdate } from '@/components/admin/b2b/InquiryStatusUpdate';

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getInquiry(id: string) {
  return await db.query.b2bInquiries.findFirst({
    where: eq(b2bInquiries.id, id),
  });
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Baru',
  contacted: 'Ditindaklanjuti',
  converted: 'Terjadwal',
  rejected: 'Ditolak',
};

export default async function B2BInquiryDetailPage({ params }: PageProps) {
  const { id } = await params;
  const inquiry = await getInquiry(id);

  if (!inquiry) {
    notFound();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/b2b-inquiries"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-admin-text-primary">Detail Inquiry</h1>
          <p className="text-admin-text-secondary text-sm mt-1">
            {inquiry.companyName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Company Info */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Informasi Perusahaan</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-admin-text-secondary uppercase tracking-wider mb-1">Nama Perusahaan</p>
                <p className="font-medium text-admin-text-primary">{inquiry.companyName}</p>
              </div>
              <div>
                <p className="text-xs text-admin-text-secondary uppercase tracking-wider mb-1">Jenis Bisnis</p>
                <p className="font-medium text-admin-text-primary">{inquiry.companyType || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-admin-text-secondary uppercase tracking-wider mb-1">Estimasi Volume</p>
                <p className="font-medium text-admin-text-primary">{inquiry.estimatedVolumeId || '-'}</p>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Informasi Kontak</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-admin-text-secondary uppercase tracking-wider mb-1">Nama PIC</p>
                <p className="font-medium text-admin-text-primary">{inquiry.picName}</p>
              </div>
              <div>
                <p className="text-xs text-admin-text-secondary uppercase tracking-wider mb-1">Email</p>
                <p className="font-medium text-admin-text-primary">{inquiry.picEmail}</p>
              </div>
              <div>
                <p className="text-xs text-admin-text-secondary uppercase tracking-wider mb-1">WhatsApp</p>
                <p className="font-medium text-admin-text-primary">{inquiry.picPhone}</p>
              </div>
            </div>
          </div>

          {/* Message */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Pesan</h2>
            <p className="text-admin-text-secondary whitespace-pre-wrap">{inquiry.message}</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Status</h2>
            <div className="mb-4">
              <span className={`inline-flex px-3 py-1.5 text-sm font-medium rounded-full ${
                inquiry.status === 'new' ? 'bg-warning-light text-warning' :
                inquiry.status === 'contacted' ? 'bg-info-light text-info' :
                inquiry.status === 'converted' ? 'bg-success-light text-success' :
                'bg-slate-200 text-slate-600'
              }`}>
                {STATUS_LABELS[inquiry.status] || inquiry.status}
              </span>
            </div>
            <InquiryStatusUpdate inquiryId={inquiry.id} currentStatus={inquiry.status} />
          </div>

          {/* Internal Notes */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Catatan Internal</h2>
            <p className="text-admin-text-secondary text-sm whitespace-pre-wrap">
              {inquiry.internalNotes || 'Belum ada catatan.'}
            </p>
          </div>

          {/* Meta */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Info Tambahan</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-admin-text-secondary">ID</p>
                <p className="font-mono text-xs">{inquiry.id}</p>
              </div>
              <div>
                <p className="text-admin-text-secondary">Dibuat</p>
                <p className="text-admin-text-primary">
                  {new Date(inquiry.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              {inquiry.handledBy && (
                <div>
                  <p className="text-admin-text-secondary">Ditangani oleh</p>
                  <p className="text-admin-text-primary">{inquiry.handledBy}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}