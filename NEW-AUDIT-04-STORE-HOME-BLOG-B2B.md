# AUDIT 04 — STORE PAGES, HOME, BLOG & B2B PORTAL
**Date**: 2026-05-22 | **Branch**: fix/multiple-audit-fixes-may-2026  
**Scope**: `app/(store)/`, `app/(b2b)/`, `components/store/`, blog infrastructure  
**If 100 users hit this tomorrow**: RSS feed returns 0 posts to all subscribers; Testimonials section likely shows nothing; B2B buyers have no way to view their order history; blog search loses category when combined with text search.

---

## BUG-01 — CRITICAL: RSS Feed Returns Empty XML (No Posts)

**File**: `app/(store)/blog/rss.xml/route.ts`  
**Severity**: CRITICAL — completely non-functional  

**What's wrong**: The RSS route is registered at `/blog/rss.xml`. However, the implementation returns hardcoded static XML with an empty `<channel>` — it **never queries the database**. Any RSS subscriber or Google News bot that fetches this URL gets an empty feed regardless of how many published posts exist.

**Current implementation (entire handler)**:
```ts
export async function GET() {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" ...>
  <channel>
    <title>Dapur Dekaka Blog</title>
    ...
    {/* NO ITEMS - never queries DB */}
  </channel>
</rss>`;
  return new Response(rssXml, { headers: { 'Content-Type': 'application/xml' } });
}
```

**Fix**: Implement with real DB query:
```ts
import { db } from '@/lib/db';
import { blogPosts, blogCategories } from '@/lib/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dapurdekaka.com';

  const posts = await db.query.blogPosts.findMany({
    where: and(
      eq(blogPosts.isPublished, true),
      sql`${blogPosts.deletedAt} IS NULL`
    ),
    orderBy: [desc(blogPosts.publishedAt)],
    limit: 20,
    with: { category: true },
  });

  const items = posts.map(post => `
    <item>
      <title><![CDATA[${post.titleId}]]></title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid>${BASE_URL}/blog/${post.slug}</guid>
      <pubDate>${post.publishedAt ? new Date(post.publishedAt).toUTCString() : new Date(post.createdAt).toUTCString()}</pubDate>
      ${post.category ? `<category><![CDATA[${post.category.nameId}]]></category>` : ''}
      ${post.excerptId ? `<description><![CDATA[${post.excerptId}]]></description>` : ''}
      ${post.coverImageUrl ? `<enclosure url="${post.coverImageUrl}" type="image/jpeg" />` : ''}
    </item>
  `).join('\n');

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Dapur Dekaka Blog</title>
    <link>${BASE_URL}/blog</link>
    <description>Artikel dan tips seputar makanan frozen dari Dapur Dekaka</description>
    <language>id</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/blog/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

  return new Response(rssXml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
```

---

## BUG-02 — HIGH: Testimonials Component Fetches from Non-Existent API Route

**File**: `components/store/home/Testimonials.tsx`  
**Severity**: HIGH — homepage section shows nothing  

**What's wrong**: The Testimonials component fetches from `/api/testimonials/public`. This route does NOT appear to exist in the codebase (not found in any file listing). The component likely has a try/catch that silently returns an empty array on 404, meaning the Testimonials section on the homepage shows nothing — no social proof for any visitor.

**Verification**: Run `find . -path "*/api/testimonials*" -name "*.ts"` to confirm.

**Fix Option A** — Create the API route:
```ts
// app/api/testimonials/public/route.ts
import { db } from '@/lib/db';
import { testimonials } from '@/lib/db/schema'; // Verify this table exists
import { eq, desc } from 'drizzle-orm';
import { success } from '@/lib/utils/api-response';

export async function GET() {
  const data = await db.query.testimonials.findMany({
    where: eq(testimonials.isActive, true),
    orderBy: [desc(testimonials.sortOrder)],
    limit: 10,
  });
  return success(data);
}
```

**Fix Option B** — If the `testimonials` DB table doesn't exist, hardcode testimonials in the component or in a constants file until the DB table is created.

**Fix Option C** — Fetch testimonials server-side in `app/(store)/page.tsx` and pass as props to `<Testimonials>` component, avoiding the client-side fetch entirely.

---

## BUG-03 — HIGH: Blog Search Loses Category Filter

**File**: `app/(store)/blog/page.tsx:127–131`  
**Severity**: HIGH — broken combined search + filter  

**What's wrong**: The blog page has both a text search (`BlogSearchForm`) and category filter buttons (rendered as `<a>` tags). When a user is browsing a category and then uses the search box, the category is lost. 

The code has this:
```tsx
<BlogSearchForm defaultValue={search} />
{categorySlug && <input type="hidden" name="category" value={categorySlug} />}
```

The `input type="hidden"` is placed **outside** the `BlogSearchForm`'s internal `<form>` element. So when BlogSearchForm submits, the browser only sends the search form's own inputs — the hidden `category` input is outside the form boundary and is ignored.

**Fix**: Pass `categorySlug` as a prop to `BlogSearchForm` and include it inside the form:
```tsx
// In BlogSearchForm:
interface BlogSearchFormProps {
  defaultValue: string;
  categorySlug?: string; // ADD THIS
}

// Inside the form element:
{categorySlug && <input type="hidden" name="category" value={categorySlug} />}
```

And update the usage:
```tsx
<BlogSearchForm defaultValue={search} categorySlug={categorySlug} />
// Remove the standalone hidden input
```

---

## BUG-04 — HIGH: B2B Portal Missing Account Pages (Orders & Quotes)

**File**: `app/(b2b)/b2b/account/` — directory may be incomplete  
**Severity**: HIGH — B2B buyers have no order history  

**What's wrong**: The B2B portal at `/b2b` has a navigation structure that implies account management. B2B users can submit quotes via `QuoteForm`, but:
- `/b2b/account/orders` — if this doesn't exist, B2B buyers cannot see their order history
- `/b2b/account/quotes` — if this doesn't exist, they can't track quote status

For a wholesale portal, this is critical. A B2B buyer needs to see: "What quotes did I submit? What's the status? What orders have I placed?"

**Fix**: If these pages don't exist in the main branch, create them:

`app/(b2b)/b2b/account/orders/page.tsx`:
```tsx
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { redirect } from 'next/navigation';

export default async function B2BOrdersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'b2b') redirect('/b2b');

  const userOrders = await db.query.orders.findMany({
    where: eq(orders.userId, session.user.id),
    with: { items: true },
    orderBy: [desc(orders.createdAt)],
    limit: 20,
  });

  return (/* render orders list */);
}
```

---

## BUG-05 — HIGH: B2B Layout Has No Auth Protection for Server-Side Checks

**File**: `app/(b2b)/layout.tsx`  
**Severity**: MEDIUM — security gap  

**What's wrong**: The B2B layout renders `Navbar + Footer + children`. It does NOT check if the user is authenticated as a B2B role at the layout level. Each individual page must do its own auth check. If a page forgets to check, it exposes B2B pricing to unapproved users.

The B2B products page checks auth, but what about future pages added to the `/b2b` route group?

**Fix**: Add server-side auth check to the layout itself:
```ts
// app/(b2b)/layout.tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function B2BLayout({ children }) {
  const session = await auth();
  // Allow landing page for marketing, but protect /b2b/products and /b2b/account
  // This requires reading the pathname — use middleware instead.
