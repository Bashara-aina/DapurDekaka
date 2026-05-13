# BACKEND_IMPLEMENTATION.md — Backend Implementation Guide
# DapurDekaka.com v2
**Version:** 1.0
**Status:** Production Target
**Author:** Bashara (Technical Lead)
**Last Updated:** May 2026

---

## CRITICAL RULES FOR CURSOR

1. ALL API routes must validate session AND role server-side — never trust client
2. NEVER expose server keys to client (no NEXT_PUBLIC_ prefix for Midtrans server key, RajaOngkir, Resend, Cloudinary secret)
3. EVERY database mutation must be wrapped in a try/catch with proper error response
4. ALL webhook endpoints must verify signature BEFORE processing anything
5. Stock deduction happens ONLY on Midtrans `settlement` webhook — NEVER at order creation
6. Points reversal and coupon reversal MUST happen on `deny`, `cancel`, `expire` webhook events
7. Use Drizzle transactions (`db.transaction()`) for any operation touching multiple tables atomically

---

## TABLE OF CONTENTS
1. Database Connection & Schema Bootstrap
2. API Route Implementation — Complete File-by-File
3. Midtrans Payment Engine
4. RajaOngkir Shipping Engine
5. Order Number Generator
6. Email Engine (Resend)
7. Points Engine
8. Coupon Engine
9. Webhook Handler (Complete Logic)
10. Admin API Routes
11. Seed Script
12. Error Handling Conventions
13. Rate Limiting Setup

---

## 1. DATABASE CONNECTION & SCHEMA BOOTSTRAP

### 1.1 `lib/db/index.ts`
```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
export type DB = typeof db;
```

### 1.2 `lib/db/schema.ts` — Complete Drizzle Schema

```typescript
import {
  pgTable, uuid, text, integer, boolean, timestamp,
  pgEnum, decimal, jsonb, index, uniqueIndex
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── ENUMS ───────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'customer', 'b2b', 'warehouse', 'owner', 'superadmin'
]);

export const orderStatusEnum = pgEnum('order_status', [
  'pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'
]);

export const deliveryMethodEnum = pgEnum('delivery_method', ['delivery', 'pickup']);

export const couponTypeEnum = pgEnum('coupon_type', [
  'percentage', 'fixed', 'free_shipping', 'buy_x_get_y'
]);

export const pointsTypeEnum = pgEnum('points_type', [
  'earn', 'redeem', 'expire', 'adjust'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending', 'settlement', 'deny', 'cancel', 'expire', 'failure'
]);

// ─── NEXTAUTH REQUIRED TABLES ────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  password: text('password'), // null for Google OAuth users
  role: userRoleEnum('role').default('customer').notNull(),
  phone: text('phone'),
  pointsBalance: integer('points_balance').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_idx').on(t.email),
}));

export const accounts = pgTable('accounts', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
});

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

// ─── ADDRESSES ───────────────────────────────────────────────────────────────

export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: text('label'), // e.g. "Rumah", "Kantor"
  recipientName: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  addressLine: text('address_line').notNull(),
  province: text('province').notNull(),
  provinceId: text('province_id').notNull(),
  city: text('city').notNull(),
  cityId: text('city_id').notNull(),
  district: text('district').notNull(),
  postalCode: text('postal_code').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('addresses_user_id_idx').on(t.userId),
}));

// ─── PRODUCTS & VARIANTS ─────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nameEn: text('name_en').notNull(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').default(0),
});

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  nameEn: text('name_en').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  descriptionEn: text('description_en'),
  categoryId: uuid('category_id').references(() => categories.id),
  weightGram: integer('weight_gram').default(0).notNull(),
  isHalal: boolean('is_halal').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  isB2bAvailable: boolean('is_b2b_available').default(false).notNull(),
  images: jsonb('images').$type<string[]>().default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  slugIdx: uniqueIndex('products_slug_idx').on(t.slug),
  activeIdx: index('products_active_idx').on(t.isActive),
}));

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // "25 pcs", "50 pcs"
  sku: text('sku').notNull().unique(),
  price: integer('price').notNull(), // IDR, no decimals
  b2bPrice: integer('b2b_price'),
  stock: integer('stock').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  productIdx: index('variants_product_id_idx').on(t.productId),
  skuIdx: uniqueIndex('variants_sku_idx').on(t.sku),
}));

// ─── ORDERS ──────────────────────────────────────────────────────────────────

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderNumber: text('order_number').notNull().unique(),
  userId: uuid('user_id').references(() => users.id), // null = guest
  // Guest info (if no userId)
  guestName: text('guest_name'),
  guestEmail: text('guest_email'),
  guestPhone: text('guest_phone'),
  // Delivery
  deliveryMethod: deliveryMethodEnum('delivery_method').notNull(),
  // Snapshot of shipping address at time of order
  shippingName: text('shipping_name'),
  shippingPhone: text('shipping_phone'),
  shippingAddressLine: text('shipping_address_line'),
  shippingCity: text('shipping_city'),
  shippingCityId: text('shipping_city_id'),
  shippingProvince: text('shipping_province'),
  shippingPostalCode: text('shipping_postal_code'),
  // Courier
  courierCode: text('courier_code'), // "sicepat", "jne", "anteraja"
  courierService: text('courier_service'), // "FROZEN", "YES"
  courierName: text('courier_name'), // "SiCepat Frozen"
  estimatedDays: text('estimated_days'),
  trackingNumber: text('tracking_number'),
  // Pricing (all IDR integers)
  subtotal: integer('subtotal').notNull(),
  shippingCost: integer('shipping_cost').default(0).notNull(),
  couponDiscount: integer('coupon_discount').default(0).notNull(),
  pointsDiscount: integer('points_discount').default(0).notNull(),
  totalAmount: integer('total_amount').notNull(),
  // Coupon
  couponId: uuid('coupon_id').references(() => coupons.id),
  couponCode: text('coupon_code'),
  // Points
  pointsUsed: integer('points_used').default(0).notNull(),
  pointsEarned: integer('points_earned').default(0).notNull(),
  // Payment
  status: orderStatusEnum('status').default('pending_payment').notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('pending').notNull(),
  midtransOrderId: text('midtrans_order_id').unique(), // may have -retry-N suffix
  midtransSnapToken: text('midtrans_snap_token'),
  paymentRetryCount: integer('payment_retry_count').default(0).notNull(),
  // Notes
  orderNotes: text('order_notes'),
  // Timestamps
  paidAt: timestamp('paid_at'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  cancelledAt: timestamp('cancelled_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  orderNumberIdx: uniqueIndex('orders_order_number_idx').on(t.orderNumber),
  userIdIdx: index('orders_user_id_idx').on(t.userId),
  statusIdx: index('orders_status_idx').on(t.status),
  createdAtIdx: index('orders_created_at_idx').on(t.createdAt),
  midtransOrderIdIdx: uniqueIndex('orders_midtrans_order_id_idx').on(t.midtransOrderId),
}));

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  productId: uuid('product_id').notNull().references(() => products.id),
  // Snapshot at time of order (product/variant data may change later)
  productName: text('product_name').notNull(),
  variantName: text('variant_name').notNull(),
  sku: text('sku').notNull(),
  price: integer('price').notNull(),
  quantity: integer('quantity').notNull(),
  subtotal: integer('subtotal').notNull(),
  weightGram: integer('weight_gram').notNull(),
}, (t) => ({
  orderIdIdx: index('order_items_order_id_idx').on(t.orderId),
}));

// ─── COUPONS ─────────────────────────────────────────────────────────────────

export const coupons = pgTable('coupons', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(), // stored uppercase
  type: couponTypeEnum('type').notNull(),
  value: integer('value').notNull(), // % or IDR amount or qty
  minOrder: integer('min_order').default(0),
  maxUses: integer('max_uses'), // null = unlimited
  usedCount: integer('used_count').default(0).notNull(),
  expiresAt: timestamp('expires_at'),
  isActive: boolean('is_active').default(true).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  codeIdx: uniqueIndex('coupons_code_idx').on(t.code),
}));

// ─── POINTS ──────────────────────────────────────────────────────────────────

export const pointsHistory = pgTable('points_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: pointsTypeEnum('type').notNull(),
  points: integer('points').notNull(), // positive = earn, negative = redeem/expire
  balanceAfter: integer('balance_after').notNull(),
  orderId: uuid('order_id').references(() => orders.id),
  orderNumber: text('order_number'),
  description: text('description').notNull(),
  expiresAt: timestamp('expires_at'), // 1 year from earn date
  isExpired: boolean('is_expired').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdIdx: index('points_user_id_idx').on(t.userId),
  expiresAtIdx: index('points_expires_at_idx').on(t.expiresAt),
}));

// ─── BLOG ────────────────────────────────────────────────────────────────────

export const blogPosts = pgTable('blog_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  titleEn: text('title_en'),
  slug: text('slug').notNull().unique(),
  content: text('content'), // HTML from TipTap
  contentEn: text('content_en'),
  excerpt: text('excerpt'),
  coverImage: text('cover_image'),
  authorId: uuid('author_id').references(() => users.id),
  isPublished: boolean('is_published').default(false).notNull(),
  publishedAt: timestamp('published_at'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  slugIdx: uniqueIndex('blog_slug_idx').on(t.slug),
  publishedIdx: index('blog_published_idx').on(t.isPublished, t.publishedAt),
}));

// ─── CAROUSEL ────────────────────────────────────────────────────────────────

export const carouselSlides = pgTable('carousel_slides', {
  id: uuid('id').primaryKey().defaultRandom(),
  imageUrl: text('image_url').notNull(),
  title: text('title'),
  subtitle: text('subtitle'),
  ctaText: text('cta_text'),
  ctaUrl: text('cta_url'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── B2B ─────────────────────────────────────────────────────────────────────

export const b2bInquiries = pgTable('b2b_inquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyName: text('company_name').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  message: text('message').notNull(),
  estimatedQuantity: text('estimated_quantity'),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── STOCK LOGS ──────────────────────────────────────────────────────────────

export const stockLogs = pgTable('stock_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  variantId: uuid('variant_id').notNull().references(() => productVariants.id),
  userId: uuid('user_id').references(() => users.id), // who made the change
  oldStock: integer('old_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  reason: text('reason'), // "order_fulfilled", "manual_adjustment", "webhook_settlement"
  orderId: uuid('order_id').references(() => orders.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── PASSWORD RESET ───────────────────────────────────────────────────────────

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── RELATIONS ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  pointsHistory: many(pointsHistory),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  variants: many(productVariants),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  coupon: one(coupons, { fields: [orders.couponId], references: [coupons.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
```

