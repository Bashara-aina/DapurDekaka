'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';

interface InventoryVariant {
  id: string;
  nameId: string;
  sku: string;
  stock: number;
  productId: string;
  product: {
    id: string;
    nameId: string;
  };
}

interface InventoryClientProps {
  initialVariants: InventoryVariant[];
}

function StockCell({
  variant,
  onUpdate,
}: {
  variant: InventoryVariant;
  onUpdate: (variantId: string, newStock: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(variant.stock));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const newStock = parseInt(value, 10);
    if (isNaN(newStock) || newStock < 0) {
      toast.error('Stok harus berupa angka positif');
      return;
    }

    const delta = newStock - variant.stock;
    if (delta === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/field/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: variant.id,
          delta,
          reason: 'Inline adjustment from inventory page',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menyimpan stok');
      }

      toast.success(`Stok diperbarui: ${variant.stock} → ${newStock}`);
      onUpdate(variant.id, newStock);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan stok');
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setValue(String(variant.stock));
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className="w-20 h-7 px-2 text-sm rounded border border-admin-border bg-white font-mono disabled:opacity-50"
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-7 px-2 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? '...' : '✓'}
        </button>
        <button
          onClick={() => { setValue(String(variant.stock)); setEditing(false); }}
          disabled={saving}
          className="h-7 px-2 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`inline-flex px-2 py-1 text-xs font-bold rounded hover:opacity-80 transition-opacity ${
        variant.stock === 0
          ? 'bg-red-100 text-red-800'
          : variant.stock < 10
          ? 'bg-amber-100 text-amber-800'
          : 'bg-green-100 text-green-800'
      }`}
      title="Klik untuk edit"
    >
      {variant.stock}
    </button>
  );
}

export default function InventoryClient({ initialVariants }: InventoryClientProps) {
  const [variants, setVariants] = useState(initialVariants);
  const [search, setSearch] = useState('');
  const [sortStockFirst, setSortStockFirst] = useState(false);

  const handleUpdate = (variantId: string, newStock: number) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === variantId ? { ...v, stock: newStock } : v))
    );
  };

  const totalVariants = variants.length;
  const outOfStock = variants.filter((v) => v.stock === 0).length;
  const lowStock = variants.filter((v) => v.stock > 0 && v.stock < 10).length;

  const filtered = variants.filter(v =>
    !search ||
    v.sku.toLowerCase().includes(search.toLowerCase()) ||
    v.product.nameId.toLowerCase().includes(search.toLowerCase()) ||
    v.nameId.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = sortStockFirst
    ? [...filtered].sort((a, b) => a.stock - b.stock)
    : filtered;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventaris</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-admin-border p-4">
          <p className="text-sm text-gray-500">Total Varian</p>
          <p className="text-2xl font-bold text-text-primary">{totalVariants}</p>
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-4">
          <p className="text-sm text-gray-500">Stok Habis</p>
          <p className="text-2xl font-bold text-red-600">{outOfStock}</p>
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-4">
          <p className="text-sm text-gray-500">Stok Rendah (&lt;10)</p>
          <p className="text-2xl font-bold text-amber-600">{lowStock}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU, produk, atau varian..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-admin-border bg-white text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={() => setSortStockFirst(v => !v)}
          className={`h-9 px-3 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
            sortStockFirst
              ? 'bg-[#0F172A] text-white border-[#0F172A]'
              : 'border-admin-border text-gray-600 hover:bg-gray-50'
          }`}
        >
          {sortStockFirst ? '✓' : ''} Habis Duluan
        </button>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Varian</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {sorted.map((variant) => (
                <tr key={variant.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-sm">{variant.product.nameId}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{variant.nameId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{variant.sku}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StockCell variant={variant} onUpdate={handleUpdate} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/admin/products/${variant.productId}`}
                      className="text-brand-red hover:underline"
                    >
                      Edit Produk
                    </Link>
                  </td>
                </tr>
              ))}
              {variants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada varian produk
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}