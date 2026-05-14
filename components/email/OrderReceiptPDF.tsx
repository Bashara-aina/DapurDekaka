'use client';

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import { formatIDR } from '@/lib/utils/format-currency';
import { formatWIB } from '@/lib/utils/format-date';

// ── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', padding: 32, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  logo: { width: 120 },
  brandName: { fontSize: 16, fontWeight: 700, color: '#C8102E' },
  tagline: { fontSize: 9, color: '#8A8A8A', marginTop: 2 },
  divider: { borderBottom: '1px solid #E8DFC8', marginVertical: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 9, fontWeight: 600, color: '#8A8A8A', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 10, color: '#4A4A4A' },
  value: { fontSize: 10, fontWeight: 600, color: '#1A1A1A' },
  highlightValue: { fontSize: 10, fontWeight: 700, color: '#C8102E' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F0EAD6', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 4, marginBottom: 4 },
  tableHeaderText: { fontSize: 8, fontWeight: 700, color: '#1A1A1A', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottom: '1px solid #F0EAD6' },
  tableCell: { fontSize: 9, color: '#1A1A1A' },
  tableCellMuted: { fontSize: 8, color: '#8A8A8A' },
  tableCellRight: { fontSize: 9, fontWeight: 600, color: '#1A1A1A', textAlign: 'right' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 10, color: '#4A4A4A' },
  summaryValue: { fontSize: 10, fontWeight: 600, color: '#1A1A1A' },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTop: '1px solid #1A1A1A', marginTop: 4 },
  summaryTotalLabel: { fontSize: 11, fontWeight: 700, color: '#1A1A1A' },
  summaryTotalValue: { fontSize: 11, fontWeight: 700, color: '#C8102E' },
  addressBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E8DFC8' },
  addressText: { fontSize: 9, color: '#1A1A1A', lineHeight: 1.6 },
  trackingBox: { backgroundColor: '#F0EAD6', padding: 10, borderRadius: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trackingLabel: { fontSize: 9, color: '#8A8A8A' },
  trackingNumber: { fontSize: 10, fontWeight: 700, color: '#1A1A1A' },
  statusBadge: { backgroundColor: '#C8102E', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, alignSelf: 'flex-start' },
  statusText: { fontSize: 8, fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 32, left: 32, right: 32, alignItems: 'center' },
  footerText: { fontSize: 8, color: '#8A8A8A', textAlign: 'center' },
  col1: { flex: 3 },
  col2: { flex: 1 },
  col3: { flex: 1 },
  col4: { flex: 1 },
});

// ── Types ────────────────────────────────────────────────────────────────────

interface OrderReceiptProps {
  order: {
    orderNumber: string;
    status: string;
    recipientName: string;
    recipientEmail: string;
    recipientPhone: string;
    deliveryMethod: string;
    addressLine: string | null;
    district: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    courierName: string | null;
    trackingNumber: string | null;
    subtotal: number;
    discountAmount: number;
    pointsDiscount: number;
    shippingCost: number;
    totalAmount: number;
    pointsEarned: number;
    createdAt: Date | null;
    paidAt: Date | null;
    items: Array<{
      productNameId: string;
      variantNameId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
  };
  logoUrl?: string;
}

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    pending_payment: 'Menunggu Bayar',
    paid: 'Lunas',
    processing: 'Diproses',
    packed: 'Dikemas',
    shipped: 'Dikirim',
    delivered: 'Diterima',
    cancelled: 'Batal',
  };
  return (
    <View style={s.statusBadge}>
      <Text style={s.statusText}>{labels[status] ?? status}</Text>
    </View>
  );
}

// ── Main document ─────────────────────────────────────────────────────────────