---

## 2. API ROUTE IMPLEMENTATION

### 2.1 `app/api/products/route.ts` — Product Listing + Search
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, productVariants, categories } from '@/lib/db/schema';
import { eq, and, ilike, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const categorySlug = searchParams.get('category') || '';
    const featured = searchParams.get('featured') === 'true';
    const b2b = searchParams.get('b2b') === 'true';

    const conditions = [eq(products.isActive, true)];
    if (search) conditions.push(ilike(products.name, `%${search}%`));
    if (featured) conditions.push(eq(products.isFeatured, true));
    if (b2b) conditions.push(eq(products.isB2bAvailable, true));

    const result = await db.query.products.findMany({
      where: and(...conditions),
      with: {
        category: true,
        variants: {
          where: eq(productVariants.isActive, true),
          orderBy: (v, { asc }) => [asc(v.sortOrder)],
        },
      },
      orderBy: (p, { desc, asc }) => [desc(p.isFeatured), asc(p.createdAt)],
    });

    // Filter by category slug after join
    const filtered = categorySlug
      ? result.filter(p => p.category?.slug === categorySlug)
      : result;

    return NextResponse.json({ products: filtered });
  } catch (error) {
    console.error('[GET /api/products]', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}
```

### 2.2 `app/api/products/[slug]/route.ts` — Product Detail
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, productVariants } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const product = await db.query.products.findFirst({
      where: and(eq(products.slug, params.slug), eq(products.isActive, true)),
      with: {
        category: true,
        variants: {
          where: eq(productVariants.isActive, true),
          orderBy: (v, { asc }) => [asc(v.sortOrder)],
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error('[GET /api/products/[slug]]', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
```

### 2.3 `app/api/cart/validate/route.ts` — Real-Time Stock Validation
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

interface CartItem {
  variantId: string;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const { items }: { items: CartItem[] } = await request.json();

    if (!items?.length) {
      return NextResponse.json({ valid: false, errors: ['Cart is empty'] }, { status: 400 });
    }

    const variantIds = items.map(i => i.variantId);
    const dbVariants = await db.query.productVariants.findMany({
      where: inArray(productVariants.id, variantIds),
      with: { product: true },
    });

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const item of items) {
      const variant = dbVariants.find(v => v.id === item.variantId);
      if (!variant) {
        errors.push(`Produk tidak ditemukan`);
        continue;
      }
      if (!variant.isActive || !variant.product.isActive) {
        errors.push(`${variant.product.name} - ${variant.name} sudah tidak tersedia`);
        continue;
      }
      if (variant.stock === 0) {
        errors.push(`${variant.product.name} - ${variant.name} sudah habis`);
        continue;
      }
      if (item.quantity > variant.stock) {
        warnings.push(`${variant.product.name} - ${variant.name}: stok tersisa ${variant.stock} pcs`);
      }
    }

    return NextResponse.json({
      valid: errors.length === 0,
      errors,
      warnings,
    });
  } catch (error) {
    console.error('[POST /api/cart/validate]', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
```

### 2.4 `app/api/shipping/cost/route.ts` — RajaOngkir Cost
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { calculateShippingCost, ALLOWED_SERVICES } from '@/lib/rajaongkir/calculate-cost';

export async function POST(request: NextRequest) {
  try {
    const { cityId, weightGram } = await request.json();

    if (!cityId || !weightGram) {
      return NextResponse.json({ error: 'cityId and weightGram required' }, { status: 400 });
    }

    // Minimum 1000g, round up to nearest 100g
    const billableWeight = Math.max(1000, Math.ceil(weightGram / 100) * 100);

    const results = [];
    for (const service of ALLOWED_SERVICES) {
      const cost = await calculateShippingCost({
        origin: '23', // Bandung
        destination: cityId,
        weight: billableWeight,
        courier: service.courier,
      });
      const matched = cost?.rajaongkir?.results?.?.costs?.find(
        (c: any) => c.service === service.service
      );
      if (matched) {
        results.push({
          courier: service.courier,
          courierName: service.courierName,
          service: service.service,
          serviceName: matched.description,
          cost: matched.cost.value,
          etd: matched.cost.etd,
        });
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ available: false, services: [] });
    }

    return NextResponse.json({ available: true, services: results });
  } catch (error) {
    console.error('[POST /api/shipping/cost]', error);
    return NextResponse.json({ error: 'Shipping calculation failed' }, { status: 500 });
  }
}
```

### 2.5 `app/api/coupons/validate/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { coupons } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { code, subtotal } = await request.json();

    if (!code) {
      return NextResponse.json({ valid: false, message: 'Kode kupon diperlukan' }, { status: 400 });
    }

    const coupon = await db.query.coupons.findFirst({
      where: eq(coupons.code, code.toUpperCase()),
    });

    if (!coupon) {
      return NextResponse.json({ valid: false, message: 'Kode kupon tidak valid' });
    }
    if (!coupon.isActive) {
      return NextResponse.json({ valid: false, message: 'Kupon ini sudah tidak aktif' });
    }
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return NextResponse.json({ valid: false, message: 'Kupon ini sudah kedaluwarsa' });
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ valid: false, message: 'Kupon ini sudah habis digunakan' });
    }
    if (coupon.minOrder && subtotal < coupon.minOrder) {
      return NextResponse.json({
        valid: false,
        message: `Minimum pembelian IDR ${coupon.minOrder.toLocaleString('id-ID')} untuk kupon ini`,
      });
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = Math.floor((subtotal * coupon.value) / 100);
    } else if (coupon.type === 'fixed') {
      discountAmount = Math.min(coupon.value, subtotal);
    } else if (coupon.type === 'free_shipping') {
      discountAmount = 0; // Applied to shipping at checkout
    }

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discountAmount,
      },
      message: 'Kupon berhasil diterapkan!',
    });
  } catch (error) {
    console.error('[POST /api/coupons/validate]', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}
```

---

## 3. MIDTRANS PAYMENT ENGINE

### 3.1 `lib/midtrans/client.ts`
```typescript
import midtransClient from 'midtrans-client';

export const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});

