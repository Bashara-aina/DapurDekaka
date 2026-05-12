````markdown
# CURSOR_RULES.md — AI Coding Agent Instructions
# DapurDekaka.com
**Version:** 1.0
**Last Updated:** May 2026
**Author:** Bashara (Technical Lead)
**Status:** Active — Read before writing ANY code

---

## CRITICAL NOTICE TO CURSOR

You are building **DapurDekaka.com** — a direct-to-consumer frozen food e-commerce platform
for a Chinese-Indonesian heritage brand based in Bandung, Indonesia.

Before writing any code:
1. Read `PRD.md` to understand WHAT to build and WHY
2. Read `TECH_STACK.md` to understand HOW to build it
3. Read `DESIGN_SYSTEM.md` to understand HOW it should look
4. Read `SCHEMA.md` to understand the database structure
5. Read THIS FILE for all coding rules and conventions

**If any instruction in this file conflicts with your default behavior — THIS FILE WINS.**

---

## TABLE OF CONTENTS
1. Project Identity & Context
2. Core Coding Principles
3. File & Folder Conventions
4. TypeScript Rules
5. Database & Drizzle Rules
6. API Route Rules
7. Authentication & Authorization Rules
8. Component Rules
9. Styling Rules (Tailwind + Design System)
10. Form & Validation Rules
11. State Management Rules
12. Performance Rules
13. i18n & Language Rules
14. Payment (Midtrans) Rules
15. Shipping (RajaOngkir) Rules
16. Email (Resend) Rules
17. Image (Cloudinary) Rules
18. AI Content (Minimax) Rules
19. Admin Dashboard Rules
20. Security Rules
21. Error Handling Rules
22. Testing Checklist
23. What NOT To Build
24. Feature-by-Feature Build Order

---

## 1. PROJECT IDENTITY & CONTEXT

### 1.1 What This Project Is
- Indonesian frozen food D2C e-commerce website
- Brand: Dapur Dekaka (德卡) — Chinese-Indonesian heritage, based in Bandung
- Stack: Next.js 14 App Router + TypeScript + Neon PostgreSQL + Drizzle ORM
- Deployed on Vercel (free tier — respect limits)
- All prices in IDR (Indonesian Rupiah) — integer, no decimals
- Primary language: Bahasa Indonesia. Secondary: English (toggle)

### 1.2 Absolute Business Rules (Never Violate)
- ❌ Never implement COD (Cash on Delivery)
- ❌ Never show non-cold-chain couriers (only SiCepat FROZEN, JNE YES, AnterAja FROZEN)
- ❌ Never allow stock to go below 0
- ❌ Never deduct stock before payment is confirmed (Midtrans settlement webhook)
- ❌ Never expose server keys to client (no NEXT_PUBLIC_ for sensitive keys)
- ❌ Never skip Midtrans webhook signature verification
- ❌ Never allow guest users to earn loyalty points
- ❌ Never allow warehouse role to access anything except /admin/inventory and /admin/shipments
- ✅ Always validate all coupon rules before applying (min order, expiry, max uses)
- ✅ Always snapshot product data in order_items at order creation time
- ✅ Always send email confirmation after Midtrans settlement webhook
- ✅ Always use IDR integer for all monetary values (never floats)

---

## 2. CORE CODING PRINCIPLES

### 2.1 The Golden Rules

```
1. EXPLICIT OVER IMPLICIT
   Never use `any` in TypeScript. Every type must be declared or inferred.

2. SERVER-FIRST
   Default to Server Components. Use 'use client' only when necessary.
   Reason: mobile performance — reduce JS bundle.

3. FAIL LOUDLY
   Throw errors explicitly. Never silently swallow errors.
   All API routes return structured error responses.

4. ONE SOURCE OF TRUTH
   Business logic lives in /lib — never duplicated in components or API routes.
   Validation schemas in /lib/validations — reused on both client and server.

5. NEVER TRUST THE CLIENT
   Validate EVERYTHING on the server, even if validated on client.
   Re-fetch prices and stock from DB on checkout — never trust cart payload.

6. COMMENTS FOR WHY, NOT WHAT
   Code explains WHAT. Comments explain WHY.
   Only comment non-obvious business logic, not obvious code.
```

### 2.2 File Length Rule
- Maximum file length: **300 lines**
- If a file exceeds 300 lines: split into smaller files
- Exception: `schema.ts` (single source of truth for DB schema)

### 2.3 Function Rules
- Maximum function length: **50 lines**
- One function = one responsibility
- Functions that return data must have explicit return type annotations
- Async functions must handle errors with try/catch

### 2.4 Import Order
Always maintain this import order (enforced by ESLint):
```typescript
// 1. React / Next.js core
import { useState, useEffect } from 'react';
import { NextRequest, NextResponse } from 'next/server';
import Link from 'next/link';
import Image from 'next/image';

// 2. Third-party libraries
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

// 3. Internal — lib/
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { formatIDR } from '@/lib/utils/format-currency';

// 4. Internal — components/
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/components/store/products/ProductCard';

// 5. Types
import type { Order } from '@/lib/db/schema';

// 6. Styles (rarely needed, prefer Tailwind)
import styles from './Component.module.css';
```

---

## 3. FILE & FOLDER CONVENTIONS

### 3.1 Naming Conventions
```
Components:     PascalCase          ProductCard.tsx
Hooks:          camelCase + use     useCart.ts
Utilities:      kebab-case          format-currency.ts
API routes:     route.ts            (Next.js convention)
Pages:          page.tsx            (Next.js convention)
Layouts:        layout.tsx          (Next.js convention)
Types:          kebab-case.types.ts order.types.ts
Schemas:        kebab-case.schema.ts checkout.schema.ts
Store files:    kebab-case.store.ts cart.store.ts
Constants:      SCREAMING_SNAKE     MAX_CART_QUANTITY
```

### 3.2 Component File Structure
Every component file must follow this exact structure:
```typescript
// 1. Imports
// 2. Types/interfaces (local to file)
// 3. Constants (local to file)
// 4. Component function
// 5. Sub-components (if small enough to colocate)
// 6. Default export

// CORRECT:
interface ProductCardProps {
  product: Product;
  className?: string;
}

const MAX_DISPLAY_STOCK = 10;

export function ProductCard({ product, className }: ProductCardProps) {
  // ...
}

export default ProductCard;
```

### 3.3 Page File Structure
```typescript
// app/(store)/products/[slug]/page.tsx

// Must always have:
import type { Metadata } from 'next';

// generateMetadata for SEO
export async function generateMetadata({ params }): Promise<Metadata> { }

// generateStaticParams for ISR (if applicable)
export async function generateStaticParams() { }

// Default export = page component
export default async function ProductPage({ params }) { }
```

