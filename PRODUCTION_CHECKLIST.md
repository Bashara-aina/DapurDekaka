# PRODUCTION_CHECKLIST.md — Production Readiness Guide
# DapurDekaka.com v2
**Version:** 1.0
**Status:** Pre-Launch Checklist
**Author:** Bashara (Technical Lead)
**Last Updated:** May 2026

---

## HOW TO USE THIS FILE

Work through each section **in order**. Each item must be checked off before moving to the next section.
Items marked `[CURSOR]` = Cursor executes the code/config.
Items marked `[MANUAL]` = Bashara does this manually (API keys, DNS, etc.).
Items marked `[TEST]` = must be verified in browser/Postman before marking done.

---

## TABLE OF CONTENTS
1. Environment Setup
2. Database Bootstrap
3. Authentication Setup
4. Payment Integration (Midtrans Sandbox)
5. Shipping Integration (RajaOngkir)
6. Email Integration (Resend)
7. Image Storage (Cloudinary)
8. AI Integration (Minimax)
9. Middleware & Security Hardening
10. SEO & Sitemap
11. Performance Verification
12. End-to-End Test Flows
13. Vercel Deployment
14. Production Switch (Midtrans Live)
15. Go-Live Final Checks

---

## 1. ENVIRONMENT SETUP

### 1.1 Required `.env.local` Variables — ALL must be set before `npm run dev`

```bash
# Verify each is filled — empty string = broken
DATABASE_URL=postgresql://...
AUTH_SECRET=                    # openssl rand -base64 32
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
MIDTRANS_SERVER_KEY=SB-Mid-server-...    # Sandbox key starts with SB-
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_IS_PRODUCTION=false
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=SB-Mid-client-...
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false
RAJAONGKIR_API_KEY=
RAJAONGKIR_BASE_URL=https://api.rajaongkir.com/starter
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@dapurdekaka.com
RESEND_FROM_NAME=Dapur Dekaka
MINIMAX_API_KEY=
MINIMAX_BASE_URL=https://api.minimaxi.chat/v1
MINIMAX_MODEL=MiniMax-M2.7
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_NUMBER=6281xxxxxxxxx
NEXT_PUBLIC_STORE_ADDRESS=Jl. Sinom V no. 7, Turangga, Bandung
NEXT_PUBLIC_GOOGLE_MAPS_URL=https://maps.google.com/?q=Jl+Sinom+V+No+7+Turangga+Bandung
SEED_ADMIN_EMAIL=bashara@dapurdekaka.com
SEED_ADMIN_PASSWORD=
```

**[CURSOR]** Create `scripts/verify-env.ts` — run this before every deploy:
```typescript
const REQUIRED_VARS = [
  'DATABASE_URL', 'AUTH_SECRET', 'AUTH_URL',
  'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET',
  'MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY',
  'RAJAONGKIR_API_KEY', 'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'RESEND_API_KEY', 'MINIMAX_API_KEY',
  'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_WHATSAPP_NUMBER',
];

const missing = REQUIRED_VARS.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error('❌ Missing env vars:', missing.join(', '));
  process.exit(1);
}
console.log('✅ All required env vars are set');
```

**[MANUAL]** Add to `package.json` scripts:
```json
"predev": "tsx scripts/verify-env.ts",
"prebuild": "tsx scripts/verify-env.ts"
```

---

## 2. DATABASE BOOTSTRAP

### 2.1 Initial Setup Sequence
```bash
# Step 1: Push schema to Neon (development)
npm run db:push

# Step 2: Verify schema in Drizzle Studio
npm run db:studio
# Open http://localhost:4983 — check all tables created

# Step 3: Run seed
npm run db:seed

# Step 4: Verify seed in studio
# ✅ categories table: 5 rows
# ✅ products table: 5+ rows (add remaining 14 from Shopee manually)
# ✅ product_variants table: variants per product
# ✅ users table: 1 superadmin row
# ✅ coupons table: SELAMATDATANG + GRATISONGKIR
# ✅ carousel_slides table: 1 row
```

