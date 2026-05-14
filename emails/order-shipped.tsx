import React from 'react';
import { formatIDR } from '@/lib/utils/format-currency';

interface OrderShippedEmailProps {
  order: {
    orderNumber: string;
    courierName: string;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    totalAmount: number;
  };
  user: { name: string; email: string };
}

export function OrderShippedEmail({ order, user }: OrderShippedEmailProps) {
  const firstName = user.name.split(' ')[0];

  return (
    <html lang="id">
      <head />
      <body style={{ backgroundColor: '#FAFAF8', fontFamily: 'Inter, sans-serif', margin: 0, padding: 0 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          {/* Header */}
          <div style={{ backgroundColor: '#059669', padding: '24px', textAlign: 'center', borderRadius: '12px 12px 0 0' }}>
            <h1 style={{ color: '#FFFFFF', margin: 0, fontSize: '24px', fontFamily: 'Georgia, serif' }}>
              Paket Dalam Perjalanan! 🚚
            </h1>
          </div>

          {/* Body */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '0 0 12px 12px' }}>
            <p style={{ fontSize: '16px', color: '#1A1A1A', marginBottom: '8px' }}>
              Hai <strong>{firstName}</strong> 👋
            </p>
            <p style={{ fontSize: '14px', color: '#6B6B6B', lineHeight: '1.6', marginBottom: '24px' }}>
              Pesanan kamu sedang dalam perjalanan! Yuk pantau statusnya secara berkala ya.
            </p>

            <div style={{ backgroundColor: '#F0EAD6', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B6B6B' }}>Nomor Pesanan</p>
                <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#C8102E', fontFamily: 'monospace' }}>
                  {order.orderNumber}
                </p>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B6B6B' }}>Kurir</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: '600', color: '#1A1A1A' }}>
                  {order.courierName}
                </p>
              </div>
              {order.trackingNumber && (
                <div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6B6B6B' }}>Nomor Resi</p>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#059669', fontFamily: 'monospace' }}>
                    {order.trackingNumber}
                  </p>
                </div>
              )}
            </div>

            <p style={{ fontSize: '14px', color: '#6B6B6B', lineHeight: '1.6' }}>
              Pastikan kamu atau orang yang dituju siap untuk menerima paket.
              Pesanan dikirim dalam keadaan beku (cold-chain) untuk menjaga kesegaran.
            </p>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '24px 0 0', fontSize: '12px', color: '#ABABAB' }}>
            <p style={{ margin: 0 }}>Dapur Dekaka 德卡 · Bandung, Jawa Barat</p>
          </div>
        </div>
      </body>
    </html>
  );
}