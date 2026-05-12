````markdown
# DESIGN_SYSTEM.md — UI/UX & Brand Guidelines
# DapurDekaka.com
**Version:** 1.0
**Last Updated:** May 2026
**Author:** Bashara (Product Owner)
**Status:** Active — Pre-Development

---

## TABLE OF CONTENTS
1. Brand Identity & Philosophy
2. Color System
3. Typography System
4. Spacing & Layout System
5. Component Library
6. Mobile-First Rules
7. Animation & Motion System
8. Iconography
9. Imagery & Photography
10. Empty States & Illustrations
11. Page-by-Page Design Specs
12. Admin Dashboard Design
13. Email Design System
14. Accessibility Standards
15. CSS Variables Reference

---

## 1. BRAND IDENTITY & PHILOSOPHY

### 1.1 Brand Essence
Dapur Dekaka (德卡) is a **Chinese-Indonesian heritage frozen food brand** from Bandung. The brand identity is rooted in:
- **Family heritage** — recipes passed down, "dari dapur keluarga"
- **Chinese-Indonesian culture** — 德卡 (Dé Kǎ) Chinese characters, dimsum tradition
- **Artisan quality** — handcrafted, not factory-mass-produced feeling
- **Warmth and trust** — food brand that feels like someone's mother made it

### 1.2 Visual Direction: Warm Heritage
The design style is **Warm Heritage** — inspired by old Bandung Chinese shophouses, traditional Chinese tableware, and the warmth of a family kitchen. This is NOT:
- ❌ Corporate and sterile (no pure white + blue SaaS look)
- ❌ Loud and chaotic (no neon colors, no aggressive sale banners)
- ❌ Generic marketplace (no Shopee/Tokopedia clone aesthetics)
- ❌ Overly modern minimalist (no cold whitespace-only design)

This IS:
- ✅ Warm cream backgrounds with rich red accents
- ✅ Traditional Chinese motifs used subtly as decorative elements
- ✅ Paper/linen texture on section backgrounds
- ✅ Editorial food photography presented with care
- ✅ Handcrafted feeling in typography and spacing
- ✅ Premium but approachable — like a well-loved family restaurant

### 1.3 Brand Voice (Copywriting Tone)
All UI copy, labels, error messages, and CTAs must follow this voice:

| Dimension | Guideline | Example |
|---|---|---|
| **Language** | Bahasa Indonesia, conversational | "Yuk, mulai belanja!" not "Mulailah berbelanja" |
| **Warmth** | Like talking to a friend's parent | "Pesanan kamu sudah kami terima 🙏" |
| **Confidence** | Proud of product quality | "Dibuat dengan bahan segar pilihan" |
| **Heritage** | Reference Chinese-Indonesian identity | "Cita rasa yang sudah diwariskan" |
| **Urgency** | Gentle, never aggressive | "Stok terbatas" not "BELI SEKARANG!!!" |
| **Error messages** | Empathetic, helpful | "Ups, kode kupon ini sudah tidak berlaku. Coba cek kupon lain yuk!" |

### 1.4 Logo Usage Rules
- Logo is always placed on **cream (#F0EAD6) or white (#FFFFFF)** background
- Never place logo on red background
- Never distort, recolor, or add effects to logo
- Minimum size: 40px diameter
- Clear space around logo: minimum 8px on all sides
- Logo file: `/public/logo.jpg` (circular, red with cream illustration)

---

## 2. COLOR SYSTEM

### 2.1 Primary Brand Colors

```css
/* Core Brand */
--color-brand-red:        #C8102E;   /* Primary — CTAs, headers, accents */
--color-brand-red-dark:   #8B0000;   /* Hover states, active states */
--color-brand-red-light:  #E8394F;   /* Light variant, less critical accents */
--color-brand-red-muted:  #F5C6CC;   /* Very light red for backgrounds, alerts */

/* Cream / Background */
--color-cream:            #F0EAD6;   /* Primary background, section fills */
--color-cream-dark:       #E0D4BC;   /* Dividers, card borders, subtle separators */
--color-cream-darker:     #C8B89A;   /* Stronger dividers, icons on cream bg */

/* Text */
--color-text-primary:     #1A1A1A;   /* Body text, headings */
--color-text-secondary:   #6B6B6B;   /* Subtext, captions, labels */
--color-text-disabled:    #ABABAB;   /* Disabled states */
--color-text-inverse:     #FFFFFF;   /* Text on dark/red backgrounds */
--color-text-cream:       #F0EAD6;   /* Text on red backgrounds */

/* Surface */
--color-surface-white:    #FFFFFF;   /* Card backgrounds, inputs */
--color-surface-off:      #FAFAF8;   /* Slightly off-white page background */
--color-surface-cream:    #F0EAD6;   /* Warm section backgrounds */
```

### 2.2 Semantic Colors

```css
/* Status */
--color-success:          #16A34A;   /* Order confirmed, payment success */
--color-success-light:    #DCFCE7;   /* Success background */
--color-warning:          #D97706;   /* Low stock, payment pending */
--color-warning-light:    #FEF3C7;   /* Warning background */
--color-error:            #DC2626;   /* Errors, validation failures */
--color-error-light:      #FEE2E2;   /* Error background */
--color-info:             #2563EB;   /* Info messages, links */
--color-info-light:       #DBEAFE;   /* Info background */

/* Order Status Colors */
--color-status-pending:   #D97706;   /* pending_payment */
--color-status-paid:      #2563EB;   /* paid */
--color-status-processing:#7C3AED;   /* processing */
--color-status-packed:    #0891B2;   /* packed */
--color-status-shipped:   #059669;   /* shipped */
--color-status-delivered: #16A34A;   /* delivered */
--color-status-cancelled: #6B7280;   /* cancelled */
--color-status-refunded:  #9CA3AF;   /* refunded */
```

### 2.3 Color Usage Rules

**Red (#C8102E) is ONLY used for:**
- Primary CTA buttons ("Tambah ke Keranjang", "Bayar Sekarang", "Pesan Sekarang")
- Navigation active states
- Brand logo and wordmark
- Section headers on cream background
- Promotional banners background
- Halal badge
- Price display (on product cards)
- Error states (use semantic red)

**Red is NEVER used for:**
- Large background fills on content pages (causes fatigue)
- Body text (unreadable)
- Secondary actions (use outline style instead)
- Admin dashboard content area (use neutral)

**Cream (#F0EAD6) is used for:**
- Alternating section backgrounds on homepage
- Card backgrounds in heritage sections
- Badge backgrounds
- Footer background

### 2.4 Tailwind Config Extension

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
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
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
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
        'noise': "url('/textures/noise.png')",
        'chinese-pattern': "url('/textures/chinese-pattern.svg')",
        'hero-gradient': 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
        'button': '0 1px 2px rgba(200,16,46,0.3)',
        'button-hover': '0 4px 12px rgba(200,16,46,0.4)',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'badge': '6px',
        'pill': '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(200,16,46,0.4)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 8px rgba(200,16,46,0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwindcss-animate'),
  ],
};

