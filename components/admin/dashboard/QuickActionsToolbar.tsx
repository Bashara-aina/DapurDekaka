'use client';

import { Package, Plus } from 'lucide-react';

export function QuickActionsToolbar() {
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href="/admin/products/new"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-admin-sidebar text-white text-xs font-medium rounded-lg hover:bg-admin-sidebar-hover transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Produk
      </a>
      <a
        href="/admin/coupons/new"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-admin-sidebar text-white text-xs font-medium rounded-lg hover:bg-admin-sidebar-hover transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Kupon
      </a>
      <a
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Package className="w-3.5 h-3.5" /> Semua Pesanan
      </a>
    </div>
  );
}