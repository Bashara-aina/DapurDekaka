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

interface B2BQuoteApprovedEmailProps {
  quoteNumber: string;
  companyName: string;
  items: Array<{
    name: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  validUntil: string;
}

export function B2BQuoteApprovedEmail({
  quoteNumber,
  companyName,
  items,
  subtotal,
  discountAmount,
  totalAmount,
  validUntil,
}: B2BQuoteApprovedEmailProps) {
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
        Penawaran #{quoteNumber} Telah Disetujui — Dapur Dekaka B2B
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.headerSection}>
            <Text style={styles.brandName}>Dapur Dekaka 德卡 — B2B</Text>
            <Text style={styles.headerTitle}>Penawaran Telah Disetujui!</Text>
            <Text style={styles.headerSubtitle}>
              Selamat, {companyName}. Penawaran #{quoteNumber} telah disetujui.
            </Text>
          </Section>

          {/* Approval Banner */}
          <Section style={styles.approvalBanner}>
            <Text style={styles.approvedIcon}>✓</Text>
            <Text style={styles.approvedTitle}>Penawaran Disetujui</Text>
            <Text style={styles.approvedSubtitle}>
              Nomor Penawaran: {quoteNumber}
            </Text>
          </Section>

          {/* Valid Until */}
          {validUntil && (
            <Section style={styles.validUntilSection}>
              <Text style={styles.validUntilText}>
                Penawaran berlaku hingga: <strong>{validUntil}</strong>
              </Text>
            </Section>
          )}

          {/* Items Table */}
          <Section style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Detail Penawaran</Text>
            {items.map((item, index) => (
              <Row key={index} style={styles.itemRow}>
                <td style={styles.itemNameCell}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemVariant}>
                    {item.variant} × {item.quantity}
                  </Text>
                </td>
                <td style={styles.itemPriceCell}>
                  <Text style={styles.itemPrice}>{formatPrice(item.subtotal)}</Text>
                </td>
              </Row>
            ))}
          </Section>

          {/* Summary */}
          <Section style={styles.summarySection}>
            <Row style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
            </Row>
            {discountAmount > 0 && (
              <Row style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Diskon</Text>
                <Text style={styles.summaryDiscount}>-{formatPrice(discountAmount)}</Text>
              </Row>
            )}
            <Row style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(totalAmount)}</Text>
            </Row>
          </Section>

          {/* Next Steps */}
          <Section style={styles.nextStepsSection}>
            <Text style={styles.nextStepsTitle}>Langkah Selanjutnya</Text>
            <Text style={styles.nextStepsText}>
              Tim kami akan menghubungi Anda untuk koordinasi pembayaran dan pengiriman.
             若有疑问，请通过 WhatsApp 联系 kami.
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
  validUntilSection: {
    backgroundColor: '#FEF3C7',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  },
  validUntilText: {
    fontSize: '14px',
    color: '#92400E',
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
    padding: '12px 0',
    borderBottom: '1px solid #F0EAD6',
  },
  itemNameCell: {
    paddingRight: '16px',
  },
  itemPriceCell: {
    textAlign: 'right' as const,
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
  itemPrice: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#1A1A1A',
  },
  summarySection: {
    marginBottom: '24px',
  },
  summaryRow: {
    padding: '6px 0',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#6B6B6B',
  },
  summaryValue: {
    fontSize: '14px',
    color: '#1A1A1A',
    textAlign: 'right' as const,
  },
  summaryDiscount: {
    fontSize: '14px',
    color: '#16A34A',
    textAlign: 'right' as const,
  },
  totalLabel: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  totalValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#C8102E',
    textAlign: 'right' as const,
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