export default config;
```

---

## 3. TYPOGRAPHY SYSTEM

### 3.1 Font Stack

```css
/* Load in app/layout.tsx via next/font/google */
import { Playfair_Display, Inter } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});
```

### 3.2 Type Scale

| Token | Size | Weight | Font | Usage |
|---|---|---|---|---|
| `display-2xl` | 72px | 700 | Playfair Display | Hero headlines (desktop) |
| `display-xl` | 60px | 700 | Playfair Display | Page heroes |
| `display-lg` | 48px | 600 | Playfair Display | Section headlines |
| `display-md` | 36px | 600 | Playfair Display | Card headlines, modal titles |
| `display-sm` | 30px | 600 | Playfair Display | Sub-section headlines |
| `display-xs` | 24px | 500 | Playfair Display | Card titles, widget headers |
| `text-xl` | 20px | 500 | Inter | Large body, lead paragraphs |
| `text-lg` | 18px | 400 | Inter | Body text primary |
| `text-base` | 16px | 400 | Inter | Default body text |
| `text-sm` | 14px | 400 | Inter | Secondary text, labels |
| `text-xs` | 12px | 400 | Inter | Captions, metadata |
| `text-2xs` | 10px | 500 | Inter | Badges, tiny labels |

### 3.3 Typography Rules
- **Headings** always use Playfair Display — this is the brand font
- **All UI labels, buttons, inputs, prices** use Inter — clean and readable
- **Price display:** Inter Bold, brand-red color, always in IDR format
- **Product names:** Playfair Display Medium on product cards
- **Body text** line height: 1.6 for readability
- **Mobile heading sizes** are 70% of desktop sizes (responsive)
- **Indonesian text** does not require different letter-spacing than English

### 3.4 Price Formatting
```typescript
// lib/utils/format-currency.ts
export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  // Output: "Rp 120.000"
}
```

---

## 4. SPACING & LAYOUT SYSTEM

### 4.1 Spacing Scale (Tailwind default + custom)
Uses Tailwind's default 4px base unit. Key tokens:
- `2` = 8px (tight spacing, icon gaps)
- `3` = 12px (small gaps)
- `4` = 16px (standard component padding)
- `6` = 24px (card padding, section internal)
- `8` = 32px (section padding mobile)
- `12` = 48px (section padding desktop)
- `16` = 64px (large section gaps)
- `20` = 80px (hero section padding)
- `24` = 96px (major section breaks)

### 4.2 Container Widths

```css
/* Mobile first breakpoints */
sm:  640px   /* Large phones */
md:  768px   /* Tablets */
lg:  1024px  /* Laptops */
xl:  1280px  /* Desktops */
2xl: 1536px  /* Large monitors */

