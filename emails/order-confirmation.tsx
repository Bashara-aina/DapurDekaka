import React from 'react';
import { formatIDR } from '@/lib/utils/format-currency';

interface OrderConfirmationEmailProps {
  order: {
    orderNumber: string;
    totalAmount: number;
    subtotal: number;
    shippingCost: number;
    discountAmount: number;
    courierName: string;
  };
  user: { name: string; email: string };
  items: Array<{
    id: string;
    productNameId: string;
    variantNameId: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    productImageUrl?: string | null;
  }>;
}

export function OrderConfirmationEmail({ order, user, items }: OrderConfirmationEmailProps) {
  const firstName = user.name.split(' ')[0];

  return (
    <html lang="id">
      <head />
      <body style={{ backgroundColor: '#FAFAF8', fontFamily: 'Inter, sans-serif', margin: 0, padding: 0 }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          {/* Header */}
          <div style={{ backgroundColor: '#C8102E', padding: '24px', textAlign: 'center', borderRadius: '12px 12px 0 0' }}>
            <h1 style={{ color: '#F0EAD6', margin: 0, fontSize: '24px', fontFamily: 'Georgia, serif' }}>
              Dapur Dekaka
            </h1>
            <p style={{ color: '#F0EAD6', margin: '8px 0 0', fontSize: '14px', opacity: 0.9 }}>
              Cita Rasa Warisan, Kini di Rumahmu
            </p>
          </div>

          {/* Body */}
          <div style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '0 0 12px 12px' }}>
            <p style={{ fontSize: '16px', color: '#1A1A1A', marginBottom: '8px' }}>
              Hai <strong>{firstName}</strong> 👋
            </p>
            <p style={{ fontSize: '14px', color: '#6B6B6B', lineHeight: '1.6', marginBottom: '24px' }}>
              Pesanan kamu sudah kami terima dan sedang kami proses dengan penuh cinta.
              Kamu akan mendapat notifikasi saat pesanan dikirim 🚚
            </p>

            {/* Order Number */}
            <div style={{ backgroundColor: '#F0EAD6', padding: '16px', borderRadius: '8px', textAlign: 'center', marginBottom: '24px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B6B6B' }}>Nomor Pesanan</p>
              <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: 'bold', color: '#C8102E', fontFamily: 'monospace' }}>
                {order.orderNumber}
              </p>
            </div>

            {/* Items */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                Item Pesanan
              </h3>
              {items.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #E0D4BC' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1A1A1A' }}>
                      {item.productNameId}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B6B6B' }}>
                      {item.variantNameId} × {item.quantity}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#C8102E' }}>
                    {formatIDR(item.subtotal)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div style={{ backgroundColor: '#FAFAF8', padding: '16px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#6B6B6B', fontSize: '14px' }}>Subtotal</span>
                <span style={{ color: '#1A1A1A', fontSize: '14px' }}>{formatIDR(order.subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#6B6B6B', fontSize: '14px' }}>Ongkir ({order.courierName})</span>
                <span style={{ color: '#1A1A1A', fontSize: '14px' }}>{formatIDR(order.shippingCost)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#6B6B6B', fontSize: '14px' }}>Diskon</span>
                  <span style={{ color: '#16A34A', fontSize: '14px' }}>-{formatIDR(order.discountAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #C8102E', paddingTop: '12px', marginTop: '12px' }}>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#1A1A1A' }}>Total</span>
                <span style={{ fontSize: '16px', fontWeight: '700', color: '#C8102E' }}>{formatIDR(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', padding: '24px 0 0', fontSize: '12px', color: '#ABABAB' }}>
            <p style={{ margin: 0 }}>Dapur Dekaka 德卡 · Bandung, Jawa Barat</p>
            <p style={{ margin: '8px 0 0' }}>
              <a href="https://wa.me/6281234567890" style={{ color: '#25D366', textDecoration: 'none' }}>WhatsApp CS</a>
              {' · '}
              <a href="mailto:cs@dapurdekaka.com" style={{ color: '#C8102E', textDecoration: 'none' }}>cs@dapurdekaka.com</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}