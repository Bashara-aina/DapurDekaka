import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

interface OrderDeliveredEmailProps {
  orderNumber: string;
  customerName: string;
  pointsEarned: number;
  items: Array<{
    name: string;
    variant: string;
    quantity: number;
  }>;
  totalAmount: number;
  deliveredAt: string;
}

export function OrderDeliveredEmail({
  orderNumber,
  customerName,
  pointsEarned,
  items,
  totalAmount,
  deliveredAt,
}: OrderDeliveredEmailProps) {
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
        Pesanan {orderNumber} sudah diterima! Terima kasih — Dapur Dekaka 德卡
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Pesanan Diterima!</Text>
            <Text style={styles.headerSubtitle}>
              Terima kasih, {customerName}! Pesanan {orderNumber} sudah diterima.
            </Text>
          </Section>

          {/* Success Banner */}
          <Section style={styles.successBanner}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.successTitle}>Pesanan Selesai</Text>
            <Text style={styles.successSubtitle}>
              Diterima pada {deliveredAt}
            </Text>
          </Section>

          {/* Points Earned */}
          {pointsEarned > 0 && (
            <Section style={styles.pointsSection}>
              <Text style={styles.pointsTitle}>Poinku Bertambah! 🎉</Text>
              <Text style={styles.pointsValue}>+{pointsEarned.toLocaleString('id-ID')} poin</Text>
              <Text style={styles.pointsSubtitle}>
                1 poin = Rp 1.000 untuk potongan harga di pembelian berikutnya.
                Poin berlaku 365 hari.
              </Text>
              <Link
                href={`${process.env.NEXT_PUBLIC_APP_URL}/account/points`}
                style={styles.pointsButton}
              >
                Lihat Riwayat Poin
              </Link>
            </Section>
          )}

          {/* Order Summary */}
          <Section style={styles.summarySection}>
            <Text style={styles.sectionTitle}>Ringkasan Belanja</Text>
            {items.map((item, index) => (
              <Row key={index} style={styles.itemRow}>
                <td style={styles.itemNameCell}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemVariant}>
                    {item.variant} × {item.quantity}
                  </Text>
                </td>
              </Row>
            ))}
            <Hr style={styles.itemDivider} />
            <Row style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Belanja</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </Row>
          </Section>

          {/* Review Request */}
          <Section style={styles.reviewSection}>
            <Text style={styles.reviewTitle}>
             Bagaimana rasanya produk kami?
            </Text>
            <Text style={styles.reviewSubtitle}>
              Kami ingin tahu pendapatmu! Klik untuk memberikan review.
            </Text>
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL}/account/orders/${orderNumber}`}
              style={styles.reviewButton}
            >
              Beri Review
            </Link>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Terima kasih sudah mempercayai Dapur Dekaka!
            </Text>
            <Text style={styles.footerSubtext}>
             若有疑问，请通过WhatsApp联系 kami. Selamat menikmati!
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
  successBanner: {
    backgroundColor: '#16A34A',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  checkmark: {
    fontSize: '32px',
    color: '#FFFFFF',
    marginBottom: '8px',
  },
  successTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  successSubtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
  },
  pointsSection: {
    backgroundColor: '#FFF9E6',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  pointsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#C9A84C',
    marginBottom: '8px',
  },
  pointsValue: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#C9A84C',
    marginBottom: '8px',
  },
  pointsSubtitle: {
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '12px',
  },
  pointsButton: {
    backgroundColor: '#C9A84C',
    color: '#FFFFFF',
    padding: '8px 24px',
    borderRadius: '6px',
    fontSize: '12px',
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
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    textAlign: 'right' as const,
  },
  reviewSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  reviewTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '8px',
  },
  reviewSubtitle: {
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '12px',
  },
  reviewButton: {
    backgroundColor: '#C8102E',
    color: '#FFFFFF',
    padding: '10px 24px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 'bold',
    textDecoration: 'none',
    display: 'inline-block',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid #E0D4BC',
  },
  footerText: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '4px',
  },
  footerSubtext: {
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '8px',
  },
  footerLink: {
    fontSize: '12px',
    color: '#C8102E',
  },
} as const;