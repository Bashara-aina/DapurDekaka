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

interface PickupInvitationEmailProps {
  orderNumber: string;
  customerName: string;
  items: Array<{
    name: string;
    variant: string;
    quantity: number;
  }>;
  totalAmount: number;
  pickupCode: string;
  paidAt: string;
  pickupAddress: string;
  openingHours: string;
}

export function PickupInvitationEmail({
  orderNumber,
  customerName,
  items,
  totalAmount,
  pickupCode,
  paidAt,
  pickupAddress,
  openingHours,
}: PickupInvitationEmailProps) {
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
        Pesanan {orderNumber} siap diambil! — Dapur Dekaka 德卡
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Pesanan Siap Diambil!</Text>
            <Text style={styles.headerSubtitle}>
              Terima kasih, {customerName}. Pembayaranmu telah kami terima.
            </Text>
          </Section>

          {/* Pickup Code Banner */}
          <Section style={styles.pickupBanner}>
            <Text style={styles.pickupLabel}>Kode Pengambilan</Text>
            <Text style={styles.pickupCode}>{pickupCode}</Text>
            <Text style={styles.pickupHint}>
              Tunjukkan kode ini ke staff toko saat mengambil pesanan
            </Text>
          </Section>

          {/* Order Info */}
          <Section style={styles.orderInfo}>
            <Row style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nomor Pesanan</Text>
              <Text style={styles.infoValue}>{orderNumber}</Text>
            </Row>
            <Row style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tanggal Pembayaran</Text>
              <Text style={styles.infoValue}>{paidAt}</Text>
            </Row>
            <Row style={styles.infoRow}>
              <Text style={styles.infoLabel}>Total Pembayaran</Text>
              <Text style={styles.infoAmount}>{formatPrice(totalAmount)}</Text>
            </Row>
          </Section>

          {/* Items Summary */}
          <Section style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Item yang Diambil</Text>
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
          </Section>

          {/* Pickup Location */}
          <Section style={styles.locationSection}>
            <Text style={styles.sectionTitle}>Lokasi Pengambilan</Text>
            <Text style={styles.addressText}>{pickupAddress}</Text>
            <Text style={styles.hoursText}>
              <strong>Jam Operasional:</strong> {openingHours}
            </Text>
          </Section>

          {/* Important Notes */}
          <Section style={styles.notesSection}>
            <Text style={styles.notesTitle}>Catatan Penting</Text>
            <Text style={styles.notesText}>
              • Mohon bawa kode pengambilan atau tunjukkan email ini{'\n'}
              • Pesanan akan kami simpan selama 7 hari kerja{'\n'}
              •若有疑问，请通过 WhatsApp 联系 kami
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Terima kasih sudah berbelanja di Dapur Dekaka!
            </Text>
            <Text style={styles.footerSubtext}>
              Selamat menikmati! 🎉
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
  pickupBanner: {
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  pickupLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '4px',
    textTransform: 'uppercase' as const,
  },
  pickupCode: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#C9A84C',
    marginBottom: '8px',
    letterSpacing: '4px',
  },
  pickupHint: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.6)',
  },
  orderInfo: {
    backgroundColor: '#F8F8F8',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  infoRow: {
    padding: '8px 0',
    borderBottom: '1px solid #E0D4BC',
  },
  infoLabel: {
    fontSize: '12px',
    color: '#6B6B6B',
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1A1A1A',
  },
  infoAmount: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#C8102E',
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
  locationSection: {
    backgroundColor: '#FFF9E6',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  addressText: {
    fontSize: '14px',
    color: '#1A1A1A',
    lineHeight: '1.6',
    marginBottom: '12px',
  },
  hoursText: {
    fontSize: '14px',
    color: '#1A1A1A',
  },
  notesSection: {
    backgroundColor: '#FEF2F2',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  notesTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '8px',
  },
  notesText: {
    fontSize: '13px',
    color: '#6B6B6B',
    lineHeight: '1.8',
    whiteSpace: 'pre-line' as const,
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
    fontSize: '14px',
    color: '#C9A84C',
    marginBottom: '8px',
  },
  footerLink: {
    fontSize: '12px',
    color: '#C8102E',
  },
} as const;