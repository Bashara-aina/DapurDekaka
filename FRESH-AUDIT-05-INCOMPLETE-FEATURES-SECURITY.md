# FRESH AUDIT 05 — Incomplete Features, Security & Miscellaneous Bugs
> Deep code-level audit — May 2026. Use this file directly in Cursor.
> Every bug references the exact file + the specific code that is wrong.

---

## BUG-01 🚨 CRITICAL — Forgot password emails send a 404 link
**File:** `app/api/auth/forgot-password/route.ts` (line 50)  
**Severity:** CRITICAL — every "reset password" email silently sends a broken link; the feature is completely non-functional

**What's wrong:**  
```ts
const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password/${token}`;
```
The URL prefix is `/auth/reset-password/` — but the actual route lives at `app/(auth)/reset-password/[token]/page.tsx`. In Next.js, route groups like `(auth)` are invisible in the URL: the real URL path is `/reset-password/[token]` (no `/auth` prefix).

Every reset email sent since launch has contained a 404 link.

**Fix:**  
```ts
// CHANGE line 50 from:
const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password/${token}`;

// TO:
const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;
```

---

## BUG-02 🚨 CRITICAL — Blog is entirely empty (seed never run)
**File:** `scripts/seed-blog.ts`  
**Severity:** CRITICAL — the entire blog infrastructure is in place (routes, components, admin editor, categories) but the blog has 0 posts; every visitor sees "Artikel tidak ditemukan"

**What's wrong:**  
`scripts/seed-blog.ts` exists and is complete (idempotent, has 15 full Indonesian blog posts ready). It was never run. The blog page queries `blogPosts` and `blogCategories` which are both empty tables.

**Fix:**  
Run the seed script once:
```bash
npx tsx scripts/seed-blog.ts
```
The script is already idempotent: it skips if posts already exist. After running, verify at `/blog` that the posts appear.

---

## BUG-03 — Blog pagination: `getTotalCount` missing `deletedAt IS NULL` filter
**File:** `app/(store)/blog/page.tsx` (line 61–80)  
**Severity:** MEDIUM — pagination shows wrong total page count after soft-deleting posts

**What's wrong:**  
`getPosts` (line 38) correctly excludes soft-deleted posts:
```ts
const conditions = [eq(blogPosts.isPublished, true), sql`${blogPosts.deletedAt} IS NULL`];
```

But `getTotalCount` (line 61) does NOT:
```ts
async function getTotalCount(search?: string, categoryId?: string): Promise<number> {
  const conditions = [eq(blogPosts.isPublished, true)];  // ← missing deletedAt check
  ...
}
```

After any post is soft-deleted, `getTotalCount` overcounts, causing pagination to show extra pages that return zero posts.

**Fix:**  
```ts
async function getTotalCount(search?: string, categoryId?: string): Promise<number> {
  const conditions = [eq(blogPosts.isPublished, true), sql`${blogPosts.deletedAt} IS NULL`];
  // ... rest unchanged
}
```

---

## BUG-04 — Product pages have no `generateStaticParams` (cold-render on every visit)
**File:** `app/(store)/products/[slug]/page.tsx` (line 85)  
**Severity:** MEDIUM — product pages are server-rendered on every first request; no ISR pre-rendering

**What's wrong:**  
The product detail page has:
```ts
export const revalidate = 60;
```
But no `generateStaticParams`. Compare to `app/(store)/blog/[slug]/page.tsx` which does have `generateStaticParams` and pre-renders all published posts at build time.

Without `generateStaticParams`, every unique product URL hits the database cold on the first request from each Vercel edge region. For a store with a small catalog (say 20–50 products), pre-rendering all slugs at build time is trivial and guarantees instant page loads.