### 3.4 Route Handler Structure
```typescript
// app/api/[route]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

// Always define request schema
const RequestSchema = z.object({ ... });

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check (if required)
    const session = await auth();
    if (!session) return unauthorized();

    // 2. Parse + validate body
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    // 3. Business logic
    const result = await doSomething(parsed.data);

    // 4. Return success
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    return serverError(error);
  }
}
```

---

## 4. TYPESCRIPT RULES

### 4.1 Strict Mode
`tsconfig.json` must have:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 4.2 Type Rules
```typescript
// ❌ NEVER use `any`
const data: any = await fetch(...);

// ✅ USE unknown + type guard
const data: unknown = await fetch(...);
if (isOrder(data)) { ... }

// ❌ NEVER use type assertion without guard
const order = data as Order;

// ✅ USE Zod parse for runtime validation
const order = OrderSchema.parse(data);

// ❌ NEVER ignore TypeScript errors with @ts-ignore
// @ts-ignore
doSomething(wrongType);

// ✅ FIX the type properly

// ❌ NEVER use optional chaining to hide type errors
const price = product?.variant?.price; // if variant should always exist

// ✅ ASSERT non-null with reason comment
const variant = product.variants; // products always have at least 1 variant
```

### 4.3 Type Definitions
```typescript
// ✅ Prefer Drizzle inferred types
import type { Order, Product } from '@/lib/db/schema';

// ✅ Use utility types for partials
type UpdateOrderInput = Partial<Pick<Order, 'status' | 'trackingNumber'>>;

// ✅ Strict API response types
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; code: string };
```

---

## 5. DATABASE & DRIZZLE RULES

### 5.1 Connection Rule
```typescript
// ✅ ALWAYS import db from the single connection file
import { db } from '@/lib/db';

// ❌ NEVER create a new Drizzle instance inline
const db = drizzle(neon(process.env.DATABASE_URL!));
```

### 5.2 Query Rules
```typescript
// ✅ USE Drizzle relational queries for joined data
const order = await db.query.orders.findFirst({
  where: eq(orders.orderNumber, orderNumber),
  with: { items: true, statusHistory: true },
});

// ✅ USE Drizzle core for mutations
await db.insert(orders).values(newOrder);
await db.update(orders).set({ status: 'paid' }).where(eq(orders.id, orderId));

// ❌ NEVER use raw SQL unless absolutely unavoidable
await db.execute(sql`UPDATE orders SET status = 'paid'`);

// ✅ USE transactions for multi-table mutations
await db.transaction(async (tx) => {
  await tx.update(orders).set({ status: 'paid' }).where(eq(orders.id, orderId));
  await tx.update(productVariants).set({ stock: sql`stock - ${quantity}` }).where(...);
  await tx.insert(pointsHistory).values(newPointsRecord);
});
```

### 5.3 Transaction Rules
These operations MUST use database transactions (all-or-nothing):
1. **Payment settlement processing:**
   - Update order status → paid
   - Deduct stock for each variant
   - Award loyalty points
   - Confirm coupon usage

2. **Order cancellation:**
   - Update order status → cancelled
   - Reverse coupon used_count
   - Reverse points deduction

3. **Points redemption:**
   - Deduct from points_balance
   - Create points_history record
   - Apply to order

### 5.4 Stock Management Rules
```typescript
// ✅ ALWAYS use SQL expression for stock deduction (atomic, prevents race conditions)
await tx.update(productVariants)
  .set({
    stock: sql`GREATEST(stock - ${quantity}, 0)`,
    updatedAt: new Date(),
  })
  .where(
    and(
      eq(productVariants.id, variantId),
      gte(productVariants.stock, quantity) // safety check
    )
  );

// After deduction, check affected rows count
// If 0 rows affected = stock was insufficient = abort transaction

// ❌ NEVER do read-then-write for stock (race condition risk):
const variant = await db.query.productVariants.findFirst(...);
const newStock = variant.stock - quantity; // RACE CONDITION
await db.update(productVariants).set({ stock: newStock });
```

### 5.5 Soft Delete Rules
```typescript
// ✅ Products use soft delete
await db.update(products)
  .set({ deletedAt: new Date(), isActive: false })
  .where(eq(products.id, productId));

// ✅ Always filter soft-deleted in queries
const activeProducts = await db.query.products.findMany({
  where: and(
    eq(products.isActive, true),
    isNull(products.deletedAt)
  ),
});
```

### 5.6 Migration Rules
```bash
# After ANY schema change:
npm run db:generate  # generates migration file
npm run db:push      # applies to development DB

# NEVER manually edit generated migration files
# NEVER run db:push on production directly
# Production migrations run via: npm run db:migrate (in Vercel build)
```

---

## 6. API ROUTE RULES

### 6.1 Response Format
ALL API routes must return consistent JSON structure:
```typescript
// lib/utils/api-response.ts

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function success<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function created<T>(data: T) {
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json(
    { success: false, error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json(
    { success: false, error: message, code: 'FORBIDDEN' },
    { status: 403 }
  );
}

export function notFound(message = 'Not found') {
  return NextResponse.json(
    { success: false, error: message, code: 'NOT_FOUND' },
    { status: 404 }
  );
}

export function validationError(error: ZodError) {
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

export function serverError(error: unknown) {
  console.error('[API Error]', error);
  return NextResponse.json(
    { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```

### 6.2 HTTP Method Rules
```typescript
// ✅ Use correct HTTP methods:
// GET    — read data, no side effects
// POST   — create new resource or trigger action
// PUT    — replace entire resource
// PATCH  — partial update
// DELETE — delete resource

// ✅ Webhook endpoints use POST
// ✅ Search/filter can use GET with query params
// ❌ Never use GET for mutations (no side effects in GET)
```

### 6.3 Rate Limiting
Apply rate limiting to sensitive endpoints:
```typescript
// Use Vercel's edge rate limiting or simple in-memory for:
// /api/auth/[...nextauth]   — 10 req/min per IP
// /api/coupons/validate     — 20 req/min per IP
// /api/checkout/initiate    — 5 req/min per IP/user
// /api/ai/generate-caption  — 10 req/min per user
```