### 2.2 Critical Index Verification
**[CURSOR]** Add to `scripts/verify-db.ts`:
```typescript
import { db } from '../lib/db';
import { products, orders, productVariants } from '../lib/db/schema';
import { count } from 'drizzle-orm';

async function verifyDb() {
  const [prodCount] = await db.select({ count: count() }).from(products);
  const [variantCount] = await db.select({ count: count() }).from(productVariants);

  console.log(`Products: ${prodCount.count}`);
  console.log(`Variants: ${variantCount.count}`);

  if (Number(prodCount.count) < 5) {
    console.error('❌ Not enough products seeded — add remaining SKUs');
    process.exit(1);
  }
  console.log('✅ Database looks healthy');
}

verifyDb().catch(console.error);
```

### 2.3 Required Manual Steps After Seeding
- [ ] **[MANUAL]** Upload product images to Cloudinary under `dapurdekaka/products/`
- [ ] **[MANUAL]** Update each product's `images` array in DB via Drizzle Studio or admin panel
- [ ] **[MANUAL]** Set real prices per variant (seed uses reference prices — adjust for website pricing = Shopee price × 0.84)
- [ ] **[MANUAL]** Add remaining 14 products from Shopee (`https://shopee.co.id/dapurdekaka`)

---

## 3. AUTHENTICATION SETUP

### 3.1 Google OAuth Configuration
- [ ] **[MANUAL]** Go to Google Cloud Console → APIs & Services → Credentials
- [ ] **[MANUAL]** Create OAuth 2.0 Client ID (Web application)
- [ ] **[MANUAL]** Add authorized origins: `http://localhost:3000`, `https://dapurdekaka.com`
- [ ] **[MANUAL]** Add authorized redirect URIs:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://dapurdekaka.com/api/auth/callback/google`
- [ ] **[MANUAL]** Copy Client ID → `AUTH_GOOGLE_ID`
- [ ] **[MANUAL]** Copy Client Secret → `AUTH_GOOGLE_SECRET`

### 3.2 Test Authentication
- [ ] **[TEST]** Navigate to `http://localhost:3000/auth/login`
- [ ] **[TEST]** Click "Masuk dengan Google" — should redirect and complete OAuth
- [ ] **[TEST]** After login, verify session in Drizzle Studio → `sessions` table has row
- [ ] **[TEST]** Navigate to `http://localhost:3000/admin` — superadmin should access dashboard
- [ ] **[TEST]** Register new email account at `/auth/register`
- [ ] **[TEST]** Login with email + password → should work
- [ ] **[TEST]** Try accessing `/admin` with customer account → should redirect to `/`
- [ ] **[TEST]** Warehouse account should only access `/admin/inventory` and `/admin/shipments`

### 3.3 Middleware Verification
**[CURSOR]** Verify `middleware.ts` matches this exact matcher config:
```typescript
export const config = {
  matcher: [
    '/admin/:path*',
    '/account/:path*',
    '/b2b/account/:path*',
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
```

---

## 4. PAYMENT INTEGRATION (MIDTRANS SANDBOX)

### 4.1 Midtrans Dashboard Setup
- [ ] **[MANUAL]** Login to `dashboard.sandbox.midtrans.com`
- [ ] **[MANUAL]** Settings → Access Keys → copy Server Key (`SB-Mid-server-...`) + Client Key
- [ ] **[MANUAL]** Settings → Configuration → Payment Notification URL:
  - Set to: `https://YOUR_VERCEL_PREVIEW_URL/api/webhooks/midtrans`
  - For local testing: use `ngrok http 3000` → `https://xxx.ngrok.io/api/webhooks/midtrans`
- [ ] **[MANUAL]** Settings → Snap Preferences → enable: VA, e-wallet (GoPay, OVO), QRIS, Credit Card
- [ ] **[MANUAL]** Settings → Configuration → Enable 3DS for credit card

### 4.2 Webhook Local Testing with ngrok
```bash
# Install ngrok
brew install ngrok

# Expose local server
ngrok http 3000

# Copy HTTPS URL (e.g. https://abc123.ngrok.io)
# Set in Midtrans dashboard: https://abc123.ngrok.io/api/webhooks/midtrans
```

### 4.3 Midtrans Sandbox Test Cases
**[TEST]** Complete all test scenarios using Midtrans simulator:

