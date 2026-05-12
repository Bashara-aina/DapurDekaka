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

interface OrderShippedEmailProps {
  orderNumber: string;
  customerName: string;
  courierName: string;
  trackingNumber: string;
  trackingUrl: string;
  estimatedDays: string;
  items: Array<{
    name: string;
    variant: string;
    quantity: number;
  }>;
  totalAmount: number;
}

export function OrderShippedEmail({
  orderNumber,
  customerName,
  courierName,
  trackingNumber,
  trackingUrl,
  estimatedDays,
  items,
  totalAmount,
}: OrderShippedEmailProps) {
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
        Pesanan {orderNumber} sudah dikirim! — Dapur Dekaka 德卡
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Pesanan Kamu Sudah Dikirim!</Text>
            <Text style={styles.headerSubtitle}>
              Halo {customerName}, pesananmu sedang dalam perjalanan ke kamu.
            </Text>
          </Section>

          {/* Tracking Info Banner */}
          <Section style={styles.trackingBanner}>
            <Text style={styles.trackingLabel}>Kurir</Text>
            <Text style={styles.trackingValue}>{courierName}</Text>

            <Text style={styles.trackingLabel}>Nomor Resi</Text>
            <Text style={styles.trackingNumber}>{trackingNumber}</Text>

            {estimatedDays && (
              <>
                <Text style={styles.trackingLabel}>Estimasi Tiba</Text>
                <Text style={styles.trackingValue}>{estimatedDays}</Text>
              </>
            )}
          </Section>

          {/* Tracking Button */}
          <Section style={styles.buttonSection}>
            <Button
              href={trackingUrl}
              style={styles.trackingButton}
            >
              Lacak Pengiriman
            </Button>
          </Section>

          {/* Order Summary */}
          <Section style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Ringkasan Pesanan</Text>
            <Text style={styles.orderNumberText}>Order {orderNumber}</Text>

            {items.slice(0, 3).map((item, index) => (
              <Row key={index} style={styles.itemRow}>
                <td style={styles.itemNameCell}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemVariant}>
                    {item.variant} × {item.quantity}
                  </Text>
                </td>
              </Row>
            ))}
            {items.length > 3 && (
              <Text style={styles.moreItems}>
                + {items.length - 3} produk lainnya
              </Text>
            )}
            <Hr style={styles.itemDivider} />
            <Row style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Pembayaran</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </Row>
          </Section>

          {/* Delivery Note */}
          <Section style={styles.noteSection}>
            <Text style={styles.noteTitle}>Catatan Pengiriman</Text>
            <Text style={styles.noteText}>
              • Pastikan有人在收货地址签收包裹
              • 若为冷冻食品，请立即放入冰箱冷冻
              • 如有疑问，请通过WhatsApp联系 kami
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Terima kasih sudah berbelanja di Dapur Dekaka!
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
  trackingBanner: {
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '24px',
  },
  trackingLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '2px',
    marginTop: '12px',
  },
  trackingValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  trackingNumber: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#C9A84C',
    marginBottom: '4px',
  },
  buttonSection: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  trackingButton: {
    backgroundColor: '#C8102E',
    color: '#FFFFFF',
    padding: '12px 32px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    textDecoration: 'none',
    display: 'inline-block',
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
  orderNumberText: {
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '12px',
  },
  itemRow: {
    padding: '8px 0',
  },
  itemNameCell: {
    paddingRight: '16px',
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
  moreItems: {
    fontSize: '12px',
    color: '#6B6B6B',
    marginTop: '4px',
  },
  itemDivider: {
    borderColor: '#E0D4BC',
    margin: '12px 0',
  },
  totalRow: {
    padding: '4px 0',
  },
  totalLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#C8102E',
    textAlign: 'right' as const,
  },
  noteSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  noteTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '8px',
  },
  noteText: {
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