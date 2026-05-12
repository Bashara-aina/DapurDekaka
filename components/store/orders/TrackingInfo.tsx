'use client';

import { Truck, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TrackingInfoProps {
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  className?: string;
}

const TRACKING_URLS: Record<string, string> = {
  sicepat: 'https://www.sicepat.com/checkAwb?awb=',
  jne: 'https://www.jne.co.id/id/tracking/trace/',
  anteraja: 'https://anteraja.id/tracking/',
};

export function TrackingInfo({
  courierName,
  trackingNumber,
  trackingUrl,
  className,
}: TrackingInfoProps) {
  if (!trackingNumber) return null;

  const url = trackingUrl ?? (TRACKING_URLS[courierName?.toLowerCase() ?? ''] ?? '') + trackingNumber;

  return (
    <div className={cn('p-4 bg-brand-cream rounded-lg', className)}>
      <div className="flex items-start gap-3">
        <Truck className="w-5 h-5 text-brand-red flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-text-secondary mb-1">Kurir</p>
          <p className="font-medium text-sm">{courierName ?? 'N/A'}</p>
          <p className="text-xs text-text-secondary mt-2 mb-1">Nomor Resi</p>
          <p className="font-mono font-medium text-sm">{trackingNumber}</p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-brand-red hover:underline mt-2"
            >
              Lacak di kurir
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}