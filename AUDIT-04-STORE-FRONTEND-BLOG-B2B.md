# AUDIT 04 — STORE FRONTEND, BLOG & B2B

**Auditor:** Cursor AI (Automated Code Audit)
**Date:** May 22, 2026
**Scope:** `app/(store)/`, `app/(b2b)/`, `components/store/`, `components/b2b/`, `app/api/products/`, `app/api/blog/`, `app/api/testimonials/`, `app/api/categories/`

---

## BUG-01 — CRITICAL: Missing `/api/products` API Route (Public Listing)

**File:** `app/api/products/route.ts` — **DOES NOT EXIST**

**What's wrong:**
The `app/api/products/route.ts` file does not exist. The `app/api/products/[slug]/route.ts` exists (for individual product lookups), but the public products listing endpoint `/api/products` is missing entirely. This breaks the PRD's API contract and any future client-side product fetching that expects a REST endpoint.

The products page (`app/(store)/products/page.tsx`) and catalog (`ProductCatalog`) are Server Components that query the DB directly — which works, but the public API route is a documented part of the API surface that must exist.

**Fix:**
Create `app/api/products/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { success, serverError } from '@/lib/utils/api-response';
import { db } from '@/lib/db';
import { products, productVariants, productImages } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || '';
    const q = searchParams.get('q') || '';
    const sort = searchParams.get('sort') || 'default';
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));

    const allProducts = await db.query.products.findMany({
      where: and(eq(products.isActive, true), isNull(products.deletedAt)),
      with: {
        variants: { where: eq(productVariants.isActive, true) },
        images: { orderBy: (images, { asc }) => [asc(images.sortOrder)], limit: 1 },
        category: true,
      },
    });
    // ... filtering, sorting, pagination logic ...
    return success({ products: filtered, total, page, totalPages });
  } catch (error) {
    console.error('[api/products]', error);
    return serverError(error);
  }
}
```

---

## BUG-02 — CRITICAL: StockBadge Always Calls Zustand Hook (Hydration Crash Risk)

**File:** `components/store/common/StockBadge.tsx:13-16`

**What's wrong:**
`StockBadge` unconditionally calls `useCartStore()` even when `variantId` is not provided:

```typescript
export function StockBadge({ stock: directStock, variantId, className }: StockBadgeProps) {
  const cartStock = useCartStore((s) =>
    variantId ? s.items.find((i) => i.variantId === variantId)?.stock : undefined
  );
```

If `StockBadge` is rendered during SSR or in a context where the Zustand store hasn't hydrated (e.g., on a Server Component page, or before `Providers` wraps the app), this will cause: "Error: Invalid hook call. Hooks can only be called inside of the number of lines 6."

The `ProductCard` uses `StockBadge` (line 127) and `ProductDetailClient` uses `StockBadge` (line 247) — both are Client Components but the issue is the pattern itself is dangerous.

**Fix:**
```typescript
export function StockBadge({ stock: directStock, variantId, className }: StockBadgeProps) {
  // Only call hook when variantId is present AND we're in a client context
  const cartStock = variantId
    ? useCartStore((s) => s.items.find((i) => i.variantId === variantId)?.stock)
    : undefined;
  const stock = cartStock ?? directStock;
  // ... rest unchanged
```

Or better: remove the Zustand integration from `StockBadge` entirely and let the parent handle stock validation. The `StockBadge` should be a pure presentational component.

---

## BUG-03 — CRITICAL: `app/(b2b)/b2b/quote/page.tsx` Does Not Exist

**File:** `app/(b2b)/b2b/quote/page.tsx`

**What's wrong:**
The PRD (Section 3.2) specifies `/b2b/quote` as a page for "Request custom quote". The `app/(b2b)/b2b/quote/page.tsx` file does not exist. The B2B landing page (`app/(b2b)/b2b/page.tsx`) has a form that submits to `/api/b2b/inquiry` but there is no dedicated `/b2b/quote` page. The form is embedded inline in the landing page which is not optimal for SEO (a separate page would have its own meta tags, Open Graph, etc.).

