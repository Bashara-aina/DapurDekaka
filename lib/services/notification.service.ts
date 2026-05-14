import { Resend } from 'resend';
import { db } from '@/lib/db';
import { orders, orderItems, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order || !order.userId) return;

  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, order.userId))
    .limit(1);

  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  const firstName = user?.name?.split(' ')[0] ?? 'Pelanggan';

  await resend.emails.send({
    from: 'Dapur Dekaka <pesanan@dapurdekaka.com>',
    to: user?.email ?? '',
    subject: `Pesanan ${order.orderNumber} Dikonfirmasi`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #C8102E; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #F0EAD6; margin: 0; font-size: 24px;">Dapur Dekaka</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px;">Hai <strong>${firstName}</strong></p>
          <p style="color: #6B6B6B;">Pesanan kamu sudah kami terima dan sedang kami proses dengan penuh cinta. Kamu akan mendapat notifikasi saat pesanan dikirim.</p>
          <p style="font-size: 14px; color: #6B6B6B;">Detail pesanan: <strong>${order.orderNumber}</strong></p>
          <p style="font-size: 14px;">Total: <strong style="color: #C8102E;">Rp ${order.totalAmount.toLocaleString('id-ID')}</strong></p>
        </div>
      </div>
    `,
  });
}

export async function sendShippingEmail(orderId: string, trackingNumber: string): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order || !order.userId) return;

  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, order.userId))
    .limit(1);

  const firstName = user?.name?.split(' ')[0] ?? 'Pelanggan';

  await resend.emails.send({
    from: 'Dapur Dekaka <pesanan@dapurdekaka.com>',
    to: user?.email ?? '',
    subject: `Pesanan ${order.orderNumber} Sedang Dikirim`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #C8102E; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #F0EAD6; margin: 0; font-size: 24px;">Dapur Dekaka</h1>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 12px 12px;">
          <p style="font-size: 16px;">Hai <strong>${firstName}</strong></p>
          <p>Pesanan kamu sedang dalam perjalanan!</p>
          <p style="font-size: 14px;">No. Resi: <strong>${trackingNumber}</strong></p>
          <p style="font-size: 14px;">Kurir: <strong>${order.courierName}</strong></p>
        </div>
      </div>
    `,
  });
}