/* Max content width */
.container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px;    /* mobile */
}
@media (min-width: 768px) {
  .container { padding: 0 24px; }
}
@media (min-width: 1024px) {
  .container { padding: 0 32px; }
}
```

### 4.3 Grid System

**Product Catalog:**
- Mobile: 1 column (horizontal cards, full width)
- Tablet (md): 1 column (wider horizontal cards)
- Desktop (lg): 2 columns (horizontal cards side by side)
- Large (xl): 3 columns

**Homepage Featured Products:**
- Mobile: Horizontal scroll (2.5 cards visible, peek effect)
- Desktop: 4 column grid

**Admin Dashboard:**
- Mobile: 1 column stack
- Tablet: 2 column grid (KPI cards)
- Desktop: 4 column grid (KPI cards) + sidebar layout

### 4.4 Safe Areas (Mobile)
- Top: `pt-safe` (iOS notch)
- Bottom: `pb-safe` plus 80px for bottom navigation bar
- All pages must account for the 80px bottom navigation bar on mobile

---

## 5. COMPONENT LIBRARY

### 5.1 Button System

```typescript
// Variants
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'whatsapp';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | 'icon';

/*
PRIMARY — #C8102E background, cream text
  - Use for: Add to cart, Bayar Sekarang, Pesan Sekarang
  - Hover: #8B0000
  - Shadow: 0 4px 12px rgba(200,16,46,0.4)

SECONDARY — cream background, red text, red border
  - Use for: secondary actions

OUTLINE — transparent background, brand-red border, brand-red text
  - Use for: filters, toggles, less important CTAs

GHOST — transparent, gray text
  - Use for: navigation items, tertiary actions

DESTRUCTIVE — red background (error semantic)
  - Use for: delete, cancel, dangerous actions

WHATSAPP — #25D366 green background, white text, WhatsApp icon
  - Use for: floating WA button, WA order alternative
*/
```

**Button Sizes:**
- `sm`: h-8, px-3, text-sm — filter chips, compact actions
- `md`: h-10, px-4, text-base — default
- `lg`: h-12, px-6, text-lg — primary CTAs on cards
- `xl`: h-14, px-8, text-xl — hero CTAs, checkout button (full width on mobile)
- `icon`: h-10 w-10 — icon-only buttons

**Touch targets:** All buttons minimum 44px height on mobile (xl size for primary mobile CTAs)

### 5.2 Product Card (Horizontal Layout)

```
┌──────────────────────────────────────────────┐
│ ┌──────────┐  Dimsum Mix (Siomay) Frozen      │
│ │          │  ★★★★★ (234 terjual)             │
│ │  IMAGE   │  [HALAL] [FROZEN]                │
│ │  120×120 │                                  │
│ │          │  25 pcs    Rp 65.000             │
│ └──────────┘  50 pcs    Rp 120.000            │
│               [+ Tambah ke Keranjang  ]       │
└──────────────────────────────────────────────┘
```

**Specs:**
- Card background: white (#FFFFFF)
- Border radius: 12px
- Shadow: `card` (subtle)
- Hover shadow: `card-hover` (lift effect)
- Image: 120×120px, rounded-lg, object-cover
- Product name: Playfair Display Medium, 16px
- Price: Inter Bold, brand-red, 15px
- "Habis" state: image has 50% opacity overlay with "Habis" badge center
- Padding: 12px all sides
- Separator: 1px brand-cream-dark between cards

### 5.3 Cart Item Component

```
┌──────────────────────────────────────────────┐
│ ┌────────┐  Dimsum Mix 50 pcs                │
│ │ IMAGE  │  Rp 120.000                       │
│ │  80×80 │                                   │
│ └────────┘  [−] [  2  ] [+]    Rp 240.000   │
│                                    [🗑 Hapus] │
└──────────────────────────────────────────────┘
```

### 5.4 Badge System

```typescript
type BadgeVariant = 'halal' | 'habis' | 'promo' | 'baru' | 'terlaris' | 'frozen' | 'status';

/*
HALAL — green background (#DCFCE7), green text (#16A34A), "✓ HALAL" text
HABIS — gray background, gray text, "HABIS" text — overlays product image
PROMO — brand-red background, cream text, "PROMO" or discount text
BARU — blue background, blue text, "BARU" text
TERLARIS — amber background, amber text, "TERLARIS" text
FROZEN — light blue background, "❄ Frozen" text
STATUS — color per order status (see semantic colors)
*/
```

### 5.5 Form Elements

**Input fields:**
- Height: 44px (mobile touch-friendly)
- Border: 1.5px brand-cream-dark
- Border radius: 8px
- Focus border: brand-red + shadow `0 0 0 3px rgba(200,16,46,0.15)`
- Background: white
- Label: Inter Medium 14px, text-primary, above input
- Error state: border-error, error message in text-error text-sm below
- Placeholder: text-disabled

**Select dropdowns:**
- Same specs as input
- Custom chevron icon in brand-red

**Quantity stepper:**
```
[  −  ] [  2  ] [  +  ]
```
- Each segment: 44×44px minimum
- Border: 1.5px brand-cream-dark
- Minus/Plus: brand-red text
- Count: Inter Bold, center

### 5.6 Order Status Timeline

```
● Pesanan Dikonfirmasi    12 Mei 2026, 01:30
│ Pembayaran berhasil diterima
│
● Sedang Diproses         12 Mei 2026, 09:00
│ Pesanan sedang disiapkan
│
● Sedang Dikemas          (menunggu)
│
○ Dikirim                 (menunggu)
│
○ Tiba di Tujuan          (menunggu)
```

- Completed steps: solid brand-red circle, solid line
- Active step: animated pulsing brand-red circle
- Pending steps: hollow circle, dashed line
- Each step has timestamp + description

### 5.7 WhatsApp Floating Button

```typescript
// Always visible, bottom-right, above bottom nav
// Mobile: bottom: 96px (above bottom nav), right: 16px
// Desktop: bottom: 32px, right: 32px

