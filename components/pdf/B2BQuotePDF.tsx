'use client';

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';
import { formatIDR } from '@/lib/utils/format-currency';

// ── Types ────────────────────────────────────────────────────────────────────

interface B2BQuoteItem {
  productNameId: string;
  variantNameId: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface B2BQuotePDFProps {
  quote: {
    quoteNumber: string;
    status: string;
    subtotal: number;
    discountAmount: number;
    totalAmount: number;
    validUntil: Date | null;
    paymentTerms: string | null;
    notesId: string | null;
    notesEn: string | null;
    createdAt: Date;
    items: B2BQuoteItem[];
    b2bProfile?: {
      companyName: string;
      picName: string;
      picEmail: string;
      picPhone: string;
    } | null;
  };
  logoUrl?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: { backgroundColor: '#FFFFFF', padding: 32, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  brandName: { fontSize: 16, fontWeight: 700, color: '#C8102E' },
  tagline: { fontSize: 9, color: '#8A8A8A', marginTop: 2 },
  quoteLabel: { fontSize: 9, color: '#8A8A8A', marginBottom: 4 },
  quoteNumber: { fontSize: 12, fontWeight: 700, color: '#1A1A1A' },
  statusBadge: { backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, alignSelf: 'flex-start', marginTop: 4 },
  statusText: { fontSize: 8, fontWeight: 700, color: '#FFFFFF', textTransform: 'uppercase' },
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
  customerBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E8DFC8' },
  customerText: { fontSize: 9, color: '#1A1A1A', lineHeight: 1.6 },
  notesBox: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 6, border: '1px solid #E8DFC8' },
  notesText: { fontSize: 9, color: '#4A4A4A', lineHeight: 1.6 },
  footer: { position: 'absolute', bottom: 32, left: 32, right: 32, alignItems: 'center' },
  footerText: { fontSize: 8, color: '#8A8A8A', textAlign: 'center' },
  col1: { flex: 3 },
  col2: { flex: 1 },
  col3: { flex: 1 },
  col4: { flex: 1 },
  validUntil: { backgroundColor: '#F0EAD6', padding: 8, borderRadius: 4, marginTop: 8 },
  validUntilText: { fontSize: 9, color: '#4A4A4A' },
  validUntilDate: { fontSize: 10, fontWeight: 700, color: '#C8102E' },
});

// ── Status badge ─────────────────────────────────────────────────────────────

function QuoteStatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: 'Draft',
    sent: 'Terkirim',
    accepted: 'Diterima',
    rejected: 'Ditolak',
    expired: 'Kedaluwarsa',
  };
  return (
    <View style={s.statusBadge}>
      <Text style={s.statusText}>{labels[status] ?? status}</Text>
    </View>
  );
}

// ── Main document ─────────────────────────────────────────────────────────────

export function B2BQuotePDF({ quote, logoUrl }: B2BQuotePDFProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const validUntilStr = quote.validUntil
    ? formatDate(quote.validUntil)
    : 'Tidak terbatas';

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={s.tagline}>Cita Rasa Warisan, Kini di Rumahmu</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.quoteLabel}>QUOTE B2B</Text>
            <Text style={s.quoteNumber}>{quote.quoteNumber}</Text>
            <View style={{ marginTop: 4 }}>
              <QuoteStatusBadge status={quote.status} />
            </View>
          </View>
        </View>

        <View style={s.divider} />

        {/* Customer Info */}
        {quote.b2bProfile && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Informasi Pelanggan B2B</Text>
            <View style={s.customerBox}>
              <Text style={s.customerText}>
                {quote.b2bProfile.companyName}
                {'\n'}
                PIC: {quote.b2bProfile.picName}
                {'\n'}
                Email: {quote.b2bProfile.picEmail}
                {'\n'}
                WhatsApp: {quote.b2bProfile.picPhone}
              </Text>
            </View>
          </View>
        )}

        {/* Quote Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Detail Quote</Text>
          <View style={s.row}>
            <Text style={s.label}>Tanggal Dibuat</Text>
            <Text style={s.value}>{formatDate(quote.createdAt)}</Text>
          </View>
          {quote.paymentTerms && (
            <View style={s.row}>
              <Text style={s.label}>Terms Pembayaran</Text>
              <Text style={s.value}>{quote.paymentTerms}</Text>
            </View>
          )}
          <View style={s.validUntil}>
            <Text style={s.validUntilText}>Valid Until / Berlaku Hingga</Text>
            <Text style={s.validUntilDate}>{validUntilStr}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Items Table */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Item Quote</Text>

          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, s.col1]}>Produk</Text>
            <Text style={[s.tableHeaderText, s.col2]}>Qty</Text>
            <Text style={[s.tableHeaderText, s.col3]}>Harga Unit</Text>
            <Text style={[s.tableHeaderText, s.col4]}>Subtotal</Text>
          </View>

          {quote.items.map((item, i) => (
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
            <Text style={s.summaryValue}>{formatIDR(quote.subtotal)}</Text>
          </View>
          {quote.discountAmount > 0 && (
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Diskon</Text>
              <Text style={[s.summaryValue, { color: '#16A34A' }]}>-{formatIDR(quote.discountAmount)}</Text>
            </View>
          )}
          <View style={s.summaryTotalRow}>
            <Text style={s.summaryTotalLabel}>TOTAL</Text>
            <Text style={s.summaryTotalValue}>{formatIDR(quote.totalAmount)}</Text>
          </View>
        </View>

        {/* Notes */}
        {(quote.notesId || quote.notesEn) && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Catatan</Text>
            <View style={s.notesBox}>
              <Text style={s.notesText}>{quote.notesId || quote.notesEn}</Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>
            Quote ini adalah dokumen resmi dari Dapur Dekaka.
            {'\n'}
            Hubungi kami di +62 812-xxxx-xxxx untuk konfirmasi pesanan B2B.
          </Text>
        </View>
      </Page>
    </Document>
  );
}