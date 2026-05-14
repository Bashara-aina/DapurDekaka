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

interface B2BInquiryNotificationEmailProps {
  inquiryId: string;
  companyName: string;
  picName: string;
  picEmail: string;
  picPhone: string;
  companyType?: string;
  message: string;
  estimatedVolume?: string;
  submittedAt: string;
}

export function B2BInquiryNotificationEmail({
  inquiryId,
  companyName,
  picName,
  picEmail,
  picPhone,
  companyType,
  message,
  estimatedVolume,
  submittedAt,
}: B2BInquiryNotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Inquiry B2B Baru: {companyName} — Dapur Dekaka 德卡
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Inquiry B2B Baru</Text>
            <Text style={styles.headerSubtitle}>
              Ada inquiry baru dari pelanggan B2B yang memerlukan tindak lanjut.
            </Text>
          </Section>

          {/* Alert Banner */}
          <Section style={styles.alertBanner}>
            <Text style={styles.alertIcon}>📋</Text>
            <Text style={styles.alertTitle}>Inquiry Baru #{inquiryId.slice(0, 8)}</Text>
            <Text style={styles.alertSubtitle}>
              Submitted: {submittedAt}
            </Text>
          </Section>

          {/* Company Details */}
          <Section style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Informasi Perusahaan</Text>
            <Row style={styles.detailRow}>
              <Text style={styles.detailLabel}>Perusahaan</Text>
              <Text style={styles.detailValue}>{companyName}</Text>
            </Row>
            {companyType && (
              <Row style={styles.detailRow}>
                <Text style={styles.detailLabel}>Jenis Bisnis</Text>
                <Text style={styles.detailValue}>{companyType}</Text>
              </Row>
            )}
            {estimatedVolume && (
              <Row style={styles.detailRow}>
                <Text style={styles.detailLabel}>Estimasi Volume</Text>
                <Text style={styles.detailValue}>{estimatedVolume}</Text>
              </Row>
            )}
          </Section>

          {/* Contact Details */}
          <Section style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Informasi Kontak</Text>
            <Row style={styles.detailRow}>
              <Text style={styles.detailLabel}>Nama PIC</Text>
              <Text style={styles.detailValue}>{picName}</Text>
            </Row>
            <Row style={styles.detailRow}>
              <Text style={styles.detailLabel}>Email</Text>
              <Link href={`mailto:${picEmail}`} style={styles.detailLink}>
                {picEmail}
              </Link>
            </Row>
            <Row style={styles.detailRow}>
              <Text style={styles.detailLabel}>WhatsApp</Text>
              <Link href={`https://wa.me/${picPhone.replace(/[^0-9]/g, '')}`} style={styles.detailLink}>
                {picPhone}
              </Link>
            </Row>
          </Section>

          {/* Message */}
          <Section style={styles.messageSection}>
            <Text style={styles.sectionTitle}>Pesan</Text>
            <Text style={styles.messageText}>{message}</Text>
          </Section>

          {/* Action Button */}
          <Section style={styles.actionSection}>
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL}/admin/b2b-inquiries/${inquiryId}`}
              style={styles.actionButton}
            >
              Lihat & Tindak Lanjuti
            </Link>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Email ini dikirim secara otomatis dari sistem Dapur Dekaka.
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
  alertBanner: {
    backgroundColor: '#C8102E',
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '24px',
  },
  alertIcon: {
    fontSize: '24px',
    marginBottom: '8px',
  },
  alertTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  alertSubtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
  },
  detailsSection: {
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
  detailRow: {
    padding: '8px 0',
    borderBottom: '1px solid #F0EAD6',
  },
  detailLabel: {
    fontSize: '12px',
    color: '#6B6B6B',
    width: '120px',
  },
  detailValue: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1A1A1A',
  },
  detailLink: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#C8102E',
    textDecoration: 'underline',
  },
  messageSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  messageText: {
    fontSize: '14px',
    color: '#1A1A1A',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap' as const,
  },
  actionSection: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  actionButton: {
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
    fontSize: '12px',
    color: '#6B6B6B',
    marginBottom: '8px',
  },
  footerLink: {
    fontSize: '12px',
    color: '#C8102E',
  },
} as const;