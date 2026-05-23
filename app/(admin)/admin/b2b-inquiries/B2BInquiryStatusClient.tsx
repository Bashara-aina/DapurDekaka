'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

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

  const handleStatusChange = async (newStatus: string | null) => {
    const statusValue = newStatus;
    if (!statusValue || statusValue === status || isUpdating) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/b2b-inquiries/${inquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue }),
      });

      if (res.ok) {
        setStatus(statusValue);
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Gagal mengupdate status');
        setStatus(currentStatus);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengupdate status');
    } finally {
      setIsUpdating(false);
    }
  };

  const statusInfo = STATUS_LABELS[status] ?? { label: status, className: 'bg-slate-200 text-slate-700' };

  return (
    <Select value={status} onValueChange={handleStatusChange} disabled={isUpdating}>
      <SelectTrigger className={`text-xs font-medium rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-brand-red ${statusInfo.className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="new">Baru</SelectItem>
        <SelectItem value="contacted">Ditindaklanjuti</SelectItem>
        <SelectItem value="converted">Terjadwal</SelectItem>
        <SelectItem value="rejected">Ditolak</SelectItem>
      </SelectContent>
    </Select>
  );
}