export const coreApi = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});
```

### 3.2 `lib/midtrans/verify-webhook.ts`
```typescript
import crypto from 'crypto';

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  signatureKey: string
): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY!;
  const hash = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
  return hash === signatureKey;
}
```

### 3.3 `lib/midtrans/create-transaction.ts`
```typescript
import { snap } from './client';

interface CreateTransactionParams {
  orderNumber: string;
  midtransOrderId: string;
  totalAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

export async function createMidtransTransaction(params: CreateTransactionParams) {
  const transactionDetails = {
    transaction_details: {
      order_id: params.midtransOrderId,
      gross_amount: params.totalAmount,
    },
    customer_details: {
      first_name: params.customerName,
      email: params.customerEmail,
      phone: params.customerPhone,
    },
    item_details: params.items,
    expiry: {
      unit: 'minute',
      duration: 15,
    },
  };

  const response = await snap.createTransaction(transactionDetails);
  return response; // { token, redirect_url }
}
```

### 3.4 `app/api/checkout/initiate/route.ts` — CORE CHECKOUT ENGINE
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, coupons, users } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateOrderNumber } from '@/lib/utils/generate-order-number';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';
import { checkoutSchema } from '@/lib/validations/checkout.schema';

export async function POST(request: NextRequest) {
  const session = await auth();

  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid checkout data', details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;

    // 1. Validate all cart items against live stock
    const variantIds = data.items.map(i => i.variantId);
    const dbVariants = await db.query.productVariants.findMany({
      where: inArray(productVariants.id, variantIds),
      with: { product: true },
    });

    for (const item of data.items) {
      const variant = dbVariants.find(v => v.id === item.variantId);
      if (!variant || !variant.isActive || !variant.product.isActive) {
        return NextResponse.json({ error: `Produk tidak tersedia` }, { status: 400 });
      }
      if (variant.stock < item.quantity) {
        return NextResponse.json({
          error: `Stok ${variant.product.name} - ${variant.name} tidak mencukupi. Tersisa: ${variant.stock}`,
        }, { status: 400 });
      }
    }

    // 2. Validate coupon if provided
    let couponRecord = null;
    let couponDiscount = 0;
    if (data.couponCode) {
      couponRecord = await db.query.coupons.findFirst({
        where: eq(coupons.code, data.couponCode.toUpperCase()),
      });
      if (!couponRecord || !couponRecord.isActive) {
        return NextResponse.json({ error: 'Kupon tidak valid' }, { status: 400 });
      }
      if (couponRecord.type === 'percentage') {
        couponDiscount = Math.floor((data.subtotal * couponRecord.value) / 100);
      } else if (couponRecord.type === 'fixed') {
        couponDiscount = Math.min(couponRecord.value, data.subtotal);
      } else if (couponRecord.type === 'free_shipping') {
        couponDiscount = 0; // Shipping set to 0 in totalAmount
      }
    }

    // 3. Validate points if provided
    let pointsDiscount = 0;
    if (data.pointsToRedeem && data.pointsToRedeem > 0 && session?.user?.id) {
      const userRecord = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      });
      if (!userRecord || userRecord.pointsBalance < data.pointsToRedeem) {
        return NextResponse.json({ error: 'Poin tidak mencukupi' }, { status: 400 });
      }
      if (data.pointsToRedeem < 100) {
        return NextResponse.json({ error: 'Minimum penukaran 100 poin' }, { status: 400 });
      }
      const maxRedeemable = Math.floor(data.subtotal * 0.5 / 1000) * 100;
      const actualPoints = Math.min(data.pointsToRedeem, maxRedeemable);
      pointsDiscount = Math.floor(actualPoints / 100) * 1000;
    }

    // 4. Calculate totals
    const shippingCost = data.deliveryMethod === 'pickup' ? 0 : data.shippingCost;
    const totalAmount = data.subtotal - couponDiscount - pointsDiscount + shippingCost;

    // 5. Generate order number
    const orderNumber = await generateOrderNumber();
    const midtransOrderId = orderNumber; // DDK-YYYYMMDD-XXXX

    // 6. Create order + items atomically
    const newOrder = await db.transaction(async (tx) => {
      // Insert order
      const [order] = await tx.insert(orders).values({
        orderNumber,
        userId: session?.user?.id ?? null,
        guestName: !session ? data.guestName : null,
        guestEmail: !session ? data.guestEmail : null,
        guestPhone: !session ? data.guestPhone : null,
        deliveryMethod: data.deliveryMethod,
        shippingName: data.shippingName,
        shippingPhone: data.shippingPhone,
        shippingAddressLine: data.shippingAddressLine,
        shippingCity: data.shippingCity,
        shippingCityId: data.shippingCityId,
        shippingProvince: data.shippingProvince,
        shippingPostalCode: data.shippingPostalCode,
        courierCode: data.courierCode,
        courierService: data.courierService,
        courierName: data.courierName,
        estimatedDays: data.estimatedDays,
        subtotal: data.subtotal,
        shippingCost,
        couponDiscount,
        pointsDiscount,
        totalAmount,
        couponId: couponRecord?.id ?? null,
        couponCode: couponRecord?.code ?? null,
        pointsUsed: data.pointsToRedeem ?? 0,
        midtransOrderId,
        orderNotes: data.orderNotes,
        status: 'pending_payment',
        paymentStatus: 'pending',
      }).returning();

      // Insert order items
      const itemsToInsert = data.items.map(item => {
        const variant = dbVariants.find(v => v.id === item.variantId)!;
        return {
          orderId: order.id,
          variantId: item.variantId,
          productId: variant.productId,
          productName: variant.product.name,
          variantName: variant.name,
          sku: variant.sku,
          price: variant.price,
          quantity: item.quantity,
          subtotal: variant.price * item.quantity,
          weightGram: variant.product.weightGram,
        };
      });
      await tx.insert(orderItems).values(itemsToInsert);

      // Tentatively deduct points (reversed on failure)
      if (data.pointsToRedeem && data.pointsToRedeem > 0 && session?.user?.id) {
        const userRecord = await tx.query.users.findFirst({
          where: eq(users.id, session.user.id),
        });
        await tx.update(users)
          .set({ pointsBalance: (userRecord!.pointsBalance - data.pointsToRedeem), updatedAt: new Date() })
          .where(eq(users.id, session.user.id));
      }

      return order;
    });

    // 7. Create Midtrans transaction
    const customerName = session?.user?.name || data.guestName || 'Pelanggan';
    const customerEmail = session?.user?.email || data.guestEmail || '';
    const customerPhone = data.guestPhone || '';

    const midtransItems = [
      ...data.items.map(item => {
        const variant = dbVariants.find(v => v.id === item.variantId)!;
        return {
          id: item.variantId,
          name: `${variant.product.name} - ${variant.name}`,
          price: variant.price,
          quantity: item.quantity,
        };
      }),
    ];

    if (shippingCost > 0) {
      midtransItems.push({
        id: 'shipping',
        name: `Ongkos Kirir ${data.courierName || ''}`,
        price: shippingCost,
        quantity: 1,
      });
    }

    const totalDiscount = couponDiscount + pointsDiscount;
    if (totalDiscount > 0) {
      midtransItems.push({
        id: 'discount',
        name: 'Diskon',
        price: -totalDiscount,
        quantity: 1,
      });
    }

    const midtransResponse = await createMidtransTransaction({
      orderNumber,
      midtransOrderId,
      totalAmount,
      customerName,
      customerEmail,
      customerPhone,
      items: midtransItems,
    });

    // Store snap token
    await db.update(orders)
      .set({ midtransSnapToken: midtransResponse.token })
      .where(eq(orders.id, newOrder.id));

    return NextResponse.json({
      orderNumber,
      orderId: newOrder.id,
      snapToken: midtransResponse.token,
      totalAmount,
    });

  } catch (error) {
    console.error('[POST /api/checkout/initiate]', error);
    return NextResponse.json({ error: 'Checkout gagal. Silakan coba lagi.' }, { status: 500 });
  }
}
```

---

## 4. RAJAONGKIR SHIPPING ENGINE

### 4.1 `lib/rajaongkir/client.ts`
```typescript
const BASE_URL = process.env.RAJAONGKIR_BASE_URL || 'https://api.rajaongkir.com/starter';
const API_KEY = process.env.RAJAONGKIR_API_KEY!;

export async function rajaongkirFetch(endpoint: string, options?: RequestInit) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      key: API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`RajaOngkir API error: ${response.status}`);
  }
  return response.json();
}
```

### 4.2 `lib/rajaongkir/calculate-cost.ts`
```typescript
import { rajaongkirFetch } from './client';

export const ALLOWED_SERVICES = [
  { courier: 'sicepat', service: 'FROZEN', courierName: 'SiCepat Frozen' },
  { courier: 'jne', service: 'YES', courierName: 'JNE YES' },
  { courier: 'anteraja', service: 'FROZEN', courierName: 'AnterAja Frozen' },
];

interface CostParams {
  origin: string;
  destination: string;
  weight: number;
  courier: string;
}

export async function calculateShippingCost(params: CostParams) {
  const body = new URLSearchParams({
    origin: params.origin,
    destination: params.destination,
    weight: params.weight.toString(),
    courier: params.courier,
  });

  return rajaongkirFetch('/cost', {
    method: 'POST',
    body: body.toString(),
  });
}
```

### 4.3 `app/api/shipping/provinces/route.ts`
```typescript
import { NextResponse } from 'next/server';
import { rajaongkirFetch } from '@/lib/rajaongkir/client';
import { unstable_cache } from 'next/cache';

const getProvinces = unstable_cache(
  async () => {
    const data = await rajaongkirFetch('/province');
    return data.rajaongkir.results;
  },
  ['rajaongkir-provinces'],
  { revalidate: 86400 } // 24 hours
);

export async function GET() {
  try {
    const provinces = await getProvinces();
    return NextResponse.json({ provinces });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch provinces' }, { status: 500 });
  }
}
```

### 4.4 `app/api/shipping/cities/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { rajaongkirFetch } from '@/lib/rajaongkir/client';
import { unstable_cache } from 'next/cache';

export async function GET(request: NextRequest) {
  try {
    const provinceId = new URL(request.url).searchParams.get('province');
    if (!provinceId) return NextResponse.json({ error: 'province required' }, { status: 400 });

    const getCities = unstable_cache(
      async () => {
        const data = await rajaongkirFetch(`/city?province=${provinceId}`);
        return data.rajaongkir.results;
      },
      [`rajaongkir-cities-${provinceId}`],
      { revalidate: 86400 }
    );

    const cities = await getCities();
    return NextResponse.json({ cities });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 500 });
  }
}
```

---

## 5. ORDER NUMBER GENERATOR

### 5.1 `lib/utils/generate-order-number.ts`
```typescript
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { like, count } from 'drizzle-orm';

