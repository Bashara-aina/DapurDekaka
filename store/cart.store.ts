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
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getTotalWeight: () => number;
  validateStock: () => Promise<void>;
  syncToDb: () => Promise<void>;
  loadFromDb: () => Promise<void>;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find((i) => i.variantId === item.variantId);
        if (existing) {
          const maxQty = Math.min(99, item.stock ?? 99);
          set({
            items: get().items.map((i) =>
              i.variantId === item.variantId
                ? { ...i, quantity: Math.min(i.quantity + 1, maxQty) }
                : i
            ),
          });
        } else {
          const maxQty = Math.min(99, item.stock ?? 99);
          set({ items: [...get().items, { ...item, quantity: Math.min(1, maxQty) }] });
        }
      },

      removeItem: (variantId) => {
        set({ items: get().items.filter((i) => i.variantId !== variantId) });
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(variantId);
          return;
        }
        const item = get().items.find((i) => i.variantId === variantId);
        const maxQty = Math.min(99, item?.stock ?? 99);
        set({
          items: get().items.map((i) =>
            i.variantId === variantId ? { ...i, quantity: Math.min(quantity, maxQty) } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      getTotalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      getSubtotal: () => get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),

      getTotalWeight: () =>
        get().items.reduce((sum, item) => sum + item.weightGram * item.quantity, 0),

      validateStock: async () => {
        const items = get().items;
        if (items.length === 0) return;

        try {
          const res = await fetch('/api/cart/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity })) }),
          });
          const json = await res.json();
          if (json.success && json.data) {
            // Fix cart.store.ts stock mapping type issue
            const stockMap = new Map<string, number>(json.data.map((s: { variantId: string; stock: number }) => [s.variantId, s.stock]));
            set({
              items: items.map(i => ({
                ...i,
                stock: stockMap.get(i.variantId) ?? i.stock,
              } as CartItem)),
            });
          }
        } catch {
          // Silently fail - cart stock will remain stale but cart is still functional
        }
      },

      syncToDb: async () => {
        const items = get().items;
        if (items.length === 0) return;

        try {
          await fetch('/api/auth/merge-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          });
        } catch {
          // Silently fail - cart will remain in localStorage
        }
      },

      loadFromDb: async () => {
        // This is a placeholder — actual DB→Zustand sync happens
        // via the /api/auth/merge-cart response in the login flow
      },
    }),
    {
      name: 'dapur-cart',
    }
  )
);