export function OrderReceiptPDF({ order, logoUrl }: OrderReceiptProps) {
  const orderDate = order.createdAt ? formatWIB(new Date(order.createdAt)) : '-';

  return (
    <Document>
      <Page size="A5" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={s.tagline}>Cita Rasa Warisan, Kini di Rumahmu</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 9, color: '#8A8A8A', marginBottom: 4 }}>STRUK PESANAN</Text>
            <Text style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A' }}>{order.orderNumber}</Text>
            <View style={{ marginTop: 4 }}>
              <StatusBadge status={order.status} />
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Customer info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Informasi Pelanggan</Text>
          <View style={s.row}>
            <Text style={s.label}>Nama</Text>
            <Text style={s.value}>{order.recipientName}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Email</Text>
            <Text style={s.value}>{order.recipientEmail}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>No. HP</Text>
            <Text style={s.value}>{order.recipientPhone}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Tanggal Pesanan</Text>
            <Text style={s.value}>{orderDate}</Text>
          </View>
        </View>

        {/* Delivery address */}
        {order.deliveryMethod === 'delivery' && order.addressLine && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Alamat Pengiriman</Text>
            <View style={s.addressBox}>
              <Text style={s.addressText}>
                {order.recipientName}
                {'\n'}
                {order.addressLine}
                {order.district ? `, ${order.district}` : ''}
                {order.city ? `, ${order.city}` : ''}
                {order.province ? `, ${order.province}` : ''}
                {order.postalCode ? ` ${order.postalCode}` : ''}
              </Text>
            </View>
            {order.courierName && (
              <View style={{ marginTop: 6 }}>
                <View style={s.row}>
                  <Text style={s.label}>Kurir</Text>
                  <Text style={s.value}>{order.courierName}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {order.deliveryMethod === 'pickup' && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Metode Pengiriman</Text>
            <Text style={s.value}>Ambil di Toko (Pickup)</Text>
          </View>
        )}

        {/* Tracking */}
        {order.trackingNumber && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Nomor Resi</Text>
            <View style={s.trackingBox}>
              <View>
                <Text style={s.trackingLabel}>Nomor Tracking</Text>
                <Text style={s.trackingNumber}>{order.trackingNumber}</Text>
              </View>
              <Text style={{ fontSize: 9, color: '#4A4A4A' }}>{order.courierName}</Text>
            </View>
          </View>
        )}

        <View style={s.divider} />

        {/* Items table */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Item Pesanan</Text>

          {/* Table header */}
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, s.col1]}>Item</Text>
            <Text style={[s.tableHeaderText, s.col2]}>Qty</Text>
            <Text style={[s.tableHeaderText, s.col3]}>Harga</Text>
            <Text style={[s.tableHeaderText, s.col4]}>Subtotal</Text>
          </View>

          {/* Table rows */}
          {order.items.map((item, i) => (
            <View key={i} style={s.tableRow}>
              <Text style={[s.tableCell, s.col1]}>
                {item.productNameId} — {item.variantNameId}
              </Text>
              <Text style={[s.tableCell, s.col2]}>{item.quantity}x</Text>
              <Text style={[s.tableCell, s.col3]}>{formatIDR(item.unitPrice)}</Text>
              <Text style={[s.tableCellRight, s.col4]}>{formatIDR(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={s.section}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>Subtotal</Text>
            <Text style={s.summaryValue}>{formatIDR(order.subtotal)}</Text>
          </View>
          {order.discountAmount > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Diskon</Text>
              <Text style={[s.summaryValue, { color: '#16A34A' }]}>-{formatIDR(order.discountAmount)}</Text>
            </View>
          )}
          {order.pointsDiscount > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Points Digunakan</Text>
              <Text style={[s.summaryValue, { color: '#16A34A' }]}>-{formatIDR(order.pointsDiscount)}</Text>
            </View>
          )}
          {order.shippingCost > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Ongkos Kirim</Text>
              <Text style={s.summaryValue}>{formatIDR(order.shippingCost)}</Text>
            </View>
          )}
          {order.pointsEarned > 0 && order.status !== 'cancelled' && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Points Didapat</Text>
              <Text style={[s.summaryValue, { color: '#C9A84C' }]}>+{order.pointsEarned} pt</Text>
            </View>
          )}
          <View style={s.summaryTotalRow}>
            <Text style={s.summaryTotalLabel}>TOTAL</Text>
            <Text style={s.summaryTotalValue}>{formatIDR(order.totalAmount)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Terima kasih atas kepercayaan Anda kepada Dapur Dekaka.
            {'\n'}
            Struk ini adalah bukti pembayaran yang sah.
          </Text>
        </View>
      </Page>
    </Document>
  );
}