export async function generateOrderNumber(): Promise<string> {
  const now = new Date();
  // Use Asia/Jakarta timezone
  const dateStr = now.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).split('/').reverse().join(''); // YYYYMMDD

  const prefix = `DDK-${dateStr}-`;

  // Count orders today to get next sequence
  const [result] = await db
    .select({ count: count() })
    .from(orders)
    .where(like(orders.orderNumber, `${prefix}%`));

  const sequence = (result?.count ?? 0) + 1;
  const paddedSeq = sequence.toString().padStart(4, '0');

  return `${prefix}${paddedSeq}`;
}
```

---

## 6. WEBHOOK HANDLER — COMPLETE IMPLEMENTATION

### 6.1 `app/api/webhooks/midtrans/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, users, coupons, pointsHistory, stockLogs } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyMidtransSignature } from '@/lib/midtrans/verify-webhook';
import { sendOrderConfirmationEmail, sendOrderCancelledEmail } from '@/lib/resend/send-email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = body;

    // 1. Verify Midtrans signature — REJECT if invalid
    const isValid = verifyMidtransSignature(order_id, status_code, gross_amount, signature_key);
    if (!isValid) {
      console.error('[WEBHOOK] Invalid Midtrans signature for order:', order_id);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // 2. Find order (handle -retry-N suffix)
    const baseOrderId = order_id.split('-retry-'); // e.g. "DDK-20260512-0047"
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, baseOrderId),
      with: { items: true, user: true },
    });

    if (!order) {
      console.error('[WEBHOOK] Order not found:', baseOrderId);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 3. Handle SETTLEMENT
    if (transaction_status === 'settlement' ||
        (transaction_status === 'capture' && fraud_status === 'accept')) {

      if (order.status === 'paid') {
        // Idempotency: already processed
        return NextResponse.json({ message: 'Already processed' });
      }

      await db.transaction(async (tx) => {
        // a) Update order status → paid
        await tx.update(orders)
          .set({
            status: 'paid',
            paymentStatus: 'settlement',
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        // b) Deduct stock for each item
        for (const item of order.items) {
          const variant = await tx.query.productVariants.findFirst({
            where: eq(productVariants.id, item.variantId),
          });
          if (variant) {
            const newStock = Math.max(0, variant.stock - item.quantity);
            await tx.update(productVariants)
              .set({ stock: newStock })
              .where(eq(productVariants.id, item.variantId));

            await tx.insert(stockLogs).values({
              variantId: item.variantId,
              userId: order.userId,
              oldStock: variant.stock,
              newStock,
              reason: 'order_fulfilled',
              orderId: order.id,
            });
          }
        }

        // c) Confirm coupon used_count
        if (order.couponId) {
          const coupon = await tx.query.coupons.findFirst({
            where: eq(coupons.id, order.couponId),
          });
          if (coupon) {
            await tx.update(coupons)
              .set({ usedCount: coupon.usedCount + 1 })
              .where(eq(coupons.id, order.couponId));
          }
        }

        // d) Award loyalty points to registered user
        if (order.userId && order.subtotal > 0) {
          const pointsEarned = Math.floor(order.subtotal / 1000);
          if (pointsEarned > 0) {
            const user = await tx.query.users.findFirst({
              where: eq(users.id, order.userId),
            });
            if (user) {
              const newBalance = user.pointsBalance + pointsEarned;
              const expiresAt = new Date();
              expiresAt.setFullYear(expiresAt.getFullYear() + 1);

              await tx.update(users)
                .set({ pointsBalance: newBalance, updatedAt: new Date() })
                .where(eq(users.id, order.userId));

              await tx.insert(pointsHistory).values({
                userId: order.userId,
                type: 'earn',
                points: pointsEarned,
                balanceAfter: newBalance,
                orderId: order.id,
                orderNumber: order.orderNumber,
                description: `Pembelian ${order.orderNumber}`,
                expiresAt,
              });

              // Update pointsEarned on order
              await tx.update(orders)
                .set({ pointsEarned })
                .where(eq(orders.id, order.id));
            }
          }
        }
      });

      // e) Send confirmation email (outside transaction)
      try {
        await sendOrderConfirmationEmail(order);
      } catch (emailError) {
        console.error('[WEBHOOK] Email send failed (non-critical):', emailError);
      }

      return NextResponse.json({ message: 'Settlement processed' });
    }

    // 4. Handle PENDING — no action needed
    if (transaction_status === 'pending') {
      return NextResponse.json({ message: 'Pending acknowledged' });
    }

    // 5. Handle DENY / CANCEL / EXPIRE — reverse everything
    if (['deny', 'cancel', 'expire', 'failure'].includes(transaction_status)) {
      if (['cancelled', 'refunded'].includes(order.status)) {
        return NextResponse.json({ message: 'Already cancelled' });
      }

      await db.transaction(async (tx) => {
        // a) Update order status → cancelled
        await tx.update(orders)
          .set({
            status: 'cancelled',
            paymentStatus: transaction_status as any,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        // b) Reverse tentative points deduction
        if (order.pointsUsed > 0 && order.userId) {
          const user = await tx.query.users.findFirst({
            where: eq(users.id, order.userId),
          });
          if (user) {
            const newBalance = user.pointsBalance + order.pointsUsed;
            await tx.update(users)
              .set({ pointsBalance: newBalance, updatedAt: new Date() })
              .where(eq(users.id, order.userId));

            await tx.insert(pointsHistory).values({
              userId: order.userId,
              type: 'adjust',
              points: order.pointsUsed,
              balanceAfter: newBalance,
              orderId: order.id,
              orderNumber: order.orderNumber,
              description: `Pembalikan poin — pesanan dibatalkan ${order.orderNumber}`,
            });
          }
        }
      });

      // c) Send cancellation email
      try {
        await sendOrderCancelledEmail(order);
      } catch (emailError) {
        console.error('[WEBHOOK] Cancel email failed (non-critical):', emailError);
      }

      return NextResponse.json({ message: 'Cancellation processed' });
    }

    return NextResponse.json({ message: 'Event acknowledged' });

  } catch (error) {
    console.error('[WEBHOOK /midtrans]', error);
    // Return 200 to Midtrans even on internal error — prevents retry storm
    // Log to monitoring instead
    return NextResponse.json({ error: 'Internal error' }, { status: 200 });
  }
}
```

---

## 7. EMAIL ENGINE

### 7.1 `lib/resend/send-email.ts`
```typescript
import { Resend } from 'resend';
import { OrderConfirmation } from './templates/OrderConfirmation';
import { OrderShipped } from './templates/OrderShipped';
import { OrderDelivered } from './templates/OrderDelivered';
import { OrderCancelled } from './templates/OrderCancelled';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`;

export async function sendOrderConfirmationEmail(order: any) {
  const to = order.userId ? order.user?.email : order.guestEmail;
  if (!to) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: ` Pesanan ${order.orderNumber} Dikonfirmasi — Dapur Dekaka`,
    react: OrderConfirmation({ order }),
  });
}

export async function sendOrderShippedEmail(order: any) {
  const to = order.userId ? order.user?.email : order.guestEmail;
  if (!to) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: ` Pesanan ${order.orderNumber} Sedang Dikirim`,
    react: OrderShipped({ order }),
  });
}

export async function sendOrderDeliveredEmail(order: any) {
  const to = order.userId ? order.user?.email : order.guestEmail;
  if (!to) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: ` Pesanan ${order.orderNumber} Sudah Tiba!`,
    react: OrderDelivered({ order }),
  });
}

export async function sendOrderCancelledEmail(order: any) {
  const to = order.userId ? order.user?.email : order.guestEmail;
  if (!to) return;

  await resend.emails.send({
    from: FROM,
    to,
    subject: ` Pesanan ${order.orderNumber} Dibatalkan`,
    react: OrderCancelled({ order }),
  });
}
```

---

## 8. POINTS ENGINE

### 8.1 `lib/utils/calculate-points.ts`
```typescript
import { db } from '@/lib/db';
import { users, pointsHistory } from '@/lib/db/schema';
import { eq, and, lt } from 'drizzle-orm';

export function calculatePointsToEarn(subtotal: number, isB2b: boolean = false): number {
  const rate = isB2b ? 2 : 1; // B2B earns double
  return Math.floor(subtotal / 1000) * rate;
}

export function calculatePointsDiscount(points: number): number {
  return Math.floor(points / 100) * 1000; // 100 pts = IDR 1,000
}

// Run via cron or scheduled job to expire points
export async function expirePoints() {
  const now = new Date();
  const expiredPoints = await db.query.pointsHistory.findMany({
    where: and(
      eq(pointsHistory.isExpired, false),
      eq(pointsHistory.type, 'earn'),
      lt(pointsHistory.expiresAt, now)
    ),
    with: { user: true },
  });

  for (const record of expiredPoints) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, record.userId),
    });
    if (!user || user.pointsBalance <= 0) continue;

    const deduction = Math.min(record.points, user.pointsBalance);
    const newBalance = user.pointsBalance - deduction;

    await db.transaction(async (tx) => {
      await tx.update(users)
        .set({ pointsBalance: newBalance, updatedAt: now })
        .where(eq(users.id, record.userId));

      await tx.update(pointsHistory)
        .set({ isExpired: true })
        .where(eq(pointsHistory.id, record.id));

      await tx.insert(pointsHistory).values({
        userId: record.userId,
        type: 'expire',
        points: -deduction,
        balanceAfter: newBalance,
        orderNumber: record.orderNumber,
        description: `Poin kedaluwarsa (diperoleh ${record.createdAt.toLocaleDateString('id-ID')})`,
      });
    });
  }
}
```

---

## 9. ADMIN API ROUTES

### 9.1 `app/api/admin/orders/route.ts` — Order Management
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders, orderItems, productVariants, stockLogs } from '@/lib/db/schema';
import { eq, desc, like, and, inArray } from 'drizzle-orm';
import { sendOrderShippedEmail, sendOrderDeliveredEmail } from '@/lib/resend/send-email';

// GET — list orders (admin/owner/superadmin only)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session || !['superadmin', 'owner', 'warehouse'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (status) conditions.push(eq(orders.status, status as any));
  if (search) conditions.push(like(orders.orderNumber, `%${search}%`));

  const result = await db.query.orders.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    with: { items: true, user: true },
    orderBy: [desc(orders.createdAt)],
    limit,
    offset,
  });

  return NextResponse.json({ orders: result });
}