### 6.4 Webhook Security
```typescript
// app/api/webhooks/midtrans/route.ts
export async function POST(req: NextRequest) {
  const body = await req.json();

  // STEP 1: ALWAYS verify signature FIRST before any processing
  const isValid = verifyMidtransSignature(
    body.order_id,
    body.status_code,
    body.gross_amount,
    process.env.MIDTRANS_SERVER_KEY!,
    body.signature_key
  );

  if (!isValid) {
    console.warn('[Midtrans Webhook] Invalid signature', body.order_id);
    return NextResponse.json({ received: false }, { status: 400 });
  }

  // STEP 2: Check idempotency — prevent double-processing
  const existingOrder = await getOrderByMidtransId(body.order_id);
  if (existingOrder?.status === 'paid' && body.transaction_status === 'settlement') {
    return NextResponse.json({ received: true, note: 'already_processed' });
  }

  // STEP 3: Process based on transaction_status
  // ... rest of webhook logic
}
```

---

## 7. AUTHENTICATION & AUTHORIZATION RULES

### 7.1 Session Access
```typescript
// In Server Components / API Routes:
import { auth } from '@/lib/auth';
const session = await auth();

// In Client Components:
import { useSession } from 'next-auth/react';
const { data: session } = useSession();

// ✅ Always check session.user.role for permissions
// ✅ Never trust client-sent role information
```

### 7.2 Role Checking Pattern
```typescript
// lib/auth/check-role.ts
import { auth } from '@/lib/auth';
import type { UserRole } from '@/lib/db/schema';

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  if (!allowedRoles.includes(session.user.role as UserRole)) {
    throw new Error('FORBIDDEN');
  }
  return session;
}

// Usage in API routes:
export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(['superadmin', 'owner']);
    // ... rest of handler
  } catch (error) {
    if (error.message === 'UNAUTHORIZED') return unauthorized();
    if (error.message === 'FORBIDDEN') return forbidden();
    return serverError(error);
  }
}
```

### 7.3 Middleware Rules
The middleware in `middleware.ts` handles route protection:
- `/admin/*` — requires warehouse, owner, or superadmin
- `/admin/inventory` and `/admin/shipments` — warehouse can access
- All other `/admin/*` — owner and superadmin only
- `/account/*` — requires any authenticated user
- `/b2b/account/*` — requires b2b role
- All other routes — public (no auth required)

### 7.4 Guest Checkout Rules
```typescript
// Guest checkout collects: name, email, phone
// Store in order.recipientEmail for order tracking
// Guest can track at /orders/[orderNumber] by providing email
// Guest NEVER earns points — check userId is not null before awarding
if (order.userId) {
  await awardLoyaltyPoints(order.userId, pointsEarned);
}
```

---

## 8. COMPONENT RULES

### 8.1 Server vs Client Components
```typescript
// ✅ DEFAULT: Server Component (no directive needed)
// Use for: data fetching, static UI, SEO pages, layouts

// ✅ 'use client' ONLY when needed:
// - useState or useEffect
// - Browser APIs (window, localStorage)
// - Event listeners
// - Third-party client libraries (Midtrans Snap, etc.)
// - Zustand store access
// - useSession from next-auth/react

// ❌ NEVER put 'use client' on:
// - Layout files (breaks streaming)
// - Page files (loses server rendering benefits)
// - Large data-fetching components
```

### 8.2 Data Fetching Pattern
```typescript
// ✅ Fetch in Server Component, pass to Client Component
// app/(store)/products/[slug]/page.tsx (Server Component)
export default async function ProductPage({ params }) {
  const product = await getProductBySlug(params.slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}

// components/store/products/ProductDetail.tsx ('use client' — for cart interaction)
'use client';
export function ProductDetail({ product }: { product: Product }) {
  const { addToCart } = useCartStore();
  // ...
}
```

### 8.3 Loading States
Every page that fetches data must have a corresponding `loading.tsx`:
```typescript
// app/(store)/products/loading.tsx
export default function ProductsLoading() {
  return (
    <div className="container py-8">
      <div className="grid gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
```

### 8.4 Error Boundaries
Every route group must have an `error.tsx`:
```typescript
// Must be 'use client'
'use client';
export default function Error({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      illustration="surprised"
      title="Ups, ada yang tidak beres"
      description="Coba refresh halaman atau hubungi kami via WhatsApp"
      action={{ label: 'Coba Lagi', onClick: reset }}
    />
  );
}
```

### 8.5 Component Props Rules
```typescript
// ✅ Always define explicit Props interface
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}

// ✅ Use className prop for style extension (with cn helper)
import { cn } from '@/lib/utils/cn';

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button className={cn(baseStyles, variantStyles, className)} {...props} />
  );
}

// ❌ NEVER use inline styles except for dynamic values
// ❌ NEVER pass arbitrary CSS as props
```

---

## 9. STYLING RULES (TAILWIND + DESIGN SYSTEM)

### 9.1 Color Usage
```typescript
// ✅ ALWAYS use design system color tokens (from tailwind.config.ts)
className="bg-brand-red text-white"
className="bg-brand-cream text-text-primary"
className="border-brand-cream-dark"

// ❌ NEVER use arbitrary color values
className="bg-[#C8102E]"  // use bg-brand-red instead
className="text-[#1A1A1A]" // use text-text-primary instead

// ❌ NEVER use Tailwind's default colors for brand elements
className="bg-red-600"  // use bg-brand-red
className="bg-yellow-50" // use bg-brand-cream
```

### 9.2 Typography
```typescript
// ✅ Product names, headings: font-display (Playfair Display)
className="font-display text-display-sm font-semibold"

// ✅ UI labels, buttons, prices: font-body (Inter) — default
className="text-lg font-medium"

// ✅ Prices: always bold, brand-red, IDR format
className="font-body font-bold text-brand-red text-lg"
// Content: {formatIDR(price)}  →  "Rp 120.000"
```

### 9.3 Spacing Consistency
```typescript
// ✅ Use consistent padding for sections
className="py-12 md:py-16 lg:py-24"  // section vertical padding

// ✅ Card padding: always p-4 or p-6
className="p-4"  // compact card
className="p-6"  // standard card

// ✅ Container: always use the container class
className="container mx-auto"

// ❌ NEVER use arbitrary spacing values
className="mt-[37px]"  // use mt-9 or mt-10
```

### 9.4 Responsive Design
```typescript
// ✅ Mobile-first ALWAYS
// Start with mobile styles, add md:, lg:, xl: prefixes for larger screens

// ❌ WRONG (desktop-first):
className="flex-row md:flex-col"

// ✅ CORRECT (mobile-first):
className="flex-col md:flex-row"

// ✅ Bottom navigation clearance on ALL pages with content:
className="pb-20 md:pb-0"  // 80px for mobile bottom nav
```

