'use client';

import { MessageCircle } from 'lucide-react';

export function WhatsAppButton() {
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890';
  const message = encodeURIComponent('Halo Dapur Dekaka, saya ingin bertanya...');
  const href = `https://wa.me/${waNumber}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg animate-pulse-soft hover:animate-none hover:scale-110 transition-transform no-tap"
      aria-label="Hubungi via WhatsApp"
    >
      <MessageCircle size={28} className="text-white fill-white" />
    </a>
  );
}
