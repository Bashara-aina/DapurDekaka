'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

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
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-admin-text-secondary uppercase tracking-wider">
        Update Status
      </label>
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={status === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleStatusChange(option.value)}
            disabled={isUpdating || status === option.value}
            className={status === option.value ? 'bg-brand-red text-white' : ''}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}