// PATCH — update order status
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { orderId, newStatus, trackingNumber } = await request.json();

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { user: true, items: true },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  // Warehouse can only set to 'shipped' via tracking number
  if (session.user.role === 'warehouse') {
    if (newStatus !== 'shipped' || !trackingNumber) {
      return NextResponse.json({ error: 'Warehouse can only update tracking number' }, { status: 403 });
    }
  }

  const updates: Record<string, any> = { status: newStatus, updatedAt: new Date() };
  if (trackingNumber) updates.trackingNumber = trackingNumber;
  if (newStatus === 'shipped') updates.shippedAt = new Date();
  if (newStatus === 'delivered') updates.deliveredAt = new Date();

  await db.update(orders).set(updates).where(eq(orders.id, orderId));

  // Send emails on key transitions
  const updatedOrder = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { user: true, items: true },
  });

  if (newStatus === 'shipped') {
    try { await sendOrderShippedEmail(updatedOrder); } catch (e) { console.error(e); }
  }
  if (newStatus === 'delivered') {
    try { await sendOrderDeliveredEmail(updatedOrder); } catch (e) { console.error(e); }
  }

  return NextResponse.json({ success: true });
}
```

### 9.2 `app/api/admin/inventory/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productVariants, stockLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session || !['superadmin', 'owner', 'warehouse'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const variants = await db.query.productVariants.findMany({
    where: eq(productVariants.isActive, true),
    with: { product: true },
    orderBy: (v, { asc }) => [asc(v.sku)],
  });

  return NextResponse.json({ variants });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session || !['superadmin', 'owner', 'warehouse'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { variantId, newStock } = await request.json();
  if (newStock < 0) return NextResponse.json({ error: 'Stock cannot be negative' }, { status: 400 });

  const variant = await db.query.productVariants.findFirst({
    where: eq(productVariants.id, variantId),
  });
  if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 });

  await db.transaction(async (tx) => {
    await tx.update(productVariants)
      .set({ stock: newStock })
      .where(eq(productVariants.id, variantId));

    await tx.insert(stockLogs).values({
      variantId,
      userId: session.user.id,
      oldStock: variant.stock,
      newStock,
      reason: 'manual_adjustment',
    });
  });

  return NextResponse.json({ success: true });
}
```

---

## 10. SEED SCRIPT

### 10.1 `scripts/seed.ts`
```typescript
import { db } from '../lib/db';
import { categories, products, productVariants, users, coupons, carouselSlides } from '../lib/db/schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log(' Seeding database...');

  // 1. Categories
  const insertedCategories = await db.insert(categories).values([
    { name: 'Dimsum', nameEn: 'Dimsum', slug: 'dimsum', sortOrder: 1 },
    { name: 'Siomay', nameEn: 'Siomay', slug: 'siomay', sortOrder: 2 },
    { name: 'Bakso & Sosis', nameEn: 'Meatballs & Sausage', slug: 'bakso-sosis', sortOrder: 3 },
    { name: 'Snack Frozen', nameEn: 'Frozen Snacks', slug: 'snack-frozen', sortOrder: 4 },
    { name: 'Paket Hemat', nameEn: 'Bundle Deals', slug: 'paket-hemat', sortOrder: 5 },
  ]).returning();

  const catMap = Object.fromEntries(insertedCategories.map(c => [c.slug, c.id]));

  // 2. Products (19 SKUs from Dapur Dekaka Shopee store)
  const productData = [
    {
      name: 'Dimsum Mix Spesial', nameEn: 'Special Mix Dimsum', slug: 'dimsum-mix-spesial',
      categoryId: catMap['dimsum'], weightGram: 500, isFeatured: true, isB2bAvailable: true,
      variants: [
        { name: '25 pcs', sku: 'DDK-DMS-25', price: 45000, b2bPrice: 38000, stock: 50 },
        { name: '50 pcs', sku: 'DDK-DMS-50', price: 85000, b2bPrice: 72000, stock: 30 },
      ],
    },
    {
      name: 'Hakau Udang', nameEn: 'Shrimp Hakau', slug: 'hakau-udang',
      categoryId: catMap['dimsum'], weightGram: 300, isFeatured: true, isB2bAvailable: true,
      variants: [
        { name: '20 pcs', sku: 'DDK-HKU-20', price: 55000, b2bPrice: 47000, stock: 40 },
        { name: '40 pcs', sku: 'DDK-HKU-40', price: 105000, b2bPrice: 89000, stock: 20 },
      ],
    },
    {
      name: 'Siomay Udang Bambu', nameEn: 'Bamboo Shrimp Siomay', slug: 'siomay-udang-bambu',
      categoryId: catMap['siomay'], weightGram: 400, isFeatured: false, isB2bAvailable: true,
      variants: [
        { name: '20 pcs', sku: 'DDK-SUB-20', price: 50000, b2bPrice: 42000, stock: 35 },
        { name: '40 pcs', sku: 'DDK-SUB-40', price: 95000, b2bPrice: 80000, stock: 15 },
      ],
    },
    {
      name: 'Bakso Sapi Premium', nameEn: 'Premium Beef Meatball', slug: 'bakso-sapi-premium',
      categoryId: catMap['bakso-sosis'], weightGram: 500, isFeatured: true, isB2bAvailable: true,
      variants: [
        { name: '250 gr', sku: 'DDK-BSP-250', price: 35000, b2bPrice: 29000, stock: 60 },
        { name: '500 gr', sku: 'DDK-BSP-500', price: 65000, b2bPrice: 55000, stock: 25 },
      ],
    },
    {
      name: 'Paket Hemat Dimsum Keluarga', nameEn: 'Family Dimsum Bundle', slug: 'paket-hemat-dimsum-keluarga',
      categoryId: catMap['paket-hemat'], weightGram: 1000, isFeatured: true, isB2bAvailable: false,
      variants: [
        { name: '1 Paket (100 pcs mix)', sku: 'DDK-PHK-100', price: 155000, b2bPrice: null, stock: 20 },
      ],
    },
    // ... Continue seeding remaining 14 SKUs from Shopee catalog
  ];

  for (const pData of productData) {
    const [product] = await db.insert(products).values({
      name: pData.name, nameEn: pData.nameEn, slug: pData.slug,
      categoryId: pData.categoryId, weightGram: pData.weightGram,
      isFeatured: pData.isFeatured, isB2bAvailable: pData.isB2bAvailable,
      isActive: true, isHalal: true,
      images: [], // Placeholder — admin uploads via Cloudinary
    }).returning();

    for (let i = 0; i < pData.variants.length; i++) {
      const v = pData.variants[i];
      await db.insert(productVariants).values({
        productId: product.id,
        name: v.name, sku: v.sku, price: v.price,
        b2bPrice: v.b2bPrice ?? null, stock: v.stock,
        isActive: true, sortOrder: i,
      });
    }
  }

  // 3. Superadmin user
  const hashedPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD!, 12);
  await db.insert(users).values({
    name: 'Bashara (Superadmin)',
    email: process.env.SEED_ADMIN_EMAIL!,
    password: hashedPassword,
    role: 'superadmin',
    isActive: true,
  }).onConflictDoNothing();

  // 4. Sample coupons
  await db.insert(coupons).values([
    {
      code: 'SELAMATDATANG',
      type: 'percentage',
      value: 10,
      minOrder: 100000,
      isActive: true,
      description: 'Diskon 10% untuk pembelian pertama',
    },
    {
      code: 'GRATISONGKIR',
      type: 'free_shipping',
      value: 0,
      minOrder: 150000,
      isActive: true,
      description: 'Gratis ongkos kirim min. pembelian 150rb',
    },
  ]).onConflictDoNothing();

  // 5. Carousel slides
  await db.insert(carouselSlides).values([
    {
      imageUrl: 'https://res.cloudinary.com/placeholder/carousel-1.webp',
      title: 'Dimsum Premium Langsung dari Dapur',
      subtitle: 'Authentic Chinese-Indonesian taste, delivered frozen to your door',
      ctaText: 'Belanja Sekarang',
      ctaUrl: '/products',
      isActive: true,
      sortOrder: 1,
    },
  ]).onConflictDoNothing();

  console.log(' Seed complete!');
}

