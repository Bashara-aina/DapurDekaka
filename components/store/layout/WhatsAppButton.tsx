'use client';

import { useState } from 'react';
import { MessageCircle, Info } from 'lucide-react';

export interface WhatsAppButtonProps {
  whatsappNumber?: string;
  className?: string;
}

export function WhatsAppButton({ whatsappNumber, className }: WhatsAppButtonProps) {
  const number = whatsappNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '6281234567890';
  const message = encodeURIComponent('Halo Dapur Dekaka, saya ingin bertanya tentang...');
  const whatsappUrl = `https://wa.me/${number}?text=${message}`;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-50">
      {showTooltip && (
        <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-lg p-3 max-w-[200px] text-sm text-text-secondary mb-2 border border-brand-cream-dark">
          <button
            onClick={() => setShowTooltip(false)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md"
            aria-label="Tutup"
          >
            ×
          </button>
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-brand-red mt-0.5 flex-shrink-0" />
            <p className="text-xs leading-relaxed">
              Anda akan diarahkan ke WhatsApp. Chat ini tercatat untuk keperluan CS kami.
            </p>
          </div>
        </div>
      )}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform animate-pulse-soft"
        aria-label="Chat WhatsApp"
        onClick={() => setShowTooltip(true)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <MessageCircle className="w-7 h-7 text-white" />
      </a>
    </div>
  );
}
