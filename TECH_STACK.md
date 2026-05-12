````markdown
# TECH_STACK.md — Architecture & Technology Stack
# DapurDekaka.com
**Version:** 1.0
**Last Updated:** May 2026
**Author:** Bashara (Technical Lead)
**Status:** Active — Pre-Development

---

## TABLE OF CONTENTS
1. Architecture Overview
2. Core Technology Decisions
3. Full Dependency List
4. Folder Structure
5. Environment Variables
6. API Integrations
7. Database Architecture
8. Authentication Architecture
9. Payment Architecture
10. Deployment Architecture
11. Performance Strategy
12. Development Workflow

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 System Design Philosophy
DapurDekaka.com is built as a **monorepo Next.js 14 application** deployed on Vercel with a serverless-first architecture. There is no separate backend server — all backend logic runs as Next.js API Routes (serverless functions). The database is Neon PostgreSQL (serverless-compatible).

This architecture is chosen because:
- **Zero infrastructure cost** at launch (Vercel + Neon free tiers)
- **No persistent server to maintain** — Vercel handles scaling automatically
- **Single codebase** — frontend and backend in one repo, one deploy
- **Native Next.js features** — App Router, Server Components, Image optimization all work out of the box
- **Vercel + Neon official integration** — one-click DATABASE_URL injection

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   dapurdekaka.com                    │
│                  (Vercel CDN Edge)                   │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌────────▼────────┐
│  Next.js 14    │          │  Next.js API    │
│  App Router    │          │  Routes         │
│  (React RSC)   │          │  (Serverless)   │
└───────┬────────┘          └────────┬────────┘
        │                            │
        │                   ┌────────▼────────┐
        │                   │  Neon PostgreSQL │
        │                   │  (Serverless DB) │
        │                   └────────┬────────┘
        │                            │
        │              ┌─────────────┼─────────────┐
        │              │             │             │
   ┌────▼────┐  ┌──────▼──┐  ┌─────▼─────┐  ┌───▼────┐
   │Cloudinary│  │Midtrans │  │RajaOngkir │  │ Resend │
   │(Images) │  │(Payment)│  │(Shipping) │  │(Email) │
   └─────────┘  └─────────┘  └───────────┘  └────────┘
                                                   │
                                          ┌────────▼───────┐
                                          │  Minimax M2.7  │
                                          │  (AI Content)  │
                                          └────────────────┘
```

### 1.3 Rendering Strategy Per Page Type

| Page Type | Strategy | Reason |
|---|---|---|
| Homepage | ISR (revalidate: 3600) | Dynamic carousel but cacheable |
| Product catalog | ISR (revalidate: 300) | Stock changes frequently |
| Product detail | ISR (revalidate: 60) | Stock + price need near-realtime |
| Blog posts | SSG (static) | Never changes after publish |
| Cart / Checkout | CSR (client-side) | Fully dynamic, user-specific |
| Order tracking | SSR (server-side) | Always fresh order status |
| Admin dashboard | SSR (server-side) | Real-time data required |
| Account pages | SSR (server-side) | User-specific, protected |

---

## 2. CORE TECHNOLOGY DECISIONS

### 2.1 Framework & Runtime

| Technology | Version | Decision | Alternative Considered |
|---|---|---|---|
| **Next.js** | 14.x (App Router) | ✅ Chosen | Remix, Nuxt |
| **TypeScript** | 5.x | ✅ Chosen | JavaScript |
| **Node.js** | 20.x LTS | ✅ Chosen | — |
| **React** | 18.x | ✅ (via Next.js) | — |

**Why Next.js 14 App Router:**
- Server Components reduce client bundle size (critical for mobile performance)
- Built-in image optimization via `next/image`
- API Routes eliminate need for separate Express server
- Native SEO support via `generateMetadata()`
- Vercel deployment is zero-config

### 2.2 Database

| Technology | Version | Decision |
|---|---|---|
| **Neon PostgreSQL** | Latest | ✅ Chosen |
| **Drizzle ORM** | 0.39.x | ✅ Chosen |
| **@neondatabase/serverless** | 0.10.x | ✅ Chosen |

**Why Neon:**
- Serverless PostgreSQL — no connection pool exhaustion on Vercel serverless functions
- Official Vercel integration — auto-injects DATABASE_URL
- Free tier: 0.5GB storage, 1 project, 10 branches
- HTTP-based connections via `@neondatabase/serverless` — works in Edge Runtime

**Why Drizzle ORM:**
- Type-safe queries with TypeScript inference
- Lightweight (no Prisma bloat)
- `drizzle-kit` for migrations
- Works perfectly with Neon serverless driver

**Connection Setup:**
```typescript
// lib/db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

