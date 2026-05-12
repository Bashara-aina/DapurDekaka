import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

interface OrderConfirmationEmailProps {
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
  deliveryMethod: 'delivery' | 'pickup';
  courierName?: string;
  recipientName: string;
  recipientPhone: string;
  addressLine?: string;
  city?: string;
  province?: string;
  paidAt: string;
  pdfAttachment?: { filename: string; content: Buffer | string };
}

export function OrderConfirmationEmail({
  orderNumber,
  customerName,
  items,
  subtotal,
  shippingCost,
  discountAmount,
  totalAmount,
  deliveryMethod,
  courierName,
  recipientName,
  recipientPhone,
  addressLine,
  city,
  province,
  paidAt,
  pdfAttachment,
}: OrderConfirmationEmailProps) {
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
        Pesanan {orderNumber} telah dikonfirmasi! — Dapur Dekaka 德卡
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Pesanan Kamu Sudah Dikonfirmasi!</Text>
            <Text style={styles.headerSubtitle}>
              Terima kasih, {customerName}. Pesananmu sedang kami siapkan.
            </Text>
          </Section>

          {/* Order Info Banner */}
          <Section style={styles.orderBanner}>
            <Row>
              <Text style={styles.orderLabel}>Nomor Pesanan</Text>
              <Text style={styles.orderNumber}>{orderNumber}</Text>
            </Row>
            <Row>
              <Text style={styles.orderLabel}>Tanggal Pembayaran</Text>
              <Text style={styles.orderValue}>{paidAt}</Text>
            </Row>
            <Row>
              <Text style={styles.orderLabel}>Total Pembayaran</Text>
              <Text style={styles.orderAmount}>{formatPrice(totalAmount)}</Text>
            </Row>
          </Section>

          {/* Items Table */}
          <Section style={styles.itemsSection}>
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
          </Section>

          {/* Summary */}
          <Section style={styles.summarySection}>
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
              <Text style={styles.summaryLabel}>
                Ongkos Kirim{deliveryMethod === 'pickup' ? ' (Ambil di Toko)' : courierName ? ` (${courierName})` : ''}
              </Text>
              <Text style={styles.summaryValue}>
                {deliveryMethod === 'pickup' ? 'Gratis' : formatPrice(shippingCost)}
              </Text>
            </Row>
            <Hr style={styles.summaryDivider} />
            <Row style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </Row>
          </Section>

          {/* Delivery / Pickup Info */}
          {deliveryMethod === 'delivery' ? (
            <Section style={styles.deliverySection}>
              <Text style={styles.sectionTitle}>Alamat Pengiriman</Text>
              <Text style={styles.deliveryText}>
                <strong>{recipientName}</strong>
                <br />
                {recipientPhone}
                <br />
                {addressLine}
                <br />
                {city}, {province}
              </Text>
            </Section>
          ) : (
            <Section style={styles.pickupSection}>
              <Text style={styles.sectionTitle}>Ambil di Toko</Text>
              <Text style={styles.deliveryText}>
                Jl. Sinom V no. 7, Turangga, Bandung
                <br />
                Tunjukkan kode pesanan <strong>{orderNumber}</strong> ke staff toko.
              </Text>
            </Section>
          )}

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Pesananmu akan diproses segera.若有 pertanyaan，请 hubungi kami via WhatsApp.
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
    marginBottom: '32px',
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
  orderBanner: {
    backgroundColor: '#C8102E',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '24px',
  },
  orderLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '2px',
  },
  orderNumber: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '12px',
  },
  orderValue: {
    fontSize: '14px',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  orderAmount: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  itemsSection: {
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
  summarySection: {
    marginBottom: '24px',
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
  summaryDivider: {
    borderColor: '#E0D4BC',
    margin: '12px 0',
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
  deliverySection: {
    marginBottom: '24px',
  },
  pickupSection: {
    marginBottom: '24px',
  },
  deliveryText: {
    fontSize: '14px',
    color: '#1A1A1A',
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