```

Better fix: Use Next.js middleware to protect `/b2b/products` and `/b2b/account` paths, allowing `/b2b` (landing) to remain public:
```ts
// middleware.ts — add to matcher:
// If path starts with /b2b/products or /b2b/account, require b2b role
```

---

## BUG-06 — MEDIUM: Home Page Opening Hours JSON-LD Hardcoded

**File**: `app/(store)/page.tsx:216–228`  
**Severity**: LOW — SEO inconsistency  

**What's wrong**: The LocalBusiness JSON-LD schema has hardcoded opening hours:
```ts
{
  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  opens: '09:00',
  closes: '17:00',
},
{
  dayOfWeek: ['Sunday'],
  opens: '09:00',
  closes: '15:00',
},
```

But the checkout pickup UI fetches hours from system settings (`store_open_days`, `store_opening_hours`), and the admin can change them. If the admin changes hours, the JSON-LD remains wrong — Google's structured data shows outdated hours.

**Fix**: Fetch store hours in `getPromoSettings()` and use them in the JSON-LD:
```ts
const storeHours = settings.find(s => s.key === 'store_opening_hours')?.value ?? '09:00 - 17:00';
// Parse and use in JSON-LD
```

---

## BUG-07 — MEDIUM: InstagramFeed Component Is Fully Hardcoded

**File**: `components/store/home/InstagramFeed.tsx`  
**Severity**: MEDIUM — maintenance burden  

**What's wrong**: The Instagram feed section shows 6 hardcoded Cloudinary image paths. If product photos are updated on Cloudinary (new images uploaded to replace old ones), the gallery won't change without a code deploy.

Currently:
```ts
const GALLERY_IMAGES = [
  'gallery-01', 'gallery-02', 'gallery-03',
  'gallery-04', 'gallery-05', 'gallery-06'
];
```

**Fix Options**:
1. Store gallery image URLs in a `galleryImages` system setting or small DB table, fetch in server component
2. Use Cloudinary's dynamic named transformation to always serve a "gallery" named URL
3. At minimum, make the image IDs configurable via environment variable

For a business that updates product photos regularly, option 1 or 2 is necessary.

---

## BUG-08 — MEDIUM: HeroCarousel Falls Back to Static Image if No Slides in DB

**File**: `components/store/home/HeroCarousel.tsx`  
**Severity**: MEDIUM — silent broken hero  

**What's wrong**: When `slides.length === 0`, the component shows a static fallback hero image. But the static image path is a Cloudinary URL that may or may not exist. If the Cloudinary resource hasn't been uploaded, the hero section shows a broken image.

**Fix**:
1. Add an `onError` handler to the fallback image with a solid color placeholder:
```tsx
<img 
  src={fallbackUrl}
  onError={(e) => { e.currentTarget.style.display = 'none'; }}
  ...
