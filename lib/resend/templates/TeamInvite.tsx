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

interface TeamInviteEmailProps {
  inviteUrl: string;
  inviterName: string;
  role: string;
}

export function TeamInviteEmail({
  inviteUrl,
  inviterName,
  role,
}: TeamInviteEmailProps) {
  const roleDisplayNames: Record<string, string> = {
    warehouse: 'Warehouse Staff',
    owner: 'Owner',
    b2b: 'B2B Manager',
    customer: 'Customer',
  };

  return (
    <Html>
      <Head />
      <Preview>Undangan Tim — Dapur Dekaka 德卡</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡</Text>
            <Text style={styles.headerTitle}>Anda Diundang untuk Bergabung!</Text>
            <Text style={styles.headerSubtitle}>
              {inviterName} mengundang Anda sebagai <strong>{roleDisplayNames[role] || role}</strong> di Dapur Dekaka.
            </Text>
          </Section>

          {/* Invitation Banner */}
          <Section style={styles.inviteBanner}>
            <Text style={styles.inviteIcon}>👋</Text>
            <Text style={styles.inviteTitle}>Bergabung dengan Tim</Text>
            <Text style={styles.inviteSubtitle}>
              Klik tombol di bawah untuk set password dan akses akun Anda.
            </Text>
          </Section>

          {/* CTA Button */}
          <Section style={styles.ctaSection}>
            <Button href={inviteUrl} style={styles.ctaButton}>
              Set Password
            </Button>
          </Section>

          {/* Expiry Notice */}
          <Section style={styles.expirySection}>
            <Text style={styles.expiryText}>
              Link undangan berlaku selama 7 hari. Jika link sudah expired,
              silakan hubungi admin untuk invitation baru.
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
  inviteBanner: {
    backgroundColor: '#1A1A1A',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  inviteIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  inviteTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: '4px',
  },
  inviteSubtitle: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
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