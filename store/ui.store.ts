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
  setLanguage: (lang) => {
    // Persist to cookie so next-intl and other components can read it
    document.cookie = `NEXT_LOCALE=${lang};path=/;max-age=31536000;SameSite=Lax`;
    set({ language: lang });
  },
}));
