# UI_PRODUCTION.md — Frontend Implementation Guide
# DapurDekaka.com v2
**For:** Cursor AI execution
**Status:** Production Target
**Stack:** Next.js 14 App Router · React 18 · Tailwind CSS · shadcn/ui · Zustand · TanStack Query

---

## CRITICAL RULES — READ FIRST

1. **Mobile-first always** — write mobile CSS first, then `md:` breakpoints
2. **Bottom nav is 80px** — add `pb-20 md:pb-0` on every page-level wrapper for mobile
3. **Min touch target 44px** — all clickable elements must have `min-h-[44px] min-w-[44px]`
4. **Monetary values are integers** — never use `toFixed(2)`, use `toLocaleString('id-ID')` or a `formatIDR()` helper
5. **Cart persists to localStorage** — Zustand `persist` middleware, key `dapurdekaka-cart`
6. **Midtrans Snap.js via `<Script strategy="afterInteractive">`** — never in `<head>`, never static import
7. **Server Components by default** — only add `'use client'` when using hooks, events, or browser APIs
8. **ISR pages use `revalidate`** — product listings: 300s, homepage: 60s, static pages: 3600s
9. **Bilingual** — all user-facing strings go through `next-intl`, never hardcoded
10. **Never render red text on red background** — follow DESIGN_SYSTEM.md color rules

---

## 1. INITIAL SETUP

### Tailwind Config
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: false, // Dapur Dekaka has no dark mode
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './emails/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#C8102E',
          'red-dark': '#8B0000',
          'red-light': '#E8394F',
          'red-muted': '#F5C6CC',
          cream: '#F0EAD6',
          'cream-dark': '#E0D4BC',
          'cream-darker': '#C8B89A',
        },
        surface: {
          white: '#FFFFFF',
          off: '#FAFAF8',
          cream: '#F0EAD6',
        },
        status: {
          pending: '#D97706',
          paid: '#2563EB',
          processing: '#7C3AED',
          packed: '#0891B2',
          shipped: '#059669',
          delivered: '#16A34A',
          cancelled: '#6B7280',
          refunded: '#9CA3AF',
        },
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-md': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'display-sm': ['1.875rem', { lineHeight: '1.25' }],
        'display-xs': ['1.5rem', { lineHeight: '1.3' }],
      },
      backgroundImage: {
        'chinese-pattern': "url('/textures/chinese-pattern.svg')",
        'hero-gradient': 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
        button: '0 1px 2px rgba(200,16,46,0.3)',
        'button-hover': '0 4px 12px rgba(200,16,46,0.4)',
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        badge: '6px',
        pill: '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        shimmer: 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
};

export default config;
```

### Global CSS Variables
```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --color-brand-red: #C8102E;
    --color-brand-red-dark: #8B0000;
    --color-cream: #F0EAD6;
    --color-cream-dark: #E0D4BC;
    --color-text-primary: #1A1A1A;
    --color-text-secondary: #6B6B6B;
    --radius-card: 12px;
    --radius-button: 8px;

    /* shadcn/ui base vars */
    --background: 0 0% 100%;
    --foreground: 0 0% 10%;
    --primary: 350 84% 44%;       /* brand-red */
    --primary-foreground: 0 0% 100%;
    --secondary: 40 38% 90%;      /* cream */
    --secondary-foreground: 0 0% 10%;
    --muted: 40 38% 90%;
    --muted-foreground: 0 0% 42%;
    --border: 40 20% 85%;
    --ring: 350 84% 44%;
    --radius: 0.5rem;
  }

  * { @apply border-border; }
  body {
    @apply bg-surface-off text-[#1A1A1A] font-body antialiased;
    -webkit-tap-highlight-color: transparent;
  }
  h1, h2, h3 { @apply font-display; }
}