### 9.5 Dark Mode
```typescript
// ❌ NEVER add dark: variants — dark mode is NOT supported
// The website is light mode only per brand decision
className="dark:bg-gray-900"  // ❌ FORBIDDEN
```

### 9.6 Animation Classes
```typescript
// ✅ Use predefined animation classes from tailwind.config.ts
className="animate-fade-in"
className="animate-slide-up"
className="animate-pulse-soft"  // WhatsApp button

// ✅ Framer Motion only for complex sequences
// ❌ Never import framer-motion in small utility components
// ❌ Never use framer-motion on admin pages
```

---

## 10. FORM & VALIDATION RULES

### 10.1 Form Stack
```typescript
// ALWAYS use react-hook-form + zod + @hookform/resolvers
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const CheckoutSchema = z.object({
  recipientName: z.string().min(2, 'Nama minimal 2 karakter'),
  recipientEmail: z.string().email('Email tidak valid'),
  recipientPhone: z
    .string()
    .regex(/^(\+62|62|0)[0-9]{8,13}$/, 'Format nomor HP tidak valid'),
});

type CheckoutForm = z.infer<typeof CheckoutSchema>;
```

### 10.2 Indonesian Phone Validation
```typescript
// ✅ Always validate Indonesian phone numbers
const indonesianPhone = z
  .string()
  .regex(
    /^(\+62|62|0)[0-9]{8,13}$/,
    'Masukkan nomor HP yang valid (contoh: 08123456789)'
  )
  .transform((val) => {
    // Normalize to 08xx format for display
    if (val.startsWith('+62')) return '0' + val.slice(3);
    if (val.startsWith('62')) return '0' + val.slice(2);
    return val;
  });
```

### 10.3 Error Message Language
```typescript
// ✅ ALL validation error messages in Bahasa Indonesia
z.string().min(1, 'Kolom ini wajib diisi')
z.string().email('Format email tidak valid')
z.number().min(1, 'Jumlah minimal 1')
z.string().max(500, 'Maksimal 500 karakter')

// ❌ NEVER use English error messages for customer-facing forms
z.string().min(1, 'Required')  // ❌
```

### 10.4 Server-Side Validation
```typescript
// ✅ ALWAYS re-validate on server even if client validates
// Client validation = UX improvement
// Server validation = security requirement
// NEVER skip server validation because client validated

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);
  // proceed only with parsed.data — typed and validated
}
```

---

## 11. STATE MANAGEMENT RULES

### 11.1 Cart Store (Zustand)
```typescript
// store/cart.store.ts
// Cart persisted to localStorage for guests
// Cart synced to DB for logged-in users

interface CartItem {
  variantId: string;
  productId: string;
  productNameId: string;
  productNameEn: string;
  variantNameId: string;
  variantNameEn: string;
  sku: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  weightGram: number;
  stock: number;  // current stock snapshot
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getTotalWeight: () => number;
}
```

### 11.2 Cart Merge on Login
```typescript
// When user logs in with items in cart:
// 1. Get localStorage cart
// 2. Get DB cart for user (if any)
// 3. Merge: if same variantId → add quantities (cap at 99)
// 4. Save merged cart to DB
// 5. Clear localStorage cart
// Implement in auth callback or login success handler
```

### 11.3 TanStack Query Rules
```typescript
// ✅ Define query keys as constants
export const queryKeys = {
  products: {
    all: ['products'] as const,
    list: (filters: ProductFilters) => ['products', 'list', filters] as const,
    detail: (slug: string) => ['products', 'detail', slug] as const,
  },
  orders: {
    byNumber: (orderNumber: string) => ['orders', orderNumber] as const,
    userList: (userId: string) => ['orders', 'user', userId] as const,
  },
} as const;

// ✅ Set appropriate stale times
// Products: staleTime: 5 * 60 * 1000  (5 minutes)
// Order status: staleTime: 30 * 1000  (30 seconds — poll on pending page)
// Cart validation: staleTime: 0       (always fresh)
```

---

## 12. PERFORMANCE RULES

### 12.1 Bundle Size Rules
```typescript
// ✅ Lazy load heavy libraries
const PDFDocument = dynamic(
  () => import('@/components/pdf/ReceiptDocument'),
  { ssr: false, loading: () => <p>Menyiapkan PDF...</p> }
);

const Confetti = dynamic(
  () => import('canvas-confetti'),
  { ssr: false }
);

// ✅ Admin-only libraries MUST be dynamic imported
const RevenueChart = dynamic(
  () => import('@/components/admin/dashboard/RevenueChart'),
  { ssr: false }
);

const TiptapEditor = dynamic(
  () => import('@/components/admin/blog/TiptapEditor'),
  { ssr: false }
);
```

### 12.2 Image Rules
```typescript
// ✅ ALWAYS use next/image for ALL images
import Image from 'next/image';

// ✅ Always provide width, height, and alt
<Image
  src={product.imageUrl}
  alt={product.altTextId ?? product.nameId}
  width={120}
  height={120}
  className="object-cover rounded-lg"
/>

// ✅ Use priority for above-fold images only
<Image priority src={carousel.imageUrl} ... />

// ❌ NEVER use <img> tag
// ❌ NEVER skip alt text
// ❌ NEVER use layout="fill" without a sized container
```

### 12.3 ISR Configuration
```typescript
// app/(store)/products/[slug]/page.tsx
export const revalidate = 60; // 60 seconds ISR

// app/(store)/products/page.tsx
export const revalidate = 300; // 5 minutes ISR

// app/(store)/blog/[slug]/page.tsx
export const revalidate = 86400; // 24 hours (blog rarely changes)

// app/(admin)/admin/dashboard/page.tsx
export const dynamic = 'force-dynamic'; // always fresh for admin
```

### 12.4 Database Query Optimization
```typescript
// ✅ Select only needed columns for list views
const products = await db
  .select({
    id: products.id,
    nameId: products.nameId,
    slug: products.slug,
    // only select what's displayed in card
  })
  .from(products)
  .where(eq(products.isActive, true));

// ✅ Use pagination for all list queries
const ITEMS_PER_PAGE = 20;
const offset = (page - 1) * ITEMS_PER_PAGE;

// ✅ Count separately for pagination
const [{ count }] = await db
  .select({ count: sql<number>`count(*)` })
  .from(orders);
```

---

## 13. I18N & LANGUAGE RULES

