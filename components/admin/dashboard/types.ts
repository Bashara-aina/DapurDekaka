import type { OrderStatus } from '@/components/admin/orders/OrderStatusBadge';

export interface KPIData {
  revenueToday: number;
  revenueDelta: number;
  estimatedMargin: number;
  marginPercent: number;
  ordersToday: number;
  ordersDelta: number;
  newCustomersToday: number;
  guestCheckoutsToday: number;
  systemHealth?: {
    status: string;
    midtransWebhook: string;
    neonDB: string;
    lastCronCheck: string;
  };
}

export interface DashboardAlert {
  priority: number;
  message: string;
  link: string;
  dismissKey?: string;
}

export interface OrderFunnel {
  pending_payment: number;
  paid: number;
  processing: number;
  packed: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

export interface ActionQueueItem {
  priority: number;
  type: string;
  message: string;
  entityId: string;
  actionLabel: string;
  link: string;
}

export interface LiveOrder {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  createdAt: string;
  recipientName: string;
  totalAmount: number;
  isB2b: boolean;
  itemSummary: { name: string; quantity: number }[];
  totalItems: number;
}

export interface InventoryFlash {
  outOfStock: { count: number };
  lowStock: { count: number };
  topSelling: { variantId: string; productName: string; variantName: string; totalQuantity: number; totalRevenue: number }[];
  totalActiveVariants: number;
}

export interface DashboardAuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  ipAddress: string | null;
  user?: { name: string | null; email: string | null } | null;
}

export interface UserSummary {
  superadmin: number;
  owner: number;
  warehouse: number;
  b2b: number;
  customer: number;
  inactive: number;
  recentSignups: number;
}

export interface RevenueChartPoint {
  date: string;
  label: string;
  revenue: number;
  orders: number;
}

export const FUNNEL_STAGES: Array<{
  key: keyof OrderFunnel;
  label: string;
  color: string;
  href: string;
}> = [
  { key: 'pending_payment', label: 'Menunggu Bayar', color: 'bg-amber-500', href: '/admin/orders?status=pending_payment' },
  { key: 'paid', label: 'Dibayar', color: 'bg-blue-500', href: '/admin/orders?status=paid' },
  { key: 'processing', label: 'Diproses', color: 'bg-indigo-500', href: '/admin/orders?status=processing' },
  { key: 'packed', label: 'Dikemas', color: 'bg-purple-500', href: '/admin/orders?status=packed' },
  { key: 'shipped', label: 'Dikirim', color: 'bg-green-500', href: '/admin/orders?status=shipped' },
];

export const LIVE_FEED_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Semua' },
  { key: 'paid', label: 'Dibayar' },
  { key: 'processing', label: 'Diproses' },
  { key: 'packed', label: 'Dikemas' },
  { key: 'shipped', label: 'Dikirim' },
];

export const DATE_PRESETS: Array<{ label: string; getValue: () => { from: string; to: string } }> = [
  {
    label: 'Hari Ini',
    getValue: () => {
      const t = new Date();
      return { from: t.toISOString().split('T')[0]!, to: t.toISOString().split('T')[0]! };
    },
  },
  {
    label: 'Minggu Ini',
    getValue: () => {
      const t = new Date();
      const start = new Date(t);
      start.setDate(t.getDate() - 6);
      return { from: start.toISOString().split('T')[0]!, to: t.toISOString().split('T')[0]! };
    },
  },
  {
    label: 'Bulan Ini',
    getValue: () => {
      const t = new Date();
      const start = new Date(t.getFullYear(), t.getMonth(), 1);
      return { from: start.toISOString().split('T')[0]!, to: t.toISOString().split('T')[0]! };
    },
  },
  {
    label: '30 Hari',
    getValue: () => {
      const t = new Date();
      const start = new Date(t);
      start.setDate(t.getDate() - 29);
      return { from: start.toISOString().split('T')[0]!, to: t.toISOString().split('T')[0]! };
    },
  },
];

export function getRelativeTime(dateStr: string): string {
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Selamat Pagi';
  if (h < 15) return 'Selamat Siang';
  if (h < 18) return 'Selamat Sore';
  return 'Selamat Malam';
}

/**
 * Fetch wrapper that returns null instead of throwing, so a single failing
 * endpoint cannot take down the entire admin dashboard via the route's error.tsx.
 */
export async function safeFetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (!json?.success) return null;
    return json.data as T;
  } catch {
    return null;
  }
}