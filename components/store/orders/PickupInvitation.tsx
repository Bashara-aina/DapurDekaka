'use client';

import { MapPin, Phone, Clock, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface PickupInvitationProps {
  orderNumber: string;
  storeAddress?: string;
  googleMapsUrl?: string;
  whatsappNumber?: string;
  openingHours?: string;
  className?: string;
}

export function PickupInvitation({
  orderNumber,
  storeAddress = '',
  googleMapsUrl = '',
  openingHours = '',
  whatsappNumber = '',
  className,
}: PickupInvitationProps) {
  const waNumber = whatsappNumber;
  const waUrl = waNumber ? `https://wa.me/${waNumber.replace(/^0/, '62')}` : undefined;

  return (
    <div className={cn('p-6 bg-brand-cream rounded-lg', className)}>
      <div className="text-center mb-6">
        <p className="text-xs text-text-secondary mb-2">Kode Pengambilan</p>
        <p className="font-mono font-bold text-3xl text-brand-red tracking-wider">
          {orderNumber}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-brand-red text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
            1
          </div>
          <p className="text-sm text-text-primary">
            Tunjukkan kode <strong>{orderNumber}</strong> ke staff toko
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-brand-red text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
            2
          </div>
          <p className="text-sm text-text-primary">
            Staff akan memverifikasi pesanan Anda
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-brand-red text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
            3
          </div>
          <p className="text-sm text-text-primary">
            Pesanan akan disiapkan dalam 15-30 menit
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
            <CheckCircle className="w-3 h-3" />
          </div>
          <p className="text-sm text-text-primary font-medium">
            Nikmati produk Anda!
          </p>
        </div>
      </div>

      <div className="space-y-3 border-t border-brand-cream-dark pt-4">
        {storeAddress ? (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-brand-red flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{storeAddress}</p>
              {googleMapsUrl ? (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-red hover:underline"
                >
                  Buka di Google Maps
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {openingHours ? (
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-brand-red flex-shrink-0" />
            <p className="text-sm">{openingHours}</p>
          </div>
        ) : null}

        {waUrl ? (
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-brand-red flex-shrink-0" />
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand-red hover:underline"
            >
              Hubungi via WhatsApp
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}