@layer components {
  .shimmer-bg {
    background: linear-gradient(90deg, #f0ead6 25%, #e0d4bc 50%, #f0ead6 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  /* Remove blue highlight on mobile tap */
  .no-tap { -webkit-tap-highlight-color: transparent; }

  /* Bottom nav safe area */
  .bottom-nav-safe { padding-bottom: calc(80px + env(safe-area-inset-bottom)); }
}
```

### Font Setup
```typescript
// app/layout.tsx — font setup
import { Playfair_Display, Inter } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Apply to <html> className: `${playfair.variable} ${inter.variable}`
```

### shadcn/ui Installation
```bash
npx shadcn@latest init
# Select: TypeScript, Default style, brand-red as primary, globals.css path

# Install all required components
npx shadcn@latest add button input label select textarea
npx shadcn@latest add dialog sheet drawer
npx shadcn@latest add toast sonner
npx shadcn@latest add card badge separator
npx shadcn@latest add form
npx shadcn@latest add accordion tabs
npx shadcn@latest add skeleton
npx shadcn@latest add alert
npx shadcn@latest add dropdown-menu
npx shadcn@latest add progress
```

---

## 2. APP STRUCTURE

```
app/
  (store)/                     # Customer-facing store
    layout.tsx                 # Store layout: Header + BottomNav + WhatsApp
    page.tsx                   # Homepage (ISR, revalidate: 60)
    produk/
      page.tsx                 # Product listing (ISR, revalidate: 300)
      [slug]/
        page.tsx               # Product detail (SSR, revalidate: 60)
    keranjang/
      page.tsx                 # Cart (CSR — localStorage)
    checkout/
      page.tsx                 # Checkout form (CSR + SSR for points)
    pesanan/
      page.tsx                 # Order history (SSR, auth required)
      [orderNumber]/
        page.tsx               # Order detail + status (SSR)
    akun/
      page.tsx                 # Account dashboard
      profil/page.tsx
      alamat/page.tsx
      poin/page.tsx
    masuk/
      page.tsx                 # Login page
    daftar/
      page.tsx                 # Register page
    blog/
      page.tsx
      [slug]/page.tsx
    tentang/page.tsx
    kontak/page.tsx
  (admin)/                     # Admin panel
    layout.tsx                 # Admin layout: Sidebar + Header
    admin/
      dashboard/page.tsx       # KPI dashboard (SSR)
      pesanan/page.tsx
      pesanan/[id]/page.tsx
      produk/page.tsx
      produk/baru/page.tsx
      produk/[id]/page.tsx
      inventaris/page.tsx
      blog/page.tsx
      pengguna/page.tsx
      pengaturan/page.tsx
  (b2b)/                       # B2B portal
    layout.tsx
    b2b/
      dashboard/page.tsx
      penawaran/page.tsx
  api/                         # API routes (see BACKEND_PRODUCTION.md)

components/
  ui/                          # shadcn/ui auto-generated
  store/                       # Customer store components
    layout/
      StoreHeader.tsx
      BottomNav.tsx
      WhatsAppButton.tsx
      MobileMenu.tsx
    product/
      ProductCard.tsx
      ProductGrid.tsx
      ProductDetailImages.tsx
      VariantSelector.tsx
      AddToCartButton.tsx
      ProductBadges.tsx
      StockIndicator.tsx
    cart/
      CartSheet.tsx
      CartItem.tsx
      CartSummary.tsx
      EmptyCart.tsx
    checkout/
      CheckoutForm.tsx
      AddressForm.tsx
      ShippingSelector.tsx
      CouponInput.tsx
      PointsRedeemer.tsx
      OrderSummary.tsx
      MidtransPayButton.tsx
    order/
      OrderCard.tsx
      OrderTimeline.tsx
      OrderStatusBadge.tsx
      PDFReceiptButton.tsx
    home/
      HeroCarousel.tsx
      CategoryGrid.tsx
      FeaturedProducts.tsx
      TestimonialSection.tsx
      HeritageBanner.tsx
    common/
      LoadingSpinner.tsx
      ErrorBoundary.tsx
      EmptyState.tsx
      Breadcrumb.tsx
      SectionHeader.tsx
      PriceDisplay.tsx
      HalalBadge.tsx
  admin/
    layout/
      AdminSidebar.tsx
      AdminHeader.tsx
      AdminBreadcrumb.tsx
    dashboard/
      KPICard.tsx
      RevenueChart.tsx
      RecentOrders.tsx
      LowStockAlert.tsx
    product/
      ProductForm.tsx
      ImageUploader.tsx
      VariantManager.tsx
    order/
      OrderTable.tsx
      OrderStatusUpdater.tsx
      OrderFilters.tsx

store/
  cart.store.ts                # Zustand cart with persist

hooks/
  useCart.ts
  useAuth.ts
  useBreakpoint.ts
  useMidtrans.ts
  useToast.ts

lib/
  utils.ts                     # cn(), formatIDR(), formatDate()
  queryClient.ts               # TanStack Query client

providers/
  QueryProvider.tsx            # TanStack Query provider
  AuthProvider.tsx             # NextAuth session provider
```

---

## 3. ROOT LAYOUT

### `app/layout.tsx`
```typescript
import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import { auth } from '@/lib/auth/config';
import { SessionProvider } from 'next-auth/react';
import { QueryProvider } from '@/providers/QueryProvider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { template: '%s | Dapur Dekaka', default: 'Dapur Dekaka — Dimsum & Frozen Food Premium Bandung' },
  description: 'Dimsum dan frozen food premium dari dapur keluarga Tionghoa-Indonesia Bandung. 德卡 — Cita rasa warisan, kualitas terjamin halal.',
  keywords: ['dimsum', 'frozen food', 'bandung', 'halal', 'siomay', 'bakpao', 'hakau'],
  openGraph: {
    siteName: 'Dapur Dekaka',
    locale: 'id_ID',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="id" className={`${playfair.variable} ${inter.variable}`}>
      <body>
        <SessionProvider session={session}>
          <QueryProvider>
            {children}
            <Toaster position="top-center" richColors />
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

### `providers/QueryProvider.tsx`
```typescript
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,     // 1 minute
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

---

## 4. STORE LAYOUT

### `app/(store)/layout.tsx`
```typescript
import Script from 'next/script';
import { StoreHeader } from '@/components/store/layout/StoreHeader';
import { BottomNav } from '@/components/store/layout/BottomNav';
import { WhatsAppButton } from '@/components/store/layout/WhatsAppButton';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreHeader />
      <main className="min-h-screen pb-20 md:pb-0">
        {children}
      </main>
      <BottomNav />
      <WhatsAppButton />
      {/* Midtrans Snap.js — afterInteractive so it doesn't block render */}
      <Script
        src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="afterInteractive"
      />
    </>
  );
}
```

---

## 5. CORE COMPONENTS

### `components/store/layout/StoreHeader.tsx`
```typescript
import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/lib/auth/config';
import { CartSheet } from '@/components/store/cart/CartSheet';
import { LanguageToggle } from '@/components/store/layout/LanguageToggle';
import { UserMenu } from '@/components/store/layout/UserMenu';
import { SearchButton } from '@/components/store/layout/SearchButton';

export async function StoreHeader() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-brand-cream-dark shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <Image
            src="/logo.jpg"
            alt="Dapur Dekaka"
            width={40}
            height={40}
            className="rounded-full"
            priority
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/produk" className="hover:text-brand-red transition-colors">Produk</Link>
          <Link href="/blog" className="hover:text-brand-red transition-colors">Blog</Link>
          <Link href="/tentang" className="hover:text-brand-red transition-colors">Tentang</Link>
          <Link href="/kontak" className="hover:text-brand-red transition-colors">Kontak</Link>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <SearchButton />
          <LanguageToggle />
          <CartSheet />
          <UserMenu session={session} />
        </div>
      </div>
    </header>
  );
}
```

### `components/store/layout/BottomNav.tsx`
```typescript
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ShoppingBag, Heart, ShoppingCart, User } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Beranda' },
  { href: '/produk', icon: ShoppingBag, label: 'Produk' },
  { href: '/keranjang', icon: ShoppingCart, label: 'Keranjang' },
  { href: '/akun', icon: User, label: 'Akun' },
];

