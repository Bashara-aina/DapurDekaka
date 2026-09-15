'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { AddressCard } from '@/components/store/account/AddressCard';
import { AddressForm } from '@/components/store/account/AddressForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch('/api/account/addresses');
      const data = await res.json();
      if (data.success) {
        setAddresses(data.data);
      }
    } catch (err) {
      logger.warn('[account/addresses] load failed', { error: err instanceof Error ? err.message : String(err) });
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
    // Open the confirm dialog; the actual DELETE runs in confirmDelete.
    // (No native confirm() — it blocks the main thread and breaks mobile UX.)
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);

    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAddresses(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      logger.warn('[account/addresses] delete failed', { error: err instanceof Error ? err.message : String(err) });
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
    } catch (err) {
      logger.warn('[account/addresses] set-default failed', { error: err instanceof Error ? err.message : String(err) });
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
    } catch (err) {
      logger.warn('[account/addresses] save failed', { error: err instanceof Error ? err.message : String(err) });
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
            type="button"
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
            type="button"
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

      {/* Delete confirmation — non-blocking Dialog (same pattern as cart). */}
      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{t('deleteAddressConfirmTitle') || t('deleteAddressConfirm') || 'Hapus alamat?'}</DialogTitle>
          </DialogHeader>
          <p className="text-text-secondary text-sm">
            {t('deleteAddressConfirmDesc') || t('deleteAddressConfirm') || 'Yakin ingin menghapus alamat ini?'}
          </p>
          <DialogFooter className="flex gap-3">
            <button
              type="button"
              onClick={() => setPendingDeleteId(null)}
              className="flex-1 h-11 border border-brand-cream-dark rounded-button font-medium hover:bg-brand-cream transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="flex-1 h-11 bg-brand-red text-white rounded-button font-bold hover:bg-brand-red-dark transition-colors"
            >
              {t('delete')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}