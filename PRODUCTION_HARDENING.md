# PRODUCTION_HARDENING.md — Operations, Security & Production Readiness
# DapurDekaka.com
**Version:** 1.0
**Last Updated:** May 2026
**Author:** Bashara (Technical Lead)
**Purpose:** Cron jobs, auto-cancellation, rate limiting, security hardening, monitoring, database optimization, error recovery, and deployment ops. Cursor must implement these exactly to ensure the platform runs reliably in production.

---

## 1. CRON JOBS & SCHEDULED TASKS

### 1.1 Cron Job Architecture

On Vercel serverless, there is no persistent process for cron. Use **Vercel Cron Jobs** via `vercel.json` to trigger API routes on a schedule.

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/cancel-expired-orders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/expire-points",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/points-expiry-warning",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 1.2 Cron Security

All cron routes must verify they're called by Vercel's cron system, not by random HTTP requests.

```typescript
// lib/utils/cron-auth.ts
import { NextRequest } from 'next/server';

/**
 * Verify the request is from Vercel Cron.
 * Vercel sends a CRON_SECRET header in production.
 * In development, skip verification.
 */
export function verifyCronAuth(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not set — rejecting request');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}
```

### 1.3 Auto-Cancel Expired Orders

Orders in `pending_payment` that exceed their payment window must be auto-cancelled. This cron runs every 5 minutes.

