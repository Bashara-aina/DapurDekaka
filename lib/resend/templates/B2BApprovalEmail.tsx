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

interface B2BApprovalEmailProps {
  userName: string;
  companyName: string;
  loginUrl: string;
}

export function B2BApprovalEmail({
  userName,
  companyName,
  loginUrl,
}: B2BApprovalEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Akun B2B Dapur Dekaka Disetujui — Akses Penuh Sekarang</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡 — B2B</Text>
            <Text style={styles.headerTitle}>Selamat! Akun B2B Anda Disetujui</Text>
            <Text style={styles.headerSubtitle}>
              Hai {userName}, akun B2B untuk {companyName} telah disetujui. Sekarang
              Anda memiliki akses penuh ke portal B2B kami.
            </Text>
          </Section>

          {/* Approval Banner */}
          <Section style={styles.approvalBanner}>
            <Text style={styles.approvedIcon}>✓</Text>
            <Text style={styles.approvedTitle}>Akun Disetujui</Text>
            <Text style={styles.approvedSubtitle}>
              Anda sekarang dapat memesan produk B2B dengan harga khusus
            </Text>
          </Section>

          {/* Benefits */}
          <Section style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>Benefit Akun B2B:</Text>
            <Text style={styles.benefitItem}>• Harga khusus B2B yang lebih murah</Text>
            <Text style={styles.benefitItem}>• Minimum pemesanan yang fleksibel</Text>
            <Text style={styles.benefitItem}>• Akses ke produk eksklusif</Text>
            <Text style={styles.benefitItem}>• Konsultasi langsung via WhatsApp</Text>
          </Section>

          {/* CTA Button */}
          <Section style={styles.ctaSection}>
            <Link href={loginUrl} style={styles.ctaButton}>
              Masuk ke Portal B2B
            </Link>
          </Section>

          {/* Note */}
          <Section style={styles.noteSection}>
            <Text style={styles.noteText}>
             若有疑问，请通过 WhatsApp 联系 kami di nomor yang tertera di website.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>Dapur Dekaka — 德卡 B2B</Text>
            <Text style={styles.footerSubtext}>Jl. Sinom V no. 7, Turangga, Bandung</Text>
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
  approvalBanner: {
    backgroundColor: '#16A34A',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  approvedIcon: {
    fontSize: '32px',
    color: '#FFFFFF',
    marginBottom: '8px',
  },
  approvedTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  approvedSubtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
  },
  benefitsSection: {
    backgroundColor: '#F8F8F8',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
  },
  benefitsTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: '12px',
  },
  benefitItem: {
    fontSize: '13px',
    color: '#4A4A4A',
    marginBottom: '8px',
  },
  ctaSection: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  ctaButton: {
    display: 'inline-block',
    backgroundColor: '#C8102E',
    color: '#FFFFFF',
    padding: '14px 28px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 'bold',
    textDecoration: 'none',
  },
  noteSection: {
    textAlign: 'center' as const,
    marginBottom: '24px',
  },
  noteText: {
    fontSize: '13px',
    color: '#6B6B6B',
    fontStyle: 'italic',
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