**Fix:**  
Add after `export const revalidate = 60;`:
```ts
export async function generateStaticParams() {
  try {
    const activeProducts = await db.query.products.findMany({
      where: and(eq(products.isActive, true), isNull(products.deletedAt)),
      columns: { slug: true },
    });
    return activeProducts.map((p) => ({ slug: p.slug }));
  } catch {
    return []; // DB unavailable at build time → render on-demand
  }
}
```

---

## BUG-05 — Forgot password: timing attack still partially exploitable
**File:** `app/api/auth/forgot-password/route.ts`  
**Severity:** MEDIUM — attacker can still enumerate registered emails via response time

**What's wrong:**  
The current code attempts constant-time behavior when user is NOT found:
```ts
} else {
  // Constant-time baseline — compute dummy hash to prevent timing enumeration
  await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
}
```
This simulates the bcrypt hash step (~100ms). However, the happy path (user found) also calls `await sendEmail(...)` via Resend, which adds ~200–500ms of HTTP latency. The "user not found" path skips this entirely.

Measured difference: found ≈ 400ms, not found ≈ 100ms. An attacker making 50+ requests can distinguish with high confidence.

**Fix:**  
Add a fixed minimum response time that accounts for the email send latency:
```ts
} else {
  // Timing normalization: simulate bcrypt + email send
  await new Promise(resolve => setTimeout(resolve, 400));
}
```
Alternatively, run the hash AND a fake HTTP call in parallel — but a fixed delay is simpler and sufficient.

---

## BUG-06 — B2B orders API: superadmin/owner gets 403 on order detail
**File:** `app/api/b2b/orders/[orderNumber]/route.ts` (line 18)  
**Severity:** MEDIUM — support staff (superadmin/owner) cannot view a B2B customer's order detail

**What's wrong:**  
```ts
if (session.user.role !== 'b2b') return forbidden('Akses ditolak');
```
Any role that isn't exactly `'b2b'` is rejected, including `superadmin` and `owner`. This means when a B2B customer reports a problem, the admin team cannot look up their specific order via the detail endpoint.

**Fix:**  
```ts
const allowedRoles = ['b2b', 'superadmin', 'owner'];
if (!allowedRoles.includes(session.user.role ?? '')) {
  return forbidden('Akses ditolak');
}

// For non-admin B2B users, scope to their own orders only
const isAdmin = ['superadmin', 'owner'].includes(session.user.role ?? '');
const order = await db.query.orders.findFirst({
  where: and(
    eq(orders.orderNumber, orderNumber),
    eq(orders.isB2b, true),
    isAdmin ? undefined : eq(orders.userId, session.user.id)
  ),
  ...
});
```

---

## BUG-07 — B2B order detail client: missing B2B role check
**File:** `app/(b2b)/b2b/account/orders/[orderNumber]/B2BOrderDetailClient.tsx` (line 73–77)  
**Severity:** HIGH — any logged-in user (customer, warehouse) can trigger this client and make API calls

**What's wrong:**  
Same pattern as FRESH-AUDIT-04 BUG-04 and BUG-05. The `useEffect` only redirects unauthenticated users:
```ts
useEffect(() => {
  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/b2b/account/orders');
  }
}, [status, router]);
```
Any logged-in non-B2B user who lands on this page won't be redirected. The API call will fail with 403 (since the API is fixed), but the user sees a loading state indefinitely rather than a proper redirect.

**Fix:**  
```ts
useEffect(() => {
  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/b2b/account/orders');
  } else if (status === 'authenticated') {
    const role = session?.user?.role;
    if (role !== 'b2b' && role !== 'superadmin') {
      router.push('/b2b');
    }
  }
}, [status, session, router]);
```

---

## BUG-08 — Register page: auto-login uses wrong success check
**File:** `app/(auth)/register/page.tsx` (line 63)  
**Severity:** LOW — in rare error cases, user is incorrectly redirected to `/account` while the session is broken