| Scenario | Test Card/Method | Expected Result |
|---|---|---|
| Successful payment | Card: 4811 1111 1111 1114, CVV: 123, Expiry: 01/25 | Order → `paid`, stock deducted |
| Denied payment | Card: 4911 1111 1111 1113 | Order → `cancelled`, points reversed |
| VA pending then pay | BCA VA in simulator | Order stays `pending_payment`, then `paid` after simulated payment |
| QRIS payment | Simulate in Midtrans dashboard | Order → `paid` |
| Payment expire | Wait 15 min OR use simulator expire | Order → `cancelled` |

**[TEST]** After each successful payment:
- [ ] Check `orders` table: status = `paid`, `paid_at` set
- [ ] Check `product_variants` table: stock decremented correctly
- [ ] Check `points_history` table: new `earn` row (if logged in)
- [ ] Check email inbox: confirmation email received
- [ ] Check `/checkout/success?order=DDK-...` page renders correctly

### 4.4 Webhook Signature Verification Test
**[CURSOR]** Add `scripts/test-webhook.ts`:
```typescript
import crypto from 'crypto';

const orderId = 'DDK-20260514-0001';
const statusCode = '200';
const grossAmount = '236000.00';
const serverKey = process.env.MIDTRANS_SERVER_KEY!;

const hash = crypto
  .createHash('sha512')
  .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
  .digest('hex');

console.log('Expected signature:', hash);
// Compare with what Midtrans sends in webhook
```

---

## 5. SHIPPING INTEGRATION (RAJAONGKIR)

### 5.1 RajaOngkir Setup
- [ ] **[MANUAL]** Register at `rajaongkir.com` → get free Starter API key
- [ ] **[MANUAL]** Set `RAJAONGKIR_API_KEY` in `.env.local`
- [ ] **[MANUAL]** Verify Starter plan supports: sicepat, jne, anteraja couriers

### 5.2 Shipping API Tests
**[TEST]** Test each endpoint:
```bash
# Provinces
curl http://localhost:3000/api/shipping/provinces
# Expected: array of 34 Indonesian provinces

# Cities (Jawa Barat = province_id 9)
curl "http://localhost:3000/api/shipping/cities?province=9"
# Expected: array of cities in West Java

# Cost calculation (Bandung → Jakarta, 1.5kg)
curl -X POST http://localhost:3000/api/shipping/cost \
  -H "Content-Type: application/json" \
  -d '{"cityId": "152", "weightGram": 1500}'
# Expected: { available: true, services: [...SiCepat/JNE/AnterAja...] }
```

**[TEST]** Verify ONLY frozen services appear:
- [ ] SiCepat FROZEN appears
- [ ] JNE YES appears
- [ ] AnterAja FROZEN appears
- [ ] JNE REG does NOT appear
- [ ] J&T does NOT appear

**[TEST]** Test unavailable destination:
- Try a remote city_id that has no frozen service
- Expected: `{ available: false, services: [] }`
- UI shows WhatsApp redirect message

### 5.3 Weight Calculation Verification
**[TEST]** Add 3 × "Dimsum Mix 50pcs" (500g each) to cart:
- Total weight: 1500g
- Billable weight: 1500g (≥ 1000g minimum, already 100g multiple)
- Check `/api/shipping/cost` receives `weightGram: 1500`

---

## 6. EMAIL INTEGRATION (RESEND)

### 6.1 Resend Setup
- [ ] **[MANUAL]** Register at `resend.com` → get API key (free: 3,000 emails/month)
- [ ] **[MANUAL]** Add domain: `dapurdekaka.com` → follow DNS verification steps
- [ ] **[MANUAL]** Add DNS records: SPF, DKIM, DMARC (provided by Resend dashboard)
- [ ] **[MANUAL]** Verify domain (green checkmark in Resend dashboard)
- [ ] **[MANUAL]** Set `RESEND_FROM_EMAIL=noreply@dapurdekaka.com`