seed().catch(console.error);
```

---

## 11. ERROR HANDLING CONVENTIONS

All API routes MUST follow this pattern:

```typescript
// Standard error response format
return NextResponse.json(
  { error: 'Human-readable message in Bahasa Indonesia', code: 'MACHINE_CODE' },
  { status: 4xx | 5xx }
);

// Standard success response format
return NextResponse.json({ data: ..., message: 'Success message' });
```

### HTTP Status Code Rules
| Situation | Status Code |
|---|---|
| Unauthenticated | 401 |
| Wrong role/permission | 403 |
| Resource not found | 404 |
| Validation error | 400 |
| Duplicate/conflict | 409 |
| Server/DB error | 500 |
| External API failure | 502 |

### Console Logging Convention
```typescript
// Always prefix with route for easy filtering in Vercel logs
console.error('[POST /api/checkout/initiate]', error);
console.log('[WEBHOOK] Settlement processed:', orderNumber);
```

---

## 12. RATE LIMITING SETUP

### 12.1 `middleware.ts` — Add Rate Limiting Headers
```typescript
// For Vercel: use @upstash/ratelimit + @upstash/redis if needed
// Minimum: add basic rate limit via response headers on sensitive routes

const RATE_LIMITED_PATHS = [
  '/api/auth',
  '/api/coupons/validate',
  '/api/checkout/initiate',
];