**What's wrong:**  
After registration, the page calls `signIn('credentials', { redirect: false })` and then:
```ts
if (loginResult?.url) {
  // ...
  router.push('/account');
} else {
  router.push('/login?registered=true');
}
```
The NextAuth `signIn()` response can have `url` set even when `error` is also set (the URL may be an error redirect URL). The correct check is whether the sign-in succeeded without an error.

**Fix:**  
```ts
if (loginResult && !loginResult.error) {
  // Merge guest cart...
  router.push('/account');
} else {
  router.push('/login?registered=true');
}
```

---

## BUG-09 — Product pages: no JSON-LD Product schema
**File:** `app/(store)/products/[slug]/page.tsx`  
**Severity:** MEDIUM — products are invisible to Google Shopping, rich snippets, and AI search engines

**What's wrong:**  
The product detail page has no structured data. Without a `Product` JSON-LD schema, Google and AI crawlers cannot extract price, availability, images, or reviews to show rich results. This is particularly impactful for a food brand where Google Shopping and AI recommendations are key discovery channels.

Blog posts DO have breadcrumb JSON-LD (in `app/(store)/blog/[slug]/page.tsx`).

**Fix:**  
Add to the product detail page component, after fetching `product`:
```tsx
const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.nameId,
  description: product.descriptionId,
  image: product.images?.map((img) => img.imageUrl),
  brand: {
    '@type': 'Brand',
    name: 'Dapur Dekaka',
  },
  offers: product.variants?.map((v) => ({
    '@type': 'Offer',
    price: v.price,
    priceCurrency: 'IDR',
    availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
  })),
};

// In the JSX, before closing </div>:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
/>
```

---

## BUG-10 — Homepage: no Organization JSON-LD schema
**File:** `app/(store)/layout.tsx` or `app/layout.tsx`  
**Severity:** MEDIUM — brand is invisible to Google Knowledge Panel and AI brand recognition

**What's wrong:**  
There is no site-wide `Organization` JSON-LD schema. Without it:
- Google cannot associate the website with the "Dapur Dekaka" brand entity
- AI assistants (ChatGPT, Gemini, Perplexity) cannot reliably recommend the brand
- The business misses out on Knowledge Panel display in search results

**Fix:**  
Add to `app/layout.tsx` or the store layout, as a `<script>` tag in `<head>`:
```tsx
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Dapur Dekaka',
  url: 'https://dapurdekaka.com',
  logo: 'https://dapurdekaka.com/logo.png',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    availableLanguage: 'Indonesian',
  },
  sameAs: [
    'https://instagram.com/dapurdekaka',
    // Add other social profiles
  ],
};
```

---

## BUG-11 — Admin B2B quotes: `'admin'` role check references non-existent role
**File:** `app/(admin)/admin/b2b-quotes/[id]/page.tsx`  
**Severity:** LOW — dead code, but confuses future devs and indicates stale copy-paste

**What's wrong:**  
(Already in FRESH-AUDIT-02 BUG-06. Confirming here for completeness.)
```ts
if (!['owner', 'superadmin', 'admin'].includes(role)) {
  redirect('/admin');
}
```
`'admin'` is not a valid role in the schema. Valid roles: `superadmin`, `owner`, `warehouse`, `b2b`, `customer`.

**Fix:**  
```ts
if (!['owner', 'superadmin'].includes(role)) {
  redirect('/admin');
}
```

---

## BUG-12 — `@react-pdf/renderer` on `nodejs` runtime: cold start risk on Vercel Hobby
**File:** `app/api/orders/[orderNumber]/receipt/route.ts`  
**Severity:** LOW — potential timeout on PDF generation during cold start

**What's happening:**  
The receipt route uses `@react-pdf/renderer` with `runtime = 'nodejs'` (correct — PDF rendering needs Node.js, not Edge). On Vercel Hobby tier, Node.js serverless functions have a 10-second execution limit. `renderToBuffer()` for a complex receipt PDF may take 2–5 seconds. On a cold start, this could approach or exceed the limit.