/>
```
2. Or use a CSS background fallback with `brand-cream` color
3. Or ensure at least 1 carousel slide is always seeded in the DB

---

## BUG-09 — MEDIUM: Blog Post Pages Have No `generateStaticParams`

**File**: `app/(store)/blog/[slug]/page.tsx` (check if exists)  
**Severity**: MEDIUM — SEO performance gap  

**What's wrong**: Product pages (`/products/[slug]`) have `generateStaticParams` which pre-renders product pages at build time for fast first-load and good SEO. Blog post pages likely don't have this, meaning every blog page visit goes through SSR instead of being statically served from CDN.

**Fix** (in `app/(store)/blog/[slug]/page.tsx`):
```ts
export async function generateStaticParams() {
  const posts = await db.query.blogPosts.findMany({
    where: eq(blogPosts.isPublished, true),
    columns: { slug: true },
  });
  return posts.map(p => ({ slug: p.slug }));
}

export const revalidate = 3600; // Re-generate every hour
```

---

## BUG-10 — MEDIUM: Blog Cards Don't Show Reading Time

**File**: `components/store/blog/BlogCard.tsx`  
**Severity**: LOW — missing feature that's built  

**What's wrong**: `lib/utils/reading-time.ts` exists. `ReadingProgress.tsx` exists. `TableOfContents.tsx` exists. But `BlogCard.tsx` doesn't call `reading-time.ts` to display estimated reading time. In 2026, reading time is a standard blog UI element that improves click-through rate.

**Fix**: Import and use in BlogCard:
```ts
import { calculateReadingTime } from '@/lib/utils/reading-time';