### 2.3 Authentication

| Technology | Version | Decision |
|---|---|---|
| **NextAuth.js** | v5 (Auth.js) | ✅ Chosen |
| **@auth/drizzle-adapter** | Latest | ✅ Chosen |

**Why NextAuth v5:**
- Native Next.js App Router support
- Drizzle adapter for session storage in Neon
- Supports Google OAuth + Credentials out of the box
- Edge-compatible middleware

**Auth Configuration:**
- Google OAuth provider (login + register)
- Credentials provider (email + bcrypt password)
- Session strategy: database (stored in Neon)
- Session duration: 30 days
- JWT for middleware edge compatibility

### 2.4 Styling

| Technology | Version | Decision |
|---|---|---|
| **Tailwind CSS** | 3.4.x | ✅ Chosen |
| **shadcn/ui** | Latest | ✅ Chosen |
| **class-variance-authority** | 0.7.x | ✅ Chosen |
| **clsx + tailwind-merge** | Latest | ✅ Chosen |
| **Framer Motion** | 11.x | ✅ Chosen (selective) |

**Why this combination:**
- Tailwind for utility-first rapid development
- shadcn/ui for pre-built accessible components (Dialog, Select, Tabs etc.)
- Framer Motion ONLY for: carousel, page transitions, micro-interactions — not global
- All animations respect `prefers-reduced-motion`

### 2.5 State Management

| Technology | Usage | Decision |
|---|---|---|
| **Zustand** | Cart state, UI state | ✅ Chosen |
| **TanStack Query** | Server data fetching | ✅ Chosen |
| **React Context** | Auth state, language | ✅ (via NextAuth) |

**Zustand stores:**
- `useCartStore` — cart items, persisted to localStorage
- `useUIStore` — mobile menu, modals, language preference

**TanStack Query usage:**
- Product listing with infinite scroll
- Cart validation against live stock
- Order status polling on pending page
- Admin dashboard data

### 2.6 UI Components & Libraries

