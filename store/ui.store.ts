import { create } from 'zustand';

interface UIStore {
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  language: 'id' | 'en';
  setLanguage: (lang: 'id' | 'en') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isCartOpen: false,
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  toggleCart: () => set((state) => ({ isCartOpen: !state.isCartOpen })),
  language: 'id',
  setLanguage: (lang) => set({ language: lang }),
}));
