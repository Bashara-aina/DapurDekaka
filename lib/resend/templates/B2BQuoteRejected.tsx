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

interface B2BQuoteRejectedEmailProps {
  quoteNumber: string;
  companyName: string;
}

export function B2BQuoteRejectedEmail({
  quoteNumber,
  companyName,
}: B2BQuoteRejectedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Penawaran #{quoteNumber} Tidak Dapat Diproses — Dapur Dekaka B2B
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡 — B2B</Text>
            <Text style={styles.headerTitle}>Penawaran Tidak Dapat Diproses</Text>
            <Text style={styles.headerSubtitle}>
              Halo {companyName}, sayangnya penawaran #{quoteNumber} tidak dapat kami proses saat ini.
            </Text>
          </Section>

          {/* Rejection Banner */}
          <Section style={styles.rejectionBanner}>
            <Text style={styles.rejectedIcon}>✕</Text>
            <Text style={styles.rejectedTitle}>Penawaran Tidak Disetujui</Text>
            <Text style={styles.rejectedSubtitle}>
              Nomor Penawaran: {quoteNumber}
            </Text>
          </Section>

          {/* Next Steps */}
          <Section style={styles.nextStepsSection}>
            <Text style={styles.nextStepsTitle}>Apa Selanjutnya?</Text>
            <Text style={styles.nextStepsText}>
              Jika Anda memiliki pertanyaan mengenai keputusan ini atau ingin mengajukan
              penawaran baru, silakan hubungi tim kami melalui WhatsApp.
              Kami siap membantu Anda kapan saja.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Dapur Dekaka — 德卡 B2B
            </Text>
            <Text style={styles.footerSubtext}>
              Jl. Sinom V no. 7, Turangga, Bandung
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
    fontSize: '20px',
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
  rejectionBanner: {
    backgroundColor: '#DC2626',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  rejectedIcon: {
    fontSize: '32px',
    color: '#FFFFFF',
    marginBottom: '8px',
  },
  rejectedTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  rejectedSubtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
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
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '4px',
  },
  footerSubtext: {
    fontSize: '12px',
    color: '#ABABAB',
    marginBottom: '8px',
  },
  footerLink: {
    fontSize: '12px',
    color: '#C8102E',
  },
} as const;