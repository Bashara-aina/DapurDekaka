import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface PasswordResetEmailProps {
  resetUrl: string;
  userName: string;
}

export function PasswordResetEmail({
  resetUrl,
  userName,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset Password — Dapur Dekaka 德卡</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Reset Password</Text>
            <Text style={styles.headerSubtitle}>
              Halo {userName},
            </Text>
          </Section>

          {/* Content */}
          <Section style={styles.contentSection}>
            <Text style={styles.bodyText}>
              Kami menerima permintaan untuk reset password akun Dapur Dekaka kamu.
              Klik tombol di bawah untuk membuat password baru:
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={styles.ctaSection}>
            <Button href={resetUrl} style={styles.ctaButton}>
              Reset Password
            </Button>
          </Section>

          {/* Expiry Notice */}
          <Section style={styles.expirySection}>
            <Text style={styles.expiryText}>
              Link ini berlaku selama 1 jam. Jika kamu tidak meminta reset password,
              abaikan email ini.
            </Text>
          </Section>

          {/* Divider */}
          <Section style={styles.divider} />

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Dapur Dekaka — 德卡
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
  contentSection: {
    marginBottom: '24px',
  },
  bodyText: {
    fontSize: '14px',
    color: '#6B6B6B',
    lineHeight: '1.6',
  },
  ctaSection: {
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  ctaButton: {
    backgroundColor: '#C8102E',
    color: '#FFFFFF',
    padding: '14px 32px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '600',
    textDecoration: 'none',
    display: 'inline-block',
  },
  expirySection: {
    marginBottom: '24px',
  },
  expiryText: {
    fontSize: '14px',
    color: '#6B6B6B',
    lineHeight: '1.6',
    textAlign: 'center' as const,
  },
  divider: {
    borderTop: '1px solid #E0D4BC',
    margin: '24px 0',
  },
  footer: {
    textAlign: 'center' as const,
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