### 13.1 Content Rules
```typescript
// ✅ ALL user-facing strings go through next-intl
import { useTranslations } from 'next-intl';

export function AddToCartButton() {
  const t = useTranslations('store.product');
  return <button>{t('addToCart')}</button>;
}

// ❌ NEVER hardcode Indonesian or English strings in components
<button>Tambah ke Keranjang</button>  // ❌

// ✅ Exception: Admin-only UI can use English directly
// (admin users are always Bashara/Owner — no language toggle needed)
```

### 13.2 Translation File Structure
```json
// i18n/messages/id.json
{
  "store": {
    "product": {
      "addToCart": "Tambah ke Keranjang",
      "outOfStock": "Habis",
      "remainingStock": "Tersisa {count} pcs",
      "selectVariant": "Pilih Varian"
    },
    "cart": {
      "empty": "Keranjangmu masih kosong 🥺",
      "emptySubtitle": "Yuk, temukan dimsum favoritmu!",
      "startShopping": "Mulai Belanja"
    },
    "checkout": {
      "title": "Checkout",
      "delivery": "Pengiriman",
      "pickup": "Ambil di Toko",
      "payNow": "Bayar Sekarang"
    }
  }
}
```

### 13.3 Bilingual Database Content
```typescript
// ✅ Always use language-appropriate field based on locale
const locale = useLocale(); // 'id' or 'en'
const productName = locale === 'id' ? product.nameId : product.nameEn;
const description = locale === 'id' ? product.descriptionId : product.descriptionEn;

// ✅ Helper function
export function getLocalizedField(
  obj: { nameId: string; nameEn: string },
  locale: 'id' | 'en'
): string {
  return locale === 'id' ? obj.nameId : obj.nameEn;
}
```

### 13.4 Date & Number Formatting
```typescript
// ✅ Indonesian date format
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

format(new Date(), "d MMMM yyyy, HH:mm 'WIB'", { locale: idLocale });
// → "12 Mei 2026, 01:30 WIB"

// ✅ Currency format
formatIDR(120000)  // → "Rp 120.000"

// ✅ All times stored as UTC, displayed as WIB (UTC+7)
import { toZonedTime } from 'date-fns-tz';
const wibTime = toZonedTime(utcDate, 'Asia/Jakarta');
```

---

## 14. PAYMENT (MIDTRANS) RULES

### 14.1 Sandbox vs Production
```typescript
// ✅ Environment controlled by env var
const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true';

// ✅ Snap.js loaded from correct CDN
const snapUrl = isProduction
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js';

// Add as script tag with data-client-key attribute
```

### 14.2 Order ID Rules
```typescript
// Midtrans order_id must be UNIQUE per transaction
// On retry: append -retry-N suffix

function getMidtransOrderId(orderNumber: string, retryCount: number): string {
  if (retryCount === 0) return orderNumber;
  return `${orderNumber}-retry-${retryCount}`;
}
// "DDK-20260512-0047"           (first attempt)
// "DDK-20260512-0047-retry-1"   (first retry)
// "DDK-20260512-0047-retry-2"   (second retry)
```

### 14.3 Amount Rules
```typescript
// ✅ ALWAYS integer — Midtrans requires integer IDR amounts
// ✅ gross_amount MUST equal sum of item_details amounts
// ✅ Discount as negative item_detail entry

const itemDetails = [
  ...orderItems.map(item => ({
    id: item.variantId,
    price: item.unitPrice,      // integer
    quantity: item.quantity,    // integer
    name: item.productNameId.substring(0, 50),  // max 50 chars
  })),
  {
    id: 'shipping',
    price: shippingCost,         // integer
    quantity: 1,
    name: `Ongkir ${courierName}`,
  },
  // If discount exists:
  {
    id: 'discount',
    price: -(discountAmount + pointsDiscount),  // NEGATIVE integer
    quantity: 1,
    name: 'Diskon & Poin',
  },
];

// Verify: sum of (price × quantity) === totalAmount
const sum = itemDetails.reduce((acc, item) => acc + item.price * item.quantity, 0);
if (sum !== totalAmount) throw new Error('Amount mismatch — cannot create Midtrans transaction');
```

### 14.4 Webhook Idempotency
```typescript
// ✅ ALWAYS check if order was already processed
// Midtrans may send duplicate webhooks
// Before processing: check order.status !== 'paid'
// After processing: return 200 OK even for duplicates
```

### 14.5 Snap Token Handling
```typescript
// ✅ Store snap_token in order record temporarily
// ✅ Clear snap_token after payment (set to null)
// ✅ snap_token has 15-minute expiry — match payment_expires_at
// ❌ NEVER log or expose snap_token in responses
```

---

## 15. SHIPPING (RAJAONGKIR) RULES

### 15.1 Allowed Couriers Only
```typescript
// ✅ ONLY show these services — no others
const ALLOWED_COURIERS = [
  { code: 'sicepat', service: 'FROZEN', displayName: 'SiCepat FROZEN' },
  { code: 'jne',     service: 'YES',    displayName: 'JNE YES (Next Day)' },
  { code: 'anteraja',service: 'FROZEN', displayName: 'AnterAja Frozen' },
] as const;

// Filter RajaOngkir response strictly:
const allowedServices = rawResults.filter(result =>
  ALLOWED_COURIERS.some(
    allowed =>
      allowed.code === courierCode &&
      result.service === allowed.service
  )
);

// ❌ NEVER show: JNE REG, J&T, Pos Indonesia, or any regular (non-frozen) service
```

### 15.2 Origin City
```typescript
// ✅ Origin is ALWAYS Bandung
const ORIGIN_CITY_ID = '23'; // Bandung RajaOngkir ID
// This is also stored in system_settings as 'rajaongkir_origin_city_id'
```

### 15.3 Weight Calculation
```typescript
// ✅ Total weight = sum of (variant.weightGram × quantity) for all items
// ✅ Minimum billable weight: 1000g (1 kg)
// ✅ Round up to nearest 100g before API call

function calculateShippingWeight(items: CartItem[]): number {
  const totalGrams = items.reduce(
    (sum, item) => sum + item.weightGram * item.quantity, 0
  );
  const minimumGrams = 1000;
  const actualGrams = Math.max(totalGrams, minimumGrams);
  // Round up to nearest 100g
  return Math.ceil(actualGrams / 100) * 100;
}
```

### 15.4 No-Service Fallback
```typescript
// ✅ If no cold-chain courier available for destination:
if (allowedServices.length === 0) {
  return {
    available: false,
    message: 'Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia. ' +
             'Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus.',
    whatsappUrl: `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`,
  };
}
```