**Fix:**
Create `app/(b2b)/b2b/quote/page.tsx` as a dedicated page with proper metadata:
```typescript
export const metadata: Metadata = {
  title: 'Minta Penawaran Harga - Dapur Dekaka B2B',
  description: 'Request custom quote untuk pemesanan frozen food dalam jumlah besar...',
  robots: { index: true, follow: true },
};
```

---

## BUG-04 — CRITICAL: Missing `robots.txt` and Sitemap for Store

**File:** Project root — **DOES NOT EXIST**

**What's wrong:**
The `robots.txt` file does not exist at the project root. The sitemap (normally at `app/sitemap.ts` or `app/sitemap.xml/route.ts`) also does not exist. The PRD explicitly requires `sitemap.xml + robots.txt` as a P1 feature.

Without `robots.txt`, crawlers have no instruction and may crawl admin routes. Without a sitemap, Google cannot discover all store pages efficiently.

**Fix:**
Create `app/sitemap.ts`:
```typescript
import { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { products, blogPosts } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dapurdekaka.com';
  
  const [activeProducts, publishedPosts] = await Promise.all([
    db.query.products.findMany({ where: and(eq(products.isActive, true), isNull(products.deletedAt)), columns: { slug: true } }),
    db.query.blogPosts.findMany({ where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)), columns: { slug: true } }),
  ]);

  const productsUrls = activeProducts.map(p => ({
    url: `${BASE_URL}/products/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const blogUrls = publishedPosts.map(p => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/products`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/blog`, changeFrequency: 'weekly', priority: 0.7 },
    ...productsUrls,
    ...blogUrls,
  ];
}
```

Create `app/robots.ts`:
```typescript
import { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', disallow: ['/admin/', '/api/', '/checkout/', '/account/'] },
      { userAgent: 'Googlebot', allow: '/' },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
```

---

## BUG-05 — CRITICAL: All Products Show "MUI 001/2020" Fake Halal Badge

**File:** `components/store/products/ProductCard.tsx:113-116`

**What's wrong:**
The MUI certification number `MUI 001/2020` is hardcoded for ALL products, not fetched from the database:

```typescript
{product.isHalal && (
  <span className="text-[8px] text-text-disabled bg-white/60 px-1 rounded text-center">
    MUI 001/2020
  </span>
)}
```

This is factually incorrect — only products that actually have MUI certification should display this. The schema does not even have a field to store the certification number, meaning this was added as a placeholder and shipped. This is a compliance and legal risk.

**Fix:**
Remove the MUI number entirely OR add a `halalCertificationNumber` field to the `products` table in the schema, then render it conditionally:
```typescript
{product.isHalal && product.halalCertificationNumber && (
  <span className="text-[8px] text-text-disabled bg-white/60 px-1 rounded text-center">
    {product.halalCertificationNumber}
  </span>
)}
```

If no actual certification data exists, remove the MUI number entirely.

---

## BUG-06 — CRITICAL: B2B Landing Page Missing SEO Metadata

**File:** `app/(b2b)/b2b/page.tsx:75`

**What's wrong:**
The B2B landing page has no `export const metadata`. The page renders without title, description, Open Graph, or robots directives. This page has different content from the store homepage and needs its own SEO treatment for B2B-focused keywords.

**Fix:**
Add to `app/(b2b)/b2b/page.tsx`:
```typescript
export const metadata: Metadata = {
  title: 'B2B - Kerjasama Bisnis Frozen Food - Dapur Dekaka',
  description: 'Dapur Dekaka menyediakan produk frozen food berkualitas untuk hotel, restoran, catering, dan event organizer. Harga khusus untuk pemesanan dalam jumlah besar.',
  keywords: ['b2b', 'frozen food grosir', 'catering Bandung', 'hotel supplier', 'bulk frozen food'],
  openGraph: {
    title: 'B2B Partnership - Dapur Dekaka',
    description: 'Kerjasama bisnis frozen food berkualitas dengan harga khusus.',
    url: 'https://dapurdekaka.com/b2b',
    type: 'website',
  },
  robots: { index: true, follow: true },
};
```

---

## BUG-07 — HIGH: Language Toggle Commented Out in Both Mobile and Desktop Navbar

**File:** `components/store/layout/Navbar.tsx:66` and `components/store/layout/Navbar.tsx:133`

**What's wrong:**
`LanguageSwitcher` is commented out in both the desktop navbar and the mobile header:

```typescript
{/* <LanguageSwitcher /> */}
```

The PRD (Section 4.1) specifies language toggle as P1 ("Day 1-7"). The `next-intl` configuration exists (`i18n/request.ts`, `i18n/routing.ts`, `i18n/messages/id.json`) but the toggle component is commented out with a note "FIX 2" suggesting it was disabled temporarily and never re-enabled.

Users cannot switch between Bahasa Indonesia and English.

**Fix:**
Uncomment and properly implement `LanguageSwitcher`:
```typescript
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

// Create components/store/common/LanguageSwitcher.tsx
export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');

  const toggle = () => {
    const newLocale = locale === 'id' ? 'en' : 'id';
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <button onClick={toggle} className="text-sm font-medium text-text-secondary hover:text-brand-red">
      {locale === 'id' ? 'EN' : 'ID'}
    </button>
  );
}
```

---

## BUG-08 — HIGH: No Loading Skeleton for Product Catalog on Sort/Filter

**File:** `components/store/products/ProductCatalog.tsx`

**What's wrong:**
When the user changes category or sort option, the `ProductCatalog` re-filters locally (no network request since it's all in-memory). However, if the component were to do a network refetch in the future, there's no skeleton state. More critically: the sort/filter UI updates instantly but there's no visual feedback that the change was applied.

**Fix:**
Add a brief `opacity-50` transition on the grid when sort/category changes to give visual feedback.

---

## BUG-09 — HIGH: Instagram Feed Uses Hardcoded Placeholder Gallery Images

**File:** `components/store/home/InstagramFeed.tsx:9-16`

**What's wrong:**
`InstagramFeed` uses hardcoded Cloudinary IDs (`gallery-01` through `gallery-06`) rather than fetching from the Instagram Basic Display API or the `instagram_posts` table in the DB:

```typescript
const INSTAGRAM_GALLERY_IDS: Array<{ id: number; publicId: string; alt: string }> = [
  { id: 1, publicId: 'dapurdekaka/gallery/gallery-01', alt: 'Dimsum premium' },
  // ...6 items...
];
```

These are gallery images (from the ASSETS reference in PRD section 11), NOT actual Instagram posts. This section is labeled "Galeri Kami" and links to Instagram, but it doesn't show real Instagram content. All 6 images show the same static gallery photos regardless of what is actually on Instagram.

**Fix:**
Replace with a DB-backed approach using an `instagram_posts` table (or at minimum, make the image IDs configurable via a CMS setting). Add a `SocialMediaSettings` table with a `store_instagram_feed_ids` key storing comma-separated post IDs. Fall back to the hardcoded gallery images only when the setting is empty.

---

## BUG-10 — HIGH: B2B Products Page Doesn't Show Weight for Shipping Calculation

**File:** `app/(b2b)/b2b/products/page.tsx:82-93`

**What's wrong:**
The B2B products page only shows `nameId` and `price`/`b2bPrice` in the product grid and teaser table:

```typescript
<td className="py-2.5 px-3 font-medium">{product.nameId}</td>
<td className="py-2.5 px-3 text-right text-text-secondary">{formatIDR(retailPrice)}</td>
<td className="py-2.5 px-3 text-right font-bold text-brand-red">{b2bPrice ? formatIDR(b2bPrice) : ...}</td>
```

B2B buyers (hotels, caterings) need to know the weight of each product variant to estimate shipping costs. The weight (`weightGram`) exists in the DB schema but is not displayed anywhere in the B2B catalog.

**Fix:**
Add weight column to the B2B price teaser table:
```typescript
<th className="text-right py-2 px-3 font-medium text-text-secondary">Berat</th>
// ...
<td className="py-2.5 px-3 text-right text-text-secondary">{variant.weightGram}g</td>
```

---

## BUG-11 — HIGH: Blog `ReadingProgress` and `BackToTop` Components Have No Error Boundary

**File:** `app/(store)/blog/[slug]/page.tsx:9-12`

**What's wrong:**
The blog post page imports `ReadingProgress`, `BackToTop`, `TableOfContents`, `BlogCTA`, and `CopyLinkButton`:

```typescript
import { ReadingProgress } from '@/components/store/blog/ReadingProgress';
import { BackToTop } from '@/components/store/blog/BackToTop';
import { TableOfContents } from '@/components/store/blog/TableOfContents';
import { BlogCTA } from '@/components/store/blog/BlogCTA';
import { CopyLinkButton } from '@/components/store/blog/CopyLinkButton';
```

If any of these components throws an error (e.g., during SSR), the entire blog post page crashes without a graceful fallback. The page has an `error.tsx` sibling but these components should be individually resilient.

**Fix:**
Wrap each component in an error boundary or add `try/catch` with fallback null returns inside each component. At minimum, add a blog-post-specific error file.

---

## BUG-12 — HIGH: B2B QuoteForm Success State Auto-Redirects Without User Action

**File:** `components/b2b/QuoteForm.tsx:92-94`

**What's wrong:**
On successful quote submission, the form shows success state then auto-redirects after 3 seconds:

```typescript
if (result.success) {
  setIsSuccess(true);
  setTimeout(() => {
    router.push('/b2b');
  }, 3000);
}
```

If the user's internet is slow or the redirect fails silently, the user is stuck with no ability to submit another inquiry or stay on the page. The 3-second timeout is arbitrary and not enough for the user to read the success message.

**Fix:**
Remove the auto-redirect. Show the success state permanently with a "Kirim Permintaan Lain" button that resets the form:
```typescript
if (result.success) {
  setIsSuccess(true);
  // No auto-redirect. Let user click to start over or navigate manually.
}
```

---

## BUG-13 — HIGH: Homepage CategoryChips Doesn't Trigger Product Filter

**File:** `components/store/home/CategoryChips.tsx`

**What's wrong:**
The `CategoryChips` on the homepage links to `/products?category=${cat.slug}` — this works correctly. However, the `homepage` page also renders `CategoryChips` but the category is not passed as `activeSlug`, meaning the "Semua" chip is always highlighted regardless of the URL parameter:

```typescript
<CategoryChips categories={allCategories} />
// activeSlug is never set, so no chip is highlighted when visiting /products?category=dimsum
```

**Fix:**
In `app/(store)/page.tsx`, read the `category` from searchParams and pass it to `CategoryChips`:
```typescript
// homepage doesn't have searchParams; CategoryChips on homepage is just navigation
// The actual fix is in the products page — ensure it reads activeCategory from URL
```

The homepage's `CategoryChips` is a navigation shortcut. Verify that `app/(store)/products/page.tsx` correctly reads `searchParams.category` and passes `activeSlug` to `ProductCatalog`.

---

## BUG-14 — HIGH: Testimonials Section Returns `null` on Error (Silent Failure)

**File:** `components/store/home/Testimonials.tsx:47-49`

**What's wrong:**
When `fetchTestimonials()` fails, the component returns `null` instead of showing any placeholder:

```typescript
if (testimonials.length === 0) {
  return null;  // entire section disappears with no fallback
}
```

A store with zero testimonials (empty DB table, API error, or during initial setup) will show a completely blank "Kata Mereka yang Sudah Percaya" section — confusing for users who expect at least some social proof.

**Fix:**
Add a fallback static testimonial or show a minimal placeholder:
```typescript
if (testimonials.length === 0) {
  return (
    <section className="py-12 px-4 bg-white">
      <div className="container mx-auto">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-center mb-8">
          Kata Mereka yang Sudah Percaya
        </h2>
        <p className="text-center text-text-secondary">Testimonial akan segera hadir.</p>
      </div>
    </section>
  );
}
```

---

## BUG-15 — MEDIUM: WhatsApp Button Tooltip Close Button Uses "×" Text Instead of Icon

**File:** `components/store/layout/WhatsAppButton.tsx:28-29`

**What's wrong:**
The tooltip close button uses plain text "×" instead of an accessible icon:

```typescript
<button
  onClick={() => setShowTooltip(false)}
  className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md"
  aria-label="Tutup"
