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

const DEFAULT_ADDRESS = 'Jl. Sinom V no. 7, Turangga, Bandung';
const DEFAULT_MAPS_URL = 'https://maps.google.com/?q=Jl+Sinom+V+No+7+Turangga+Bandung';
const DEFAULT_WHATSAPP = '6281234567890';

export function PickupInvitation({
  orderNumber,
  storeAddress = DEFAULT_ADDRESS,
  googleMapsUrl = DEFAULT_MAPS_URL,
  whatsappNumber = DEFAULT_WHATSAPP,
  openingHours = '08:00 - 20:00 WIB (Setiap Hari)',
  className,
}: PickupInvitationProps) {
  const waUrl = `https://wa.me/${whatsappNumber.replace(/^0/, '62')}`;

  return (
    <div className={cn('p-6 bg-brand-cream rounded-lg', className)}>
      {/* Pickup code */}
      <div className="text-center mb-6">
        <p className="text-xs text-text-secondary mb-2">Kode Pengambilan</p>
        <p className="font-mono font-bold text-3xl text-brand-red tracking-wider">
          {orderNumber}
        </p>
      </div>

      {/* Instructions */}
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

      {/* Store info */}
      <div className="space-y-3 border-t border-brand-cream-dark pt-4">
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-brand-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{storeAddress}</p>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-red hover:underline"
            >
              Buka di Google Maps
            </a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-brand-red flex-shrink-0" />
          <p className="text-sm">{openingHours}</p>
        </div>

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
      </div>
    </div>
  );
}