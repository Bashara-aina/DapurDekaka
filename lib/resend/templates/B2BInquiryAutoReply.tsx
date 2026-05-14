import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface B2BInquiryAutoReplyEmailProps {
  companyName: string;
  picName: string;
  inquiryId: string;
}

export function B2BInquiryAutoReplyEmail({
  companyName,
  picName,
  inquiryId,
}: B2BInquiryAutoReplyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Kami telah menerima inquiry Anda — Dapur Dekaka 德卡
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>
              Terima kasih, {picName}!
            </Text>
            <Text style={styles.headerSubtitle}>
              Inquiry Anda telah kami terima dan sedang dalam proses review.
            </Text>
          </Section>

          {/* Confirmation Banner */}
          <Section style={styles.confirmBanner}>
            <Text style={styles.confirmIcon}>✓</Text>
            <Text style={styles.confirmTitle}>Inquiry Diterima</Text>
            <Text style={styles.confirmSubtitle}>
              ID: {inquiryId.slice(0, 8)}
            </Text>
          </Section>

          {/* Greeting */}
          <Section style={styles.greetingSection}>
            <Text style={styles.greetingText}>
              Halo {picName} dari {companyName},
            </Text>
            <Text style={styles.greetingText}>
              Terima kasih telah menghubungi Dapur Dekaka! Kami telah menerima
              inquiry B2B Anda dan tim kami akan mereview dalam{' '}
              <strong>24-48 jam kerja</strong>.
            </Text>
          </Section>

          {/* What to Expect */}
          <Section style={styles.expectSection}>
            <Text style={styles.expectTitle}>Apa Selanjutnya?</Text>
            <Text style={styles.expectText}>
              1. Tim kami akan menghubungi Anda via email atau WhatsApp{'\n'}
              2. Kami akan mendiskusikan kebutuhan produk dan volume Anda{'\n'}
              3. Anda akan menerima penawaran harga khusus B2B
            </Text>
          </Section>

          {/* Contact Info */}
          <Section style={styles.contactSection}>
            <Text style={styles.contactTitle}>Kebutuhan Segera?</Text>
            <Text style={styles.contactText}>
              若有疑问，请通过 WhatsApp langsung hubungi kami:
            </Text>
            <Link href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`} style={styles.contactLink}>
              {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}
            </Link>
          </Section>

          {/* Closing */}
          <Section style={styles.closingSection}>
            <Text style={styles.closingText}>
              Kami menantikan kesempatan untuk bekerja sama dengan {companyName}.
              Selamat menikmati produk frozen food berkualitas dari Dapur Dekaka!
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerBrand}>Dapur Dekaka 德卡</Text>
            <Text style={styles.footerText}>
              Cita Rasa Warisan, Kini di Rumahimu
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
  confirmBanner: {
    backgroundColor: '#16A34A',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  confirmIcon: {
    fontSize: '32px',
    color: '#FFFFFF',
    marginBottom: '8px',
  },
  confirmTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  confirmSubtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
  },
  greetingSection: {
    marginBottom: '24px',
  },
  greetingText: {
    fontSize: '14px',
    color: '#1A1A1A',
    lineHeight: '1.6',
    marginBottom: '12px',
  },
  expectSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
  },
  expectTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '12px',
  },
  expectText: {
    fontSize: '13px',
    color: '#6B6B6B',
    lineHeight: '1.8',
    whiteSpace: 'pre-line' as const,
  },
  contactSection: {
    backgroundColor: '#FFF9E6',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  contactTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '8px',
  },
  contactText: {
    fontSize: '13px',
    color: '#6B6B6B',
    marginBottom: '8px',
  },
  contactLink: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#C8102E',
    textDecoration: 'none',
  },
  closingSection: {
    marginBottom: '24px',
  },
  closingText: {
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
  footerBrand: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#C8102E',
    marginBottom: '4px',
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