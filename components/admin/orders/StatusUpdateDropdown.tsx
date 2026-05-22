import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import type { OrderStatus } from './OrderStatusBadge';

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

interface StatusUpdateDropdownProps {
  orderId: string;
  currentStatus: OrderStatus;
  userRole: string;
  onStatusChange?: (newStatus: OrderStatus) => void;
  disabled?: boolean;
  className?: string;
}

export function StatusUpdateDropdown({
  orderId,
  currentStatus,
  userRole,
  onStatusChange,
  disabled = false,
  className,
}: StatusUpdateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Warehouse can only set shipped when status is packed
  const allowedTransitions =
    userRole === 'warehouse'
      ? currentStatus === 'packed'
        ? (['shipped'] as OrderStatus[])
        : []
      : VALID_TRANSITIONS[currentStatus] ?? [];

  if (allowedTransitions.length === 0) {
    return null;
  }

  const handleSelect = async (newStatus: OrderStatus) => {
    setIsOpen(false);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error ?? 'Gagal memperbarui status');
        return;
      }

      toast.success(`Status berhasil diperbarui ke "${newStatus}"`);
      onStatusChange?.(newStatus);
    } catch {
      toast.error('Terjadi kesalahan saat memperbarui status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !disabled && !isLoading && setIsOpen((v) => !v)}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
          'bg-white border border-gray-200 text-gray-700',
          'hover:bg-gray-50 hover:border-gray-300',
          'focus:outline-none focus:ring-2 focus:ring-brand-red/20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors'
        )}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-gray-300 border-t-brand-red rounded-full animate-spin" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        <span>Ubah Status</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
            {allowedTransitions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleSelect(status)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 hover:text-brand-red transition-colors"
              >
                {getStatusLabel(status)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function getStatusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    pending_payment: 'Menunggu Pembayaran',
    paid: 'Sudah Bayar',
    processing: 'Diproses',
    packed: 'Dikemas',
    shipped: 'Dikirim',
    delivered: 'Diterima',
    cancelled: 'Dibatalkan',
    refunded: 'Dikembalikan',
  };
  return labels[status] ?? status;
}