### 6.2 Email Template Tests
**[CURSOR]** Create `scripts/test-emails.ts`:
```typescript
import { resend } from '../lib/resend/client';
import { OrderConfirmation } from '../lib/resend/templates/OrderConfirmation';

const mockOrder = {
  orderNumber: 'DDK-20260514-TEST',
  items: [
    { productName: 'Dimsum Mix', variantName: '50 pcs', quantity: 2, price: 85000, subtotal: 170000 },
  ],
  subtotal: 170000,
  shippingCost: 25000,
  couponDiscount: 0,
  pointsDiscount: 0,
  totalAmount: 195000,
  courierName: 'SiCepat Frozen',
  shippingAddressLine: 'Jl. Test No. 1',
  shippingCity: 'Bandung',
  pointsEarned: 170,
  deliveryMethod: 'delivery',
  guestEmail: 'bashara@test.com',
  guestName: 'Bashara Test',
};

async function testEmail() {
  const result = await resend.emails.send({
    from: 'Dapur Dekaka <noreply@dapurdekaka.com>',
    to: 'bashara@test.com', // Your test email
    subject: 'TEST — Order Confirmation',
    react: OrderConfirmation({ order: mockOrder }),
  });
  console.log('Email sent:', result);
}

testEmail().catch(console.error);
```

