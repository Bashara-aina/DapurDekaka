import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { formatIDR } from '@/lib/utils/format-currency';

interface OrderReceiptData {
  orderNumber: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  courierName: string;
  recipientName: string;
  addressLine: string;
  city: string;
  province: string;
  postalCode: string;
}

// Note: This file uses dynamic imports to avoid SSR issues with @react-pdf/renderer
// Usage: const { generateOrderPDF } = await import('@/lib/pdf/order-receipt');
// then: const blob = await generateOrderPDF(data);

export async function generateOrderPDF(data: OrderReceiptData): Promise<Blob> {
  const { default: dynamic } = await import('react/jsx-runtime');
  
  // Minimal PDF generation — in production you'd use @react-pdf/renderer components
  // For now, generate a simple text blob as placeholder
  const content = `
KWITANSI PESANAN
================
Dapur Dekaka 德卡

No. Pesanan: ${data.orderNumber}
Tanggal: ${data.orderDate}

Pelanggan: ${data.customerName}
Email: ${data.customerEmail}

ITEM PESANAN:
${data.items.map(item => `
- ${item.productName} (${item.variantName})
  Qty: ${item.quantity} x ${formatIDR(item.unitPrice)} = ${formatIDR(item.subtotal)}
`).join('')}

RINCIAN PEMBAYARAN:
Subtotal: ${formatIDR(data.subtotal)}
Ongkir (${data.courierName}): ${formatIDR(data.shippingCost)}
Diskon: -${formatIDR(data.discountAmount)}
TOTAL: ${formatIDR(data.totalAmount)}

ALAMAT PENGIRIMAN:
${data.recipientName}
${data.addressLine}
${data.city}, ${data.province} ${data.postalCode}

========================
Dapur Dekaka — Cita Rasa Warisan, Kini di Rumahmu
Jl. Dapur Keluarga No. 1, Bandung, Jawa Barat
  `.trim();

  return new Blob([content], { type: 'application/pdf' });
}