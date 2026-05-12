'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { products, productVariants, b2bProfiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

interface ProductOption {
  id: string;
  nameId: string;
  variants: Array<{
    id: string;
    nameId: string;
    b2bPrice: number | null;
    price: number;
  }>;
}

interface LineItem {
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export default function NewB2BQuotePage() {
  const router = useRouter();
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [validDays, setValidDays] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(0, subtotal - discountAmount);

  const handleAddItem = () => {
    setItems([...items, {
      variantId: '',
      productName: '',
      variantName: '',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: string, value: string | number) => {
    const newItems: LineItem[] = [...items];
    const item = newItems[index];
    if (!item) return;

    if (field === 'variantId') {
      const [productName, variantName, price] = (value as string).split('|');
      item.variantId = value as string;
      item.productName = productName ?? '';
      item.variantName = variantName ?? '';
      item.unitPrice = Number(price) || 0;
      item.subtotal = item.quantity * item.unitPrice;
    } else if (field === 'quantity') {
      item.quantity = Math.max(1, Number(value) || 1);
      item.subtotal = item.quantity * item.unitPrice;
    }

    newItems.splice(index, 1, item);
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!selectedProfileId || items.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/b2b-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          b2bProfileId: selectedProfileId,
          items: items.map(i => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          discountAmount,
          notes,
          validDays,
        }),
      });

      if (response.ok) {
        router.push('/admin/b2b-quotes');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/admin/b2b-quotes"
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-admin-text-primary">Quote Baru</h1>
          <p className="text-admin-text-secondary text-sm mt-1">
            Buat penawaran untuk pelanggan B2B
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Selection */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Pelanggan B2B</h2>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm focus:outline-none focus:border-brand-red"
            >
              <option value="">Pilih pelanggan</option>
              <option value="new">+ Pelanggan Baru (Inquiry baru)</option>
            </select>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-admin-text-primary">Item Quote</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="border-brand-red text-brand-red hover:bg-brand-red/5"
              >
                <Plus className="w-4 h-4 mr-1" />
                Tambah Item
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-admin-text-secondary">
                Belum ada item. Klik &quot;Tambah Item&quot; untuk memulai.
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-admin-text-primary text-sm">
                        {item.productName} - {item.variantName}
                      </p>
                      <p className="text-xs text-admin-text-secondary">
                        Rp {item.unitPrice.toLocaleString('id-ID')} / unit
                      </p>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                        className="text-center"
                      />
                    </div>
                    <div className="w-32 text-right">
                      <p className="font-medium text-admin-text-primary">
                        Rp {item.subtotal.toLocaleString('id-ID')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      className="p-2 text-error hover:bg-error-light rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-admin-border p-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Catatan</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan atau instruksi tambahan..."
              rows={3}
              className="w-full px-3 py-2 border border-admin-border rounded-lg text-sm focus:outline-none focus:border-brand-red resize-none"
            />
          </div>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-admin-border p-6 sticky top-6">
            <h2 className="font-semibold text-admin-text-primary mb-4">Ringkasan</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-admin-text-secondary">Subtotal</span>
                <span className="font-medium">Rp {subtotal.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-admin-text-secondary">Diskon</span>
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-32 text-right text-sm"
                />
              </div>
              <div className="border-t border-admin-border pt-3 flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-brand-red text-lg">
                  Rp {total.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-admin-text-secondary uppercase tracking-wider">
                  Valid Selama (hari)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={validDays}
                  onChange={(e) => setValidDays(Math.max(1, Number(e.target.value) || 14))}
                  className="mt-1"
                />
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!selectedProfileId || items.length === 0 || isSubmitting}
              className="w-full mt-6 bg-brand-red hover:bg-brand-red-dark"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Quote'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}