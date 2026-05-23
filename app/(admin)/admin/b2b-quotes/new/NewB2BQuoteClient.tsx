'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import ProfileSelector from './ProfileSelector';
import LineItemRow from './LineItemRow';

interface VariantOption {
  id: string;
  nameId: string;
  nameEn: string;
  price: number;
  b2bPrice: number | null;
  stock: number;
  productId: string;
  productNameId: string;
  productNameEn: string;
  sku: string;
}

interface LineItem {
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface B2BProfile {
  id: string;
  companyName: string;
  picName: string;
  picEmail: string;
  picPhone: string;
}

interface NewCustomer {
  companyName: string;
  picName: string;
  picEmail: string;
  picPhone: string;
}

export default function NewB2BQuoteClient() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<B2BProfile[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomer>({
    companyName: '',
    picName: '',
    picEmail: '',
    picPhone: '',
  });
  const [items, setItems] = useState<LineItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [validDays, setValidDays] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingVariants, setLoadingVariants] = useState(true);
  const [searchVariant, setSearchVariant] = useState('');

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch('/api/admin/b2b-profiles?status=approved');
        if (res.ok) {
          const data = await res.json();
          setProfiles(data.data?.profiles ?? []);
        }
      } catch {
        toast.error('Gagal memuat data pelanggan');
      } finally {
        setLoadingProfiles(false);
      }
    }
    fetchProfiles();
  }, []);

  useEffect(() => {
    async function fetchVariants() {
      try {
        const res = await fetch('/api/admin/products');
        if (res.ok) {
          const data = await res.json();
          const allVariants: VariantOption[] = [];
          for (const product of data.data?.products ?? []) {
            for (const variant of product.variants ?? []) {
              allVariants.push({
                id: variant.id,
                nameId: variant.nameId,
                nameEn: variant.nameEn,
                price: variant.price,
                b2bPrice: variant.b2bPrice,
                stock: variant.stock,
                productId: product.id,
                productNameId: product.nameId,
                productNameEn: product.nameEn,
                sku: variant.sku,
              });
            }
          }
          setVariants(allVariants);
        }
      } catch {
        toast.error('Gagal memuat data produk');
      } finally {
        setLoadingVariants(false);
      }
    }
    fetchVariants();
  }, []);

  const filteredVariants = variants.filter(v =>
    v.productNameId.toLowerCase().includes(searchVariant.toLowerCase()) ||
    v.nameId.toLowerCase().includes(searchVariant.toLowerCase()) ||
    v.sku.toLowerCase().includes(searchVariant.toLowerCase())
  );

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const total = Math.max(0, subtotal - discountAmount);

  const handleAddItem = useCallback(() => {
    setItems([...items, {
      variantId: '',
      productName: '',
      variantName: '',
      sku: '',
      quantity: 1,
      unitPrice: 0,
      subtotal: 0,
    }]);
  }, [items]);

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSelectVariant = (index: number, variant: VariantOption) => {
    if (variant.stock < 1) {
      toast.error('Stok varian ini habis');
      return;
    }
    const unitPrice = variant.b2bPrice ?? variant.price;
    const newItems: LineItem[] = [...items];
    newItems[index] = {
      variantId: variant.id,
      productName: variant.productNameId,
      variantName: variant.nameId,
      sku: variant.sku,
      quantity: 1,
      unitPrice,
      subtotal: unitPrice,
    };
    setItems(newItems);
  };

  const handleUpdateItem = (index: number, field: string, value: string | number) => {
    const newItems: LineItem[] = [...items];
    const item = newItems[index];
    if (!item) return;

    if (field === 'quantity') {
      item.quantity = Math.max(1, Number(value) || 1);
      item.subtotal = item.quantity * item.unitPrice;
    }

    newItems.splice(index, 1, item);
    setItems(newItems);
  };

  const handleSubmit = async () => {
    const isNewCustomer = selectedProfileId === 'new';
    if (!isNewCustomer && !selectedProfileId) {
      toast.error('Pilih pelanggan terlebih dahulu');
      return;
    }
    if (isNewCustomer) {
      if (!newCustomer.companyName || !newCustomer.picName || !newCustomer.picEmail || !newCustomer.picPhone) {
        toast.error('Lengkapi data pelanggan baru');
        return;
      }
    }
    if (items.length === 0 || items.every(i => !i.variantId)) {
      toast.error('Tambahkan minimal 1 item');
      return;
    }
    if (validDays < 1) {
      toast.error('Masa valid minimal 1 hari');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        items: items.filter(i => i.variantId).map(i => ({
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        discountAmount,
        notes,
        validDays,
      };

      if (isNewCustomer) {
        payload.newCustomer = newCustomer;
      } else {
        payload.b2bProfileId = selectedProfileId;
      }

      const response = await fetch('/api/admin/b2b-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan quote');
      }

      toast.success('Quote berhasil dibuat');
      router.push('/admin/b2b-quotes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan quote');
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
          <ProfileSelector
            selectedProfileId={selectedProfileId}
            onProfileChange={setSelectedProfileId}
            showNewCustomer={showNewCustomer}
            onShowNewCustomerChange={setShowNewCustomer}
            newCustomer={newCustomer}
            onNewCustomerChange={setNewCustomer}
            loadingProfiles={loadingProfiles}
            profiles={profiles}
          />

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
                  <LineItemRow
                    key={index}
                    item={item}
                    index={index}
                    searchVariant={searchVariant}
                    onSearchChange={setSearchVariant}
                    filteredVariants={filteredVariants}
                    loadingVariants={loadingVariants}
                    onSelectVariant={handleSelectVariant}
                    onUpdateItem={handleUpdateItem}
                    onRemoveItem={handleRemoveItem}
                  />
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
                <Label className="text-xs text-admin-text-secondary uppercase tracking-wider">
                  Valid Selama (hari)
                </Label>
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
              type="button"
              onClick={handleSubmit}
              disabled={!selectedProfileId || items.length === 0 || isSubmitting}
              className="w-full mt-6 bg-brand-red hover:bg-brand-red-dark"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : 'Simpan Quote'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}