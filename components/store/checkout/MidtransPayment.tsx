'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSnapUrl } from '@/lib/midtrans/client';

interface SnapCallbacks {
  onSuccess?: () => void;
  onPending?: () => void;
  onError?: () => void;
  onClose?: () => void;
}

interface MidtransPaymentProps {
  snapToken: string;
  callbacks?: SnapCallbacks;
}

export function MidtransPayment({
  snapToken,
  callbacks,
}: MidtransPaymentProps) {
  const router = useRouter();
  const scriptLoaded = useRef(false);

  const handleSuccess = useCallback(() => {
    callbacks?.onSuccess?.();
    const orderNumber = new URLSearchParams(window.location.search).get('order') ?? '';
    router.push(`/checkout/success?order=${orderNumber}`);
  }, [callbacks, router]);

  const handlePending = useCallback(() => {
    callbacks?.onPending?.();
    const orderNumber = new URLSearchParams(window.location.search).get('order') ?? '';
    router.push(`/checkout/pending?order=${orderNumber}`);
  }, [callbacks, router]);

  const handleError = useCallback(() => {
    callbacks?.onError?.();
    const orderNumber = new URLSearchParams(window.location.search).get('order') ?? '';
    router.push(`/checkout/failed?order=${orderNumber}`);
  }, [callbacks, router]);

  const handleClose = useCallback(() => {
    callbacks?.onClose?.();
    const orderNumber = new URLSearchParams(window.location.search).get('order') ?? '';
    router.push(`/checkout/failed?order=${orderNumber}`);
  }, [callbacks, router]);

  useEffect(() => {
    if (scriptLoaded.current) return;

    const snapUrl = getSnapUrl();
    const existingScript = document.querySelector(`script[src="${snapUrl}"]`);

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = snapUrl;
      script.async = true;
      script.onload = () => {
        scriptLoaded.current = true;
        const snap = (window as Window & { snap?: any }).snap;
        if (snap) {
          snap.pay(snapToken, {
            onSuccess: handleSuccess,
            onPending: handlePending,
            onError: handleError,
            onClose: handleClose,
          });
        }
      };
      script.onerror = () => {
        console.error('Failed to load Midtrans Snap');
        router.push(`/checkout/failed?order=${new URLSearchParams(window.location.search).get('order') ?? ''}`);
      };
      document.head.appendChild(script);
    } else {
      const snap = (window as Window & { snap?: any }).snap;
      if (snap) {
        snap.pay(snapToken, {
          onSuccess: handleSuccess,
          onPending: handlePending,
          onError: handleError,
          onClose: handleClose,
        });
      }
    }

    return () => {
      // Cleanup after payment popup closes
    };
  }, [snapToken, handleSuccess, handlePending, handleError, handleClose, router]);

  return null;
}