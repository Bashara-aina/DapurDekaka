'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AddressCard } from '@/components/store/account/AddressCard';
import { AddressForm } from '@/components/store/account/AddressForm';
import type { Address } from '@/lib/db/schema';
import type { AddressFormData } from '@/components/store/account/AddressForm';

export const dynamic = 'force-dynamic';

export default function AccountAddressesPage() {
  const t = useTranslations('account');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch('/api/account/addresses');
      const data = await res.json();
      if (data.success) {
        setAddresses(data.data);
      }
    } catch {
      toast.error(t('loadAddressError') || 'Gagal memuat alamat');
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const handleEdit = (address: Address) => {
    setEditingAddress(address);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteAddressConfirm') || 'Yakin ingin menghapus alamat ini?')) return;

    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAddresses(prev => prev.filter(a => a.id !== id));
      }
    } catch {
      toast.error(t('deleteAddressError') || 'Gagal menghapus alamat');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/account/addresses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true }),
      });
      const data = await res.json();
      if (data.success) {
        setAddresses(prev => prev.map(a => ({
          ...a,
          isDefault: a.id === id,
        })));
      }
    } catch {
      toast.error(t('setDefaultError') || 'Gagal mengatur alamat utama');
    }
  };

  const handleSubmitAddress = async (formData: AddressFormData) => {
    setIsSubmitting(true);
    try {
      if (editingAddress) {
        const res = await fetch('/api/account/addresses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingAddress.id, ...formData }),
        });
        const data = await res.json();
        if (data.success) {
          setAddresses(prev => prev.map(a => a.id === editingAddress.id ? data.data : a));
        }
      } else {
        const res = await fetch('/api/account/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.success) {
          setAddresses(prev => [data.data, ...prev]);
        }
      }

      setShowForm(false);
      setEditingAddress(null);
    } catch {
      toast.error(t('saveAddressError') || 'Gagal menyimpan alamat');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingAddress(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-card shadow-card p-6 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">{t('addresses')}</h1>
          <p className="text-text-secondary text-sm mt-1">{t('addresses')}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 h-10 px-4 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('addAddress')}
          </button>
        )}
      </div>

      {showForm && (
        <AddressForm
          address={editingAddress || undefined}
          onSubmit={handleSubmitAddress}
          onCancel={handleCancel}
          isLoading={isSubmitting}
        />
      )}

      {addresses.length === 0 && !showForm ? (
        <div className="bg-white rounded-card shadow-card p-12 text-center">
          <div className="w-20 h-20 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-10 h-10 text-text-disabled" />
          </div>
          <h2 className="font-display text-lg font-semibold text-text-primary mb-2">
            {t('noAddresses')}
          </h2>
          <p className="text-text-secondary mb-6">
            {t('noAddressesDesc') || 'Tambahkan alamat untuk checkout lebih cepat'}
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 h-12 px-6 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('addAddress')}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map(address => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}