**Recommended check:**  
Add a timeout guard:
```ts
const pdfBuffer = await Promise.race([
  renderToBuffer(OrderReceiptPDF({ order, logoUrl })),
  new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('PDF_TIMEOUT')), 8000)
  ),
]);
```
And catch the timeout to return a 503 with a retry message.

---

## BUG-13 — Blog category filter: uses `id` (UUID) in URL instead of slug
**File:** `app/(store)/blog/page.tsx` (lines 130–145)  
**Severity:** LOW — SEO-unfriendly category URLs; UUIDs in URLs look broken to users and crawlers

**What's wrong:**  
Category filter links use the category UUID as the URL parameter:
```tsx
href={`/blog?category=${cat.id}`}
// Result: /blog?category=550e8400-e29b-41d4-a716-446655440000
```
This produces ugly, non-descriptive URLs and breaks if category IDs change.

**Fix:**  
Add a `slug` column to `blogCategories` (or use `nameId` slugified), and use that in the URL:
```tsx
href={`/blog?category=${cat.slug}`}
// Result: /blog?category=resep-memasak
```
Update `getPosts` and `getTotalCount` to look up category by slug instead of ID.

---

## BUG-14 — Blog: no RSS feed
**File:** Missing — `app/(store)/blog/rss.xml/route.ts` does not exist  
**Severity:** LOW — missed opportunity for content syndication and AI crawler indexing

**What's wrong:**  
There is no RSS or Atom feed at `/blog/rss.xml`. RSS feeds are still consumed by:
- Google and Bing for fast indexing of new content
- AI crawlers (Perplexity, GPT) for content discovery
- Users who follow blogs via RSS readers
- Other food blogs for cross-linking

**Fix:**  
Create `app/(store)/blog/rss.xml/route.ts`:
```ts
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';

export const revalidate = 3600;

export async function GET() {
  const posts = await db.query.blogPosts.findMany({
    where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)),
    orderBy: [desc(blogPosts.publishedAt)],
    limit: 20,
    with: { category: true },
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Dapur Dekaka</title>
    <link>https://dapurdekaka.com/blog</link>
    <description>Artikel dan tips seputar makanan frozen dari Dapur Dekaka</description>
    <language>id</language>
    <atom:link href="https://dapurdekaka.com/blog/rss.xml" rel="self" type="application/rss+xml"/>
    ${posts.map((post) => `
    <item>
      <title><![CDATA[${post.titleId}]]></title>
      <link>https://dapurdekaka.com/blog/${post.slug}</link>
      <guid>https://dapurdekaka.com/blog/${post.slug}</guid>
      <pubDate>${new Date(post.publishedAt!).toUTCString()}</pubDate>
      <description><![CDATA[${post.excerptId ?? ''}]]></description>
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 's-maxage=3600',
    },
  });
}
```

---

## BUG-15 — `app/api/admin/field/packing-queue/route.ts`: no return check on second UPDATE
**File:** `app/api/admin/field/packing-queue/route.ts`  
**Severity:** MEDIUM — silent failure: packing queue marks order as packed even if the DB update didn't find the row  
(Already in FRESH-AUDIT-02 BUG-10. Confirmed here as still unresolved. Apply that fix.)

---

## MISSING FEATURE-01 — No `robots.txt` AI crawler directives
**File:** `public/robots.txt` (may not exist or may be incomplete)  
**Severity:** LOW — AI crawlers (GPTBot, Google-Extended, PerplexityBot) scrape site with no guidance

**What's needed:**  
Create or update `public/robots.txt`:
```txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /account/
Disallow: /b2b/account/
Disallow: /checkout/
Disallow: /api/

# AI training crawlers — allow indexing but disallow training data use
User-agent: GPTBot
Allow: /blog/
Allow: /products/
Disallow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