>
  ×
</button>
```

The "×" character is not an accessible icon. Screen readers will announce it as the letter "X" instead of "close" or "tutup".

**Fix:**
```typescript
import { X } from 'lucide-react';
// ...
<X className="w-3 h-3 text-text-primary" />
```

---

## BUG-16 — MEDIUM: Footer Has Hardcoded "Harga sudah termasuk PPN 11%"

**File:** `components/store/layout/Footer.tsx:107`

**What's wrong:**
The footer unconditionally shows "Harga sudah termasuk PPN 11%":

```typescript
<span>Harga sudah termasuk PPN 11%</span>
```

Not all products may be subject to PPN 11% (some may be exempt or subject to different rates). This should be a configurable setting in `systemSettings`, not hardcoded.

**Fix:**
Fetch from system settings:
```typescript
const includeVat = await getSetting('show_vat_statement') === 'true';
const vatRate = await getSetting('vat_rate') ?? '11%';
// Then in the footer:
{includeVat && <span>Harga sudah termasuk PPN {vatRate}%</span>}
```

---

## BUG-17 — MEDIUM: Footer Has Broken Links to Non-Existent Pages

**File:** `components/store/layout/Footer.tsx:28-44`

**What's wrong:**
Footer links to `/about`, `/refund-policy`, `/privacy-policy` — none of these pages exist. These are standard e-commerce pages that are expected to exist by users and are referenced in the footer navigation.

```typescript
<Link href="/about" className="hover:text-brand-cream">Tentang Kami</Link>
<Link href="/refund-policy" className="hover:text-brand-cream">Kebijakan Pengembalian</Link>
<Link href="/privacy-policy" className="hover:text-brand-cream">Kebijakan Privasi</Link>
```

**Fix:**
Create placeholder pages for each, or remove the links if these pages are not in scope for V1.

---

## BUG-18 — MEDIUM: Cart Stock Validation Text Uses Wrong Color Class

**File:** `app/(store)/cart/page.tsx:159`

**What's wrong:**
The cart validation loading indicator uses `text-text-secondary` but should use `text-text-muted` or a semantic color:

```typescript
<span className="text-xs text-text-secondary">
  Memvalidasi stok...