// In component:
const readingTime = calculateReadingTime(post.contentId ?? '');

// In JSX:
<span className="text-xs text-text-secondary">{readingTime} min baca</span>
```

Also use ReadingProgress and TableOfContents in the blog post detail page if not already done.

---

## BUG-11 — HIGH: Products Page — No Out-of-Stock Visual at Catalog Level

**File**: `components/store/products/ProductCard.tsx`, `app/(store)/products/page.tsx`  
**Severity**: HIGH — customers click and get frustrated  

**What's wrong**: When a product has all variants at `stock = 0`, the ProductCard in the catalog may still show the product as if it's available to buy. Users click, go to the product detail page, and only then see it's out of stock.

**Verification needed**: Check if `ProductCard.tsx` reads `variants[0].stock` and shows "Habis" badge.

**Fix**: In `ProductCard.tsx`, show clear sold-out state:
```tsx
const isOutOfStock = product.variants.every(v => v.stock <= 0);

// In card:
{isOutOfStock ? (
  <div className="absolute inset-0 bg-black/40 rounded-t-card flex items-center justify-center">
    <span className="bg-white text-text-primary text-sm font-bold px-3 py-1 rounded-full">Habis</span>
  </div>
) : null}

// Disable add-to-cart button:
<button disabled={isOutOfStock} ...>
  {isOutOfStock ? 'Habis' : 'Tambah ke Keranjang'}
</button>
```

---

## BUG-12 — MEDIUM: QuoteForm Doesn't Validate Phone Number Format

**File**: `components/b2b/QuoteForm.tsx`  
**Severity**: MEDIUM — data quality  

**What's wrong**: The B2B inquiry form likely has phone field validation but Indonesian phone numbers have complex formatting (+62, 08xx, 628xx). If validation is too strict or too loose, either valid numbers are rejected or junk numbers are accepted.

**Fix**: Use a regex that accepts common Indonesian formats:
```ts
const phoneRegex = /^(\+62|62|0)8[0-9]{8,11}$/;
```

---

## INCOMPLETE FEATURE: Blog Has No `<link rel="alternate" type="application/rss+xml">` in Head

**File**: `app/(store)/layout.tsx` or `app/(store)/blog/page.tsx`  
**Severity**: MEDIUM — RSS discoverability  

**What's missing**: The blog page (and ideally the entire site) should announce the RSS feed via a `<link>` tag in `<head>`. Browsers and RSS readers auto-discover this.

**Fix**: In `app/(store)/layout.tsx` metadata or in `app/(store)/blog/page.tsx` metadata:
```ts
export const metadata: Metadata = {
  // ...existing
  alternates: {
    types: {
      'application/rss+xml': 'https://dapurdekaka.com/blog/rss.xml',
    },
  },
};
```

---

## INCOMPLETE FEATURE: No Newsletter/WhatsApp CTA in Blog Posts

**File**: `components/store/blog/BlogCTA.tsx`  
**Severity**: LOW — conversion opportunity missed  

**What's wrong**: `BlogCTA.tsx` component exists but may not be used in blog post pages. Blog visitors are warm leads — showing a "Beli Produk Kami" or "Chat via WhatsApp" CTA after an article is a high-conversion touchpoint.

**Fix**: Verify `BlogCTA.tsx` is rendered in the blog post detail page. If not, add it after the article content. The component should show:
- WhatsApp chat button
- Link to products page
- Optional newsletter signup (if implemented)

---

## INCOMPLETE FEATURE: No Product Detail Page — Back Button UX

**File**: `components/store/products/ProductDetailClient.tsx`  
**Severity**: LOW  

**What's missing**: When a user navigates from the products catalog to a product detail, clicking "back" should return to the catalog. But if they arrived from a direct link or social share, the "back" button would navigate to the previous page in browser history (could be anywhere). Consider adding an explicit "← Kembali ke Produk" link.