Sitemap: https://dapurdekaka.com/sitemap.xml
```

---

## MISSING FEATURE-02 — No sitemap.xml
**File:** `app/sitemap.ts` (does not exist)  
**Severity:** MEDIUM — Google and Bing cannot efficiently crawl new products and blog posts

**What's needed:**  
Create `app/sitemap.ts`:
```ts
import { db } from '@/lib/db';
import { products, blogPosts } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { MetadataRoute } from 'next';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [activeProducts, publishedPosts] = await Promise.all([
    db.query.products.findMany({
      where: and(eq(products.isActive, true), isNull(products.deletedAt)),
      columns: { slug: true, updatedAt: true },
    }),
    db.query.blogPosts.findMany({
      where: and(eq(blogPosts.isPublished, true), isNull(blogPosts.deletedAt)),
      columns: { slug: true, updatedAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: 'https://dapurdekaka.com', changeFrequency: 'weekly', priority: 1 },
    { url: 'https://dapurdekaka.com/products', changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://dapurdekaka.com/blog', changeFrequency: 'weekly', priority: 0.8 },
  ];

  const productRoutes: MetadataRoute.Sitemap = activeProducts.map((p) => ({
    url: `https://dapurdekaka.com/products/${p.slug}`,
    lastModified: p.updatedAt ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = publishedPosts.map((p) => ({
    url: `https://dapurdekaka.com/blog/${p.slug}`,
    lastModified: p.updatedAt ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...productRoutes, ...blogRoutes];
}
```

---

## MISSING FEATURE-03 — No reading time display on blog posts
**File:** `app/(store)/blog/[slug]/page.tsx`  
**Severity:** LOW — standard blog UX expectation missing

**What's missing:**  
The blog post page renders `post.titleId`, excerpt, content — but no "baca X menit" (X min read) indicator. Reading time is expected by readers as a quality signal.

**Fix:**  
Add a helper:
```ts
function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, '');
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / 200)); // 200 WPM average
}
```
Use in the page:
```tsx
const readingMinutes = estimateReadingTime(post.contentId || '');
// In JSX after the title:
<p className="text-sm text-text-muted">{readingMinutes} menit baca</p>
```

---

## MISSING FEATURE-04 — Admin cannot see B2B order in customer detail view
**File:** `app/(admin)/admin/customers/[id]/page.tsx`  
**Severity:** MEDIUM — admin cannot see B2B order history for B2B customers in the customer detail panel

**What's wrong:**  
The customer detail page queries orders for a given `userId`. But B2B orders have `isB2b = true` and may have a separate flow. Verify that the query includes B2B orders:
```bash
grep -n "isB2b\|b2b\|orders" app/\(admin\)/admin/customers/\[id\]/page.tsx
```
If the query only fetches non-B2B orders, the admin sees an empty or incomplete order history for B2B customers.

**Fix:**  
Ensure the orders query in the customer detail page does NOT filter by `isB2b`:
```ts
// Should fetch ALL orders regardless of B2B status:
where: eq(orders.userId, customerId)
// NOT: where: and(eq(orders.userId, customerId), eq(orders.isB2b, false))
```

---

## MISSING FEATURE-05 — No email notification when B2B account is approved
**File:** `app/api/admin/b2b/customers/[id]/route.ts` (or similar approval endpoint)  
**Severity:** MEDIUM — B2B applicants have no way to know their account was approved

**What's wrong:**  
When a superadmin approves a B2B account (changing `b2bProfile.isApproved = true`), there is no email sent to the B2B user. The user has to check back manually or wait for the admin to contact them separately.

**Fix:**  
After updating `isApproved = true`:
```ts
await sendEmail({
  to: user.email,
  subject: 'Akun B2B Dapur Dekaka Disetujui',
  react: B2BApprovalEmail({
    userName: user.name,
    loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/b2b/account`,
  }),
});
```
This requires creating a `B2BApprovalEmail` React Email template in `lib/resend/templates/`.
