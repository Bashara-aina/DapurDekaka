'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Baru' },
  { value: 'contacted', label: 'Ditindaklanjuti' },
  { value: 'converted', label: 'Terjadwal' },
  { value: 'rejected', label: 'Ditolak' },
];

interface InquiryStatusUpdateProps {
  inquiryId: string;
  currentStatus: string;
}

export function InquiryStatusUpdate({ inquiryId, currentStatus }: InquiryStatusUpdateProps) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/b2b-inquiries/${inquiryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setStatus(newStatus);
        router.refresh();
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Gagal mengupdate status');
      }
    } catch {
      toast.error('Gagal mengupdate status');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-text-secondary uppercase tracking-wider">
        Update Status
      </label>
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            disabled={isUpdating || status === option.value}
            className={cn(
              'text-sm px-3 py-1 rounded-full transition-colors',
              status === option.value
                ? 'bg-brand-red text-white'
                : 'bg-white text-text-primary border border-admin-border'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}