```typescript
// app/api/cron/cancel-expired-orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { db } from '@/lib/db';
import { orders, pointsHistory, coupons, couponUsages, orderStatusHistory } from '@/lib/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { checkTransactionStatus } from '@/lib/midtrans/status';

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find orders that are pending_payment and past their expiry
    const expiredOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, 'pending_payment'),
        lt(orders.paymentExpiresAt, new Date())
      ),
      columns: {
        id: true,
        orderNumber: true,
        midtransOrderId: true,
        userId: true,
        couponId: true,
        pointsUsed: true,
      },
    });

    if (expiredOrders.length === 0) {
      return NextResponse.json({ cancelled: 0 });
    }

    let cancelledCount = 0;

    for (const order of expiredOrders) {
      try {
        // Double-check with Midtrans before cancelling
        // Payment might have been settled but webhook missed
        if (order.midtransOrderId) {
          try {
            const midtransStatus = await checkTransactionStatus(order.midtransOrderId);
            if (midtransStatus.transactionStatus === 'settlement' ||
                midtransStatus.transactionStatus === 'capture') {
              // Payment actually went through! Process it instead of cancelling.
              console.log(`[Cron] Order ${order.orderNumber} was actually paid — processing settlement`);
              // Trigger settlement processing
              const { handleSettlement } = await import('@/lib/services/order.service');
              await handleSettlement(order.orderNumber, {
                order_id: order.midtransOrderId,
                transaction_status: midtransStatus.transactionStatus,
                gross_amount: midtransStatus.grossAmount,
                payment_type: midtransStatus.paymentType,
                transaction_id: '',
                transaction_time: midtransStatus.transactionTime,
                status_code: '200',
                signature_key: '',
              });
              continue;
            }
          } catch (midtransError) {
            // Midtrans check failed — still safe to cancel
            // (order has been pending too long anyway)
            console.warn(`[Cron] Midtrans check failed for ${order.orderNumber}:`, midtransError);
          }
        }

        // Cancel the order in a transaction
        await db.transaction(async (tx) => {
          // 1. Update order status
          await tx.update(orders).set({
            status: 'cancelled',
            updatedAt: new Date(),
          }).where(eq(orders.id, order.id));

          // 2. Add status history entry
          await tx.insert(orderStatusHistory).values({
            orderId: order.id,
            fromStatus: 'pending_payment',
            toStatus: 'cancelled',
            changedBy: null, // system
            note: 'Auto-cancelled: payment expired',
          });

          // 3. Reverse points if used
          if (order.userId && order.pointsUsed > 0) {
            await tx.insert(pointsHistory).values({
              userId: order.userId,
              type: 'earn', // returning points = earn
              points: order.pointsUsed,
              description: `Pengembalian poin — pesanan ${order.orderNumber} dibatalkan`,
              relatedOrderId: order.id,
            });
          }

          // 4. Reverse coupon usage if used
          if (order.couponId) {
            await tx.delete(couponUsages).where(
              and(
                eq(couponUsages.orderId, order.id),
                eq(couponUsages.couponId, order.couponId)
              )
            );
            // Decrement used_count
            await tx.update(coupons).set({
              usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)`,
            }).where(eq(coupons.id, order.couponId));
          }
        });

        cancelledCount++;
        console.log(`[Cron] Auto-cancelled order ${order.orderNumber}`);

      } catch (orderError) {
        console.error(`[Cron] Failed to cancel order ${order.orderNumber}:`, orderError);
        // Continue processing other orders
      }
    }

    return NextResponse.json({
      cancelled: cancelledCount,
      total: expiredOrders.length,
    });

  } catch (error) {
    console.error('[Cron] cancel-expired-orders failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 1.4 Points Expiry Cron

Runs daily at 1:00 AM WIB (UTC+7 → 18:00 UTC previous day). Expires points older than 1 year.

```typescript
// app/api/cron/expire-points/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { db } from '@/lib/db';
import { pointsHistory } from '@/lib/db/schema';
import { eq, and, lt, gt, sql, isNull } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find all 'earn' type points that:
    // 1. Have expired (expiresAt < now)
    // 2. Haven't been marked as expired yet (no corresponding 'expire' record)
    // 3. Still have unredeemed balance
    //
    // Strategy: Group earn records by user, calculate unredeemed balance,
    // then create 'expire' records to zero them out.

    const expiredEarns = await db
      .select({
        id: pointsHistory.id,
        userId: pointsHistory.userId,
        points: pointsHistory.points,
        expiresAt: pointsHistory.expiresAt,
      })
      .from(pointsHistory)
      .where(
        and(
          eq(pointsHistory.type, 'earn'),
          lt(pointsHistory.expiresAt, now),
          eq(pointsHistory.isExpired, false) // custom flag to track expiry
        )
      );

    if (expiredEarns.length === 0) {
      return NextResponse.json({ expired: 0 });
    }

    // Group by user
    const userExpiries = new Map<string, { totalPoints: number; recordIds: string[] }>();
    for (const earn of expiredEarns) {
      const existing = userExpiries.get(earn.userId) || { totalPoints: 0, recordIds: [] };
      existing.totalPoints += earn.points;
      existing.recordIds.push(earn.id);
      userExpiries.set(earn.userId, existing);
    }

    let expiredCount = 0;

    for (const [userId, data] of userExpiries) {
      try {
        await db.transaction(async (tx) => {
          // 1. Create 'expire' record for total expired points
          await tx.insert(pointsHistory).values({
            userId,
            type: 'expire',
            points: -data.totalPoints, // negative = deduction
            description: `${data.totalPoints} poin kedaluwarsa`,
          });

          // 2. Mark original earn records as expired
          for (const recordId of data.recordIds) {
            await tx.update(pointsHistory).set({
              isExpired: true,
            }).where(eq(pointsHistory.id, recordId));
          }
        });

        expiredCount += data.recordIds.length;
      } catch (error) {
        console.error(`[Cron] Failed to expire points for user ${userId}:`, error);
      }
    }

    return NextResponse.json({
      expired: expiredCount,
      usersAffected: userExpiries.size,
    });

  } catch (error) {
    console.error('[Cron] expire-points failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 1.5 Points Expiry Warning Email

Runs daily at 9:00 AM WIB. Sends reminder emails for points expiring within 30 days.

```typescript
// app/api/cron/points-expiry-warning/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/utils/cron-auth';
import { db } from '@/lib/db';
import { pointsHistory, users } from '@/lib/db/schema';
import { eq, and, gt, lt, between } from 'drizzle-orm';
import { sendPointsExpiringEmail } from '@/lib/services/email.service';

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find earn records expiring in the next 30 days that haven't been warned about
    const expiringRecords = await db
      .select({
        userId: pointsHistory.userId,
        points: pointsHistory.points,
        expiresAt: pointsHistory.expiresAt,
      })
      .from(pointsHistory)
      .where(
        and(
          eq(pointsHistory.type, 'earn'),
          eq(pointsHistory.isExpired, false),
          eq(pointsHistory.expiryWarned, false),
          between(pointsHistory.expiresAt, now, thirtyDaysFromNow)
        )
      );

    if (expiringRecords.length === 0) {
      return NextResponse.json({ warned: 0 });
    }

    // Group by user
    const userWarnings = new Map<string, { totalPoints: number; earliestExpiry: Date }>();
    for (const record of expiringRecords) {
      const existing = userWarnings.get(record.userId);
      if (!existing) {
        userWarnings.set(record.userId, {
          totalPoints: record.points,
          earliestExpiry: record.expiresAt!,
        });
      } else {
        existing.totalPoints += record.points;
        if (record.expiresAt! < existing.earliestExpiry) {
          existing.earliestExpiry = record.expiresAt!;
        }
      }
    }

    let warnedCount = 0;

    for (const [userId, data] of userWarnings) {
      try {
        // Get user info
        const user = await db.query.users.findFirst({
          where: eq(users.id, userId),
          columns: { email: true, name: true },
        });

        if (!user?.email) continue;

        // Calculate total current points balance
        const balanceResult = await db
          .select({ total: sql<number>`COALESCE(SUM(${pointsHistory.points}), 0)` })
          .from(pointsHistory)
          .where(eq(pointsHistory.userId, userId));

        const totalPoints = balanceResult[0]?.total || 0;

        // Send warning email (fire-and-forget — won't throw)
        await sendPointsExpiringEmail(
          user.email,
          user.name || 'Pelanggan',
          data.totalPoints,
          data.earliestExpiry,
          totalPoints
        );

        // Mark records as warned
        await db.update(pointsHistory).set({
          expiryWarned: true,
        }).where(
          and(
            eq(pointsHistory.userId, userId),
            eq(pointsHistory.type, 'earn'),
            eq(pointsHistory.isExpired, false),
            between(pointsHistory.expiresAt, now, thirtyDaysFromNow)
          )
        );

        warnedCount++;
      } catch (error) {
        console.error(`[Cron] Failed to warn user ${userId}:`, error);
      }
    }

    return NextResponse.json({ warned: warnedCount });

  } catch (error) {
    console.error('[Cron] points-expiry-warning failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

---

## 2. RATE LIMITING

### 2.1 In-Memory Rate Limiter

Vercel serverless functions don't share memory between invocations, so a simple in-memory rate limiter won't persist across cold starts. For V1, use a lightweight approach with Vercel Edge Config or a per-request-IP check using a Map with TTL cleanup.

```typescript
// lib/utils/rate-limit.ts

interface RateLimitEntry {
  count: number;
  resetAt: number; // timestamp ms
}

// Module-level cache — shared within a single serverless instance
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
let lastCleanup = Date.now();
function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return; // cleanup every 60s max
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

interface RateLimitOptions {
  windowMs: number;    // time window in ms
  maxRequests: number; // max requests per window
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Simple in-memory rate limiter.
 * Limitation: each Vercel serverless instance has its own store,
 * so limits are per-instance, not global. This is fine for V1 —
 * it stops obvious abuse without needing Redis.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  cleanupStore();

  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.maxRequests - 1 };
  }

  if (existing.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.resetAt - now,
    };
  }

  existing.count++;
  return { allowed: true, remaining: options.maxRequests - existing.count };
}
```

### 2.2 Rate Limit Middleware Helper

```typescript
// lib/utils/rate-limit-middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from './rate-limit';

/**
 * Apply rate limiting to an API route handler.
 * Returns 429 Too Many Requests if limit exceeded.
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    windowMs: number;
    maxRequests: number;
    keyPrefix: string;
  }
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Use IP + prefix as rate limit key
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    const key = `${options.keyPrefix}:${ip}`;
    const result = checkRateLimit(key, {
      windowMs: options.windowMs,
      maxRequests: options.maxRequests,
    });

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
          code: 'RATE_LIMITED',
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((result.retryAfterMs || 60000) / 1000)),
          },
        }
      );
    }

    return handler(req);
  };
}
```

### 2.3 Rate Limits Per Endpoint

```typescript
// Apply in each route file using the wrapper:

// /api/auth/[...nextauth] → handled by NextAuth built-in
// But add protection to custom auth endpoints:

// /api/checkout/initiate — 5 req/min per IP
export const POST = withRateLimit(handleCheckoutInitiate, {
  windowMs: 60_000, maxRequests: 5, keyPrefix: 'checkout',
});

// /api/coupons/validate — 20 req/min per IP
export const POST = withRateLimit(handleCouponValidate, {
  windowMs: 60_000, maxRequests: 20, keyPrefix: 'coupon',
});

// /api/ai/generate-caption — 10 req/min per IP
export const POST = withRateLimit(handleGenerateCaption, {
  windowMs: 60_000, maxRequests: 10, keyPrefix: 'ai',
});

// /api/shipping/cost — 30 req/min per IP
export const POST = withRateLimit(handleShippingCost, {
  windowMs: 60_000, maxRequests: 30, keyPrefix: 'shipping',
});

// /api/webhooks/midtrans — NO rate limit (Midtrans must always get through)
```

---

## 3. SECURITY HARDENING

### 3.1 Security Headers

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://app.midtrans.com https://app.sandbox.midtrans.com https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
      "connect-src 'self' https://api.midtrans.com https://api.sandbox.midtrans.com https://api.rajaongkir.com",
      "frame-src https://app.midtrans.com https://app.sandbox.midtrans.com",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: `/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/**`,
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
```

### 3.2 Input Sanitization

```typescript
// lib/utils/sanitize.ts

/**
 * Sanitize user text input. Apply to all user-provided strings
 * before storing in database.
 */
export function sanitizeText(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, ' ');    // collapse multiple spaces
}

/**
 * Normalize Indonesian phone number to +62 format.
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+62' + cleaned.substring(1);
  } else if (cleaned.startsWith('62') && !cleaned.startsWith('+62')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

/**
 * Normalize email for consistent comparison and storage.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize coupon code for consistent comparison.
 */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Sanitize rich text content (blog posts, product descriptions).
 * Strips dangerous tags/attributes, keeps safe HTML.
 */
export function sanitizeHtml(html: string): string {
  // Use isomorphic-dompurify in the actual implementation:
  // import DOMPurify from 'isomorphic-dompurify';
  // return DOMPurify.sanitize(html, {
  //   ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'img'],
  //   ALLOWED_ATTR: ['href', 'src', 'alt', 'class'],
  // });

  // Placeholder — install isomorphic-dompurify and replace
  return html;
}
```

### 3.3 Webhook Security Hardening

```typescript
// Midtrans webhook endpoint additional protections:

// 1. Only accept POST
// 2. Verify content-type is application/json
// 3. Verify signature BEFORE any DB operations
// 4. Log every webhook call for audit
// 5. Return 200 even on errors (to prevent Midtrans retry storms)

// app/api/webhooks/midtrans/route.ts — additional checks:
export async function POST(req: NextRequest) {
  // Log webhook receipt for audit
  console.log('[Midtrans Webhook] Received at', new Date().toISOString());

  // Verify content type
  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    console.warn('[Midtrans Webhook] Invalid content-type:', contentType);
    return NextResponse.json({ received: false }, { status: 400 });
  }

  // Rest of handler as defined in INTEGRATION_ENGINE.md Section 2.6
  // ...
}

// IMPORTANT: Only allow GET/HEAD for the cron routes
// Webhook route uses POST only
export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
```

### 3.4 Admin Activity Logging

```typescript
// lib/services/audit.service.ts
import { db } from '@/lib/db';
import { adminActivityLogs } from '@/lib/db/schema';

/**
 * Log admin actions for audit trail.
 * Call after every write operation in admin routes.
 */
export async function logAdminActivity(params: {
  userId: string;
  action: string;        // e.g. 'update_order_status', 'create_product', 'update_stock'
  targetType: string;    // e.g. 'order', 'product', 'variant'
  targetId: string;      // e.g. order.id, product.id
  details?: Record<string, unknown>; // e.g. { from: 'paid', to: 'processing' }
}): Promise<void> {
  try {
    await db.insert(adminActivityLogs).values({
      userId: params.userId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      details: JSON.stringify(params.details || {}),
    });
  } catch (error) {
    // Audit logging failure must never block the actual operation
    console.error('[Audit] Failed to log activity:', error);
  }
}
```

---

## 4. DATABASE OPTIMIZATION

### 4.1 Required Indexes

These indexes are critical for production query performance. Add them to the Drizzle schema:

```typescript
// lib/db/schema.ts — indexes section

// Products
export const productsSlugIdx = index('idx_products_slug').on(products.slug);
export const productsCategoryIdx = index('idx_products_category').on(products.categoryId);
export const productsActiveIdx = index('idx_products_active').on(products.isActive);

// Orders
export const ordersUserIdx = index('idx_orders_user_id').on(orders.userId);
export const ordersStatusIdx = index('idx_orders_status').on(orders.status);
export const ordersNumberIdx = index('idx_orders_order_number').on(orders.orderNumber);
export const ordersCreatedIdx = index('idx_orders_created_at').on(orders.createdAt);
export const ordersExpiryIdx = index('idx_orders_payment_expires').on(orders.paymentExpiresAt);
export const ordersMidtransIdx = index('idx_orders_midtrans_id').on(orders.midtransOrderId);

// Order items
export const orderItemsOrderIdx = index('idx_order_items_order_id').on(orderItems.orderId);

// Points
export const pointsUserIdx = index('idx_points_user_id').on(pointsHistory.userId);
export const pointsExpiresIdx = index('idx_points_expires_at').on(pointsHistory.expiresAt);
export const pointsTypeIdx = index('idx_points_type').on(pointsHistory.type);

// Blog
export const blogSlugIdx = index('idx_blog_slug').on(blogPosts.slug);
export const blogPublishedIdx = index('idx_blog_published').on(blogPosts.isPublished, blogPosts.publishedAt);

// Users
export const usersEmailIdx = index('idx_users_email').on(users.email);
export const usersRoleIdx = index('idx_users_role').on(users.role);

// Coupons
export const couponsCodeIdx = index('idx_coupons_code').on(coupons.code);
```

### 4.2 Query Optimization Patterns

```typescript
// ✅ ALWAYS use select() to pick only needed columns
const ordersForList = await db.query.orders.findMany({
  columns: {
    id: true,
    orderNumber: true,
    status: true,
    totalAmount: true,
    recipientName: true,
    createdAt: true,
  },
  limit: 20,
  offset: page * 20,
  orderBy: [desc(orders.createdAt)],
});

// ❌ NEVER do: db.query.orders.findMany() without columns/limit
// This pulls ALL columns of ALL orders — will crash on production data

// ✅ Use count query for pagination instead of fetching all
const [{ count }] = await db
  .select({ count: sql<number>`count(*)` })
  .from(orders)
  .where(eq(orders.status, 'paid'));

// ✅ Batch related data queries with Promise.all
const [orderData, itemsData, statusHistory] = await Promise.all([
  db.query.orders.findFirst({ where: eq(orders.id, orderId) }),
  db.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId) }),
  db.query.orderStatusHistory.findMany({
    where: eq(orderStatusHistory.orderId, orderId),
    orderBy: [desc(orderStatusHistory.createdAt)],
  }),
]);
```

### 4.3 Connection Management

```typescript
// lib/db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Neon's HTTP driver creates a new connection per request.
// This is correct for serverless — no connection pool needed.
// Each Vercel function invocation gets its own db instance.
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// IMPORTANT: Do NOT use WebSocket driver for Vercel serverless.
// The HTTP driver is the correct choice:
// - No connection pool exhaustion
// - No idle connection cleanup needed
// - Works in Edge Runtime
// - Slightly higher latency per query (~5ms) but eliminates connection errors
```

---

## 5. ERROR HANDLING & RECOVERY

### 5.1 Error Classes

```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class PaymentError extends AppError {
  constructor(message: string) {
    super(message, 'PAYMENT_ERROR', 402);
  }
}

