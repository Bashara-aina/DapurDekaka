'use client';

import { Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

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

interface LineItemRowProps {
  item: LineItem;
  index: number;
  searchVariant: string;
  onSearchChange: (value: string) => void;
  filteredVariants: VariantOption[];
  loadingVariants: boolean;
  onSelectVariant: (index: number, variant: VariantOption) => void;
  onUpdateItem: (index: number, field: string, value: string | number) => void;
  onRemoveItem: (index: number) => void;
}

export default function LineItemRow({
  item,
  index,
  searchVariant,
  onSearchChange,
  filteredVariants,
  loadingVariants,
  onSelectVariant,
  onUpdateItem,
  onRemoveItem,
}: LineItemRowProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
      <div className="flex-1">
        {item.variantId ? (
          <>
            <p className="font-medium text-admin-text-primary text-sm">
              {item.productName} — {item.variantName}
            </p>
            <p className="text-xs text-admin-text-secondary">
              {item.sku} · Rp {item.unitPrice.toLocaleString('id-ID')} / unit
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="Cari produk..."
                value={searchVariant}
                onChange={e => onSearchChange(e.target.value)}
                className="text-sm"
              />
            </div>
            {searchVariant && (
              <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                {loadingVariants ? (
                  <p className="text-xs text-gray-400 px-2 py-1">Memuat...</p>
                ) : filteredVariants.slice(0, 5).map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onSelectVariant(index, v)}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-blue-50 rounded transition-colors"
                  >
                    <span className="font-medium">{v.productNameId}</span>
                    <span className="text-gray-400 mx-1">—</span>
                    <span>{v.nameId}</span>
                    <span className="text-gray-400 mx-1">·</span>
                    <span className="text-brand-red">Rp {(v.b2bPrice ?? v.price).toLocaleString('id-ID')}</span>
                    <span className={`ml-2 text-xs ${v.stock < 1 ? 'text-red-500' : 'text-green-600'}`}>
                      {v.stock < 1 ? 'Habis' : `Stok: ${v.stock}`}
                    </span>
                  </button>
                ))}
                {filteredVariants.length === 0 && (
                  <p className="text-xs text-gray-400 px-2 py-1">Produk tidak ditemukan</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {item.variantId && (
        <>
          <div className="w-24">
            <Input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => onUpdateItem(index, 'quantity', e.target.value)}
              className="text-center"
            />
          </div>
          <div className="w-32 text-right">
            <p className="font-medium text-admin-text-primary">
              Rp {item.subtotal.toLocaleString('id-ID')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemoveItem(index)}
            className="p-2 text-error hover:bg-error-light rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}