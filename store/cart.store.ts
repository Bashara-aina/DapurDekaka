import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  variantId: string;
  productId: string;
  productNameId: string;
  productNameEn: string;
  variantNameId: string;
  variantNameEn: string;
  sku: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  weightGram: number;
  stock: number;
}

interface CartStore {
  items: CartItem[];
  version: number;
  lastModified: number;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getTotalWeight: () => number;
  validateStock: () => Promise<{ valid: boolean; errors: string[] }>;
  syncToDb: () => Promise<{ success: boolean; error?: string }>;
  loadFromDb: () => Promise<{ success: boolean; error?: string }>;
  checkExternalChange: (currentVersion: number) => boolean;
}

function bumpVersion(state: { version: number; lastModified: number }) {
  return { version: state.version + 1, lastModified: Date.now() };
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      version: 0,
      lastModified: Date.now(),

      addItem: (item) => {
        const existing = get().items.find((i) => i.variantId === item.variantId);
        if (existing) {
          const maxQty = Math.min(99, item.stock ?? 99);
          set((state) => ({
            ...bumpVersion(state),
            items: state.items.map((i) =>
              i.variantId === item.variantId
                ? { ...i, quantity: Math.min(i.quantity + 1, maxQty) }
                : i
            ),
          }));
        } else {
          // Allow adding out-of-stock items (stock=0) — no longer blocked
          const maxQty = Math.min(99, item.stock ?? 99);
          set((state) => ({
            ...bumpVersion(state),
            items: [...state.items, { ...item, quantity: Math.min(1, maxQty) }],
          }));
        }
      },

      removeItem: (variantId) => {
        set((state) => ({
          ...bumpVersion(state),
          items: state.items.filter((i) => i.variantId !== variantId),
        }));
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        const item = get().items.find((i) => i.variantId === variantId);
        const maxQty = Math.min(99, item?.stock ?? 99);
        set((state) => ({
          ...bumpVersion(state),
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, quantity: Math.min(quantity, maxQty) } : i
          ),
        }));
      },

      clearCart: () => {
        set((state) => ({
          ...bumpVersion(state),
          items: [],
        }));
      },

      getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      getSubtotal: () => get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),

      getTotalWeight: () =>
        get().items.reduce((sum, item) => sum + item.weightGram * item.quantity, 0),

      validateStock: async function validateStockInner() {
        const items = get().items;
        if (items.length === 0) return { valid: true, errors: [] };

        const errors: string[] = [];

        try {
          const res = await fetch('/api/cart/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })) }),
          });
          const json = await res.json();
          if (json.success && json.data?.items) {
            const stockMap = new Map<string, number>(
              json.data.items.map((s: { variantId: string; availableStock: number }) => [s.variantId, s.availableStock])
            );
            set((state) => ({
              ...bumpVersion(state),
              items: state.items.map(i => ({
                ...i,
                stock: stockMap.get(i.variantId) ?? i.stock,
              } as CartItem)),
            }));
          }
        } catch {
          errors.push('Gagal memvalidasi stok. Silakan coba lagi.');
        }

        const insufficientItems = get().items.filter(i => i.quantity > i.stock && i.stock > 0);
        for (const item of insufficientItems) {
          errors.push(`"${item.productNameId}" - stok tidak mencukupi (tersedia ${item.stock})`);
        }

        return { valid: errors.length === 0, errors };
      },

      syncToDb: async () => {
        const items = get().items;
        if (items.length === 0) return { success: true };

        try {
          const res = await fetch('/api/auth/merge-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          });
          const json = await res.json();
          if (!res.ok || !json.success) {
            return { success: false, error: json.error || 'Gagal menyimpan keranjang ke server' };
          }
          return { success: true };
        } catch {
          return { success: false, error: 'Gagal menyimpan keranjang. Periksa koneksi internet.' };
        }
      },

      loadFromDb: async () => {
        try {
          const res = await fetch('/api/auth/cart');
          if (!res.ok) {
            return { success: false, error: 'Gagal memuat keranjang dari server' };
          }

          const json = await res.json();
          if (!json.success || !Array.isArray(json.data?.items)) {
            return { success: false, error: 'Data keranjang tidak valid' };
          }

          const dbItems: CartItem[] = json.data.items;
          const localItems = get().items;

          const merged = dbItems.map(dbItem => {
            const localItem = localItems.find(l => l.variantId === dbItem.variantId);
            if (localItem) {
              return { ...dbItem, quantity: localItem.quantity > dbItem.stock ? dbItem.stock : localItem.quantity };
            }
            return dbItem;
          }).filter(item => item.stock > 0);

          set((state) => ({
            ...bumpVersion(state),
            items: merged,
          }));

          return { success: true };
        } catch {
          return { success: false, error: 'Gagal memuat keranjang. Periksa koneksi internet.' };
        }
      },

      checkExternalChange: (currentVersion: number) => {
        return get().version !== currentVersion;
      },
    }),
    {
      name: 'dapur-cart',
      partialize: (state) => ({
        items: state.items,
        version: state.version,
        lastModified: state.lastModified,
      }),
    }
  )
);