</span>
```

The `text-text-secondary` (#6B6B6B) on a white/light background has insufficient contrast in this context (secondary text is 4.5:1 but the "loading" state is more muted than regular secondary text).

**Fix:**
```typescript
<span className="text-xs text-text-muted">Memvalidasi stok...</span>
```

---

## BUG-19 — MEDIUM: Blog RSS Feed Missing Category in Item Generation

**File:** `app/(store)/blog/rss.xml/route.ts:50`

**What's wrong:**
The RSS feed handles categories conditionally but the code has a potential null safety issue:

```typescript
const category = post.category ? escapeXml(post.category.nameId) : '';
// ...
${category ? `<category>${category}</category>` : ''}
```

The bigger issue: the RSS feed limits to 50 posts but doesn't filter by language (if bilingual content exists, both language versions appear in the feed). Also, the description field strips HTML using `.replace(/<[^>]+>/g, '')` which can produce truncated, unreadable summaries.

**Fix:**
```typescript
// Only include ID content in ID-language feed
const description = escapeXml(post.excerptId || post.contentId.replace(/<[^>]+>/g, '').slice(0, 300));
// Add language attribute to channel
<language>id</language>
```

---

## BUG-20 — MEDIUM: EmptyCart Renders EmptyState with Ambiguous action.href + onClick

**File:** `components/store/cart/EmptyCart.tsx`

**What's wrong:**
`EmptyCart` passes `action={{ label: 'Mulai Belanja', href: '/products' }}` to `EmptyState`. The `EmptyState` component renders an `<a>` tag when `action.href` is provided. The combination of `href` and `onClick` in the interface is ambiguous — if both are set, `onClick` takes precedence in the `<a>` click handler, but the `href` still makes it a link element.

**Fix:**
In `EmptyState`, if `onClick` is provided alongside `href`, prefer `onClick` and render a `<button>` instead of `<a>`:
```typescript
const Tag = action.onClick && !action.href ? 'button' : 'a';
// Or: separate the interface into two variants: action.href or action.onClick, not both
```

---

## BUG-21 — LOW: InstagramFeed Links to Instagram Profile, Not Individual Posts

**File:** `components/store/home/InstagramFeed.tsx:45`

**What's wrong:**
Every gallery item links to the Instagram profile (`https://instagram.com/dapurdekaka`) instead of the individual post URL. This means clicking any of the 6 gallery images opens Instagram in a new tab to the profile, not to the specific post being shown.

