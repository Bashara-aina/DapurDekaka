import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface PickupReadyEmailProps {
  orderNumber: string;
  customerName: string;
  pickupCode: string;
  pickupAddress: string;
  openingHours: string;
}

export function PickupReadyEmail({
  orderNumber,
  customerName,
  pickupCode,
  pickupAddress,
  openingHours,
}: PickupReadyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Pesanan {orderNumber} siap diambil — Dapur Dekaka</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Dapur Dekaka 德卡</Text>
          <Text style={styles.title}>Pesanan Siap Diambil!</Text>
          <Text style={styles.text}>Halo {customerName},</Text>
          <Text style={styles.text}>
            Pesanan {orderNumber} sudah siap diambil di toko kami.
          </Text>
          <Section style={styles.box}>
            <Text style={styles.label}>Kode Pickup</Text>
            <Text style={styles.code}>{pickupCode}</Text>
            <Text style={styles.label}>Alamat</Text>
            <Text style={styles.value}>{pickupAddress}</Text>
            <Text style={styles.label}>Jam Buka</Text>
            <Text style={styles.value}>{openingHours}</Text>
          </Section>
          <Button href={process.env.NEXT_PUBLIC_APP_URL} style={styles.button}>
            Kunjungi dapurdekaka.com
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: { backgroundColor: '#F0EAD6', fontFamily: 'Inter, sans-serif' },
  container: { backgroundColor: '#FFFFFF', padding: '32px', maxWidth: '600px', margin: '0 auto' },
  brand: { fontSize: '22px', fontWeight: 'bold', color: '#C8102E' },
  title: { fontSize: '20px', fontWeight: 'bold', color: '#1A1A1A' },
  text: { fontSize: '14px', color: '#4A4A4A', lineHeight: '1.6' },
  box: { backgroundColor: '#F8FAFC', borderRadius: '8px', padding: '16px', margin: '16px 0' },
  label: { fontSize: '12px', color: '#8A8A8A', marginBottom: '4px' },
  code: { fontSize: '24px', fontWeight: 'bold', color: '#C8102E', marginBottom: '12px' },
  value: { fontSize: '14px', color: '#1A1A1A', marginBottom: '12px' },
  button: {
    backgroundColor: '#C8102E',
    color: '#FFFFFF',
    padding: '12px 24px',
    borderRadius: '8px',
    fontWeight: 'bold',
  },
} as const;