### 15.5 Caching
```typescript
// ✅ Cache province list in memory — never changes
let cachedProvinces: Province[] | null = null;
export async function getProvinces() {
  if (cachedProvinces) return cachedProvinces;
  cachedProvinces = await fetchProvincesFromRajaOngkir();
  return cachedProvinces;
}

// ✅ Cache cities per province — use unstable_cache
import { unstable_cache } from 'next/cache';
export const getCitiesByProvince = unstable_cache(
  async (provinceId: string) => fetchCitiesFromRajaOngkir(provinceId),
  ['rajaongkir-cities'],
  { revalidate: 86400 } // 24 hours
);

// ❌ NEVER cache shipping costs — always recalculate at checkout
```

---

## 16. EMAIL (RESEND) RULES

### 16.1 When to Send Emails
```typescript
// Trigger → Email template
const EMAIL_TRIGGERS = {
  'payment.settlement':    'OrderConfirmation',  // with PDF receipt
  'order.shipped':         'OrderShipped',        // with tracking info
  'order.delivered':       'OrderDelivered',      // thank you + points
  'order.cancelled':       'OrderCancelled',
  'points.expiring_30d':   'PointsExpiring',      // cron job
  'auth.password_reset':   'PasswordReset',
} as const;
```

### 16.2 Email Rules
```typescript
// ✅ From: noreply@dapurdekaka.com
// ✅ From name: "Dapur Dekaka 德卡"
// ✅ Subject lines in Bahasa Indonesia
// ✅ All emails mobile-responsive (React Email components)
// ✅ Max email size: 1MB (avoid large image attachments)
// ✅ PDF receipt attached as base64 for confirmation email

// ❌ NEVER send emails synchronously in webhook handler
// ✅ Send emails async — don't block webhook response
// Pattern: send 200 OK to Midtrans first, then send email
```

### 16.3 Email Error Handling
```typescript
// ✅ Email failures must NEVER block order processing
// Log the failure but don't throw
try {
  await sendOrderConfirmationEmail(order);
} catch (emailError) {
  console.error('[Email] Failed to send confirmation:', emailError);
  // Order is still confirmed — email failure is non-critical
}
```

---

## 17. IMAGE (CLOUDINARY) RULES

### 17.1 Upload Rules
```typescript
// ✅ All uploads go through server-side signed upload
// ❌ NEVER use unsigned client-side uploads
// ❌ NEVER expose CLOUDINARY_API_SECRET to client

// Upload flow:
// 1. Client requests signed upload URL from /api/upload
// 2. Server generates signed upload params
// 3. Client uploads directly to Cloudinary with signed params
// 4. Cloudinary returns public_id and URL
// 5. Client saves URL + public_id to database via form submit
```

### 17.2 Folder Organization
```typescript
const CLOUDINARY_FOLDERS = {
  products: 'dapurdekaka/products',
  blog:     'dapurdekaka/blog',
  carousel: 'dapurdekaka/carousel',
  avatars:  'dapurdekaka/avatars',
} as const;
```

### 17.3 Transformation Rules
```typescript
// ✅ Apply transformations at display time via URL params
// NOT at upload time (except for very large originals)

function getProductThumbnailUrl(cloudinaryUrl: string): string {
  // Insert transformation before /upload/
  return cloudinaryUrl.replace(
    '/upload/',
    '/upload/w_240,h_240,c_fill,g_center,f_webp,q_auto:good/'
  );
}

// ✅ Always use f_webp for web delivery
// ✅ Always use q_auto for automatic quality
// ✅ Always use c_fill with g_center for consistent cropping
```

---

## 18. AI CONTENT (MINIMAX) RULES

### 18.1 Access Control
```typescript
// ✅ AI content generation: SUPERADMIN ONLY
// Route: /admin/ai-content (superadmin only)
// API: /api/ai/generate-caption (requires superadmin session)
```

### 18.2 Prompt Rules
```typescript
// ✅ System prompt always includes brand context:
const SYSTEM_PROMPT = `
Kamu adalah content creator Dapur Dekaka (德卡), brand frozen food
Chinese-Indonesian premium dari Bandung. Tone: hangat, warisan kuliner,
berkualitas tinggi. Selalu sebut dapurdekaka.com sebagai channel pembelian.
`;

// ✅ Always specify language in prompt
// ✅ Always request JSON response format for structured output
// ✅ Cap max_tokens to control cost: 800 for captions
```

### 18.3 Error Handling
```typescript
// ✅ Minimax failures are non-critical — show error in UI, don't crash
// ✅ Show generated content in preview before saving
// ✅ Admin can edit generated content before publishing
// ✅ Blog posts have is_ai_assisted flag for transparency
```

---

## 19. ADMIN DASHBOARD RULES

### 19.1 Admin Design Override
```typescript
// ✅ Admin uses NEUTRAL design (NOT brand red/cream)
// See DESIGN_SYSTEM.md Section 12

// ✅ Admin sidebar: dark slate (#0F172A)
// ✅ Content area: light gray (#F8FAFC)
// ✅ Cards: white with subtle border

// ❌ NEVER apply brand-cream or brand-red backgrounds in admin content area
// ✅ ONLY exception: status badges and alert colors use brand/semantic colors
```

### 19.2 Warehouse Mobile UI
```typescript
// ✅ /admin/inventory and /admin/shipments MUST work on mobile
// ✅ Touch targets: minimum 60px height for all interactive elements
// ✅ Numeric input: inputMode="numeric" to trigger number keyboard
// ✅ Confirm dialog before saving stock changes
// ✅ Optimistic UI: show new stock immediately, revert on error
```

### 19.3 Revenue Dashboard
```typescript
// ✅ KPI cards: Total Revenue (IDR), Orders Count, Average Order Value, New Customers
// ✅ Revenue chart: last 30 days, line chart (recharts)
// ✅ Recent orders: last 10 orders with status badges
// ✅ All monetary values formatted with formatIDR()
// ✅ Data: always fresh (dynamic = 'force-dynamic')
// ✅ Dashboard visible to: owner and superadmin
// ❌ Warehouse staff cannot see dashboard
```

### 19.4 Order Management
```typescript
// ✅ Order status can only go FORWARD (no skipping steps)
// Allowed transitions:
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['paid', 'cancelled'],
  paid:            ['processing', 'cancelled'],
  processing:      ['packed', 'cancelled'],
  packed:          ['shipped', 'cancelled'],
  shipped:         ['delivered'],
  delivered:       ['refunded'],
  cancelled:       [],  // terminal state
  refunded:        [],  // terminal state
};

// ✅ Warehouse staff can ONLY set: packed → shipped (by adding tracking number)
// ✅ Tracking number input auto-triggers status → shipped
```

---

## 20. SECURITY RULES

