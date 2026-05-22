export const dynamic = 'force-dynamic';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Package, Gift, MapPin, ChevronRight, ShoppingBag, User } from 'lucide-react';
import { count, eq, and } from 'drizzle-orm';
import { orders, addresses } from '@/lib/db/schema';
import { POINTS_VALUE_IDR } from '@/lib/constants/points';
import { formatIDR } from '@/lib/utils/format-currency';
import { users } from '@/lib/db/schema';

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, session.user.id! as string),
  });

  if (!user) {
    redirect('/login');
  }

  const recentOrders = await db.query.orders.findMany({
    where: (orders, { eq, and }) => and(
      eq(orders.userId, session.user.id!),
    ),
    with: {
      items: true,
    },
    orderBy: (orders, { desc }) => [desc(orders.createdAt)],
    limit: 5,
  });

  const [totalOrderCountResult] = await db.select({ count: count() }).from(orders)
    .where(eq(orders.userId, session.user.id!));
  const totalOrderCount = totalOrderCountResult?.count ?? 0;

  const [pendingCountResult] = await db.select({ count: count() }).from(orders)
    .where(and(eq(orders.userId, session.user.id!), eq(orders.status, 'pending_payment')));
  const pendingCount = pendingCountResult?.count ?? 0;

  const pointsHistory = await db.query.pointsHistory.findMany({
    where: (ph, { eq }) => eq(ph.userId, session.user.id!),
    orderBy: (ph, { desc }) => [desc(ph.createdAt)],
    limit: 10,
  });

  const [countResult] = await db.select({ count: count() }).from(addresses).where(eq(addresses.userId, session.user.id!));
  const addressCount = countResult?.count ?? 0;


  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Halo, {user.name}!
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          Selamat datang di akun Dapur Dekaka kamu
        </p>
      </div>

      {/* Profile Completion Banner */}
      {!user.phone && (
        <Link
          href="/account/profile?onboarding=true"
          className="block bg-amber-50 border border-amber-200 rounded-card p-4 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <p className="font-medium text-text-primary">Lengkapi Profil Kamu</p>
              <p className="text-sm text-text-secondary mt-1">
                Tambahkan nomor HP untuk menerima notifikasi pesanan dan checkout lebih cepat.
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/account/orders" className="bg-white rounded-card shadow-card p-4 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-red-muted rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{totalOrderCount || 0}</p>
              <p className="text-xs text-text-secondary">Total Pesanan</p>
            </div>
          </div>
        </Link>

        <Link href="/account/points" className="bg-white rounded-card shadow-card p-4 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-red-muted rounded-lg flex items-center justify-center">
              <Gift className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{user.pointsBalance || 0}</p>
              <p className="text-xs text-text-secondary">Poin Saya</p>
            </div>
          </div>
        </Link>

        <Link href="/account/addresses" className="bg-white rounded-card shadow-card p-4 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-red-muted rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{addressCount || 0}</p>
              <p className="text-xs text-text-secondary">Alamat Tersimpan</p>
            </div>
          </div>
        </Link>

        <Link href="/account/orders?status=pending_payment" className="bg-white rounded-card shadow-card p-4 hover:shadow-card-hover transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-red-muted rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">
                {pendingCount || 0}
              </p>
              <p className="text-xs text-text-secondary">Menunggu Pembayaran</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-text-primary">Pesanan Terbaru</h2>
          <Link
            href="/account/orders"
            className="flex items-center gap-1 text-sm text-brand-red hover:underline"
          >
            Lihat Semua
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-text-disabled" />
            </div>
            <p className="text-text-secondary">Belum ada pesanan</p>
            <Link
              href="/products"
              className="inline-block mt-4 text-brand-red font-medium hover:underline"
            >
              Mulai Belanja
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.orderNumber}`}
                className="block p-4 border border-brand-cream-dark rounded-lg hover:bg-brand-cream transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{order.orderNumber}</p>
                    <p className="text-sm text-text-secondary">
                      {new Date(order.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-brand-red">
                      {formatIDR(order.totalAmount)}
                    </p>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1
                      ${order.status === 'pending_payment' ? 'bg-warning-light text-warning' : ''}
                      ${order.status === 'paid' ? 'bg-info-light text-info' : ''}
                      ${order.status === 'processing' ? 'bg-purple-100 text-purple-700' : ''}
                      ${order.status === 'packed' ? 'bg-cyan-100 text-cyan-700' : ''}
                      ${order.status === 'shipped' ? 'bg-success-light text-success' : ''}
                      ${order.status === 'delivered' ? 'bg-success-light text-success' : ''}
                      ${order.status === 'cancelled' ? 'bg-gray-100 text-gray-600' : ''}
                    `}>
                      {order.status === 'pending_payment' && 'Menunggu'}
                      {order.status === 'paid' && 'Dibayar'}
                      {order.status === 'processing' && 'Diproses'}
                      {order.status === 'packed' && 'Dikemas'}
                      {order.status === 'shipped' && 'Dikirim'}
                      {order.status === 'delivered' && 'Selesai'}
                      {order.status === 'cancelled' && 'Dibatalkan'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Points Alert */}
      {user.pointsBalance && user.pointsBalance > 0 && (
        <div className="bg-gradient-to-r from-brand-red to-brand-red-dark rounded-card p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Poin Kamu</p>
              <p className="text-3xl font-bold">{user.pointsBalance} poin</p>
              <p className="text-xs opacity-70 mt-1">
                {formatIDR(user.pointsBalance * POINTS_VALUE_IDR)} bisa ditukarkan
              </p>
            </div>
            <Link
              href="/account/points"
              className="px-4 py-2 bg-white text-brand-red font-bold rounded-lg hover:bg-brand-cream transition-colors"
            >
              Tukarkan
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}