**[TEST]** Run `tsx scripts/test-emails.ts` and verify:
- [ ] Email received in inbox (not spam)
- [ ] Brand colors correct (#C8102E header)
- [ ] Order details render correctly
- [ ] Mobile-responsive layout

---

## 7. IMAGE STORAGE (CLOUDINARY)

### 7.1 Cloudinary Setup
- [ ] **[MANUAL]** Register at `cloudinary.com` (free: 25GB)
- [ ] **[MANUAL]** Dashboard → Settings → Upload → Create upload preset: `dapurdekaka_products` (signed)
- [ ] **[MANUAL]** Copy cloud name, API key, API secret → set in `.env.local`

### 7.2 Upload API Test
**[TEST]** Test product image upload:
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@/path/to/test-image.jpg" \
  -F "folder=dapurdekaka/products"
# Expected: { url: "https://res.cloudinary.com/..." }
```

### 7.3 `app/api/upload/route.ts`
**[CURSOR]** Implement the upload route:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || !['superadmin', 'owner'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'dapurdekaka/products';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          transformation: [{ quality: 'auto', fetch_format: 'webp' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as any);
        }
      );
      uploadStream.end(buffer);
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    console.error('[POST /api/upload]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

---

## 8. AI INTEGRATION (MINIMAX)

### 8.1 Minimax Setup
- [ ] **[MANUAL]** Register at `minimaxi.chat` → get API key
- [ ] **[MANUAL]** Set `MINIMAX_API_KEY` in `.env.local`
- [ ] **[MANUAL]** Set `MINIMAX_MODEL=MiniMax-M2.7`

### 8.2 Caption Generator Test
**[TEST]** Test via admin panel at `/admin/ai-content`:
- Input product name: "Dimsum Mix Spesial"
- Platform: Instagram
- Language: Bahasa Indonesia
- Expected: valid JSON with `caption` + `hashtags` array
- [ ] Caption is in Indonesian
- [ ] Contains call to action to dapurdekaka.com
- [ ] 15 hashtags returned
- [ ] Response time < 10 seconds

---

## 9. MIDDLEWARE & SECURITY HARDENING

### 9.1 Complete `middleware.ts`
**[CURSOR]** This is the final middleware — replace any partial version:
```typescript
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // i18n middleware for store routes
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    return intlMiddleware(req as NextRequest);
  }

  // Admin protection
  if (pathname.startsWith('/admin')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }
    const adminRoles = ['superadmin', 'owner', 'warehouse'];
    if (!adminRoles.includes(session.user.role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Warehouse: only inventory + shipments
    if (session.user.role === 'warehouse') {
      const warehouseAllowed = ['/admin/inventory', '/admin/shipments'];
      if (!warehouseAllowed.some(p => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/inventory', req.url));
      }
    }
    // Owner: no settings, no users, no AI
    if (session.user.role === 'owner') {
      const ownerBlocked = ['/admin/settings', '/admin/users', '/admin/ai-content'];
      if (ownerBlocked.some(p => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/dashboard', req.url));
      }
    }
  }

  // Account protection
  if (pathname.startsWith('/account') || pathname.startsWith('/b2b/account')) {
    if (!session) {
      return NextResponse.redirect(new URL(`/auth/login?callbackUrl=${pathname}`, req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

### 9.2 Security Headers
**[CURSOR]** Add to `next.config.ts`:
```typescript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.sandbox.midtrans.com https://app.midtrans.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://res.cloudinary.com https://lh3.googleusercontent.com",
      "connect-src 'self' https://api.midtrans.com https://api.sandbox.midtrans.com",
      "frame-src https://app.sandbox.midtrans.com https://app.midtrans.com",
    ].join('; '),
  },
];

const nextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  // ... rest of config
};
```

### 9.3 Input Sanitization
**[CURSOR]** Install and use DOMPurify for any user-generated content rendered as HTML:
```bash
npm install isomorphic-dompurify
```
```typescript
// In blog content renderer:
import DOMPurify from 'isomorphic-dompurify';
const sanitizedContent = DOMPurify.sanitize(post.content);
```

### 9.4 `.gitignore` Critical Entries
**[CURSOR]** Verify `.gitignore` contains ALL of:
```gitignore
.env.local
.env.*.local
*.pem
full_export.sql
*.sql
/scripts/seed-production.ts
node_modules/
.next/
```

---

## 10. SEO & SITEMAP

### 10.1 Metadata Per Page
**[CURSOR]** Every page must export `generateMetadata()`. Template:
```typescript
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Dimsum Frozen Premium | Dapur Dekaka',
    description: 'Beli dimsum frozen premium langsung dari Dapur Dekaka. Pengiriman ke seluruh Indonesia dengan layanan cold-chain.',
    openGraph: {
      title: 'Dimsum Frozen Premium | Dapur Dekaka',
      description: '...',
      images: ['https://res.cloudinary.com/dapurdekaka/og-image.webp'],
      siteName: 'Dapur Dekaka',
      locale: 'id_ID',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Dimsum Frozen Premium | Dapur Dekaka',
      images: ['https://res.cloudinary.com/dapurdekaka/og-image.webp'],
    },
    robots: { index: true, follow: true },
    alternates: {
      canonical: 'https://dapurdekaka.com',
      languages: { 'id': 'https://dapurdekaka.com', 'en': 'https://dapurdekaka.com/en' },
    },
  };
}
```

### 10.2 `next-sitemap.config.js`
```javascript
/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: 'https://dapurdekaka.com',
  generateRobotsTxt: true,
  exclude: [
    '/admin/*',
    '/account/*',
    '/b2b/account/*',
    '/api/*',
    '/auth/*',
    '/checkout/*',
  ],
  robotsTxtOptions: {
    policies: [
      { userAgent: '*', allow: '/' },
      { userAgent: '*', disallow: ['/admin', '/account', '/api', '/checkout'] },
    ],
  },
  changefreq: 'daily',
  priority: 0.7,
  additionalPaths: async (config) => {
    // Dynamically add product pages
    const res = await fetch(`${config.siteUrl}/api/products`);
    const { products } = await res.json();
    return products.map((p: any) => ({
      loc: `/products/${p.slug}`,
      changefreq: 'weekly',
      priority: 0.9,
    }));
  },
};
```

### 10.3 `app/robots.txt/route.ts`
```typescript
export async function GET() {
  return new Response(
    `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /account/
Disallow: /api/
Disallow: /checkout/

Sitemap: https://dapurdekaka.com/sitemap.xml`,
    { headers: { 'Content-Type': 'text/plain' } }
  );
}
```

---

## 11. PERFORMANCE VERIFICATION

### 11.1 Bundle Analysis
```bash
# Analyze bundle size
npm install --save-dev @next/bundle-analyzer

# In next.config.ts:
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

# Run:
ANALYZE=true npm run build
```

**[TEST]** Verify these are NOT in main bundle:
- [ ] `@react-pdf/renderer` — must be dynamic import only
- [ ] `recharts` — must only load on `/admin/*` routes
- [ ] `@tiptap/react` — must only load on `/admin/blog/*`
- [ ] `canvas-confetti` — must only load on `/checkout/success`

### 11.2 Image Optimization Checks
**[TEST]** On product listing page:
- [ ] All product images use `next/image` component
- [ ] Images have `alt` text
- [ ] Images lazy-load (use browser DevTools → Network → filter images → scroll page)
- [ ] Images served as WebP (check response headers: `content-type: image/webp`)

### 11.3 Mobile Performance Test
**[TEST]** Open Chrome DevTools → Lighthouse on `http://localhost:3000`:
- [ ] Performance score ≥ 85
- [ ] LCP < 2.5s
- [ ] CLS < 0.1
- [ ] FID < 200ms
- [ ] No console errors

### 11.4 `vercel.json` — Final Config
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run db:migrate && npm run build",
  "installCommand": "npm install",
  "functions": {
    "app/api/webhooks/midtrans/route.ts": {
      "maxDuration": 30
    },
    "app/api/checkout/initiate/route.ts": {
      "maxDuration": 30
    },
    "app/api/shipping/cost/route.ts": {
      "maxDuration": 15
    }
  },
  "headers": [
    {
      "source": "/api/webhooks/(.*)",
      "headers": [{ "key": "x-robots-tag", "value": "noindex" }]
    }
  ]
}
```

---

## 12. END-TO-END TEST FLOWS

### FLOW A — Guest Checkout (Most Critical)
```
1. Open / (homepage) — verify carousel loads
2. Click on a product → verify product detail page
3. Select variant → click "Tambah ke Keranjang"
4. Cart icon shows count = 1
5. Open cart → item shows correctly
6. Click "Lanjut ke Pembayaran"
7. Step 1 (Guest Info): fill name, email, phone
8. Step 2 (Delivery): select "Kirim ke Alamat"
9. Step 3 (Address): select province → city auto-loads → fill address
10. Step 4 (Shipping): verify SiCepat/JNE/AnterAja options appear
11. Select SiCepat Frozen → price added to total
12. Step 5 (Coupon): enter "SELAMATDATANG" → 10% discount applied
13. Step 6 (Review): verify all amounts correct
14. Click "Bayar Sekarang" → Midtrans Snap popup opens
15. Use test card 4811-1111-1111-1114, CVV 123, 01/25 → complete payment
16. Redirected to /checkout/success → confetti animation
17. Check email inbox → confirmation email received with correct order details
18. Navigate to /orders/DDK-... → order tracking page shows correct status
```
**[TEST]** ✅ All 18 steps pass before marking complete

### FLOW B — Registered User Checkout with Points
```
1. Register account at /auth/register
2. Login
3. Add product to cart
4. At checkout: address auto-fills from saved address (if any)
5. Apply coupon SELAMATDATANG
6. Note: points balance = 0 for new user (cannot redeem yet)
7. Complete payment
8. Check points_history table: earn row created
9. Logout + login again
10. Add product → checkout → points balance now visible → toggle "Gunakan Poin"
11. Complete payment → points deducted correctly
```

### FLOW C — Pickup Order
```
1. Guest checkout → select "Ambil Sendiri"
2. Verify: no address form, no shipping step, no courier
3. Complete payment
4. Navigate to /orders/[orderNumber]/pickup
5. Verify pickup invitation shows:
   - Order number large and visible
   - Step-by-step pickup instructions
   - Store address: Jl. Sinom V no. 7, Turangga, Bandung
   - Google Maps link
   - WhatsApp link
```

### FLOW D — Admin Order Management
```
1. Login as superadmin
2. Navigate to /admin/orders
3. Find the test order from Flow A
4. Update status: paid → processing → packed
5. Navigate to /admin/shipments
6. Enter tracking number: "TEST123456"
7. Verify: order status auto-updates to "shipped"
8. Check email: shipping notification sent to customer with tracking link
9. Update to "delivered"
10. Check email: delivered notification sent
```

### FLOW E — Warehouse Staff
```
1. Create warehouse user in DB (role: warehouse)
2. Login as warehouse
3. Verify: only /admin/inventory and /admin/shipments accessible
4. Any attempt to access /admin/dashboard → redirect to /admin/inventory
5. Update stock for a variant
6. Check stock_logs table: log entry created with userId, old/new stock
```

### FLOW F — Payment Failure Flow
```
1. Start checkout → reach payment step
2. Use denied card: 4911 1111 1111 1113
3. Midtrans shows error → popup closes
4. Redirected to /checkout/failed
5. "Coba Lagi" button visible
6. Check DB: order status = "cancelled"
7. Check DB: points reversed (if any were deducted)
8. Cancellation email received
```

### FLOW G — Language Toggle
```
1. Open homepage (default: Bahasa Indonesia)
2. Click language toggle → switch to English
3. Verify: all UI labels switch to English
4. Navigate to /products → English labels persist
5. Reload page → English preference maintained (cookie)
6. Switch back to Indonesian → works correctly
```

---

## 13. VERCEL DEPLOYMENT

### 13.1 Vercel Project Setup
- [ ] **[MANUAL]** Push code to GitHub: `git push origin main`
- [ ] **[MANUAL]** Go to `vercel.com` → New Project → Import `DapurDekaka-v2`
- [ ] **[MANUAL]** Framework: Next.js (auto-detected)
- [ ] **[MANUAL]** Build Command: `npm run db:migrate && npm run build`
- [ ] **[MANUAL]** Install Neon integration: Vercel Dashboard → Integrations → Neon → Connect → auto-injects `DATABASE_URL`

### 13.2 Environment Variables in Vercel
- [ ] **[MANUAL]** Add ALL env vars from `.env.example` in Vercel Dashboard → Settings → Environment Variables
- [ ] **[MANUAL]** Set `AUTH_URL=https://dapurdekaka.com` (Production) / `https://preview-url.vercel.app` (Preview)
- [ ] **[MANUAL]** Set `NEXT_PUBLIC_APP_URL=https://dapurdekaka.com`
- [ ] **[MANUAL]** Keep `MIDTRANS_IS_PRODUCTION=false` for Preview, `true` for Production

### 13.3 Domain Configuration
- [ ] **[MANUAL]** Vercel → Settings → Domains → Add `dapurdekaka.com`
- [ ] **[MANUAL]** Update DNS at domain registrar: add Vercel nameservers or CNAME
- [ ] **[MANUAL]** Verify SSL: green lock icon in browser within 10 minutes of DNS propagation
- [ ] **[MANUAL]** Add `www.dapurdekaka.com` → set redirect to `dapurdekaka.com`

### 13.4 Verify Deployment
- [ ] **[TEST]** Open `https://dapurdekaka.com` → homepage loads
- [ ] **[TEST]** Open `https://dapurdekaka.com/products` → products list
- [ ] **[TEST]** Open `https://dapurdekaka.com/admin` → redirects to login (not 500)
- [ ] **[TEST]** Check Vercel deployment logs → no build errors
- [ ] **[TEST]** Vercel Functions tab → API routes responding

---

## 14. PRODUCTION SWITCH (MIDTRANS LIVE)

### 14.1 Pre-Production Requirements
Complete ALL of the following before switching to production Midtrans:
- [ ] Minimum 10 sandbox test orders completed successfully
- [ ] All 6 E2E test flows pass
- [ ] Google PageSpeed score ≥ 85 (mobile)
- [ ] No console errors on any page
- [ ] Email confirmations working end-to-end
- [ ] Admin can manage orders correctly

### 14.2 Midtrans Production Activation
- [ ] **[MANUAL]** Login to `dashboard.midtrans.com` (production — not sandbox)
- [ ] **[MANUAL]** Complete business verification: upload KTP, NPWP, business documents
- [ ] **[MANUAL]** Wait for approval (1–3 business days)
- [ ] **[MANUAL]** After approval: Settings → Access Keys → copy production Server Key + Client Key (no `SB-` prefix)
- [ ] **[MANUAL]** Update Vercel env vars:
  - `MIDTRANS_SERVER_KEY` = production key
  - `MIDTRANS_CLIENT_KEY` = production key
  - `MIDTRANS_IS_PRODUCTION=true`
  - `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` = production key
  - `NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true`
- [ ] **[MANUAL]** Update webhook URL in Midtrans production dashboard: `https://dapurdekaka.com/api/webhooks/midtrans`
- [ ] **[MANUAL]** Redeploy Vercel: `vercel --prod`

### 14.3 First Real Transaction Test
- [ ] **[MANUAL]** Do a real IDR 10,000 test transaction (minimum amount) to verify production keys work
- [ ] **[MANUAL]** Confirm payment goes through → check Midtrans production dashboard
- [ ] **[MANUAL]** Issue refund from Midtrans dashboard for that test transaction

---

## 15. GO-LIVE FINAL CHECKS

### 15.1 Content Readiness
- [ ] **[MANUAL]** All 19 products have real photos uploaded to Cloudinary
- [ ] **[MANUAL]** All product descriptions written in Indonesian + English
- [ ] **[MANUAL]** Homepage carousel has 3+ real product images
- [ ] **[MANUAL]** Minimum 1 blog post published (SEO)
- [ ] **[MANUAL]** About page / brand story content written
- [ ] **[MANUAL]** WhatsApp number set correctly in env vars
- [ ] **[MANUAL]** Store opening hours configured in settings

### 15.2 Legal & Compliance
- [ ] **[MANUAL]** Privacy Policy page created at `/privacy`
- [ ] **[MANUAL]** Terms of Service page created at `/terms`
- [ ] **[MANUAL]** Halal certificate image uploaded and displayed on product pages
- [ ] **[MANUAL]** Refund policy written and visible at checkout

### 15.3 Operational Readiness
- [ ] **[MANUAL]** Girlfriend (Owner role) account created and tested
- [ ] **[MANUAL]** Warehouse staff account created and tested
- [ ] **[MANUAL]** Staff briefed on: checking orders, updating tracking numbers via mobile
- [ ] **[MANUAL]** WhatsApp Business set up and linked in floating button

### 15.4 Monitoring Setup
- [ ] **[MANUAL]** Enable Vercel Analytics: Dashboard → Analytics → Enable
- [ ] **[MANUAL]** Enable Vercel Speed Insights: Dashboard → Speed Insights → Enable
- [ ] **[MANUAL]** Set up Vercel error alerts: Dashboard → Settings → Notifications → Email on deploy failure
- [ ] **[MANUAL]** Add Google Analytics 4: get Measurement ID → add `NEXT_PUBLIC_GA_ID` to env

**[CURSOR]** Add Google Analytics to `app/layout.tsx`:
```typescript
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
      {process.env.NEXT_PUBLIC_GA_ID && (
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
      )}
    </html>
  );
}
```

### 15.5 Launch Announcement
- [ ] **[MANUAL]** Post Instagram announcement (use AI caption generator!)
- [ ] **[MANUAL]** Post on Threads + TikTok
- [ ] **[MANUAL]** Send WhatsApp blast to existing customers
- [ ] **[MANUAL]** Announce "SELAMATDATANG" coupon (10% off first order)
- [ ] **[MANUAL]** Monitor Vercel logs for first 2 hours post-launch

---

## QUICK REFERENCE: COMMON ERRORS & FIXES

| Error | Cause | Fix |
|---|---|---|
| `DATABASE_URL not found` | Missing env var | Check `.env.local` exists and is filled |
| `Invalid signature` in webhook | Wrong server key or signature calc | Verify `MIDTRANS_SERVER_KEY` matches dashboard |
| `RajaOngkir 403` | Invalid API key | Check `RAJAONGKIR_API_KEY` |
| Cart not persisting | Zustand persist not set up | Verify `persist` middleware in `cart.store.ts` |
| Google login redirect error | Redirect URI mismatch | Add exact URL to Google Cloud Console |
| PDF not generating | `@react-pdf/renderer` in SSR | Ensure dynamic import with `{ ssr: false }` |
| Points not awarded | Webhook not firing | Check ngrok/webhook URL in Midtrans settings |
| Stock not deducting | Duplicate webhook processing | Add idempotency check: `if (order.status === 'paid') return` |
| Admin 401 on API | Role not in session | Check NextAuth session callback returns `role` |
| Shipping returns empty | Courier not on Starter plan | Verify RajaOngkir Starter supports sicepat/jne/anteraja |

---

*End of PRODUCTION_CHECKLIST.md v1.0*
*DapurDekaka.com — Ready for Production*