### 20.1 Environment Variables
```typescript
// ✅ Server-only (never NEXT_PUBLIC_):
MIDTRANS_SERVER_KEY
RAJAONGKIR_API_KEY
CLOUDINARY_API_SECRET
RESEND_API_KEY
MINIMAX_API_KEY
DATABASE_URL
AUTH_SECRET

// ✅ Safe to expose (NEXT_PUBLIC_):
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY    // needed in browser for Snap.js
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME  // needed for upload widget
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_WHATSAPP_NUMBER
```

### 20.2 Input Sanitization
```typescript
// ✅ Sanitize all rich text content before storing
import DOMPurify from 'isomorphic-dompurify';

const cleanContent = DOMPurify.sanitize(userHtmlContent, {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'img'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'class'],
});

// ✅ All user text inputs: trim whitespace before storing
// ✅ Phone numbers: normalize format before storing
// ✅ Email: lowercase before storing and comparing
// ✅ Coupon codes: uppercase before storing and comparing
```

### 20.3 SQL Injection Prevention
```typescript
// ✅ ALWAYS use Drizzle parameterized queries — never string concatenation
// Drizzle ORM automatically parameterizes all values

// ❌ NEVER do this:
db.execute(sql`SELECT * FROM orders WHERE email = '${userInput}'`);

// ✅ DO this:
db.query.orders.findMany({
  where: eq(orders.recipientEmail, userInput)  // parameterized automatically
});
```

### 20.4 CORS and Headers
```typescript
// next.config.ts — security headers
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
```

### 20.5 Gitignore Critical Files
```gitignore
# .gitignore MUST contain:
.env
.env.local
.env.production
.env.*.local
full_export.sql
*.sql.backup
/scripts/seed-production.ts
```

---

## 21. ERROR HANDLING RULES

### 21.1 Error Types
```typescript
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true,
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
  constructor(variantId: string) {
    super(`Insufficient stock for variant ${variantId}`, 'INSUFFICIENT_STOCK', 409);
  }
}

export class CouponError extends AppError {
  constructor(message: string) {
    super(message, 'COUPON_ERROR', 422);
  }
}
```

### 21.2 Error Logging Pattern
```typescript
// ✅ Log errors with context for debugging
console.error('[Midtrans Webhook]', {
  orderId: body.order_id,
  error: error.message,
  stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
});

// ✅ User-facing errors: generic message (no internal details)
// ✅ Server logs: detailed with full context
// ❌ NEVER expose stack traces or DB errors to client
```

### 21.3 Fallback UI Rules
```typescript
// ✅ Every async data fetch has a fallback:
// - Loading: skeleton matching content shape
// - Error: EmptyState with sad dimsum bowl + retry button
// - Empty: EmptyState with appropriate message

// ✅ RajaOngkir down → show message to contact WhatsApp
// ✅ Midtrans snap fail to load → show "Gagal memuat pembayaran, refresh halaman"
// ✅ Image load fail → show brand-red dimsum icon placeholder
```

---

## 22. TESTING CHECKLIST

Before marking any feature as complete, verify:

### Checkout Flow
- [ ] Guest can checkout without account
- [ ] Logged-in user's cart persists after refresh
- [ ] Guest cart merges with account cart on login
- [ ] RajaOngkir returns only cold-chain couriers
- [ ] Coupon validation works (expired, invalid, min order)
- [ ] Points calculation is correct (1pt / Rp1000 subtotal)
- [ ] Points + coupon can be used simultaneously
- [ ] Midtrans Snap popup opens correctly
- [ ] Payment success triggers stock deduction
- [ ] Payment failure does NOT deduct stock
- [ ] Points awarded only after payment settlement
- [ ] Order confirmation email sent after payment

### Product Catalog
- [ ] Out-of-stock products show "Habis" + disabled button
- [ ] Stock < 5 shows "Tersisa X pcs" warning
- [ ] Product slug URLs work correctly
- [ ] Images load with blur placeholder
- [ ] Halal badge appears on all products

### Admin
- [ ] Warehouse staff can only access /admin/inventory and /admin/shipments
- [ ] Owner cannot access settings or coupon management
- [ ] Stock update creates inventory_log entry
- [ ] Tracking number input auto-sets order to shipped
- [ ] Order status can only progress forward

### Mobile
- [ ] Bottom navigation visible on all store pages
- [ ] Touch targets minimum 44px on mobile
- [ ] Add to cart sticky bar appears on product page scroll
- [ ] Checkout form works with mobile keyboard
- [ ] WhatsApp button visible above bottom nav

---

## 23. WHAT NOT TO BUILD

**STRICTLY OUT OF SCOPE FOR V1 — Do not build, do not stub, do not scaffold:**

```
❌ COD payment method
❌ Installment / cicilan
❌ Product reviews or star ratings system
❌ Automated social media posting
❌ Mobile app (React Native etc.)
❌ Multi-vendor marketplace features
❌ Live chat widget (use WhatsApp CTA)
❌ Affiliate / referral program
❌ Automated courier tracking sync
❌ Multiple warehouse locations
❌ Subscription / recurring orders
❌ Flash sale countdown timer
❌ Dark mode
❌ Push notifications
❌ Export to accounting software (Xero, etc.)
❌ Multi-currency pricing
❌ Product rating/review system
❌ Chatbot
❌ AR product preview
❌ Loyalty tier system (silver/gold/platinum)
❌ Email marketing automation (drip campaigns)
❌ Inventory forecasting
❌ Analytics dashboard beyond basic KPIs
```

---

## 24. FEATURE-BY-FEATURE BUILD ORDER

Build in this exact sequence. Do NOT skip ahead. Each phase must be
fully working before starting the next.

### Phase 0 — Foundation (Day 1)
```
1.  [ ] Initialize Next.js 14 project with TypeScript
2.  [ ] Configure Tailwind + design tokens (tailwind.config.ts)
3.  [ ] Set up Neon PostgreSQL + Drizzle + push schema
4.  [ ] Configure NextAuth v5 with Google + Credentials providers
5.  [ ] Set up environment variables (.env.local from .env.example)
6.  [ ] Install and initialize shadcn/ui base components
7.  [ ] Configure next-intl (id + en message files)
8.  [ ] Create folder structure per TECH_STACK.md Section 4
9.  [ ] Set up global CSS variables (globals.css)
10. [ ] Create utility functions (formatIDR, formatDate, cn, generateOrderNumber)
11. [ ] Run seed script (categories + superadmin + system_settings)
12. [ ] Verify: login works, DB connected, no TypeScript errors
```

