'use client';

import { ExternalLink } from 'lucide-react';
import type { InventoryFlash } from './types';

export interface InventoryFlashCardProps {
  data: InventoryFlash | null | undefined;
}

export function InventoryFlashCard({ data }: InventoryFlashCardProps) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl p-5 border border-admin-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-text-primary">Inventory Flash</h2>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const healthy = data.totalActiveVariants - data.outOfStock.count - data.lowStock.count;

  return (
    <div className="bg-white rounded-xl p-5 border border-admin-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-text-primary">Inventory Flash</h2>
        <a
          href="/admin/inventory"
          className="text-xs text-brand-red hover:underline flex items-center gap-1"
        >
          Lihat Semua <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
          <p className="text-2xl font-bold text-red-500">{data.outOfStock.count}</p>
          <p className="text-xs text-red-600 mt-0.5">Habis</p>
        </div>
        <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-2xl font-bold text-amber-500">{data.lowStock.count}</p>
          <p className="text-xs text-amber-600 mt-0.5">Menipis</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
          <p className="text-2xl font-bold text-green-600">{healthy}</p>
          <p className="text-xs text-green-700 mt-0.5">Sehat</p>
        </div>
      </div>

      {data.topSelling.length > 0 && (
        <div className="space-y-1.5 border-t border-gray-100 pt-3 mt-2">
          <p className="text-xs font-medium text-text-secondary mb-1">
            Top Penjualan 30 Hari
          </p>
          {data.topSelling.slice(0, 3).map((item) => (
            <div
              key={item.variantId}
              className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0"
            >
              <div>
                <p className="text-sm text-text-primary font-medium">{item.productName}</p>
                <p className="text-xs text-gray-400">{item.variantName}</p>
              </div>
              <span className="text-xs font-bold text-brand-red bg-red-50 px-2 py-0.5 rounded">
                {item.totalQuantity} pcs
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}