export class StockError extends AppError {
  constructor(variantId: string, available: number, requested: number) {
    super(
      `Stok tidak cukup untuk varian ${variantId}: tersedia ${available}, diminta ${requested}`,
      'INSUFFICIENT_STOCK',
      409
    );
  }
}

export class CouponError extends AppError {
  constructor(message: string) {
    super(message, 'COUPON_ERROR', 422);
  }
}

export class ShippingError extends AppError {
  constructor(message: string) {
    super(message, 'SHIPPING_ERROR', 422);
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}
```

### 5.2 Global Error Handler for API Routes

```typescript
// lib/utils/api-handler.ts
import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { IntegrationError } from '@/lib/utils/integration-helpers';
import { ZodError } from 'zod';

type ApiHandler = (req: NextRequest) => Promise<NextResponse>;

/**
 * Wraps an API route handler with standardized error handling.
 * Catches all error types and returns appropriate JSON responses.
 */
export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      // Zod validation errors
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.flatten().fieldErrors,
          },
          { status: 422 }
        );
      }

      // App-level business errors
      if (error instanceof AppError) {
        return NextResponse.json(
          { success: false, error: error.message, code: error.code },
          { status: error.statusCode }
        );
      }

      // Integration errors (Midtrans, RajaOngkir, etc.)
      if (error instanceof IntegrationError) {
        console.error(`[${error.service}]`, error.message, error.raw);
        return NextResponse.json(
          {
            success: false,
            error: 'Layanan eksternal sedang bermasalah. Silakan coba lagi.',
            code: 'INTEGRATION_ERROR',
          },
          { status: 502 }
        );
      }

      // Unknown errors
      console.error('[API] Unhandled error:', error);
      return NextResponse.json(
        { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  };
}
```

### 5.3 Client-Side Error Recovery

```typescript
// hooks/useApiMutation.ts
'use client';