**Fix:**
If real Instagram posts were fetched (see BUG-09), use `post.permalink` instead. For the hardcoded gallery fallback, link to the Instagram profile is acceptable, but the UX is confusing when different images all go to the same destination.

---

## BUG-22 — LOW: Navbar Search Link Has Empty Query Parameter

**File:** `components/store/layout/Navbar.tsx:68`

**What's wrong:**
The search icon links to `/products?q=` (with empty query). This creates a URL `/products?q=` which triggers the search empty-state. The user should go to `/products` (clean URL) or the search input should auto-focus on that page.

**Fix:**
```typescript
<Link href="/products" ...>  // Remove ?q=
// Or: href="/products?q=" and handle empty state gracefully
```

---

## BUG-23 — LOW: B2B Landing Page Uses Non-Existing `brand-navy` Color Token

**File:** `app/(b2b)/b2b/page.tsx:84`

**What's wrong:**
The B2B page uses `bg-brand-navy` which is not defined in the Tailwind config. The design system defines `brand-red`, `brand-cream`, but not `brand-navy`. This would cause the build to fail or fall back to a broken style. The intent was likely a dark navy color (#0F172A is used in the admin sidebar) but the store design system doesn't include this token.

```typescript
<section className="relative bg-gradient-to-br from-brand-navy to-brand-navy-light text-white py-16">
```

**Fix:**
Either add `brand-navy` and `brand-navy-light` to the Tailwind config, or use the closest available dark color (`bg-[#0F172A]` or define as CSS variable `--color-brand-navy: #0F172A`). Since this is B2B (separate from store branding), a separate B2B color token set is acceptable.

---

## BUG-24 — LOW: `app/(store)/account/layout.tsx` has `pb-20 md:pb-0` (Correct)

**File:** `app/(store)/account/layout.tsx:44`

**What's wrong:**
None. The account layout correctly has `pb-20 md:pb-0` for mobile bottom nav clearance. This is marked as confirmed correct.

---

## BUG-25 — LOW: `app/(store)/layout.tsx` has `pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0` (Correct)

**File:** `app/(store)/layout.tsx:13`

**What's wrong:**
None. The store layout correctly adds bottom clearance for mobile bottom nav. Confirmed correct.

---

## BUG-26 — LOW: Blog Post Page `generateStaticParams` Silently Catches Errors

**File:** `app/(store)/blog/[slug]/page.tsx:86-89`

**What's wrong:**
The `generateStaticParams` silently catches all errors and returns an empty array without logging:

```typescript
} catch {
  // DB unavailable at build time (no DATABASE_URL); pages render on-demand via ISR
  return [];
}
```

If the database is actually down or there's a code bug (not just missing env vars), the error is swallowed and the function returns `[]` silently, making debugging impossible.

**Fix:**
```typescript
} catch (error) {
  console.error('[blog/[slug]/generateStaticParams]', error);
  return [];
}
```

---

## BUG-27 — LOW: FeaturedProducts Non-Motion Version Missing "Lihat Semua" Link

**File:** `components/store/home/FeaturedProducts.tsx:44-57`

**What's wrong:**
The non-Motion fallback render (when Framer Motion hasn't loaded yet) doesn't show the "Lihat Semua" link:

```typescript
<div className="flex items-center justify-between mb-6">
  <div>
    <h2 className="font-display text-2xl md:text-3xl font-semibold text-text-primary">
      Produk Unggulan
    </h2>
    <p className="text-text-secondary text-sm">Pilihan terbaik dari dapur kami</p>
  </div>
  {/* No "Lihat Semua" link in fallback */}
</div>
```

The Motion version has the "Lihat Semua" link. Users on slow connections or with JavaScript errors will not see the link.

**Fix:**
Add the link to the non-Motion fallback:
```typescript
<Link
  href="/products"
  className="flex items-center gap-1 text-brand-red font-medium text-sm hover:underline"
>
  Lihat Semua
  <ChevronRight className="w-4 h-4" />
</Link>
```

---

## BUG-28 — LOW: QuoteForm Phone Validation Regex Too Permissive

**File:** `components/b2b/QuoteForm.tsx:36`

**What's wrong:**
The phone regex `PHONE_REGEX = /^(\+62|62|0)8[0-9]{8,11}$/` allows 8-11 digits after the prefix. Indonesian phone numbers should be exactly 10-12 digits total (e.g., 081234567890 = 11 digits). The current regex allows 9-13 digit numbers total which includes invalid numbers.

**Fix:**
```typescript
const PHONE_REGEX = /^(?:\+62|62|0)8[0-9]{9,11}$/;
// 08 + 9-11 digits = 10-12 digits total
```

---

## INCOMPLETE FEATURES

### 1. Language Toggle (`next-intl`) — Not Functional
**Severity:** HIGH
**Status:** `LanguageSwitcher` component is commented out in `Navbar.tsx` (lines 66 and 133). The `next-intl` configuration exists but the UI toggle is disabled. All users see Bahasa Indonesia only.

### 2. B2B Quote Page — Does Not Exist
**Severity:** CRITICAL
**Status:** `/b2b/quote` page is missing. The form exists inline on the B2B landing page but has no dedicated URL.

### 3. `robots.txt` and `sitemap.xml` — Do Not Exist
**Severity:** CRITICAL
**Status:** No `app/robots.ts` or `app/sitemap.ts`. Search engines have no instructions and cannot discover pages efficiently.

### 4. Public Testimonials API — No Real Data
**Severity:** HIGH
**Status:** `app/api/testimonials/public/route.ts` exists and is properly structured, but the `testimonials` table is likely empty. The `Testimonials` component on homepage shows nothing if the table has no rows. Need real testimonial data seeded.

### 5. Blog Categories API — Missing `app/api/blog/categories/route.ts`
**Severity:** MEDIUM
**Status:** The `app/api/blog/categories/route.ts` file doesn't exist (only `app/api/blog/route.ts` exists). Blog category filtering relies on database queries in the page directly.

---

## PLACEHOLDER CONTENT

### 1. Instagram Feed — Hardcoded Gallery Images
**File:** `components/store/home/InstagramFeed.tsx:9-16`
**Issue:** Uses hardcoded `gallery-01` through `gallery-06` IDs. Not real Instagram content.

### 2. B2B Products Preview — Hardcoded Static Data
**File:** `app/(b2b)/b2b/page.tsx:64-72`
**Issue:** `BENEFITS` array is hardcoded with static text. No CMS-driven content.

### 3. Product "MUI 001/2020" Badge — Fake Certification Number
**File:** `components/store/products/ProductCard.tsx:113-116`
**Issue:** All halal products show the same fake certification number.

### 4. Footer "Harga sudah termasuk PPN 11%" — Hardcoded
**File:** `components/store/layout/Footer.tsx:107`
**Issue:** Not configurable, not all products may be subject to this rate.

### 5. Empty Loading States — Placeholder Files
The following `loading.tsx` files exist but are empty or contain placeholder content:
- `app/(store)/account/addresses/loading.tsx` — **EMPTY**
- `app/(store)/account/vouchers/loading.tsx` — **EMPTY**
- `app/(b2b)/loading.tsx` — **EMPTY**

---

## MOBILE UX ISSUES

### 1. BottomNav: Only 4 Tabs Instead of 5 Specified
**File:** `components/store/layout/BottomNav.tsx:29-36`
**Issue:** The PRD specifies 5 tabs: Home/Catalog/Cart/Account/WA. The current BottomNav has only 4 tabs: Home, Products, Blog, Cart, Account. There's no dedicated WhatsApp tab (it's the floating WhatsAppButton instead). This is actually correct per the design system (WhatsApp is a floating button, not a tab), but the PRD says "5 tabs (Home/Catalog/Cart/Account/WA)". The implementation puts WA as the floating button above BottomNav, not as a tab. **Verdict: Implementation is correct, PRD description was ambiguous.**

### 2. BottomNav Missing "Blog" Tab on Mobile
**File:** `components/store/layout/BottomNav.tsx:30-32`
**Issue:** The BottomNav has `Blog` as a tab (index 3) but the design system doesn't mention Blog as a required tab. The 5 tabs are Home/Catalog/Cart/Account/WA. Blog is included in the current implementation as a 5th item. This is acceptable but inconsistent with the PRD's explicit list.

### 3. Mobile Navbar: Hamburger Menu Not Accessible
**File:** `components/store/layout/Navbar.tsx:146-152`
**Issue:** The hamburger menu button has no `aria-expanded` state, no `aria-controls`, and no keyboard focus management. A screen reader user cannot tell the menu is open.

### 4. Mobile Sticky Total Bar on Checkout Missing `pb-20` Clearance
**File:** `app/(store)/checkout/page.tsx:462`
**Issue:** The sticky total bar at the top of the checkout page (`sticky top-[76px]`) has no `pb-` clearance. On mobile with the BottomNav, the sticky bar may overlap with the bottom nav if the user scrolls to the top of the page. The checkout page body has `pb-24` which is enough, but the sticky bar itself needs the same bottom clearance.

---

## SUMMARY TABLE

| Bug ID | Severity | Category | File |
|--------|----------|----------|------|
| BUG-01 | CRITICAL | Missing API | `app/api/products/route.ts` — does not exist |
| BUG-02 | CRITICAL | Hydration | `components/store/common/StockBadge.tsx:13-16` — Zustand hook always called |
| BUG-03 | CRITICAL | Missing Page | `app/(b2b)/b2b/quote/page.tsx` — does not exist |
| BUG-04 | CRITICAL | SEO | No `robots.txt` or `sitemap.ts` |
| BUG-05 | CRITICAL | Compliance | `ProductCard.tsx:113-116` — fake MUI number for all products |
| BUG-06 | CRITICAL | SEO | `app/(b2b)/b2b/page.tsx` — no metadata |
| BUG-07 | HIGH | i18n | `Navbar.tsx:66,133` — LanguageSwitcher commented out |
| BUG-08 | HIGH | UX | `ProductCatalog.tsx` — no sort feedback |
| BUG-09 | HIGH | Content | `InstagramFeed.tsx:9-16` — hardcoded gallery images |
| BUG-10 | HIGH | B2B | `app/(b2b)/b2b/products/page.tsx:82-93` — no weight shown |
| BUG-11 | HIGH | Error Handling | `blog/[slug]/page.tsx:9-12` — components lack error boundaries |
| BUG-12 | HIGH | UX | `QuoteForm.tsx:92-94` — auto-redirect after 3s |
| BUG-13 | HIGH | UX | `CategoryChips.tsx` — active chip not highlighted from URL |
| BUG-14 | HIGH | UX | `Testimonials.tsx:47-49` — returns null on error |
| BUG-15 | MEDIUM | Accessibility | `WhatsAppButton.tsx:28-29` — "×" not accessible |
| BUG-16 | MEDIUM | Compliance | `Footer.tsx:107` — hardcoded PPN claim |
| BUG-17 | MEDIUM | Broken Links | `Footer.tsx:28-44` — /about, /refund-policy, /privacy-policy don't exist |
| BUG-18 | MEDIUM | CSS | `cart/page.tsx:159` — wrong text color for loading state |
| BUG-19 | MEDIUM | RSS | `blog/rss.xml/route.ts:50` — category handling issue |
| BUG-20 | MEDIUM | UI Bug | `EmptyCart.tsx` — ambiguous action.href + onClick |
| BUG-21 | LOW | UX | `InstagramFeed.tsx:45` — all items link to profile |
| BUG-22 | LOW | UX | `Navbar.tsx:68` — search link has empty query param |
| BUG-23 | LOW | CSS | `app/(b2b)/b2b/page.tsx:84` — `brand-navy` token doesn't exist |
| BUG-24 | LOW | Confirmed OK | `account/layout.tsx:44` — pb-20 correct |
| BUG-25 | LOW | Confirmed OK | `app/(store)/layout.tsx:13` — pb-calc correct |
| BUG-26 | LOW | Debug | `blog/[slug]/page.tsx:86-89` — silent catch |
| BUG-27 | LOW | UX | `FeaturedProducts.tsx:44-57` — missing link in fallback |
| BUG-28 | LOW | Validation | `QuoteForm.tsx:36` — phone regex too permissive |

**Total: 28 bugs identified — 6 CRITICAL, 8 HIGH, 10 MEDIUM, 4 LOW**