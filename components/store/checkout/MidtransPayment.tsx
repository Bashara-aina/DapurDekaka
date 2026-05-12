'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSnapUrl } from '@/lib/midtrans/client';

interface SnapApi {
  pay: (token: string, callbacks?: SnapCallbacks) => void;
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
          window.snap.pay(snapToken, callbacks);
        }
      };
      script.onerror = () => {
        callbacks?.onError?.(new Error('Failed to load Midtrans Snap'));
      };
      document.head.appendChild(script);
    } else {
      // Script already loaded, just call snap
      if (window.snap) {
        window.snap.pay(snapToken, callbacks);
      }
    }
  }, [snapToken, callbacks]);

  return null;
}