| Library | Purpose | Bundle Impact |
|---|---|---|
| **embla-carousel-react** | Homepage carousel | ~12KB |
| **@radix-ui/**(via shadcn) | Accessible primitives | Tree-shaken |
| **lucide-react** | Icons | Tree-shaken |
| **recharts** | Admin revenue charts | ~45KB (admin only) |
| **@tiptap/react** | Blog rich text editor | ~60KB (admin only) |
| **react-hook-form** | All forms | ~9KB |
| **zod** | Schema validation | ~12KB |
| **date-fns** | Date formatting | Tree-shaken |
| **canvas-confetti** | Payment success animation | ~8KB (lazy loaded) |
| **next-themes** | Theme provider (light only) | ~2KB |

### 2.7 PDF Generation

| Technology | Strategy | Decision |
|---|---|---|
| **@react-pdf/renderer** | Client-side PDF | ✅ Chosen |

**Why client-side:**
- Keeps serverless function size below Vercel's 50MB limit
- No server cost per PDF generation
- Customer generates PDF on demand on success page / order detail
- Equally functional for receipts
- PDF downloaded directly in browser

### 2.8 Internationalization

| Technology | Decision |
|---|---|
| **next-intl** | ✅ Chosen |

**Language support:**
- `id` — Bahasa Indonesia (primary, default)
- `en` — English (secondary, toggle in header)
- All UI labels, error messages, email templates bilingual
- Product names and descriptions bilingual (separate fields in DB)
- URL structure: `/` for ID, `/en` for EN (next-intl routing)
- Language preference stored in cookie + localStorage

---

## 3. FULL DEPENDENCY LIST

### 3.1 Production Dependencies

```json
{
  "dependencies": {
    "next": "14.2.x",
    "react": "18.3.x",
    "react-dom": "18.3.x",
    "typescript": "5.x",

    "drizzle-orm": "0.39.x",
    "@neondatabase/serverless": "0.10.x",

    "next-auth": "5.x",
    "@auth/drizzle-adapter": "latest",
    "bcryptjs": "^3.0.0",

    "tailwindcss": "3.4.x",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "class-variance-authority": "^0.7.0",

    "zustand": "^5.0.0",
    "@tanstack/react-query": "^5.60.0",

    "zod": "^3.23.8",
    "react-hook-form": "^7.53.1",
    "@hookform/resolvers": "^3.9.1",

    "embla-carousel-react": "^8.5.2",
    "embla-carousel-autoplay": "^8.5.2",

    "lucide-react": "^0.453.0",
    "recharts": "^2.13.0",

    "@tiptap/react": "^2.10.0",
    "@tiptap/starter-kit": "^2.10.0",
    "@tiptap/extension-image": "^2.10.0",
    "@tiptap/extension-link": "^2.10.0",

    "@react-pdf/renderer": "^4.0.0",

    "next-intl": "^3.26.0",

    "framer-motion": "^11.13.1",
    "canvas-confetti": "^1.9.3",

    "cloudinary": "^2.5.1",

    "resend": "^4.0.0",
    "react-email": "^3.0.0",

    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.2.0",

    "next-sitemap": "^4.2.3",
    "next-themes": "^0.4.4",

    "sharp": "^0.33.5"
  }
}
```

### 3.2 Development Dependencies

```json
{
  "devDependencies": {
    "drizzle-kit": "^0.30.4",
    "@types/node": "20.x",
    "@types/react": "18.x",
    "@types/react-dom": "18.x",
    "@types/bcryptjs": "^2.4.6",
    "@types/canvas-confetti": "^1.9.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "eslint": "^9.0.0",
    "eslint-config-next": "14.x",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "prettier": "^3.3.0",
    "prettier-plugin-tailwindcss": "^0.6.0"
  }
}
```

---

## 4. FOLDER STRUCTURE

```
dapurdekaka/
├── app/                          # Next.js App Router
│   ├── (store)/                  # Customer store layout group
│   │   ├── layout.tsx            # Store layout (navbar, footer, WhatsApp btn)
│   │   ├── page.tsx              # Homepage
│   │   ├── products/
│   │   │   ├── page.tsx          # Product catalog
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Product detail
│   │   ├── cart/
│   │   │   └── page.tsx          # Cart page
│   │   ├── checkout/
│   │   │   ├── page.tsx          # Checkout flow
│   │   │   ├── success/page.tsx  # Order success
│   │   │   ├── pending/page.tsx  # Payment pending
│   │   │   └── failed/page.tsx   # Payment failed
│   │   ├── orders/
│   │   │   └── [orderNumber]/
│   │   │       ├── page.tsx      # Order tracking
│   │   │       └── pickup/       # Pickup invitation
│   │   │           └── page.tsx
│   │   ├── account/
│   │   │   ├── layout.tsx        # Account layout (sidebar)
│   │   │   ├── page.tsx          # Account overview
│   │   │   ├── orders/page.tsx
│   │   │   ├── addresses/page.tsx
│   │   │   ├── points/page.tsx
│   │   │   ├── vouchers/page.tsx
│   │   │   └── profile/page.tsx
│   │   └── blog/
│   │       ├── page.tsx          # Blog listing
│   │       └── [slug]/page.tsx   # Blog post
│   │
│   ├── (b2b)/                    # B2B portal layout group
│   │   ├── layout.tsx
│   │   ├── b2b/
│   │   │   ├── page.tsx          # B2B landing
│   │   │   ├── products/page.tsx
│   │   │   ├── quote/page.tsx
│   │   │   └── account/
│   │   │       ├── page.tsx
│   │   │       ├── orders/page.tsx
│   │   │       └── quotes/page.tsx
│   │
│   ├── (admin)/                  # Admin dashboard layout group
│   │   ├── layout.tsx            # Admin layout (sidebar desktop, bottom nav mobile)
│   │   └── admin/
│   │       ├── page.tsx          # Redirect to dashboard
│   │       ├── dashboard/page.tsx
│   │       ├── orders/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── products/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── inventory/page.tsx
│   │       ├── shipments/page.tsx
│   │       ├── customers/
│   │       │   ├── page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── coupons/page.tsx
│   │       ├── blog/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── carousel/page.tsx
│   │       ├── b2b-inquiries/page.tsx
│   │       ├── b2b-quotes/page.tsx
│   │       ├── ai-content/page.tsx
│   │       ├── settings/page.tsx
│   │       └── users/page.tsx
│   │
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   │
│   ├── api/                      # API Routes (serverless functions)
│   │   ├── auth/
│   │   │   └── [...nextauth]/route.ts
│   │   ├── products/
│   │   │   ├── route.ts          # GET product list
│   │   │   └── [slug]/route.ts   # GET product detail
│   │   ├── cart/
│   │   │   └── validate/route.ts # POST validate cart stock
│   │   ├── checkout/
│   │   │   ├── initiate/route.ts # POST create order + Midtrans token
│   │   │   └── pickup-invitation/route.ts
│   │   ├── webhooks/
│   │   │   └── midtrans/route.ts # POST Midtrans notification
│   │   ├── orders/
│   │   │   └── [orderNumber]/
│   │   │       ├── route.ts      # GET order detail
│   │   │       └── receipt/route.ts
│   │   ├── shipping/
│   │   │   ├── provinces/route.ts
│   │   │   ├── cities/route.ts
│   │   │   └── cost/route.ts
│   │   ├── coupons/
│   │   │   └── validate/route.ts
│   │   ├── points/
│   │   │   └── redeem/route.ts
│   │   ├── upload/route.ts
│   │   ├── blog/route.ts
│   │   ├── b2b/
│   │   │   └── inquiry/route.ts
│   │   ├── admin/
│   │   │   ├── orders/route.ts
│   │   │   ├── products/route.ts
│   │   │   ├── inventory/route.ts
│   │   │   ├── customers/route.ts
│   │   │   ├── coupons/route.ts
│   │   │   ├── carousel/route.ts
│   │   │   └── settings/route.ts
│   │   └── ai/
│   │       └── generate-caption/route.ts
│   │
│   ├── globals.css               # Global styles + CSS variables
│   ├── layout.tsx                # Root layout (providers)
│   ├── not-found.tsx             # 404 page (sad dimsum bowl)
│   ├── error.tsx                 # Error boundary
│   └── loading.tsx               # Root loading state
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── badge.tsx
│   │   ├── toast.tsx
│   │   └── ... (all shadcn components)
│   │
│   ├── store/                    # Customer-facing components
│   │   ├── layout/
│   │   │   ├── Navbar.tsx        # Mobile bottom nav + desktop top nav
│   │   │   ├── Footer.tsx
│   │   │   └── WhatsAppButton.tsx # Floating pulsing button
│   │   ├── home/
│   │   │   ├── HeroCarousel.tsx
│   │   │   ├── FeaturedProducts.tsx
│   │   │   ├── CategoryChips.tsx
│   │   │   ├── PromoBanner.tsx
│   │   │   ├── InstagramFeed.tsx
│   │   │   └── Testimonials.tsx
│   │   ├── products/
│   │   │   ├── ProductCard.tsx   # Horizontal card (image left, details right)
│   │   │   ├── ProductGrid.tsx
│   │   │   ├── ProductFilters.tsx
│   │   │   ├── ProductSearch.tsx
│   │   │   ├── VariantSelector.tsx
│   │   │   ├── StockBadge.tsx    # "Habis" or "Tersisa X pcs"
│   │   │   └── HalalBadge.tsx
│   │   ├── cart/
│   │   │   ├── CartItem.tsx
│   │   │   ├── CartSummary.tsx
│   │   │   └── EmptyCart.tsx     # Sad dimsum bowl illustration
│   │   ├── checkout/
│   │   │   ├── CheckoutStepper.tsx
│   │   │   ├── AddressForm.tsx
│   │   │   ├── ShippingOptions.tsx
│   │   │   ├── CouponInput.tsx
│   │   │   ├── PointsRedeemer.tsx
│   │   │   └── OrderSummaryCard.tsx
│   │   ├── orders/
│   │   │   ├── OrderTimeline.tsx
│   │   │   ├── OrderItemsList.tsx
│   │   │   ├── TrackingInfo.tsx
│   │   │   └── PickupInvitation.tsx
│   │   └── common/
│   │       ├── LanguageToggle.tsx
│   │       ├── SkeletonCard.tsx
│   │       └── EmptyState.tsx    # Reusable with sad dimsum
│   │
│   ├── admin/                    # Admin dashboard components
│   │   ├── layout/
│   │   │   ├── AdminSidebar.tsx  # Desktop sidebar
│   │   │   ├── AdminBottomNav.tsx # Mobile bottom navigation
│   │   │   └── AdminHeader.tsx
│   │   ├── dashboard/
│   │   │   ├── KPICard.tsx
│   │   │   ├── RevenueChart.tsx
│   │   │   └── RecentOrders.tsx
│   │   ├── orders/
│   │   │   ├── OrdersTable.tsx
│   │   │   ├── OrderStatusBadge.tsx
│   │   │   └── StatusUpdateDropdown.tsx
│   │   ├── products/
│   │   │   ├── ProductForm.tsx
│   │   │   ├── VariantManager.tsx
│   │   │   └── ImageUploader.tsx
│   │   ├── inventory/
│   │   │   └── StockEditor.tsx   # Mobile-optimized stock input
│   │   └── common/
│   │       ├── DataTable.tsx
│   │       ├── SearchInput.tsx
│   │       └── ConfirmDialog.tsx
│   │
│   └── pdf/
│       └── ReceiptDocument.tsx   # @react-pdf/renderer receipt
│
├── lib/
│   ├── db/
│   │   ├── index.ts              # Drizzle + Neon connection
│   │   ├── schema.ts             # Full Drizzle schema
│   │   └── queries/              # Reusable DB query functions
│   │       ├── products.ts
│   │       ├── orders.ts
│   │       ├── users.ts
│   │       ├── coupons.ts
│   │       └── blog.ts
│   ├── auth/
│   │   └── index.ts              # NextAuth config
│   ├── midtrans/
│   │   ├── client.ts             # Midtrans SDK setup
│   │   ├── create-transaction.ts
│   │   └── verify-webhook.ts
│   ├── rajaongkir/
│   │   ├── client.ts             # RajaOngkir API client
│   │   ├── provinces.ts
│   │   ├── cities.ts
│   │   └── calculate-cost.ts
│   ├── cloudinary/
│   │   ├── client.ts
│   │   └── upload.ts
│   ├── resend/
│   │   ├── client.ts
│   │   ├── templates/
│   │   │   ├── OrderConfirmation.tsx
│   │   │   ├── OrderShipped.tsx
│   │   │   ├── OrderDelivered.tsx
│   │   │   └── PointsExpiring.tsx
│   │   └── send-email.ts
│   ├── minimax/
│   │   ├── client.ts             # Minimax M2.7 API client
│   │   └── generate-caption.ts
│   ├── utils/
│   │   ├── format-currency.ts    # IDR formatting (Intl.NumberFormat)
│   │   ├── format-date.ts        # Indonesian date formatting
│   │   ├── generate-order-number.ts
│   │   ├── calculate-points.ts
│   │   └── cn.ts                 # clsx + tailwind-merge helper
│   └── validations/
│       ├── checkout.schema.ts    # Zod schemas for checkout
│       ├── product.schema.ts
│       ├── coupon.schema.ts
│       └── address.schema.ts
│
├── store/                        # Zustand stores
│   ├── cart.store.ts
│   └── ui.store.ts
│
├── hooks/                        # Custom React hooks
│   ├── useCart.ts
│   ├── useCheckout.ts
│   ├── useShipping.ts
│   └── useDebounce.ts
│
├── i18n/                         # Internationalization
│   ├── request.ts                # next-intl config
│   ├── routing.ts
│   └── messages/
│       ├── id.json               # Bahasa Indonesia strings
│       └── en.json               # English strings
│
├── types/                        # TypeScript type definitions
│   ├── index.ts
│   ├── order.types.ts
│   ├── product.types.ts
│   └── api.types.ts
│
├── middleware.ts                 # NextAuth + i18n + admin protection
├── next.config.ts                # Next.js configuration
├── tailwind.config.ts            # Tailwind + brand colors
├── drizzle.config.ts             # Drizzle Kit config
├── next-sitemap.config.js        # Sitemap generation
├── .env.local                    # Local env vars (gitignored)
├── .env.example                  # Env template (committed)
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 5. ENVIRONMENT VARIABLES

### 5.1 Complete .env.example

```bash
# ─────────────────────────────────────────
# DATABASE (Neon PostgreSQL)
# ─────────────────────────────────────────
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require

# ─────────────────────────────────────────
# AUTHENTICATION (NextAuth v5)
# ─────────────────────────────────────────
AUTH_SECRET=                        # Generate: openssl rand -base64 32
AUTH_URL=https://dapurdekaka.com    # NEXTAUTH_URL equivalent in v5

# Google OAuth (Google Cloud Console)
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# ─────────────────────────────────────────
# PAYMENT (Midtrans)
# ─────────────────────────────────────────
MIDTRANS_SERVER_KEY=                # Server key from Midtrans dashboard
MIDTRANS_CLIENT_KEY=                # Client key from Midtrans dashboard
MIDTRANS_IS_PRODUCTION=false        # true for production, false for sandbox
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=    # Same as MIDTRANS_CLIENT_KEY (public)
NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=false

# ─────────────────────────────────────────
# SHIPPING (RajaOngkir)
# ─────────────────────────────────────────
RAJAONGKIR_API_KEY=
RAJAONGKIR_BASE_URL=https://api.rajaongkir.com/starter

# ─────────────────────────────────────────
# FILE STORAGE (Cloudinary)
# ─────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=  # Same as above (public for upload widget)

# ─────────────────────────────────────────
# EMAIL (Resend)
# ─────────────────────────────────────────
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@dapurdekaka.com
RESEND_FROM_NAME=Dapur Dekaka

# ─────────────────────────────────────────
# AI CONTENT (Minimax M2.7)
# ─────────────────────────────────────────
MINIMAX_API_KEY=
MINIMAX_BASE_URL=https://api.minimaxi.chat/v1
MINIMAX_MODEL=MiniMax-M2.7          # or specific model variant

# ─────────────────────────────────────────
# APPLICATION
# ─────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://dapurdekaka.com
NEXT_PUBLIC_APP_NAME=Dapur Dekaka
NEXT_PUBLIC_WHATSAPP_NUMBER=6281234567890  # placeholder
NEXT_PUBLIC_INSTAGRAM_URL=https://www.instagram.com/dapurdekaka/
NEXT_PUBLIC_STORE_ADDRESS=Jl. Sinom V no. 7, Turangga, Bandung
NEXT_PUBLIC_GOOGLE_MAPS_URL=https://maps.google.com/?q=Jl+Sinom+V+No+7+Turangga+Bandung

# ─────────────────────────────────────────
# SEEDING (development only)
# ─────────────────────────────────────────
SEED_ADMIN_EMAIL=bashara@dapurdekaka.com
SEED_ADMIN_PASSWORD=                # Strong password for initial superadmin
```

### 5.2 Vercel Environment Variable Setup
In Vercel dashboard → Project Settings → Environment Variables:
1. Add all variables from `.env.example`
2. Use Vercel's Neon integration for `DATABASE_URL` (auto-injected)
3. Set `MIDTRANS_IS_PRODUCTION=false` for Preview, `true` for Production
4. Set `AUTH_URL` to match environment URL

---

## 6. API INTEGRATIONS

### 6.1 Midtrans

**Documentation:** https://docs.midtrans.com
**Mode:** Sandbox first → Production after testing

```typescript
// lib/midtrans/client.ts
import midtransClient from 'midtrans-client';

export const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
});
```

**Transaction creation:**
```typescript
// Payload structure for createTransaction
{
  transaction_details: {
    order_id: "DDK-20260512-0047",   // Must be unique per transaction
    gross_amount: 236000              // Total in IDR (integer)
  },
  customer_details: {
    first_name: "Siti",
    email: "siti@example.com",
    phone: "081234567890"
  },
  item_details: [
    { id: "variant-uuid", price: 120000, quantity: 2, name: "Dimsum Mix 50pcs" },
    { id: "shipping", price: 25000, quantity: 1, name: "Ongkos Kirim SiCepat Frozen" },
    { id: "discount", price: -29000, quantity: 1, name: "Diskon Kupon + Poin" }
  ],
  expiry: {
    unit: "minute",
    duration: 15
  }
}
```

**Webhook verification:**
```typescript
// lib/midtrans/verify-webhook.ts
import crypto from 'crypto';

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signatureKey: string
): boolean {
  const hash = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
  return hash === signatureKey;
}
```

### 6.2 RajaOngkir

**Documentation:** https://rajaongkir.com/dokumentasi
**Plan:** Starter (free)
**Base URL:** `https://api.rajaongkir.com/starter`

**Endpoints used:**
```typescript
// GET /province — list all provinces
// GET /city?province={id} — cities by province
// POST /cost — calculate shipping cost

// Cost calculation payload:
{
  origin: "23",          // Bandung city_id
  destination: "501",    // Customer city_id from RajaOngkir
  weight: 1500,          // grams
  courier: "sicepat"     // one call per courier
}
```

**Response filtering — only show these:**
```typescript
const ALLOWED_SERVICES = [
  { courier: 'sicepat', service: 'FROZEN' },
  { courier: 'jne', service: 'YES' },
  { courier: 'anteraja', service: 'FROZEN' },
];
```

**Caching strategy:**
- Province list: cache in memory for entire session (never changes)
- City list per province: cache in memory for 24 hours
- Shipping cost: no cache (always fresh per checkout)

### 6.3 Cloudinary

**Plan:** Free (25GB storage, 25GB bandwidth/month)

```typescript
// lib/cloudinary/client.ts
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});
```

**Upload folders structure:**
```
dapurdekaka/
├── products/          # Product images
├── blog/              # Blog cover images
├── carousel/          # Homepage carousel images
└── avatars/           # User profile pictures
```

**Image transformations (via next/image + Cloudinary loader):**
- Product thumbnail: `w_400,h_300,c_fill,f_webp,q_auto`
- Product detail: `w_800,h_600,c_fill,f_webp,q_auto`
- Carousel: `w_1200,h_600,c_fill,f_webp,q_auto`

### 6.4 Resend

**Plan:** Free (3,000 emails/month)

```typescript
// lib/resend/client.ts
import { Resend } from 'resend';
export const resend = new Resend(process.env.RESEND_API_KEY);
```

**Email templates (React Email components):**
- `OrderConfirmation.tsx` — sent on payment settlement
- `OrderShipped.tsx` — sent when tracking number added
- `OrderDelivered.tsx` — sent when status → delivered
- `PointsExpiring.tsx` — sent 30 days before points expire
- `PasswordReset.tsx` — sent on forgot password

**All emails:**
- Bahasa Indonesia by default
- Subject lines in Indonesian
- Brand colors: #C8102E header, #F0EAD6 background
- Mobile-responsive HTML

### 6.5 Minimax M2.7

**Plan:** Token-based (no Group ID required)
**Model:** MiniMax-M2.7
**Base URL:** `https://api.minimaxi.chat/v1`

```typescript
// lib/minimax/generate-caption.ts
export async function generateCaption(
  productName: string,
  productDescription: string,
  platform: 'tiktok' | 'instagram',
  language: 'id' | 'en'
): Promise<{ caption: string; hashtags: string[] }> {
  const prompt = `
    Kamu adalah content creator food brand Indonesia yang ahli.
    Buat caption ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} untuk produk berikut:
    
    Nama Produk: ${productName}
    Deskripsi: ${productDescription}
    Brand: Dapur Dekaka (德卡) — frozen dimsum premium, Chinese-Indonesian heritage
    
    Requirements:
    - Bahasa: ${language === 'id' ? 'Bahasa Indonesia yang natural dan engaging' : 'English'}
    - Tone: Warm, appetizing, heritage feel
    - Length: ${platform === 'tiktok' ? '150-200 kata' : '100-150 kata'}
    - Include: Call to action menuju website dapurdekaka.com
    - Separate hashtags (15 relevant hashtags)
    
    Format response as JSON: { "caption": "...", "hashtags": ["#tag1", "#tag2"] }
  `;

  const response = await fetch(`${process.env.MINIMAX_BASE_URL}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.MINIMAX_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  return JSON.parse(data.choices.message.content);
}
```

---

## 7. DATABASE ARCHITECTURE

### 7.1 Connection Strategy
- Use `@neondatabase/serverless` HTTP driver (not WebSocket) for Vercel serverless compatibility
- No connection pooling required — Neon handles this server-side
- Each API route creates its own Drizzle instance with the shared `sql` client

### 7.2 Migration Strategy
```bash
# Generate migration
npx drizzle-kit generate

# Push to database (development)
npx drizzle-kit push

# Push to production (via Vercel build)
# Add to package.json scripts:
"db:migrate": "drizzle-kit migrate"
# Run in Vercel build command: npm run db:migrate && npm run build
```

### 7.3 Indexing Strategy
Critical indexes for performance:
```sql
-- Products: slug lookup (product detail pages)
CREATE INDEX idx_products_slug ON products(slug);

-- Orders: customer lookup + status filtering
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order items: order lookup
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Points: user lookup + expiry
CREATE INDEX idx_points_user_id ON points_history(user_id);
CREATE INDEX idx_points_expires_at ON points_history(expires_at);

-- Blog: slug + published
CREATE INDEX idx_blog_slug ON blog_posts(slug);
CREATE INDEX idx_blog_published ON blog_posts(is_published, published_at DESC);
```

### 7.4 Seed Data Strategy
On first deploy, run seed script:
```bash
npm run db:seed
```
Seeds:
1. Superadmin user (from `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD`)
2. All 5 categories
3. All 19 products + variants scraped from Shopee
4. 3 sample carousel slides (placeholder images)
5. 1 sample blog post
6. Sample coupons: `SELAMATDATANG` (10% off), `GRATIS` (free shipping)

---

## 8. AUTHENTICATION ARCHITECTURE

### 8.1 NextAuth v5 Configuration

```typescript
// lib/auth/index.ts
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        // validate + bcrypt compare
      },
    }),
  ],
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
});
```

### 8.2 Middleware Protection

```typescript
// middleware.ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Admin protection
  if (pathname.startsWith('/admin')) {
    if (!session) return NextResponse.redirect(new URL('/auth/login', req.url));
    if (!['superadmin', 'owner', 'warehouse'].includes(session.user.role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Warehouse: only inventory and shipments
    if (session.user.role === 'warehouse') {
      const allowed = ['/admin/inventory', '/admin/shipments'];
      if (!allowed.some(p => pathname.startsWith(p))) {
        return NextResponse.redirect(new URL('/admin/inventory', req.url));
      }
    }
  }

  // Account protection
  if (pathname.startsWith('/account')) {
    if (!session) return NextResponse.redirect(new URL('/auth/login', req.url));
    if (!['customer', 'b2b', 'superadmin', 'owner'].includes(session.user.role)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/admin/:path*', '/account/:path*', '/b2b/account/:path*'],
};
```

---

## 9. PAYMENT ARCHITECTURE

### 9.1 Checkout Initiation Flow

```
Client: POST /api/checkout/initiate
  → Validate cart items against DB stock
  → Validate coupon (if any)
  → Calculate points deduction (if any)
  → Calculate shipping cost (RajaOngkir)
  → Create order record (status: pending_payment)
  → Deduct coupon used_count tentatively
  → Reserve points tentatively
  → Create Midtrans transaction (get snap_token)
  → Return { orderId, orderNumber, snapToken }

Client: Open Midtrans Snap popup with snapToken
  → Customer completes payment
  → Midtrans closes popup, returns result to client
  → Client redirects to /checkout/success or /checkout/pending or /checkout/failed
```

### 9.2 Webhook Processing Flow

```
Midtrans: POST /api/webhooks/midtrans
  → Verify signature (SHA512 hash)
  → Check transaction_status:

  SETTLEMENT:
    → Update order status: pending_payment → paid
    → Deduct stock for each variant
    → Confirm points deduction (make permanent)
    → Confirm coupon used_count (make permanent)
    → Add loyalty points to user
    → Send confirmation email (Resend)

  PENDING:
    → Order stays pending_payment
    → No action needed (client handles UI)

  DENY / CANCEL / EXPIRE:
    → Update order status → cancelled
    → Reverse tentative points
    → Reverse tentative coupon used_count
    → Restore stock reservation (was never deducted)
    → Send cancellation email
```

### 9.3 Payment Retry Flow
```
Customer on /checkout/pending:
  → Clicks "Bayar Lagi"
  → POST /api/checkout/retry { orderNumber }
  → Generate new Midtrans token (new order_id: original + "-retry-1")
  → Open Snap popup again
  → Max 3 retries, then order cancelled
```

---

## 10. DEPLOYMENT ARCHITECTURE

### 10.1 Vercel Configuration

```json
// vercel.json
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
    }
  },
  "headers": [
    {
      "source": "/api/webhooks/(.*)",
      "headers": [
        { "key": "x-robots-tag", "value": "noindex" }
      ]
    }
  ]
}
```

### 10.2 Build Configuration

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui'],
  },
  // Reduce bundle size
  webpack: (config) => {
    config.externals.push('@react-pdf/renderer'); // Client-side only
    return config;
  },
};

export default nextConfig;
```

### 10.3 Performance Budget

| Metric | Target | Tool |
|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | Vercel Speed Insights |
| FID / INP | < 200ms | Vercel Speed Insights |
| CLS | < 0.1 | Vercel Speed Insights |
| Mobile PageSpeed Score | > 85 | Google PageSpeed |
| First page load (mobile 3G) | < 3s | Chrome DevTools |

### 10.4 Domains & DNS
- `dapurdekaka.com` → Vercel (already owned, configured in Vercel dashboard)
- `www.dapurdekaka.com` → redirect to `dapurdekaka.com`
- Email: configure SPF/DKIM/DMARC for `noreply@dapurdekaka.com` via Resend DNS records

---

## 11. PERFORMANCE STRATEGY

### 11.1 Image Optimization
- All images served via Cloudinary CDN with WebP format
- `next/image` for automatic resizing, lazy loading, blur placeholder
- Product images pre-transformed at upload time (not on-the-fly)
- Logo served as SVG (or optimized WebP < 50KB)

### 11.2 Bundle Optimization
- Admin-only libraries (recharts, TipTap) loaded only on `/admin` routes via dynamic imports
- `@react-pdf/renderer` dynamically imported — never in main bundle
- `canvas-confetti` lazy loaded on payment success only
- Framer Motion used selectively — not wrapped globally

### 11.3 Caching Strategy
- ISR for product pages (revalidate: 60s) — balances freshness with performance
- `unstable_cache` for RajaOngkir province/city lists
- TanStack Query for client-side caching with `staleTime: 5 * 60 * 1000`

---

## 12. DEVELOPMENT WORKFLOW

### 12.1 Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx scripts/seed.ts",
    "postinstall": "node scripts/setup-shadcn.js"
  }
}
```

### 12.2 Git Workflow
- `main` branch → Production (auto-deploy to Vercel)
- `develop` branch → Staging (auto-deploy to Vercel Preview URL)
- Feature branches: `feature/[feature-name]`
- Commit convention: `feat:`, `fix:`, `chore:`, `docs:`

### 12.3 First-Run Setup

```bash
# 1. Clone + install
git clone https://github.com/Bashara-aina/DapurDekaka-v2
cd DapurDekaka-v2
npm install

# 2. Copy env
cp .env.example .env.local
# Fill in all values

# 3. Setup database
npm run db:push
npm run db:seed

# 4. Install shadcn components
npx shadcn@latest init
npx shadcn@latest add button card dialog input select badge toast sheet tabs

# 5. Run dev server
npm run dev
# Open http://localhost:3000
```

---

*End of TECH_STACK.md v1.0*
*Next document: DESIGN_SYSTEM.md*
````

Ready for `DESIGN_SYSTEM.md` next?