export function BottomNav() {
  const pathname = usePathname();
  const itemCount = useCartStore((s) => s.getItemCount());

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-brand-cream-dark md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="h-20 flex items-center justify-around px-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          const isCart = href === '/keranjang';

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 min-w-[60px] py-2 px-3 rounded-xl transition-colors',
                isActive ? 'text-brand-red' : 'text-[#6B6B6B]'
              )}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {isCart && itemCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-brand-red text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### `components/store/layout/WhatsAppButton.tsx`
```typescript
'use client';
import { MessageCircle } from 'lucide-react';

export function WhatsAppButton() {
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '6281234567890';
  const message = encodeURIComponent('Halo Dapur Dekaka, saya ingin bertanya...');
  const href = `https://wa.me/${waNumber}?text=${message}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg animate-pulse-soft hover:animate-none hover:scale-110 transition-transform no-tap"
      aria-label="Hubungi via WhatsApp"
    >
      <MessageCircle size={28} className="text-white fill-white" />
    </a>
  );
}
```

### `components/store/product/ProductCard.tsx`
```typescript
import Image from 'next/image';
import Link from 'next/link';
import { formatIDR } from '@/lib/utils';
import { HalalBadge } from '@/components/store/common/HalalBadge';
import { StockIndicator } from '@/components/store/product/StockIndicator';
import { AddToCartButton } from '@/components/store/product/AddToCartButton';