### Phase 1 — Store Core (Days 2–4)
```
13. [ ] Store layout (Navbar desktop, BottomNav mobile, Footer, WhatsApp button)
14. [ ] Homepage (Carousel, Featured Products, Category Chips, Why Dekaka)
15. [ ] Product catalog page (list, search, filter by category)
16. [ ] Product detail page (images, variants, add to cart)
17. [ ] Cart page (items, summary, update qty, remove)
18. [ ] Cart Zustand store with localStorage persistence
19. [ ] Product card component (horizontal layout)
20. [ ] Stock badge (Habis, Tersisa X pcs)
21. [ ] Halal badge component
22. [ ] Empty states (empty cart, no results)
23. [ ] Skeleton loading states
24. [ ] 404 page with sad dimsum bowl
25. [ ] Verify: full browse → add to cart flow works on mobile
```

### Phase 2 — Checkout & Payment (Days 5–7)
```
26. [ ] Checkout step 1: Identity (guest name/email/phone)
27. [ ] Checkout step 2: Delivery method toggle (delivery/pickup)
28. [ ] Checkout step 3: Address form with RajaOngkir province/city
29. [ ] Checkout step 4: Courier selection (cold-chain only)
30. [ ] Checkout step 5: Coupon input + Points redemption
31. [ ] Checkout step 6: Order review
32. [ ] POST /api/checkout/initiate (create order + Midtrans token)
33. [ ] Midtrans Snap.js integration (client-side popup)
34. [ ] POST /api/webhooks/midtrans (signature verify + order processing)
35. [ ] Order success page (confetti + PDF download)
36. [ ] Order pending page (VA instructions + Bayar Lagi)
37. [ ] Order failed page (Coba Lagi)
38. [ ] Public order tracking page
39. [ ] Pickup invitation page
40. [ ] Order confirmation email (Resend + React Email)
41. [ ] Verify: full checkout → payment → webhook → email flow in sandbox
```

### Phase 3 — Auth & Accounts (Days 8–9)
```
42. [ ] Login page (Google + email/password)
43. [ ] Register page
44. [ ] Forgot/reset password flow
45. [ ] Account dashboard (overview)
46. [ ] Account orders list + detail
47. [ ] Account saved addresses (CRUD)
48. [ ] Account points history
49. [ ] Account vouchers page
50. [ ] Guest order tracking (verify by email)
51. [ ] Cart merge on login
52. [ ] Verify: all account flows work, protected routes redirect correctly
```

### Phase 4 — Admin Core (Days 10–12)
```
53. [ ] Admin layout (sidebar desktop, bottom nav mobile)
54. [ ] Admin middleware (role-based route protection)
55. [ ] Admin login redirect
56. [ ] Dashboard page (KPI cards + revenue chart + recent orders)
57. [ ] Orders list page (search, filter by status, pagination)
58. [ ] Order detail page (items, timeline, status update dropdown)
59. [ ] Products list page (search, filter, active toggle)
60. [ ] Add/Edit product form (with image upload)
61. [ ] Variant manager (add/edit/delete variants within product form)
62. [ ] Inventory page (mobile-optimized stock editor)
63. [ ] Shipments page (tracking number input, mark shipped)
64. [ ] Customer list + detail
65. [ ] Verify: owner and superadmin can manage products/orders, warehouse restricted
```

### Phase 5 — Promotions & Content (Days 13–14)
```
66. [ ] Coupon management CRUD (superadmin only)
67. [ ] Coupon validation API (all rules enforced)
68. [ ] Points award on payment settlement
69. [ ] Points redemption in checkout
70. [ ] Points expiry logic (1 year)
71. [ ] Blog post list + detail pages (store)
72. [ ] Blog CMS with TipTap editor (admin)
73. [ ] Carousel management (admin)
74. [ ] AI caption generator page (Minimax M2.7)
75. [ ] Verify: coupons + points flow end-to-end
```

### Phase 6 — B2B & SEO (Days 15–16)
```
76. [ ] B2B landing page
77. [ ] B2B inquiry form + email notification
78. [ ] B2B inquiry inbox (admin)
79. [ ] B2B account portal (basic)
80. [ ] generateMetadata() on all product/blog pages
81. [ ] next-sitemap configuration
82. [ ] robots.txt
83. [ ] Open Graph images for social sharing
84. [ ] Verify: sitemap generated, meta tags correct in page source
```

### Phase 7 — Polish & Launch (Days 17–18)
```
85. [ ] Shipped email (with tracking info)
86. [ ] Delivered email (thank you + points earned)
87. [ ] Points expiring email (30-day reminder)
88. [ ] Language toggle (ID/EN) working on all pages
89. [ ] Scroll-triggered animations (Framer Motion)
90. [ ] All empty states with sad dimsum bowl illustrations
91. [ ] Performance audit (Lighthouse score > 85 mobile)
92. [ ] Test on real mobile device (iOS + Android)
93. [ ] Switch Midtrans to production mode
94. [ ] Final env vars set in Vercel
95. [ ] Custom domain configured (dapurdekaka.com)
96. [ ] Smoke test: place real order end-to-end
97. [ ] 🚀 LAUNCH
```

---

## QUICK REFERENCE CARD

```
BRAND COLOR:        #C8102E (brand-red)
BACKGROUND:         #F0EAD6 (brand-cream)
DARK TEXT:          #1A1A1A (text-primary)
SUCCESS:            #16A34A
WARNING:            #D97706
ERROR:              #DC2626

ORIGIN CITY ID:     23 (Bandung — RajaOngkir)
ALLOWED COURIERS:   SiCepat FROZEN, JNE YES, AnterAja FROZEN
PAYMENT EXPIRY:     15 minutes
POINTS RATE:        1 point per Rp 1.000 subtotal
POINTS EXPIRY:      365 days from earn date
MAX POINTS REDEEM:  50% of subtotal
ORDER NUMBER FMT:   DDK-YYYYMMDD-XXXX

MIDTRANS SANDBOX:   MIDTRANS_IS_PRODUCTION=false
NEON DB:            @neondatabase/serverless HTTP driver
DRIZZLE:            relational queries for reads, core for mutations
ALL PRICES:         integer IDR — NO floats EVER
ALL TIMESTAMPS:     UTC in DB, WIB (Asia/Jakarta) for display

ROLES:
  superadmin  → full access
  owner       → orders, products, customers, revenue
  warehouse   → inventory + shipments ONLY
  customer    → store + account
  b2b         → store + b2b portal + account
  guest       → store only, no points
```

---

*End of CURSOR_RULES.md v1.0*
*All 5 documents complete. Begin Phase 0.*
```