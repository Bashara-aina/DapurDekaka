'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LogIn, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart.store';
import { CartItemComponent } from '@/components/store/cart/CartItem';
import { CartSummary } from '@/components/store/cart/CartSummary';
import { EmptyCart } from '@/components/store/cart/EmptyCart';
import { cn } from '@/lib/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

export const dynamic = 'force-dynamic';

interface StockValidation {
  variantId: string;
  cartQty: number;
  availableStock: number;
  available: boolean;
}

export default function CartPage() {
  const t = useTranslations('cart');
  const tAccount = useTranslations('account');

  const { data: session } = useSession();
  const items = useCartStore((s) => s.items);
  const getTotalItems = useCartStore((s) => s.getTotalItems);
  const clearCart = useCartStore((s) => s.clearCart);

  const [stockValidations, setStockValidations] = useState<StockValidation[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const validateCartStock = useCallback(async () => {
    if (items.length === 0) return;

    setIsValidating(true);
    try {
      const res = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        }),
      });
      const response = await res.json();

      if (response.success && response.data?.items) {
        setStockValidations(response.data.items);
      }
    } catch {
      toast.error(t('checkout.stockUpdated') || 'Gagal memvalidasi stok');
    } finally {
      setIsValidating(false);
      setHasValidated(true);
    }
  }, [items, t]);

  useEffect(() => {
    if (items.length > 0) {
      validateCartStock();
    }
  }, [items.length, validateCartStock]);

  // Sync cart to DB when logged in
  useEffect(() => {
    if (session?.user?.id && items.length > 0) {
      useCartStore.getState().syncToDb();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const getStockValidation = (variantId: string): StockValidation | undefined => {
    return stockValidations.find((v) => v.variantId === variantId);
  };

  const hasStockIssues = stockValidations.some((v) => !v.available);
  const invalidCount = stockValidations.filter((v) => !v.available).length;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
          <h1 className="font-display text-2xl font-bold">{t('empty')}</h1>
        </div>
        <EmptyCart />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">{t('cartTitle')}</h1>
            <p className="text-text-secondary text-sm mt-1">{tAccount('itemsCount', { count: getTotalItems() })}</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-button transition-colors"
              aria-label={tAccount('clearCartConfirmTitle')}
            >
              <Trash2 className="w-4 h-4" />
              {tAccount('deleteAll')}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 container mx-auto">
        {/* Login Prompt Banner */}
        {!session?.user?.id && (
          <div className="bg-gradient-to-r from-brand-gold/10 to-brand-cream border border-brand-gold/30 rounded-card p-4 mb-4">
            <div className="flex items-start gap-3">
              <LogIn className="w-5 h-5 text-brand-gold flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">
                  {tAccount('loginToEarnPoints')}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {tAccount('pointsEarnDescription')}
                </p>
                <div className="flex gap-2 mt-3">
                  <Link
                    href="/login?callbackUrl=/cart"
                    className="px-4 py-2 bg-brand-red text-white text-xs font-bold rounded-button hover:bg-brand-red-dark transition-colors"
                  >
                    {tAccount('login')}
                  </Link>
                  <Link
                    href="/register?callbackUrl=/cart"
                    className="px-4 py-2 border border-brand-red text-brand-red text-xs font-bold rounded-button hover:bg-brand-red/5 transition-colors"
                  >
                    {tAccount('register')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock Validation Warning */}
        {hasValidated && hasStockIssues && (
          <div role="alert" className="bg-warning-light border border-warning/30 rounded-card p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-text-primary">
                {tAccount('stockUnavailable', { count: invalidCount })}
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {tAccount('stockUpdated')}
              </p>
            </div>
          </div>
        )}

        {/* Loading indicator for validation */}
        {isValidating && (
          <div className="text-center py-2 mb-4">
            <span className="text-xs text-text-secondary">
              {tAccount('validatingStock')}
            </span>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-3 lg:gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const validation = getStockValidation(item.variantId);
              return (
                <CartItemComponent
                  key={item.variantId}
                  item={item}
                  stockValidation={validation}
                />
              );
            })}
          </div>

          {/* Cart Summary */}
          <div className="mt-4 lg:mt-0">
            <CartSummary stockIssues={hasStockIssues} />
          </div>
        </div>
      </div>

      {/* Clear Cart Confirmation Dialog */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{tAccount('clearCartConfirmTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-text-secondary text-sm">
            {tAccount('clearCartConfirmDesc')}
          </p>
          <DialogFooter className="flex gap-3">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="flex-1 h-11 border border-brand-cream-dark rounded-button font-medium hover:bg-brand-cream transition-colors"
            >
              {tAccount('cancel')}
            </button>
            <button
              onClick={() => { clearCart(); setShowClearConfirm(false); }}
              className="flex-1 h-11 bg-brand-red text-white rounded-button font-bold hover:bg-brand-red-dark transition-colors"
            >
              {tAccount('delete')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}