import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ApiError {
  success: false;
  error: string;
  code: string;
  details?: Record<string, string[]>;
}

/**
 * Wrapper around TanStack useMutation for API calls.
 * Standardizes error handling and user feedback.
 */
export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, ApiError, TVariables>, 'mutationFn'>
) {
  return useMutation({
    mutationFn,
    onError: (error: ApiError) => {
      switch (error.code) {
        case 'RATE_LIMITED':
          toast.error('Terlalu banyak permintaan. Tunggu sebentar.');
          break;
        case 'INSUFFICIENT_STOCK':
          toast.error('Stok tidak mencukupi. Silakan periksa keranjang Anda.');
          break;
        case 'COUPON_ERROR':
          toast.error(error.error);
          break;
        case 'INTEGRATION_ERROR':
          toast.error('Layanan sedang bermasalah. Silakan coba lagi.');
          break;
        case 'UNAUTHORIZED':
          toast.error('Sesi Anda telah berakhir. Silakan login kembali.');
          // Optionally redirect to login
          break;
        default:
          toast.error(error.error || 'Terjadi kesalahan. Silakan coba lagi.');
      }
    },
    ...options,
  });
}
```

---

## 6. MONITORING & OBSERVABILITY

### 6.1 Structured Logging

```typescript
// lib/utils/logger.ts

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;        // e.g. 'Midtrans.webhook', 'Order.create'
  orderId?: string;
  userId?: string;
  error?: string;
  stack?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

