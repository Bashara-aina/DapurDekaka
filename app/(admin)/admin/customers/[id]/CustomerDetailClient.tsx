'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatWIB } from '@/lib/utils/format-date';
import { ChevronLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';
import CustomerInfoCard from './CustomerInfoCard';
import CustomerAddressList from './CustomerAddressList';
import CustomerOrderHistory from './CustomerOrderHistory';
import PointsHistoryTable from './PointsHistoryTable';
import AdjustPointsModal from './AdjustPointsModal';

interface CustomerDetail {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  pointsBalance: number | null;
  createdAt: string;
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
    paidAt: string | null;
  }[];
  addresses: {
    id: string;
    label: string | null;
    recipientName: string;
    phone: string;
    addressLine: string;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    isDefault: boolean;
  }[];
  pointsHistory: {
    id: string;
    type: string;
    pointsAmount: number;
    note: string | null;
    createdAt: string;
  }[];
}

interface CustomerDetailClientProps {
  customerId: string;
}

export default function CustomerDetailClient({ customerId }: CustomerDetailClientProps) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdjustPoints, setShowAdjustPoints] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ amount: 0, type: 'add' as 'add' | 'deduct', reason: '' });
  const [isAdjusting, setIsAdjusting] = useState(false);

  useEffect(() => {
    async function fetchCustomer() {
      try {
        const res = await fetch(`/api/admin/customers/${customerId}`);
        if (!res.ok) throw new Error('Failed to fetch customer');
        const result = await res.json();
        setCustomer(result.data);
      } catch {
        setError('Gagal memuat data pelanggan');
      } finally {
        setLoading(false);
      }
    }

    fetchCustomer();
  }, [customerId]);

  async function handleAdjustPoints() {
    if (!adjustForm.reason.trim()) {
      toast.error('Alasan wajib diisi');
      return;
    }
    if (adjustForm.amount <= 0) {
      toast.error('Jumlah poin harus lebih dari 0');
      return;
    }

    setIsAdjusting(true);
    try {
      const res = await fetch('/api/admin/points/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: customerId,
          amount: adjustForm.amount,
          type: adjustForm.type,
          reason: adjustForm.reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyesuaikan poin');

      toast.success(data.data.message);
      setShowAdjustPoints(false);
      setAdjustForm({ amount: 0, type: 'add', reason: '' });

      const refreshed = await fetch(`/api/admin/customers/${customerId}`);
      const result = await refreshed.json();
      setCustomer(result.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyesuaikan poin');
    } finally {
      setIsAdjusting(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat data pelanggan...</div>;
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/customers" className="p-2 hover:bg-admin-content rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Detail Pelanggan</h1>
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-6 text-center text-red-500">
          {error ?? 'Pelanggan tidak ditemukan'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/customers" className="p-2 hover:bg-admin-content rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{customer.name || customer.email}</h1>
          <p className="text-sm text-gray-500">Customer sejak {formatWIB(customer.createdAt)}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`inline-flex px-3 py-1.5 text-sm font-semibold rounded ${
            customer.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {customer.isActive ? 'Aktif' : 'Nonaktif'}
          </span>
          <span className="text-2xl font-bold text-amber-600">{customer.pointsBalance ?? 0} pts</span>
          <button
            onClick={() => setShowAdjustPoints(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-lg hover:bg-amber-200 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Sesuaikan Poin
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomerInfoCard customer={customer} />
        <CustomerAddressList addresses={customer.addresses} />
        <CustomerOrderHistory orders={customer.orders} />
        <PointsHistoryTable pointsHistory={customer.pointsHistory} />
      </div>

      <AdjustPointsModal
        showAdjustPoints={showAdjustPoints}
        onClose={() => setShowAdjustPoints(false)}
        adjustForm={adjustForm}
        onAdjustFormChange={setAdjustForm}
        onSubmit={handleAdjustPoints}
        isAdjusting={isAdjusting}
      />
    </div>
  );
}