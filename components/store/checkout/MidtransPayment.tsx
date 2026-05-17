'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSnapUrl } from '@/lib/midtrans/client';

interface SnapApi {
  pay: (token: string, callbacks?: SnapCallbacks) => void;
  hide?: () => void;
}

interface SnapCallbacks {
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (error: unknown) => void;
  onClose?: () => void;
}

interface MidtransPaymentProps {
  snapToken: string;
  callbacks?: SnapCallbacks;
}

declare global {
  interface Window {
    snap?: SnapApi;
  }
}

export function MidtransPayment({
  snapToken,
  callbacks,
}: MidtransPaymentProps) {
  const router = useRouter();
  const scriptLoaded = useRef(false);

  const handleSuccess = useCallback((result: unknown) => {
    callbacks?.onSuccess?.(result);
    router.push(`/checkout/success?order=${new URLSearchParams(window.location.search).get('order') ?? ''}`);
  }, [callbacks, router]);

  const handlePending = useCallback((result: unknown) => {
    callbacks?.onPending?.(result);
    router.push(`/checkout/pending?order=${new URLSearchParams(window.location.search).get('order') ?? ''}`);
  }, [callbacks, router]);

  const handleError = useCallback((error: unknown) => {
    callbacks?.onError?.(error);
    router.push(`/checkout/failed?order=${new URLSearchParams(window.location.search).get('order') ?? ''}`);
  }, [callbacks, router]);

  const handleClose = useCallback(() => {
    callbacks?.onClose?.();
    router.push(`/checkout/failed?order=${new URLSearchParams(window.location.search).get('order') ?? ''}`);
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
        if (window.snap) {
          window.snap.pay(snapToken, {
            onSuccess: handleSuccess,
            onPending: handlePending,
            onError: handleError,
            onClose: handleClose,
          });
        }
      };
      script.onerror = () => {
        handleError(new Error('Failed to load Midtrans Snap'));
      };
      document.head.appendChild(script);
    } else {
      if (window.snap) {
        window.snap.pay(snapToken, {
          onSuccess: handleSuccess,
          onPending: handlePending,
          onError: handleError,
          onClose: handleClose,
        });
      }
    }

    return () => {
      if (window.snap) {
        try { window.snap.hide?.(); } catch { /* ignore */ }
      }
    };
  }, [snapToken, handleSuccess, handlePending, handleError, handleClose]);

  return null;
}