function log(level: LogLevel, message: string, meta?: Partial<Omit<LogEntry, 'level' | 'message' | 'timestamp'>>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  // In production, Vercel captures console output as structured logs
  const logFn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : console.log;

  logFn(JSON.stringify(entry));
}

export const logger = {
  debug: (msg: string, meta?: Partial<LogEntry>) => log('debug', msg, meta),
  info:  (msg: string, meta?: Partial<LogEntry>) => log('info', msg, meta),
  warn:  (msg: string, meta?: Partial<LogEntry>) => log('warn', msg, meta),
  error: (msg: string, meta?: Partial<LogEntry>) => log('error', msg, meta),
};
```

### 6.2 Critical Event Logging

```typescript
// Events that MUST be logged (use logger.info or logger.error):

// Payment events
logger.info('Order created', { context: 'Checkout', orderId, data: { orderNumber, total } });
logger.info('Payment settled', { context: 'Midtrans.webhook', orderId, data: { paymentType } });
logger.error('Payment failed', { context: 'Midtrans.webhook', orderId, data: { status, reason } });
logger.warn('Webhook signature invalid', { context: 'Midtrans.webhook', data: { orderId } });

// Stock events
logger.warn('Stock insufficient post-payment', { context: 'Inventory', data: { variantId, available, requested } });
logger.info('Stock updated', { context: 'Inventory', userId, data: { variantId, oldStock, newStock } });