// Specs:
// Size: 56×56px circle
// Background: #25D366 (WhatsApp green)
// Icon: WhatsApp SVG icon, white, 28px
// Shadow: 0 4px 16px rgba(37,211,102,0.5)
// Animation: pulseSoft (subtle pulse every 2s to attract attention)
// On click: opens wa.me/[WHATSAPP_NUMBER]?text=Halo Dapur Dekaka, saya ingin bertanya tentang...
```

### 5.8 Skeleton Loading States

All skeleton screens must match the EXACT layout shape of the content they represent:
- Product card skeleton: same dimensions as product card, shimmer animation
- Homepage carousel skeleton: full-width rectangle, same height as carousel
- Order timeline skeleton: vertical line with circles
- Dashboard KPI skeleton: 4 rectangles in row

```css
.skeleton {
  background: linear-gradient(90deg,
    var(--color-cream-dark) 25%,
    var(--color-cream) 50%,
    var(--color-cream-dark) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### 5.9 Toast Notifications

- Position: top-center on mobile, top-right on desktop
- Types: success (green), error (red), warning (amber), info (blue)
- Duration: 4 seconds auto-dismiss
- Success example: "🛒 Ditambahkan ke keranjang!"
- Error example: "❌ Stok tidak mencukupi"

---

## 6. MOBILE-FIRST RULES

### 6.1 Navigation — Mobile Bottom Bar

```
┌──────────────────────────────────────────┐
│  🏠 Beranda  📦 Produk  🛒 Keranjang  👤 Akun │
└──────────────────────────────────────────┘
```

- Height: 80px (includes safe area)
- Background: white with top shadow
- Each tab: icon (24px) + label (10px Inter)
- Active: brand-red icon + label
- Inactive: gray icon + label
- Cart icon shows badge with item count (brand-red pill, white number)
- Fixed to viewport bottom (`position: fixed; bottom: 0`)
- All page content has `pb-20` (padding-bottom: 80px) to avoid overlap

### 6.2 Desktop Navigation — Top Navbar

```
┌─────────────────────────────────────────────────────┐
│ [Logo] Beranda  Produk  Blog  B2B    [🔍] [🛒 2] [👤] │
└─────────────────────────────────────────────────────┘
```

- Background: white, subtle bottom border
- Sticky at top
- Logo: 48px height
- Nav links: Inter Medium 15px
- Active: brand-red underline
- Hover: brand-red text
- Cart: shows count badge
- Language toggle: `ID | EN` — small, right side

### 6.3 Touch Target Rules
- **Minimum touch target:** 44×44px for ALL interactive elements
- **Primary CTAs on mobile:** minimum 48px height, full width
- **List items:** minimum 56px height
- **Form inputs:** minimum 44px height
- **Spacing between targets:** minimum 8px to prevent mis-taps

### 6.4 Thumb Zone Design
Primary actions placed in **bottom thumb zone** (bottom 40% of screen):
- Add to cart button: sticky bottom bar on product page
- Checkout button: sticky bottom bar
- Bottom navigation: always reachable

Secondary actions in **middle zone:**
- Product images, descriptions, price

Rarely-needed items in **top zone:**
- Search, filters (accessible but not primary flow)

### 6.5 Sticky Bottom Bar (Product Page)

```
┌──────────────────────────────────────────┐
│ [−]  [+]    [+ Tambah ke Keranjang →] │ [reddit](https://www.reddit.com/r/replit/comments/1l5trll/replit_advising_me_to_move_to_vercel/)
└──────────────────────────────────────────┘
```

- Appears when user scrolls past the main add-to-cart button
- White background, top shadow
- Bottom: 80px (above bottom nav)
- Left side: quantity stepper
- Right side: full primary CTA button
- Transition: slides up from bottom with 0.3s ease

---

## 7. ANIMATION & MOTION SYSTEM

### 7.1 Core Principles
- **Performance first:** All animations use CSS transforms and opacity only (no layout-triggering properties)
- **Subtle not showy:** Animations enhance experience, not distract
- **Mobile battery:** Reduce motion for users who prefer it (`prefers-reduced-motion: reduce`)
- **Max duration:** 400ms for UI transitions, 600ms for page transitions

### 7.2 Scroll-Triggered Animations

Using Framer Motion `whileInView` — elements animate when entering viewport:

```typescript
// Standard scroll reveal
const revealVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' }
  }
};

// Stagger children (product grid)
const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 }
  }
};
```

Apply to:
- Homepage sections (fade up on scroll)
- Product grid (staggered fade-in per card)
- Features/benefits section icons
- Blog post cards
- B2B benefits section

### 7.3 Micro-Interactions

**Add to Cart Animation:**
```
1. Button text changes to "Ditambahkan ✓"
2. Button flashes brand-red-dark for 100ms
3. Cart icon in nav does a quick scale(1.3) → scale(1) bounce
4. Cart count badge updates with scale animation
5. Duration: 600ms total
```

**Coupon Applied:**
```
1. Input border turns success-green
2. Coupon code shows checkmark badge
3. Discount line appears in order summary with slide-down animation
4. canvas-confetti burst (small, centered, 0.5s)
5. Total updates with color flash
```

**Payment Success:**
```
1. Full screen success state
2. Large animated checkmark (SVG path animation, brand-red → success-green)
3. canvas-confetti (full-screen burst, 2s)
4. Order details slide up
5. PDF download button fades in after 1s
```

**Page Transitions:**
```
- Route change: content fades out (150ms) → new content fades in (250ms)
- Drawer/sheet open: slides from right (300ms ease-out)
- Modal open: scale(0.95) → scale(1) + fade (250ms)
- Toast: slides from top (200ms), auto-dismiss with fade
```

**Hover States:**
```
- Product card: translateY(-2px) + card-hover shadow (200ms)
- Button: background darkens (150ms)
- Nav link: underline slides in from left (200ms)
- Image gallery thumbnail: scale(1.05) with overflow hidden (200ms)
```

### 7.4 Loading States

**Page loading:** Cream background + Dapur Dekaka logo with subtle fade pulse
**Component loading:** Shimmer skeleton matching layout shape
**Button loading:** Spinner replaces text, button disabled
**Image loading:** Blur placeholder (next/image blurDataURL) → sharp

### 7.5 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. ICONOGRAPHY

### 8.1 Icon System
Use **Lucide React** exclusively — consistent, tree-shakeable.

**Key icons and their usage:**

| Icon | Lucide Name | Usage |
|---|---|---|
| 🛒 Cart | `ShoppingCart` | Navigation, cart button |
| 👤 Account | `User` | Navigation, account |
| 🔍 Search | `Search` | Search bar |
| ✓ Check | `Check`, `CheckCircle` | Success, halal badge |
| ❌ Close | `X` | Modal close, remove |
| 📦 Package | `Package` | Orders, shipping |
| 🚚 Delivery | `Truck` | Shipping options |
| 📍 Location | `MapPin` | Address, store location |
| 💳 Payment | `CreditCard` | Payment section |
| 🏷️ Tag | `Tag` | Coupon, discount |
| ⭐ Star | `Star` | Rating, featured |
| ❄️ Frozen | `Snowflake` | Frozen badge |
| 📱 WhatsApp | Custom SVG | WhatsApp button |
| 🔔 Bell | `Bell` | Notifications |
| 📊 Chart | `BarChart2` | Admin dashboard |
| ✏️ Edit | `Pencil` | Edit actions |
| 🗑️ Delete | `Trash2` | Delete actions |
| ➕ Add | `Plus` | Add items |
| ← Back | `ArrowLeft` | Navigation |
| 📄 PDF | `FileText` | Receipt download |

### 8.2 Icon Sizes
- Navigation bar: 22px
- Button icons: 18px
- Inline text icons: 16px
- Empty state illustrations: 80-120px
- Feature section icons: 48px

### 8.3 Chinese Cultural Icon (Custom)
- A subtle **steamer basket (kukusan)** SVG illustration used as decorative element
- Section dividers use a traditional **Chinese window grille pattern** SVG
- These are brand-specific — created as SVG files in `/public/icons/`

---

## 9. IMAGERY & PHOTOGRAPHY

### 9.1 Product Photography Guidelines
Since all product photos already exist, apply these display rules:

**Aspect ratios:**
- Product card image: 1:1 (square, 120×120px display)
- Product detail gallery: 4:3 (main image, full width on mobile)
- Homepage featured carousel: 16:9 (full-width banner)
- Category chips: 1:1 (circular crop)

**Display rules:**
- All images use `object-fit: cover` with `object-position: center`
- All images lazy-loaded via `next/image`
- Blur placeholder via `blurDataURL` (base64 cream color)
- Hover: subtle scale(1.05) zoom with overflow:hidden on container

**Cloudinary transformations applied:**
```
Product thumbnail: w_240,h_240,c_fill,g_center,f_webp,q_auto:good
Product detail: w_800,h_600,c_fill,g_center,f_webp,q_auto:best
Carousel banner: w_1200,h_500,c_fill,g_auto,f_webp,q_auto:good
```

### 9.2 Carousel Banner Design
Three banner types (alternating in carousel):

**Type 1 — Product Hero:**
```
[Full-bleed product photo]
[Dark gradient overlay, bottom 50%]
[Text overlay, bottom-left]:
  "Dimsum Segar Langsung dari Dapur"  ← Playfair Display, cream
  "Dikirim ke Seluruh Indonesia"      ← Inter, cream/80%
  [Pesan Sekarang →]                  ← brand-red button (subtle)
```

**Type 2 — Promo Announcement:**
```
[Cream background with Chinese pattern subtle overlay]
[Center-left layout]:
  "PROMO 10% OFF"                     ← Brand-red, Display-lg
  "Untuk pembelian pertama kamu"      ← Inter, text-secondary
  Kode: SELAMATDATANG                 ← Monospace, brand-red pill
  [Klaim Sekarang →]                  ← Primary button
[Right side: product cutout image]
```

**Type 3 — Brand Story:**
```
[Warm photo of kitchen/food preparation]
[Dark overlay]
[Text, center]:
  "德卡"                               ← Chinese chars, Playfair, cream, large
  "Warisan rasa yang tak tergantikan" ← Inter italic, cream
  "Sejak pertama kali dapur kami buka"← Inter small, cream/70%
```

### 9.3 Image Placeholder
While real product images are being uploaded, use:
- Cream background (#F0EAD6)
- Centered dimsum bowl icon in brand-red
- "Foto segera hadir" caption in text-secondary

---

## 10. EMPTY STATES & ILLUSTRATIONS

### 10.1 The Sad Dimsum Bowl Character
The mascot for all empty states — a simple, charming illustration of a dimsum basket (竹蒸篮) with a sad/sleepy face.

**Character specs:**
- Style: Simple, flat illustration — NOT anime, NOT cartoon
- Colors: Brand-red and cream only
- Size: 120×120px in empty states
- Expressions:
  - Sad (empty cart, no results)
  - Sleeping (no orders yet, no data)
  - Surprised (error states)
  - Happy (success states — not empty but used)

**File:** `/public/illustrations/dimsum-[emotion].svg`

### 10.2 Empty State Templates

**Empty Cart:**
```
[Sad dimsum bowl — 120px]
"Keranjangmu masih kosong 🥺"
"Yuk, temukan dimsum favoritmu!"
[Mulai Belanja →]  ← Primary button
```

**No Search Results:**
```
[Surprised dimsum bowl — 100px]
"Produk tidak ditemukan"
"Coba kata kunci lain atau lihat semua produk"
[Lihat Semua Produk]  ← Outline button
```

**No Orders Yet:**
```
[Sleeping dimsum bowl — 120px]
"Belum ada pesanan"
"Pesanan pertamamu akan muncul di sini"
[Mulai Belanja →]  ← Primary button
```

**404 Page:**
```
[Sad dimsum bowl — 160px, centered on page]
"404 — Halaman Tidak Ditemukan"  ← Display-md
"Sepertinya dimsum ini sudah habis..."
[← Kembali ke Beranda]  ← Primary button
[Lihat Produk Kami]  ← Outline button
```

**Server Error (500):**
```
[Surprised dimsum bowl — 140px]
"Ups, ada yang tidak beres"
"Tim kami sedang memperbaikinya. Coba lagi sebentar ya!"
[🔄 Coba Lagi]  ← Primary button
```

**No Blog Posts:**
```
[Sleeping dimsum bowl — 100px]
"Artikel segera hadir"
"Kami sedang menyiapkan konten terbaik untukmu"
```

---

## 11. PAGE-BY-PAGE DESIGN SPECS

### 11.1 Homepage

**Section 1 — Hero Carousel**
- Full viewport width, height: 60vh mobile / 70vh desktop
- Embla carousel, autoplay 5s, loop
- Navigation dots: bottom-center, cream dots (active = brand-red, larger)
- Swipe gesture on mobile
- 3 slides (product hero, promo, brand story)

**Section 2 — Category Chips (horizontal scroll)**
```
[Semua] [Dimsum] [Siomay] [Bakso & Sosis] [Snack Frozen] [Paket Hemat]
```
- Horizontal scroll, no scrollbar visible
- Pill shape, 36px height
- Inactive: cream background, brand-red text, cream-dark border
- Active: brand-red background, cream text
- Sticky below navbar on scroll (optional, P2)

**Section 3 — Featured Products**
- Section title: "Produk Unggulan" (Playfair Display, Display-sm)
- Subtitle: "Pilihan terbaik dari dapur kami" (Inter, text-secondary)
- Layout: horizontal scroll on mobile (2.5 cards visible), 4-col grid desktop
- "Lihat Semua Produk →" link at top-right

**Section 4 — Promo Banner**
- Full-width, brand-red background, cream text
- Chinese pattern as subtle background texture
- Coupon code displayed in pill badge
- CTA button: cream background, brand-red text

**Section 5 — Why Dapur Dekaka**
- Cream (#F0EAD6) background with noise texture
- 3 columns (stacked on mobile, horizontal on desktop):
  - ✅ **100% Halal** — Bersertifikat dan terjamin
  - ❄️ **Dikemas Frozen Fresh** — Kualitas terjaga sampai tujuan
  - 🚚 **Kirim ke Seluruh Indonesia** — Dari Bandung untuk Nusantara
- Icon: 48px, brand-red
- Title: Playfair Display Medium
- Description: Inter, text-secondary

**Section 6 — Instagram Feed**
- Title: "Ikuti Kami di Instagram"
- @dapurdekaka link
- 6 latest posts in 3-col grid (square crops)
- On click: opens Instagram post in new tab
- Subtle red border on hover

**Section 7 — Testimonials**
- Cream background
- Carousel of 3-5 testimonials (static data for V1)
- Each: avatar circle, name, star rating, quote text
- Quote in italic Playfair Display

**Footer:**
```
[Logo]
Jl. Sinom V no. 7, Turangga, Bandung

[Produk] [Blog] [B2B] [Tentang Kami]

[IG icon] [TikTok icon] [WhatsApp icon]

Pembayaran: [Visa] [MC] [GoPay] [OVO] [QRIS] [BCA]

© 2026 Dapur Dekaka. All rights reserved.
Halal | Frozen Fresh | Nationwide Delivery
```
- Background: #1A1A1A (dark)
- Text: cream/80%
- Links: cream/60%, hover cream/100%
- Payment icons: grayscale, 30px height

### 11.2 Product Detail Page

**Mobile Layout (top to bottom):**
1. Back arrow + "Produk" breadcrumb
2. Image gallery — full width, 4:3 ratio, swipeable
3. Thumbnail strip — 4 small images horizontal scroll
4. Product name (Playfair Display, display-xs, bold)
5. Badges row: [HALAL ✓] [❄ FROZEN] [Terlaris]
6. Variant selector (button group: "25 pcs | 50 pcs")
7. Price (Inter Bold, display-xs, brand-red)
8. Stock indicator ("Tersisa 12 pcs" or "HABIS")
9. Description accordion (collapsed by default)
10. Related products (horizontal scroll, 2.5 visible)
11. Sticky bottom bar (qty stepper + add to cart)

### 11.3 Checkout Flow

**Step indicator (top, always visible):**
```
① Identitas → ② Pengiriman → ③ Pembayaran
```
- Completed: brand-red filled circle with checkmark
- Active: brand-red filled circle with number
- Pending: gray outline circle

**Step 1 — Identitas (guest only):**
- Name, email, phone
- Optional login prompt (subtle, not blocking)
- Delivery method toggle: [🚚 Kirim ke Alamat] [🏪 Ambil di Toko]

**Step 2 — Alamat Pengiriman:**
- Province dropdown (RajaOngkir)
- City dropdown (cascades, disabled until province selected)
- District input
- Full address textarea
- Recipient name + phone
- "Simpan alamat ini" checkbox (logged-in only)

**Step 3 — Pilih Kurir (cold-chain only):**
Each courier as selectable card:
```
┌─────────────────────────────────────────┐
│ ○  [SiCepat Logo]  SiCepat FROZEN       │
│    Estimasi 1-2 hari         Rp 45.000  │
└─────────────────────────────────────────┘
```

**Step 4 — Kupon & Poin:**
- Text input + "Terapkan" button
- Points balance shown if logged in + toggle
- Order summary updates in real-time

**Step 5 — Review & Bayar:**
- Full order summary card
- "Bayar Sekarang" button (xl size, full width, brand-red)
- Midtrans Snap popup overlays the page

---

## 12. ADMIN DASHBOARD DESIGN

### 12.1 Admin Design Philosophy
Admin pages use a **clean neutral SaaS aesthetic** — functional, data-dense, easy to scan. NOT branded with red/cream. Think Vercel/Linear/Notion dashboard feel.

### 12.2 Admin Color Palette

```css
/* Admin only — does not use brand colors */
--admin-sidebar-bg:     #0F172A;   /* Dark slate sidebar */
--admin-sidebar-text:   #94A3B8;   /* Muted text in sidebar */
--admin-sidebar-active: #FFFFFF;   /* Active nav item */
--admin-sidebar-hover:  #1E293B;   /* Hover background */
--admin-content-bg:     #F8FAFC;   /* Light gray content area */
--admin-card-bg:        #FFFFFF;   /* White cards */
--admin-border:         #E2E8F0;   /* Subtle borders */
--admin-text-primary:   #0F172A;   /* Dark text */
--admin-text-secondary: #64748B;   /* Muted text */

/* Admin accent — uses brand-red sparingly */
--admin-accent:         #C8102E;   /* Active states, badges, important actions */
```

### 12.3 Admin Layout

**Desktop (≥1024px):**
```
┌──────────────┬──────────────────────────────────┐
│ SIDEBAR      │ HEADER (breadcrumb + user avatar) │
│ 240px        ├──────────────────────────────────┤
│              │                                  │
│ [Logo]       │ CONTENT AREA                     │
│              │                                  │
│ Dashboard    │ (dynamic per page)               │
│ Orders       │                                  │
│ Products     │                                  │
│ Inventory    │                                  │
│ Customers    │                                  │
│ Coupons      │                                  │
│ Blog         │                                  │
│ Carousel     │                                  │
│ B2B          │                                  │
│ AI Content   │                                  │
│ Settings     │                                  │
│              │                                  │
│ [User role]  │                                  │
└──────────────┴──────────────────────────────────┘
```

**Mobile (bottom tab navigation):**
```
┌────────────────────────────────────┐
│ CONTENT                            │
│                                    │
│                                    │
├────────────────────────────────────┤
│ 📊 Dashboard │ 📦 Orders │ + More  │
└────────────────────────────────────┘
```

Mobile bottom nav shows 4 tabs:
- Dashboard, Orders, Inventory (warehouse), More (opens drawer with all nav items)

### 12.4 Admin Data Tables

All data tables use consistent pattern:
- Search bar (top left)
- Filter dropdowns (top right)
- Sortable column headers
- Pagination (bottom)
- Row hover: subtle blue-gray highlight
- Action column (last): Edit / View / Delete icons
- Mobile: cards instead of table rows (stacked layout)
- Status column: colored badge

### 12.5 Warehouse Mobile UI
`/admin/inventory` and `/admin/shipments` are designed for mobile phone use in a warehouse environment:

**Requirements:**
- **Giant touch targets** — minimum 60px height per item
- **High contrast** — dark text on white, no subtle grays
- **Minimal scrolling** — most important info above fold
- **Large number inputs** — numeric keyboard auto-triggers
- **Confirmation dialogs** — before saving to prevent errors

**Inventory page mobile:**
```
┌─────────────────────────────────────┐
│ [🔍 Cari produk...                 ]│
├─────────────────────────────────────┤
│ Dimsum Mix 50 pcs        Stok:  │ [techolyze](https://techolyze.com/open/blog/10-vercel-alternatives-latest/)
│ SKU: DDK-001-50                     │
│                         [💾 Simpan] │
├─────────────────────────────────────┤
│ Dimsum Mix 25 pcs        Stok:  │ [nocobase](https://www.nocobase.com/en/blog/open-source-internal-tools)
│ SKU: DDK-001-25                     │
│                         [💾 Simpan] │
└─────────────────────────────────────┘
```

---

## 13. EMAIL DESIGN SYSTEM

### 13.1 Email Layout
All emails use React Email components with consistent layout:

```
┌──────────────────────────────────────┐
│ [Logo centered on cream background]  │
│ Dapur Dekaka — 德卡                   │
├──────────────────────────────────────┤
│                                      │
│ EMAIL BODY                           │
│ (white background, 600px max-width)  │
│                                      │
├──────────────────────────────────────┤
│ Jl. Sinom V no. 7, Turangga, Bandung │
│ [IG] [WA] | dapurdekaka.com          │
│ © 2026 Dapur Dekaka                  │
└──────────────────────────────────────┘
```

### 13.2 Email Color Rules
- Header: brand-cream background (#F0EAD6)
- Body: white (#FFFFFF)
- CTA buttons: brand-red (#C8102E) with cream text
- Order status badge: match semantic colors
- Footer: #1A1A1A background, cream text

### 13.3 Email Subjects (Bahasa Indonesia)
- Confirmation: "✅ Pesanan DDK-XXXXXX Dikonfirmasi — Dapur Dekaka"
- Shipped: "🚚 Pesanan DDK-XXXXXX Sedang Dikirim!"
- Delivered: "🎉 Pesanan DDK-XXXXXX Telah Tiba!"
- Cancelled: "❌ Pesanan DDK-XXXXXX Dibatalkan"
- Points expiring: "⚠️ Poin kamu akan kedaluwarsa dalam 30 hari"

---

## 14. ACCESSIBILITY STANDARDS

### 14.1 Color Contrast
- All text on white backgrounds: minimum 4.5:1 ratio (WCAG AA)
- Brand-red (#C8102E) on white: 5.1:1 ✅
- Brand-red (#C8102E) on cream (#F0EAD6): 4.6:1 ✅
- White text on brand-red: 5.1:1 ✅
- Cream text on dark (#1A1A1A): 12.6:1 ✅

### 14.2 Interactive Element Standards
- All interactive elements have `:focus-visible` ring (brand-red, 3px offset)
- All images have descriptive `alt` text
- All form inputs have associated `<label>` elements
- All icon-only buttons have `aria-label`
- Loading states announce to screen readers via `aria-live`
- Color is never the ONLY indicator of status (always paired with icon or text)

---

## 15. CSS VARIABLES REFERENCE

```css
/* globals.css */
:root {
  /* Brand */
  --brand-red: #C8102E;
  --brand-red-dark: #8B0000;
  --brand-red-light: #E8394F;
  --brand-red-muted: #F5C6CC;
  --brand-cream: #F0EAD6;
  --brand-cream-dark: #E0D4BC;
  --brand-cream-darker: #C8B89A;

  /* Text */
  --text-primary: #1A1A1A;
  --text-secondary: #6B6B6B;
  --text-disabled: #ABABAB;
  --text-inverse: #FFFFFF;

  /* Surface */
  --surface-white: #FFFFFF;
  --surface-off: #FAFAF8;
  --surface-cream: #F0EAD6;

  /* Semantic */
  --success: #16A34A;
  --success-light: #DCFCE7;
  --warning: #D97706;
  --warning-light: #FEF3C7;
  --error: #DC2626;
  --error-light: #FEE2E2;
  --info: #2563EB;
  --info-light: #DBEAFE;

  /* Typography */
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Inter', system-ui, sans-serif;

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 9999px;

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-button: 0 1px 2px rgba(200,16,46,0.3);
  --shadow-button-hover: 0 4px 12px rgba(200,16,46,0.4);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;
}
```

---

*End of DESIGN_SYSTEM.md v1.0*
*Next document: SCHEMA.md*
````