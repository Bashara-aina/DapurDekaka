import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';

interface PointsExpiringEmailProps {
  customerName: string;
  customerEmail: string;
  totalExpiringPoints: number;
  totalExpiringValue: number;
  expiringPointsList: Array<{
    pointsAmount: number;
    expiresAt: string;
    description: string;
  }>;
}

export function PointsExpiringEmail({
  customerName,
  customerEmail,
  totalExpiringPoints,
  totalExpiringValue,
  expiringPointsList,
}: PointsExpiringEmailProps) {
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
        {totalExpiringPoints.toLocaleString('id-ID')} poin kamu akan hangus dalam 30 hari — Dapur Dekaka
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Peringatan Poin Akan Hangus</Text>
            <Text style={styles.headerSubtitle}>
              Halo {customerName}, beberapa poin kamu akan segera hangus!
            </Text>
          </Section>

          {/* Expiring Banner */}
          <Section style={styles.expiringBanner}>
            <Text style={styles.expiringLabel}>Total Poin Akan Hangus</Text>
            <Text style={styles.expiringPoints}>
              {totalExpiringPoints.toLocaleString('id-ID')} poin
            </Text>
            <Text style={styles.expiringValue}>
              setara dengan {formatPrice(totalExpiringValue)}
            </Text>
          </Section>

          {/* Expiring Points List */}
          <Section style={styles.listSection}>
            <Text style={styles.sectionTitle}>Detail Poin yang Akan Hangus</Text>
            {expiringPointsList.map((item, index) => (
              <Row key={index} style={styles.listRow}>
                <td style={styles.listLeft}>
                  <Text style={styles.listDesc}>{item.description}</Text>
                  <Text style={styles.listExpiry}>
                    Kadaluarsa: {item.expiresAt}
                  </Text>
                </td>
                <td style={styles.listRight}>
                  <Text style={styles.listPoints}>-{item.pointsAmount.toLocaleString('id-ID')}</Text>
                </td>
              </Row>
            ))}
          </Section>

          {/* CTA */}
          <Section style={styles.ctaSection}>
            <Text style={styles.ctaTitle}>
              Jangan sampai poin kamu hangus!
            </Text>
            <Text style={styles.ctaSubtitle}>
              Gunakan poin kamu sekarang untuk mendapatkan potongan harga.
              100 poin = Rp 1.000.
            </Text>
            <Button
              href={`${process.env.NEXT_PUBLIC_APP_URL}/products`}
              style={styles.ctaButton}
            >
              Belanja Sekarang
            </Button>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Terima kasih, Dapur Dekaka 德卡
            </Text>
            <Text style={styles.footerNote}>
              Jika kamu tidak menggunakan poin ini, poin akan hangus sesuai tanggal yang tertera.
              Pesanan tidak dapat dibatalkan setelah menggunakan poin.
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
  expiringBanner: {
    backgroundColor: '#DC2626',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  expiringLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '4px',
  },
  expiringPoints: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  expiringValue: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
  },
  listSection: {
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
  listRow: {
    padding: '12px 0',
    borderBottom: '1px solid #F0EAD6',
  },
  listLeft: {
    paddingRight: '16px',
  },
  listRight: {
    textAlign: 'right' as const,
  },
  listDesc: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: '2px',
  },
  listExpiry: {
    fontSize: '12px',
    color: '#DC2626',
  },
  listPoints: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#DC2626',
  },
  ctaSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  ctaTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '8px',
  },
  ctaSubtitle: {
    fontSize: '13px',
    color: '#6B6B6B',
    marginBottom: '16px',
  },
  ctaButton: {
    backgroundColor: '#C8102E',
    color: '#FFFFFF',
    padding: '12px 32px',
    borderRadius: '8px',
    fontSize: '14px',
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
  footerNote: {
    fontSize: '11px',
    color: '#8A8A8A',
    marginBottom: '8px',
    lineHeight: '1.5',
  },
  footerLink: {
    fontSize: '12px',
    color: '#C8102E',
  },
} as const;