interface ProductCardProps {
  product: {
    id: string;
    slug: string;
    nameId: string;
    image: string;
    priceIDR: number;
    originalPriceIDR?: number;
    isHalal: boolean;
    stock: number;
    isNew?: boolean;
    isPromo?: boolean;
    defaultVariantId: string;
    defaultVariantName: string;
    weightGram: number;
    sku: string;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;
  const hasDiscount = product.originalPriceIDR && product.originalPriceIDR > product.priceIDR;

  return (
    <article className="bg-white rounded-card shadow-card hover:shadow-card-hover transition-shadow duration-200 overflow-hidden group">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-brand-cream">
        <Link href={`/produk/${product.slug}`}>
          <Image
            src={product.image}
            alt={product.nameId}
            fill
            className={`object-cover transition-transform duration-300 group-hover:scale-105 ${isOutOfStock ? 'opacity-60 grayscale' : ''}`}
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          />
        </Link>

        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isHalal && <HalalBadge />}
          {product.isNew && (
            <span className="bg-brand-red text-white text-[10px] font-bold px-2 py-0.5 rounded-badge">
              BARU
            </span>
          )}
          {product.isPromo && (
            <span className="bg-[#D97706] text-white text-[10px] font-bold px-2 py-0.5 rounded-badge">
              PROMO
            </span>
          )}
          {isOutOfStock && (
            <span className="bg-[#6B7280] text-white text-[10px] font-bold px-2 py-0.5 rounded-badge">
              HABIS
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-2">
        <Link href={`/produk/${product.slug}`}>
          <h3 className="font-semibold text-sm text-[#1A1A1A] line-clamp-2 leading-tight hover:text-brand-red transition-colors">
            {product.nameId}
          </h3>
        </Link>

        {/* Price */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-brand-red font-bold text-base">
            {formatIDR(product.priceIDR)}
          </span>
          {hasDiscount && (
            <span className="text-[#6B6B6B] text-xs line-through">
              {formatIDR(product.originalPriceIDR!)}
            </span>
          )}
        </div>

        {/* Stock indicator */}
        {isLowStock && <StockIndicator stock={product.stock} />}

        {/* Add to cart */}
        <AddToCartButton
          product={{
            variantId: product.defaultVariantId,
            productId: product.id,
            productName: product.nameId,
            variantName: product.defaultVariantName,
            slug: product.slug,
            sku: product.sku,
            price: product.priceIDR,
            quantity: 1,
            weightGram: product.weightGram,
            image: product.image,
            stock: product.stock,
          }}
          disabled={isOutOfStock}
        />
      </div>
    </article>
  );
}
```

### `components/store/product/AddToCartButton.tsx`
```typescript
'use client';
import { useState } from 'react';
import { ShoppingCart, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCartStore, CartItem } from '@/store/cart.store';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AddToCartButtonProps {
  product: CartItem;
  disabled?: boolean;
  className?: string;
  variant?: 'card' | 'detail';
}

export function AddToCartButton({ product, disabled, className, variant = 'card' }: AddToCartButtonProps) {
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);

  function handleAdd() {
    addItem(product);
    setAdded(true);
    toast.success(`${product.productName} ditambahkan ke keranjang`, {
      description: product.variantName,
      duration: 2000,
    });
    setTimeout(() => setAdded(false), 2000);
  }

  if (variant === 'detail') {
    return (
      <Button
        onClick={handleAdd}
        disabled={disabled || added}
        className={cn(
          'w-full h-12 bg-brand-red hover:bg-brand-red-dark text-white font-semibold rounded-button shadow-button hover:shadow-button-hover transition-all',
          className
        )}
      >
        {added ? (
          <><Check size={18} className="mr-2" /> Ditambahkan!</>
        ) : (
          <><ShoppingCart size={18} className="mr-2" /> Tambah ke Keranjang</>
        )}
      </Button>
    );
  }

  return (
    <button
      onClick={handleAdd}
      disabled={disabled || added}
      className={cn(
        'w-full min-h-[44px] rounded-button font-semibold text-sm transition-all',
        disabled
          ? 'bg-[#ABABAB] text-white cursor-not-allowed'
          : added
          ? 'bg-[#16A34A] text-white'
          : 'bg-brand-red text-white hover:bg-brand-red-dark shadow-button hover:shadow-button-hover',
        className
      )}
    >
      {disabled ? 'Habis' : added ? '✓ Ditambahkan' : 'Tambah'}
    </button>
  );
}
```

### `components/store/cart/CartSheet.tsx`
```typescript
'use client';
import { ShoppingCart } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useCartStore } from '@/store/cart.store';
import { CartItem } from '@/components/store/cart/CartItem';
import { CartSummary } from '@/components/store/cart/CartSummary';
import { EmptyCart } from '@/components/store/cart/EmptyCart';
import Link from 'next/link';

export function CartSheet() {
  const items = useCartStore((s) => s.items);
  const itemCount = useCartStore((s) => s.getItemCount());
  const subtotal = useCartStore((s) => s.getSubtotal());

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-brand-cream transition-colors no-tap">
          <ShoppingCart size={22} />
          {itemCount > 0 && (
            <span className="absolute top-0 right-0 bg-brand-red text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {itemCount > 9 ? '9+' : itemCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col p-0">
        <SheetHeader className="px-4 py-4 border-b border-brand-cream-dark">
          <SheetTitle className="font-display text-lg">
            Keranjang Belanja ({itemCount} item)
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <EmptyCart />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {items.map((item) => (
                <CartItem key={item.variantId} item={item} />
              ))}
            </div>
            <div className="border-t border-brand-cream-dark px-4 py-4 space-y-3">
              <CartSummary subtotal={subtotal} />
              <Link href="/checkout" className="block">
                <Button className="w-full h-12 bg-brand-red hover:bg-brand-red-dark text-white font-semibold rounded-button">
                  Lanjut ke Checkout
                </Button>
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

### `components/store/common/HalalBadge.tsx`
```typescript
export function HalalBadge() {
  return (
    <span className="inline-flex items-center bg-[#16A34A] text-white text-[10px] font-bold px-2 py-0.5 rounded-badge">
      ✓ HALAL
    </span>
  );
}
```

### `lib/utils.ts`
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatIDR(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function toIDRInt(value: number): number {
  return Math.floor(value);
}

export function formatDate(date: Date | string, locale: 'id' | 'en' = 'id'): string {
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDatetime(date: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(date));
}

export function toWIB(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}
```

---

## 6. CHECKOUT FLOW

### `app/(store)/checkout/page.tsx`
```typescript
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart.store';
import { useSession } from 'next-auth/react';
import Script from 'next/script';
import { AddressForm } from '@/components/store/checkout/AddressForm';
import { ShippingSelector } from '@/components/store/checkout/ShippingSelector';
import { CouponInput } from '@/components/store/checkout/CouponInput';
import { PointsRedeemer } from '@/components/store/checkout/PointsRedeemer';
import { OrderSummary } from '@/components/store/checkout/OrderSummary';
import { MidtransPayButton } from '@/components/store/checkout/MidtransPayButton';

export default function CheckoutPage() {
  const { data: session } = useSession({ required: true });
  const items = useCartStore((s) => s.items);
  const router = useRouter();

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) router.push('/keranjang');
  }, [items]);

  const [shippingData, setShippingData] = useState(null);
  const [selectedCourier, setSelectedCourier] = useState<{
    courierCode: string;
    courierService: string;
    costIDR: number;
    name: string;
  } | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ... form state and handlers

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="font-display text-display-sm text-[#1A1A1A] mb-6">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Forms */}
        <div className="space-y-4">
          <AddressForm onComplete={setShippingData} />
          {shippingData && (
            <ShippingSelector
              addressData={shippingData}
              cartItems={items}
              onSelect={setSelectedCourier}
            />
          )}
          <CouponInput
            subtotal={items.reduce((s, i) => s + i.price * i.quantity, 0)}
            onApply={(code, discount) => { setCouponCode(code); setCouponDiscount(discount); }}
          />
          <PointsRedeemer
            subtotal={items.reduce((s, i) => s + i.price * i.quantity, 0)}
            onApply={setPointsToRedeem}
          />
        </div>

        {/* Right: Summary + Pay */}
        <div className="lg:sticky lg:top-20">
          <OrderSummary
            items={items}
            shippingCost={selectedCourier?.costIDR ?? 0}
            couponDiscount={couponDiscount}
            pointsDiscount={pointsToRedeem * 10}
            shippingName={selectedCourier?.name}
          />
          <MidtransPayButton
            disabled={!shippingData || !selectedCourier}
            checkoutData={{
              items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
              shippingAddress: shippingData!,
              courierCode: selectedCourier?.courierCode,
              courierService: selectedCourier?.courierService,
              couponCode,
              pointsToRedeem,
            }}
            onSuccess={(orderNumber) => {
              useCartStore.getState().clearCart();
              router.push(`/pesanan/${orderNumber}?payment=finish`);
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

### `components/store/checkout/MidtransPayButton.tsx`
```typescript
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

declare global {
  interface Window {
    snap: {
      pay: (token: string, options: {
        onSuccess: (result: any) => void;
        onPending: (result: any) => void;
        onError: (result: any) => void;
        onClose: () => void;
      }) => void;
    };
  }
}

interface MidtransPayButtonProps {
  disabled: boolean;
  checkoutData: any;
  onSuccess: (orderNumber: string) => void;
}

export function MidtransPayButton({ disabled, checkoutData, onSuccess }: MidtransPayButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    if (!window.snap) {
      toast.error('Payment belum siap, coba lagi dalam beberapa detik');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      const { snapToken, orderNumber } = data.data;

      window.snap.pay(snapToken, {
        onSuccess: () => onSuccess(orderNumber),
        onPending: () => {
          toast.info('Menunggu konfirmasi pembayaran...');
          onSuccess(orderNumber);
        },
        onError: () => toast.error('Pembayaran gagal. Silakan coba lagi.'),
        onClose: () => setLoading(false),
      });
    } catch (e: any) {
      toast.error(e.message ?? 'Terjadi kesalahan');
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handlePay}
      disabled={disabled || loading}
      className="w-full h-14 bg-brand-red hover:bg-brand-red-dark text-white font-bold text-base rounded-button shadow-button hover:shadow-button-hover mt-4"
    >
      {loading ? (
        <><Loader2 size={20} className="mr-2 animate-spin" /> Memproses...</>
      ) : (
        'Bayar Sekarang'
      )}
    </Button>
  );
}
```

### `components/store/checkout/ShippingSelector.tsx`
```typescript
'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatIDR } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ShippingOption {
  courier: string;
  service: string;
  name: string;
  costIDR: number;
  estimatedDays: string;
}

export function ShippingSelector({ addressData, cartItems, onSelect }: {
  addressData: { cityId: string };
  cartItems: Array<{ quantity: number; weightGram: number }>;
  onSelect: (option: ShippingOption) => void;
}) {
  const totalWeight = cartItems.reduce((s, i) => s + i.weightGram * i.quantity, 0);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: options, isLoading, isError } = useQuery({
    queryKey: ['shipping', addressData.cityId, totalWeight],
    queryFn: async () => {
      const res = await fetch('/api/shipping/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationCityId: addressData.cityId,
          weightGram: totalWeight,
        }),
      });
      const data = await res.json();
      return data.data as ShippingOption[];
    },
    enabled: !!addressData.cityId,
  });

  if (isLoading) return (
    <div className="bg-white rounded-card p-4 flex items-center gap-2 text-[#6B6B6B]">
      <Loader2 size={16} className="animate-spin" />
      Menghitung ongkir...
    </div>
  );

  return (
    <div className="bg-white rounded-card p-4">
      <h3 className="font-semibold mb-3">Pilih Pengiriman (Cold-Chain)</h3>
      <div className="space-y-2">
        {options?.map((opt) => {
          const key = `${opt.courier}-${opt.service}`;
          return (
            <label
              key={key}
              className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                selected === key
                  ? 'border-brand-red bg-brand-red/5'
                  : 'border-brand-cream-dark hover:border-brand-cream-darker'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="shipping"
                  value={key}
                  checked={selected === key}
                  onChange={() => { setSelected(key); onSelect(opt); }}
                  className="accent-brand-red"
                />
                <div>
                  <p className="font-medium text-sm">{opt.name}</p>
                  <p className="text-xs text-[#6B6B6B]">Estimasi {opt.estimatedDays} hari</p>
                </div>
              </div>
              <span className="font-semibold text-brand-red">{formatIDR(opt.costIDR)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 7. ORDER STATUS COMPONENT

### `components/store/order/OrderStatusBadge.tsx`
```typescript
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending_payment: { label: 'Menunggu Pembayaran', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  paid: { label: 'Pembayaran Diterima', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  processing: { label: 'Sedang Diproses', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  packed: { label: 'Dikemas', className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  shipped: { label: 'Dalam Pengiriman', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  delivered: { label: 'Terkirim', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Dibatalkan', className: 'bg-gray-50 text-gray-600 border-gray-200' },
  refund_requested: { label: 'Refund Diminta', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  refunded: { label: 'Refund Selesai', className: 'bg-gray-50 text-gray-500 border-gray-200' },
} as const;

export function OrderStatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.cancelled;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-semibold border', config.className)}>
      {config.label}
    </span>
  );
}
```

### `components/store/order/OrderTimeline.tsx`
```typescript
import { formatDatetime } from '@/lib/utils';
import { CheckCircle, Circle } from 'lucide-react';

interface TimelineItem {
  status: string;
  note: string | null;
  createdAt: string;
}

const TIMELINE_ORDER = [
  'pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered'
];

export function OrderTimeline({ history }: { history: TimelineItem[] }) {
  return (
    <ol className="relative border-l-2 border-brand-cream-dark space-y-6 pl-6 ml-2">
      {history.map((item, idx) => (
        <li key={idx} className="relative">
          <div className="absolute -left-[29px] bg-white">
            <CheckCircle size={20} className="text-brand-red" />
          </div>
          <div className="animate-fade-in">
            <p className="font-semibold text-sm capitalize">
              {item.status.replace(/_/g, ' ')}
            </p>
            {item.note && <p className="text-xs text-[#6B6B6B] mt-0.5">{item.note}</p>}
            <time className="text-xs text-[#ABABAB]">{formatDatetime(item.createdAt)}</time>
          </div>
        </li>
      ))}
    </ol>
  );
}
```

---

## 8. SKELETON LOADING PATTERNS

```typescript
// components/store/common/ProductCardSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-card overflow-hidden">
      <Skeleton className="aspect-square w-full shimmer-bg" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4 shimmer-bg" />
        <Skeleton className="h-3 w-1/2 shimmer-bg" />
        <Skeleton className="h-8 w-full shimmer-bg" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
```

---

## 9. EMPTY STATES

```typescript
// components/store/common/EmptyState.tsx
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface EmptyStateProps {
  title: string;
  description: string;
  imageSrc?: string;
  cta?: { label: string; href: string };
}

export function EmptyState({ title, description, imageSrc, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      {imageSrc && (
        <Image src={imageSrc} alt="" width={180} height={180} className="mb-6 opacity-80" />
      )}
      <h3 className="font-display text-display-xs text-[#1A1A1A] mb-2">{title}</h3>
      <p className="text-[#6B6B6B] text-sm max-w-[280px] mb-6">{description}</p>
      {cta && (
        <Link href={cta.href}>
          <Button className="bg-brand-red hover:bg-brand-red-dark text-white rounded-button">
            {cta.label}
          </Button>
        </Link>
      )}
    </div>
  );
}

// Empty Cart specific
export function EmptyCart() {
  return (
    <EmptyState
      title="Keranjang kamu kosong"
      description="Yuk, pilih produk frozen food premium Dapur Dekaka!"
      imageSrc="/illustrations/empty-cart.svg"
      cta={{ label: 'Mulai Belanja', href: '/produk' }}
    />
  );
}
```

---

## 10. ADMIN LAYOUT

### `app/(admin)/admin/layout.tsx`
```typescript
import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || !['superadmin', 'owner', 'warehouse'].includes(session.user?.role ?? '')) {
    redirect('/masuk');
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] overflow-hidden">
      <AdminSidebar role={session.user.role!} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader user={session.user} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### `components/admin/layout/AdminSidebar.tsx`
```typescript
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, Package, Users,
  Tag, BookOpen, Settings, BarChart2, Warehouse
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['superadmin', 'owner', 'warehouse'] },
  { href: '/admin/pesanan', icon: ShoppingBag, label: 'Pesanan', roles: ['superadmin', 'owner', 'warehouse'] },
  { href: '/admin/produk', icon: Package, label: 'Produk', roles: ['superadmin', 'owner'] },
  { href: '/admin/inventaris', icon: Warehouse, label: 'Inventaris', roles: ['superadmin', 'owner', 'warehouse'] },
  { href: '/admin/pengguna', icon: Users, label: 'Pengguna', roles: ['superadmin', 'owner'] },
  { href: '/admin/kupon', icon: Tag, label: 'Kupon', roles: ['superadmin', 'owner'] },
  { href: '/admin/blog', icon: BookOpen, label: 'Blog', roles: ['superadmin', 'owner'] },
  { href: '/admin/pengaturan', icon: Settings, label: 'Pengaturan', roles: ['superadmin'] },
];

export function AdminSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const navItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 bg-[#0F172A] text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-white/10">
        <Image src="/logo.jpg" alt="Dapur Dekaka" width={32} height={32} className="rounded-full" />
        <div className="ml-3">
          <p className="font-semibold text-sm">Dapur Dekaka</p>
          <p className="text-[#94A3B8] text-xs capitalize">{role}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-red text-white'
                  : 'text-[#94A3B8] hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

---

## 11. HOMEPAGE

### `app/(store)/page.tsx` (ISR)
```typescript
import { HeroCarousel } from '@/components/store/home/HeroCarousel';
import { CategoryGrid } from '@/components/store/home/CategoryGrid';
import { FeaturedProducts } from '@/components/store/home/FeaturedProducts';
import { TestimonialSection } from '@/components/store/home/TestimonialSection';
import { HeritageBanner } from '@/components/store/home/HeritageBanner';
import { db } from '@/lib/db';
import { carouselSlides, categories, products, productVariants, testimonials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const revalidate = 60;

export default async function HomePage() {
  const [slides, cats, featured, testimonialData] = await Promise.all([
    db.select().from(carouselSlides).where(eq(carouselSlides.isActive, true)).orderBy(carouselSlides.sortOrder),
    db.select().from(categories).where(eq(categories.isActive, true)).orderBy(categories.sortOrder),
    db.select({
      id: products.id,
      slug: products.slug,
      nameId: products.nameId,
      isHalal: products.isHalal,
    }).from(products).where(and(eq(products.isFeatured, true), eq(products.isActive, true))).limit(8),
    db.select().from(testimonials).where(eq(testimonials.isActive, true)).limit(6),
  ]);

  return (
    <>
      <HeroCarousel slides={slides} />
      <CategoryGrid categories={cats} />
      <FeaturedProducts products={featured} />
      <HeritageBanner />
      <TestimonialSection testimonials={testimonialData} />
    </>
  );
}
```

---

## 12. INTERNATIONALIZATION

### `next-intl` Setup
```typescript
// i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'id';
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

### Message Files
```json
// i18n/messages/id.json
{
  "common": {
    "addToCart": "Tambah ke Keranjang",
    "buyNow": "Beli Sekarang",
    "outOfStock": "Stok Habis",
    "loading": "Memuat...",
    "error": "Terjadi kesalahan",
    "retry": "Coba Lagi"
  },
  "product": {
    "weight": "Berat",
    "sku": "SKU",
    "halal": "Halal",
    "stockRemaining": "Sisa {count} item",
    "addedToCart": "{name} ditambahkan ke keranjang"
  },
  "checkout": {
    "title": "Checkout",
    "shippingAddress": "Alamat Pengiriman",
    "shippingMethod": "Metode Pengiriman",
    "coupon": "Kode Kupon",
    "points": "Gunakan Poin",
    "pay": "Bayar Sekarang"
  },
  "errors": {
    "couponInvalid": "Kode kupon tidak valid",
    "stockInsufficient": "Stok tidak mencukupi",
    "checkoutFailed": "Gagal memproses checkout"
  }
}
```

---

## 13. PDF RECEIPT

```typescript
// components/store/order/PDFReceiptButton.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

interface PDFReceiptButtonProps {
  orderId: string;
  orderNumber: string;
}

export function PDFReceiptButton({ orderId, orderNumber }: PDFReceiptButtonProps) {
  const [generating, setGenerating] = useState(false);

  async function handleDownload() {
    setGenerating(true);
    try {
      // Dynamic import prevents SSR issues with @react-pdf/renderer
      const { generateOrderPDF } = await import('@/lib/pdf/order-receipt');

      // Fetch order data
      const res = await fetch(`/api/orders/${orderNumber}`);
      const { data: order } = await res.json();

      const blob = await generateOrderPDF(order);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kwitansi-${orderNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={generating}
      className="border-brand-cream-dark"
    >
      {generating ? (
        <Loader2 size={16} className="mr-2 animate-spin" />
      ) : (
        <Download size={16} className="mr-2" />
      )}
      Unduh Kwitansi
    </Button>
  );
}
```

---

## 14. NEXT.JS CONFIG

### `next.config.mjs`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google OAuth
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] },
  },
  async headers() {
    return [
      {
        source: '/api/payments/webhook',
        headers: [{ key: 'Access-Control-Allow-Origin', value: 'https://api.midtrans.com' }],
      },
    ];
  },
};

export default nextConfig;
```
