'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';
import { ChevronLeft } from 'lucide-react';

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

const STATUS_COLORS: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  packed: 'bg-cyan-100 text-cyan-800',
  shipped: 'bg-green-100 text-green-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-800',
  refunded: 'bg-pink-100 text-pink-800',
};

const POINTS_TYPE_LABELS: Record<string, string> = {
  earn: 'Mendapat',
  redeem: 'Ditukar',
  expire: 'Kadaluarsa',
  adjust: 'Penyesuaian',
  refund: 'Refund',
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [customerId, setCustomerId] = useState<string>('');
  const [isClientReady, setIsClientReady] = useState(false);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(p => {
      setCustomerId(p.id);
      setIsClientReady(true);
    });
  }, [params]);

  useEffect(() => {
    if (!customerId) return;

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

  if (!isClientReady) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Info */}
        <div className="bg-white rounded-lg border border-admin-border p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Info Personal</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Nama</dt>
              <dd className="font-medium">{customer.name ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium">{customer.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Telepon</dt>
              <dd className="font-medium">{customer.phone ?? '-'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Role</dt>
              <dd className="font-medium">{customer.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Poin</dt>
              <dd className="font-medium text-amber-600">{customer.pointsBalance ?? 0} pts</dd>
            </div>
          </dl>
        </div>

        {/* Addresses */}
        <div className="bg-white rounded-lg border border-admin-border p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Alamat</h2>
          {customer.addresses.length > 0 ? (
            <div className="space-y-3">
              {customer.addresses.map(addr => (
                <div key={addr.id} className="border border-admin-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{addr.label ?? 'Alamat'}</span>
                    {addr.isDefault && (
                      <span className="text-xs bg-brand-red text-white px-2 py-0.5 rounded">Default</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{addr.recipientName} · {addr.phone}</p>
                  <p className="text-sm text-gray-500">{addr.addressLine}</p>
                  <p className="text-sm text-gray-500">{addr.city}{addr.province ? `, ${addr.province}` : ''} {addr.postalCode}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Belum ada alamat tersimpan</p>
          )}
        </div>

        {/* Order History */}
        <div className="bg-white rounded-lg border border-admin-border p-6 lg:col-span-2">
          <h2 className="font-semibold text-gray-700 mb-4">Riwayat Pesanan</h2>
          {customer.orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-admin-content">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {customer.orders.map(order => (
                    <tr key={order.id}>
                      <td className="px-4 py-3">
                        <Link href={`/admin/orders/${order.id}`} className="font-medium text-sm hover:underline">
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-brand-red">
                        {formatIDR(order.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatWIB(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Belum ada pesanan</p>
          )}
        </div>

        {/* Points History */}
        <div className="bg-white rounded-lg border border-admin-border p-6 lg:col-span-2">
          <h2 className="font-semibold text-gray-700 mb-4">Riwayat Poin</h2>
          {customer.pointsHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-admin-content">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipe</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Jumlah</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Catatan</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border">
                  {customer.pointsHistory.map(ph => (
                    <tr key={ph.id}>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                          ph.type === 'earn' ? 'bg-green-100 text-green-800' :
                          ph.type === 'redeem' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {POINTS_TYPE_LABELS[ph.type] ?? ph.type}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${
                        ph.type === 'earn' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {ph.type === 'earn' ? '+' : '-'}{ph.pointsAmount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{ph.note ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatWIB(ph.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Belum ada riwayat poin</p>
          )}
        </div>
      </div>
    </div>
  );
}