// Cron events
logger.info('Cron: expired orders cancelled', { context: 'Cron', data: { count } });
logger.info('Cron: points expired', { context: 'Cron', data: { records, users } });

// Auth events
logger.warn('Unauthorized admin access attempt', { context: 'Auth', data: { path, ip } });

// Integration failures
logger.error('RajaOngkir API failed', { context: 'RajaOngkir', error: err.message });
logger.error('Email send failed', { context: 'Resend', data: { to, subject }, error: err.message });
```

### 6.3 Admin Health Dashboard Data

```typescript
// app/api/admin/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkIntegrationHealth } from '@/lib/utils/health-check';
import { db } from '@/lib/db';
import { orders, pointsHistory } from '@/lib/db/schema';
import { eq, and, lt, count } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [integrations, pendingOrders, expiringPoints] = await Promise.all([
    // External service health
    checkIntegrationHealth(),

    // Stuck orders (pending_payment for >30 minutes — should have been auto-cancelled)
    db.select({ count: count() })
      .from(orders)
      .where(and(
        eq(orders.status, 'pending_payment'),
        lt(orders.paymentExpiresAt, new Date(Date.now() - 30 * 60 * 1000))
      )),

    // Points expiring in next 7 days
    db.select({ count: count() })
      .from(pointsHistory)
      .where(and(
        eq(pointsHistory.type, 'earn'),
        eq(pointsHistory.isExpired, false),
        lt(pointsHistory.expiresAt, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
      )),
  ]);

  return NextResponse.json({
    integrations,
    alerts: {
      stuckOrders: pendingOrders[0]?.count || 0,
      expiringPointsRecords: expiringPoints[0]?.count || 0,
    },
    serverTime: new Date().toISOString(),
  });
}
```

---

## 7. DEPLOYMENT & VERCEL CONFIGURATION

### 7.1 Vercel Project Configuration

```json
// vercel.json
{
  "framework": "nextjs",
  "buildCommand": "npm run db:migrate && npm run build",
  "crons": [
    {
      "path": "/api/cron/cancel-expired-orders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/expire-points",
      "schedule": "0 18 * * *"
    },
    {
      "path": "/api/cron/points-expiry-warning",
      "schedule": "0 2 * * *"
    }
  ],
  "regions": ["sin1"],
  "functions": {
    "app/api/webhooks/midtrans/route.ts": {
      "maxDuration": 30
    },
    "app/api/checkout/initiate/route.ts": {
      "maxDuration": 30
    },
    "app/api/cron/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

Note: Cron times are UTC. WIB (UTC+7) adjustments:
- `0 18 * * *` UTC = 1:00 AM WIB (points expiry)
- `0 2 * * *` UTC = 9:00 AM WIB (expiry warning email)

### 7.2 Environment Variables Checklist

Before deploying to production, verify ALL these are set in Vercel:

```bash
# Required — app will crash without these
DATABASE_URL                       # Neon auto-injected via integration
AUTH_SECRET                        # openssl rand -base64 32
AUTH_URL                           # https://dapurdekaka.com
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
MIDTRANS_SERVER_KEY                # PRODUCTION key, not sandbox
MIDTRANS_CLIENT_KEY
MIDTRANS_IS_PRODUCTION=true        # MUST be "true" for production
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true
RAJAONGKIR_API_KEY
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_FROM_NAME
NEXT_PUBLIC_APP_URL=https://dapurdekaka.com
CRON_SECRET                        # openssl rand -base64 32

# Optional but recommended
MINIMAX_API_KEY
MINIMAX_BASE_URL
MINIMAX_MODEL
NEXT_PUBLIC_WHATSAPP_NUMBER
NEXT_PUBLIC_INSTAGRAM_URL
NEXT_PUBLIC_STORE_ADDRESS
NEXT_PUBLIC_GOOGLE_MAPS_URL
```

### 7.3 Pre-Launch Checklist

```
Pre-Deploy Verification:
├── [ ] All env vars set in Vercel (production environment)
├── [ ] Midtrans switched to production keys
├── [ ] Midtrans webhook URL set to: https://dapurdekaka.com/api/webhooks/midtrans
├── [ ] Neon database migrated with production schema
├── [ ] Seed data run (superadmin, categories, products)
├── [ ] Resend domain verified (dapurdekaka.com)
├── [ ] Cloudinary account active, folders created
├── [ ] Custom domain DNS configured
├── [ ] SSL certificate active (Vercel auto-provisions)
├── [ ] RajaOngkir API key active

Post-Deploy Smoke Test:
├── [ ] Homepage loads in <3s on mobile
├── [ ] Product catalog shows all products
├── [ ] Add to cart works
├── [ ] Checkout flow completes (use real payment, small amount)
├── [ ] Webhook fires and order status updates to paid
├── [ ] Confirmation email received
├── [ ] Admin dashboard loads with KPI data
├── [ ] Admin can update order status
├── [ ] Warehouse can update stock
├── [ ] Cron jobs are listed in Vercel dashboard → Cron tab
├── [ ] Place a second order and cancel it — verify points/coupon reversal

Monitoring (first 48 hours):
├── [ ] Check Vercel function logs for errors
├── [ ] Verify cron jobs are firing (check /api/cron responses)
├── [ ] Monitor Neon dashboard for connection count
├── [ ] Verify email delivery rate in Resend dashboard
├── [ ] Check Midtrans dashboard for settlement rates
```

### 7.4 Rollback Strategy

```
If production breaks after deploy:
1. Vercel → Deployments → click previous working deployment → "Promote to Production"
   - Instant rollback, no rebuild needed
   
2. If database migration caused the issue:
   - Neon dashboard → Branches → restore from point-in-time backup
   - OR: manually run reverse migration SQL
   
3. If Midtrans webhook is broken:
   - Missed webhooks will be retried by Midtrans for up to 5 attempts
   - After fix: run the cancel-expired-orders cron manually to catch up
   - Double-check with Midtrans status API for any orders that might have been paid
   
4. If cron jobs stopped working:
   - Run manually: curl -H "Authorization: Bearer $CRON_SECRET" https://dapurdekaka.com/api/cron/cancel-expired-orders
```

---

## 8. PERFORMANCE OPTIMIZATION

### 8.1 ISR/SSG Configuration

```typescript
// Revalidation times per page type (seconds):
// Homepage:          3600    (1 hour — carousel and featured products)
// Product catalog:   300     (5 min — stock changes)
// Product detail:    60      (1 min — stock and price near-realtime)
// Blog listing:      3600    (1 hour)
// Blog post:         Infinity (static — revalidate on publish via API)

// Example: app/(store)/products/page.tsx
export const revalidate = 300;

// Example: app/(store)/products/[slug]/page.tsx
export const revalidate = 60;

// For on-demand revalidation after admin edits:
// app/api/admin/products/route.ts (after update)
import { revalidatePath } from 'next/cache';
revalidatePath('/products');
revalidatePath(`/products/${product.slug}`);
```

### 8.2 Image Optimization

```typescript
// next/image component usage with Cloudinary:
import Image from 'next/image';

// Product card — uses Cloudinary transforms via URL
<Image
  src={getOptimizedImageUrl(product.imageUrl, 'thumbnail')}
  alt={product.nameId}
  width={240}
  height={240}
  className="object-cover"
  loading="lazy"             // lazy load below-fold images
  placeholder="blur"
  blurDataURL={PLACEHOLDER_BLUR}  // tiny base64 blur
/>

// Above-fold hero images:
<Image
  src={getOptimizedImageUrl(slide.imageUrl, 'carousel')}
  alt={slide.title}
  width={1200}
  height={600}
  priority={true}           // preload above-fold images
  placeholder="blur"
  blurDataURL={PLACEHOLDER_BLUR}
/>

// Blur placeholder constant (1x1px transparent dimsum-red):
export const PLACEHOLDER_BLUR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
```

### 8.3 Bundle Size Controls

```typescript
// Dynamic imports for heavy components:

// Midtrans Snap — only load on checkout page
const SnapPayment = dynamic(() => import('@/components/store/checkout/SnapPayment'), {
  ssr: false,
  loading: () => <PaymentSkeleton />,
});

// Recharts — only load in admin dashboard
const RevenueChart = dynamic(() => import('@/components/admin/dashboard/RevenueChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

// TipTap editor — only load in blog editor
const BlogEditor = dynamic(() => import('@/components/admin/blog/BlogEditor'), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

// React PDF — only load on receipt download
const ReceiptDocument = dynamic(() => import('@/components/pdf/ReceiptDocument'), {
  ssr: false,
});

// Canvas confetti — only on success page
const confetti = dynamic(() => import('canvas-confetti'), { ssr: false });
```

---

## 9. DATA INTEGRITY SAFEGUARDS

### 9.1 Stock Deduction Safety

```typescript
// CRITICAL: Stock deduction in webhook handler must use SQL expression
// to prevent race conditions from duplicate webhooks.

// In handleSettlement transaction:
for (const item of orderItems) {
  const result = await tx
    .update(productVariants)
    .set({
      stock: sql`GREATEST(${productVariants.stock} - ${item.quantity}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(productVariants.id, item.variantId))
    .returning({ newStock: productVariants.stock });

  // Log if stock went to 0 unexpectedly
  if (result[0]?.newStock === 0) {
    logger.warn('Stock depleted to 0 after payment', {
      context: 'Inventory',
      orderId: order.id,
      data: { variantId: item.variantId, deducted: item.quantity },
    });
  }

  // Create inventory log
  await tx.insert(inventoryLogs).values({
    variantId: item.variantId,
    changeType: 'sale',
    quantityChange: -item.quantity,
    newStock: result[0]?.newStock ?? 0,
    orderId: order.id,
    note: `Penjualan ${order.orderNumber}`,
  });
}
```

### 9.2 Order Number Uniqueness

```typescript
// lib/utils/generate-order-number.ts
import { db } from '@/lib/db';
import { orderSequence } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

/**
 * Generate a unique order number using a PostgreSQL sequence table.
 * Format: DDK-YYYYMMDD-XXXX
 * Uses UPSERT to atomically increment the daily counter.
 * Race-condition safe — PostgreSQL handles locking.
 */
export async function generateOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  // dateStr = "20260513"

  // Atomic increment: INSERT or UPDATE the daily counter
  const result = await db.execute(sql`
    INSERT INTO order_sequence (date_key, last_number)
    VALUES (${dateStr}, 1)
    ON CONFLICT (date_key)
    DO UPDATE SET last_number = order_sequence.last_number + 1
    RETURNING last_number
  `);

  const sequence = (result as any)[0]?.last_number || 1;
  const paddedSequence = String(sequence).padStart(4, '0');

  return `DDK-${dateStr}-${paddedSequence}`;
}

