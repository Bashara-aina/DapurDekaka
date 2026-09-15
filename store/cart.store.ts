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
  restoreItems: (items: CartItem[]) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getTotalWeight: () => number;
  validateStock: () => Promise<{ valid: boolean; errors: string[]; priceChanged: boolean }>;
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
          if ((existing.stock ?? 0) <= 0) return;
          const maxQty = Math.min(99, existing.stock ?? 99);
          set((state) => ({
            ...bumpVersion(state),
            items: state.items.map((i) =>
              i.variantId === item.variantId
                ? { ...i, quantity: Math.min(i.quantity + 1, maxQty) }
                : i
            ),
          }));
        } else {
          if ((item.stock ?? 0) <= 0) return;
          const maxQty = Math.min(99, item.stock);
          if (maxQty <= 0) return;
          set((state) => ({
            ...bumpVersion(state),
            items: [...state.items, { ...item, quantity: 1 }],
          }));
        }
      },

      removeItem: (variantId) => {
        set((state) => ({
          ...bumpVersion(state),
          items: state.items.filter((i) => i.variantId !== variantId),
        }));
      },

      restoreItems: (restoreItems) => {
        set((state) => {
          const mergedMap = new Map<string, CartItem>();
          for (const current of state.items) mergedMap.set(current.variantId, current);
          for (const incoming of restoreItems) {
            const qty = Math.min(Math.max(incoming.quantity ?? 1, 1), 99);
            const existing = mergedMap.get(incoming.variantId);
            if (existing) {
              const cap = Math.min(99, Math.max(existing.stock ?? incoming.stock ?? 99, 1));
              mergedMap.set(incoming.variantId, {
                ...existing,
                quantity: Math.min(existing.quantity + qty, cap),
              });
            } else {
              mergedMap.set(incoming.variantId, { ...incoming, quantity: qty });
            }
          }
          return { ...bumpVersion(state), items: Array.from(mergedMap.values()) };
        });
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
        if (items.length === 0) return { valid: true, errors: [], priceChanged: false };

        const errors: string[] = [];
        let priceChanged = false;

        try {
          const res = await fetch('/api/cart/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })) }),
          });
          const json = await res.json();
          if (json.success && json.data?.items) {
            const stockMap = new Map<string, { stock: number; price: number }>(
              json.data.items.map((s: { variantId: string; availableStock: number; unitPrice: number }) => [
                s.variantId,
                { stock: s.availableStock, price: s.unitPrice },
              ])
            );
            set((state) => ({
              ...bumpVersion(state),
              items: state.items.map(i => {
                const server = stockMap.get(i.variantId);
                if (!server) return i;
                if (server.price !== i.unitPrice) priceChanged = true;
                return {
                  ...i,
                  stock: server.stock,
                  unitPrice: server.price,
                } as CartItem;
              }),
            }));
          }
        } catch {
          errors.push('Gagal memvalidasi stok. Silakan coba lagi.');
        }

        for (const item of get().items) {
          if (item.stock <= 0) {
            errors.push(`"${item.productNameId}" — stok habis`);
          } else if (item.quantity > item.stock) {
            errors.push(`"${item.productNameId}" - stok tidak mencukupi (tersedia ${item.stock})`);
          }
        }

        return { valid: errors.length === 0, errors, priceChanged };
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

          const mergedMap = new Map<string, CartItem>();
          for (const dbItem of dbItems) {
            mergedMap.set(dbItem.variantId, dbItem);
          }
          for (const localItem of localItems) {
            const existing = mergedMap.get(localItem.variantId);
            if (existing) {
              // PRD §5.1: guest + DB quantities are added together, capped at 99/stock.
              // Always trust server price/stock over client values.
              const summed = (existing.quantity ?? 0) + (localItem.quantity ?? 0);
              const cap = Math.min(99, existing.stock ?? 99);
              mergedMap.set(localItem.variantId, {
                ...existing,
                quantity: Math.min(Math.max(summed, 1), Math.max(cap, 1)),
                unitPrice: existing.unitPrice,
                stock: existing.stock,
              });
            } else {
              mergedMap.set(localItem.variantId, localItem);
            }
          }

          const merged = Array.from(mergedMap.values()).filter((item) => item.stock > 0);

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