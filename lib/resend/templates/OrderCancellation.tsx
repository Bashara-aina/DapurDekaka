import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

interface OrderCancellationEmailProps {
  orderNumber: string;
  customerName: string;
  items: Array<{
    name: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  shippingCost: number;
  discountAmount: number;
  totalAmount: number;
  reason: string;
  cancelledAt: string;
  refundAmount?: number;
  refundInfo?: string;
}

export function OrderCancellationEmail({
  orderNumber,
  customerName,
  items,
  subtotal,
  shippingCost,
  discountAmount,
  totalAmount,
  reason,
  cancelledAt,
  refundAmount,
  refundInfo,
}: OrderCancellationEmailProps) {
  const formatPrice = (price: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);

  return (
    <Html>
      <Head />
      <Preview>
        Pesanan {orderNumber} telah dibatalkan — Dapur Dekaka 德卡
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Pesanan Dibatalkan</Text>
            <Text style={styles.headerSubtitle}>
              Halo {customerName}, pesanan {orderNumber} telah dibatalkan.
            </Text>
          </Section>

          {/* Cancellation Banner */}
          <Section style={styles.cancellationBanner}>
            <Text style={styles.cancelledIcon}>✕</Text>
            <Text style={styles.cancelledTitle}>Pembayaran Gagal / Dibatalkan</Text>
            <Text style={styles.cancelledSubtitle}>
              Tanggal: {cancelledAt}
            </Text>
          </Section>

          {/* Reason */}
          <Section style={styles.reasonSection}>
            <Text style={styles.reasonTitle}>Alasan</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </Section>

          {/* Refund Info */}
          {refundAmount !== undefined && refundAmount > 0 && (
            <Section style={styles.refundSection}>
              <Text style={styles.refundTitle}>Informasi Pengembalian Dana</Text>
              <Text style={styles.refundAmount}>
                Rp {refundAmount.toLocaleString('id-ID')}
              </Text>
              {refundInfo && (
                <Text style={styles.refundNote}>{refundInfo}</Text>
              )}
            </Section>
          )}

          {/* Order Summary */}
          <Section style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Detail Pesanan</Text>
            {items.map((item, index) => (
              <Row key={index} style={styles.itemRow}>
                <td style={styles.itemNameCell}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemVariant}>
                    {item.variant} × {item.quantity}
                  </Text>
                </td>
                <td style={styles.itemPriceCell}>
                  <Text style={styles.itemPrice}>{formatPrice(item.subtotal)}</Text>
                </td>
              </Row>
            ))}
            <Row style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
            </Row>
            {discountAmount > 0 && (
              <Row style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Diskon</Text>
                <Text style={styles.summaryDiscount}>-{formatPrice(discountAmount)}</Text>
              </Row>
            )}
            <Row style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ongkos Kirim</Text>
              <Text style={styles.summaryValue}>{formatPrice(shippingCost)}</Text>
            </Row>
            <Row style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </Row>
          </Section>

          {/* Next Steps */}
          <Section style={styles.nextStepsSection}>
            <Text style={styles.nextStepsTitle}>Langkah Selanjutnya</Text>
            <Text style={styles.nextStepsText}>
              {refundAmount !== undefined && refundAmount > 0
                ? 'Pengembalian dana akan diproses sesuai kebijakan Midtrans. Dana akan masuk ke rekening Anda dalam 1-7 hari kerja.'
                : 'Anda dapat mencoba memesan kembali produk yang diinginkan. Stok produk tidak akan dipesan sebelum pembayaran berhasil.'}
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              若有疑问，请通过 WhatsApp 联系 kami.
            </Text>
            <Link href={process.env.NEXT_PUBLIC_APP_URL} style={styles.footerLink}>
              dapurdekaka.com
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#F0EAD6',
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  container: {
    backgroundColor: '#FFFFFF',
    margin: '0 auto',
    padding: '40px 32px',
    maxWidth: '600px',
  },
  headerSection: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  brandName: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#C8102E',
    marginBottom: '8px',
  },
  headerTitle: {
    fontSize: '22px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '8px',
  },
  headerSubtitle: {
    fontSize: '14px',
    color: '#6B6B6B',
  },
  cancellationBanner: {
    backgroundColor: '#DC2626',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  cancelledIcon: {
    fontSize: '32px',
    color: '#FFFFFF',
    marginBottom: '8px',
  },
  cancelledTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  cancelledSubtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
  },
  reasonSection: {
    backgroundColor: '#FEF2F2',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  reasonTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
  },
  reasonText: {
    fontSize: '14px',
    color: '#1A1A1A',
  },
  refundSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  refundTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#16A34A',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
  },
  refundAmount: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#16A34A',
    marginBottom: '4px',
  },
  refundNote: {
    fontSize: '12px',
    color: '#6B6B6B',
  },
  summarySection: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '12px',
    borderBottom: '1px solid #E0D4BC',
    paddingBottom: '8px',
  },
  itemRow: {
    padding: '12px 0',
    borderBottom: '1px solid #F0EAD6',
  },
  itemNameCell: {
    paddingRight: '16px',
  },
  itemPriceCell: {
    textAlign: 'right' as const,
  },
  itemName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: '2px',
  },
  itemVariant: {
    fontSize: '12px',
    color: '#6B6B6B',
  },
  itemPrice: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1A1A1A',
  },
  summaryRow: {
    padding: '6px 0',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#6B6B6B',
  },
  summaryValue: {
    fontSize: '14px',
    color: '#1A1A1A',
    textAlign: 'right' as const,
  },
  summaryDiscount: {
    fontSize: '14px',
    color: '#16A34A',
    textAlign: 'right' as const,
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#C8102E',
    textAlign: 'right' as const,
  },
  nextStepsSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  nextStepsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '8px',
  },
  nextStepsText: {
    fontSize: '13px',
    color: '#6B6B6B',
    lineHeight: '1.6',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #E0D4BC',
  },
  footerText: {
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '8px',
  },
  footerLink: {
    fontSize: '12px',
    color: '#C8102E',
  },
} as const;