// order_sequence table schema:
// CREATE TABLE order_sequence (
//   date_key VARCHAR(8) PRIMARY KEY,   -- "20260513"
//   last_number INTEGER NOT NULL DEFAULT 0
// );
```

### 9.3 Idempotent Webhook Processing

```typescript
// In handleSettlement — check order status BEFORE processing:

export async function handleSettlement(
  orderNumber: string,
  payload: MidtransWebhookPayload
): Promise<void> {
  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true },
  });

  if (!order) {
    logger.error('Webhook received for unknown order', {
      context: 'Midtrans.webhook',
      data: { orderNumber, midtransOrderId: payload.order_id },
    });
    return; // Return without error — don't trigger Midtrans retry
  }

  // IDEMPOTENCY CHECK: If already processed, do nothing
  if (order.status !== 'pending_payment') {
    logger.info('Webhook duplicate — order already processed', {
      context: 'Midtrans.webhook',
      orderId: order.id,
      data: { currentStatus: order.status },
    });
    return;
  }

  // Process settlement in atomic transaction
  await db.transaction(async (tx) => {
    // ... (full settlement logic as in BACKEND_API_GUIDE.md Section 3)
  });
}
```

### 9.4 Points Balance Consistency

```typescript
// Calculate user's current points balance from the history table.
// NEVER store a cached "balance" column — always compute from history.