// In middleware, add to Vercel Edge Config or use simple IP-based counting
// For production: add Upstash Redis rate limiter
```

### 12.2 Install Rate Limiting (production requirement)
```bash
npm install @upstash/ratelimit @upstash/redis
```

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const checkoutRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '10 m'), // 5 checkouts per 10 minutes per IP
});

export const couponRateLimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'),
});
```

---

## 13. CHECKOUT RETRY FLOW

### 13.1 `app/api/checkout/retry/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createMidtransTransaction } from '@/lib/midtrans/create-transaction';

export async function POST(request: NextRequest) {
  try {
    const { orderNumber } = await request.json();

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: { items: true, user: true },
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Order is not in pending status' }, { status: 400 });
    }
    if (order.paymentRetryCount >= 3) {
      // Auto-cancel after 3 retries
      await db.update(orders)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      return NextResponse.json({ error: 'Maksimum percobaan pembayaran tercapai. Pesanan dibatalkan.' }, { status: 400 });
    }

    const retryCount = order.paymentRetryCount + 1;
    const midtransOrderId = `${order.orderNumber}-retry-${retryCount}`;

    const midtransItems = order.items.map(item => ({
      id: item.variantId,
      name: `${item.productName} - ${item.variantName}`,
      price: item.price,
      quantity: item.quantity,
    }));

    if (order.shippingCost > 0) {
      midtransItems.push({ id: 'shipping', name: 'Ongkos Kirim', price: order.shippingCost, quantity: 1 });
    }

    const totalDiscount = order.couponDiscount + order.pointsDiscount;
    if (totalDiscount > 0) {
      midtransItems.push({ id: 'discount', name: 'Diskon', price: -totalDiscount, quantity: 1 });
    }

    const response = await createMidtransTransaction({
      orderNumber: order.orderNumber,
      midtransOrderId,
      totalAmount: order.totalAmount,
      customerName: order.user?.name || order.guestName || 'Pelanggan',
      customerEmail: order.user?.email || order.guestEmail || '',
      customerPhone: order.guestPhone || order.shippingPhone || '',
      items: midtransItems,
    });

    await db.update(orders)
      .set({
        midtransOrderId,
        midtransSnapToken: response.token,
        paymentRetryCount: retryCount,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    return NextResponse.json({ snapToken: response.token });
  } catch (error) {
    console.error('[POST /api/checkout/retry]', error);
    return NextResponse.json({ error: 'Retry failed' }, { status: 500 });
  }
}
```

---

*End of BACKEND_IMPLEMENTATION.md*