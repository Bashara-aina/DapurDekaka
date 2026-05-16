'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface B2BInquiryStatusClientProps {
  inquiryId: string;
  currentStatus: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  new: { label: 'Baru', className: 'bg-warning-light text-warning' },
  contacted: { label: 'Ditindaklanjuti', className: 'bg-info-light text-info' },
  converted: { label: 'Terjadwal', className: 'bg-success-light text-success' },
  rejected: { label: 'Ditolak', className: 'bg-slate-200 text-slate-600' },
};

export function B2BInquiryStatusClient({ inquiryId, currentStatus }: B2BInquiryStatusClientProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [status, setStatus] = useState(currentStatus);

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status || isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/b2b-inquiries/${inquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setStatus(newStatus);
        router.refresh();
      }
    } catch (error) {
      console.error('Failed to update inquiry status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const statusInfo = STATUS_LABELS[status] ?? { label: status, className: 'bg-slate-200 text-slate-700' };

  return (
    <select
      value={status}
      onChange={(e) => handleStatusChange(e.target.value)}
      disabled={isUpdating}
      className={`text-xs font-medium rounded-full px-2 py-1 border-0 cursor-pointer focus:ring-2 focus:ring-brand-red ${statusInfo.className}`}
      style={{ backgroundColor: 'inherit' }}
    >
      <option value="new">Baru</option>
      <option value="contacted">Ditindaklanjuti</option>
      <option value="converted">Terjadwal</option>
      <option value="rejected">Ditolak</option>
    </select>
  );
}