export async function getUserPointsBalance(userId: string): Promise<number> {
  const result = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${pointsHistory.points}), 0)`,
    })
    .from(pointsHistory)
    .where(eq(pointsHistory.userId, userId));

  return result[0]?.balance || 0;
}

// Points redemption check:
export function validatePointsRedemption(
  balance: number,
  redeemAmount: number,
  subtotal: number
): { valid: boolean; error?: string } {
  if (redeemAmount < 100) {
    return { valid: false, error: 'Minimum penukaran 100 poin' };
  }
  if (redeemAmount > balance) {
    return { valid: false, error: 'Poin tidak mencukupi' };
  }
  // Max 50% of subtotal
  const maxDiscount = Math.floor(subtotal * 0.5);
  const pointsDiscount = Math.floor(redeemAmount / 100) * 1000;
  if (pointsDiscount > maxDiscount) {
    return { valid: false, error: `Maksimal penukaran poin: ${maxDiscount / 1000 * 100} poin` };
  }
  return { valid: true };
}
```

---

## 10. TIMESTAMP & TIMEZONE HANDLING

```typescript
// lib/utils/timezone.ts
import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const WIB_TIMEZONE = 'Asia/Jakarta';

/**
 * All dates stored in database as UTC.
 * All dates displayed to users in WIB (UTC+7).
 */
export function formatDateWIB(date: Date | string, formatStr: string = 'dd MMM yyyy, HH:mm'): string {
  return formatInTimeZone(
    typeof date === 'string' ? new Date(date) : date,
    WIB_TIMEZONE,
    formatStr,
    { locale: localeId }
  );
}

/**
 * Format for order-related dates.
 * Example output: "12 Mei 2026, 14:30 WIB"
 */
export function formatOrderDate(date: Date | string): string {
  return formatDateWIB(date, "dd MMMM yyyy, HH:mm") + ' WIB';
}

/**
 * Format for currency display.
 * Always IDR, always integer, always Indonesian format.
 */
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
```

---

*End of PRODUCTION_HARDENING.md v1.0*
*Covers: Cron jobs, rate limiting, security headers, database indexes, error handling, monitoring, deployment, performance, data integrity*
*Complete backend trilogy: BACKEND_API_GUIDE.md → INTEGRATION_ENGINE.md → PRODUCTION_HARDENING.md*
