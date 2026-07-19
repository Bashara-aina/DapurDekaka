# AUDIT-06 — Blog Implementation Gaps
**Date:** 2026-05-16  
**Scope:** Blog infrastructure, CMS, frontend pages, API routes, missing features  
**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## EXECUTIVE SUMMARY

The blog **infrastructure exists** (schema, API routes, admin CMS, frontend pages) but the blog is **completely empty** — zero posts, zero categories. The frontend pages render an empty state. The blog is a dead end for SEO because:

1. No seed content → no indexed pages → zero organic traffic
2. Blog post page has a broken `CopyLinkButton` (it's a server component calling `onClick`)
3. No `generateStaticParams` on the blog slug































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































































 page → every visit is a cold DB hit
4. Missing Article JSON-LD schema (only BreadcrumbList exists)
5. No reading time display
6. No pagination on blog listing
7. No RSS feed
8. No author bio section
9. Blog listing uses `force-dynamic` with no search-param-aware ISR
10. No blog post view counter or share tracking

---

## SECTION A — Critical Bugs

### A-01 🔴 `CopyLinkButton` is a broken server component using `onClick`

**File:** `app/(store)/blog/[slug]/page.tsx` lines 220–237

**Problem:** The `CopyLinkButton` function is defined at the bottom of the file and uses `onClick` with `navigator.clipboard`. However, the file has **no `'use client'` directive**, so it renders as a server component. `onClick` handlers are silently ignored during SSR — the button renders but does nothing.

**Fix:**

Create a separate client component file:

```tsx
// components/store/blog/CopyLinkButton.tsx
'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback for browsers without clipboard API
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-4 py-2 bg-brand-cream-dark text-text-primary text-sm font-medium rounded-button hover:bg-brand-cream transition-colors"
    >
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Tersalin!' : 'Salin Link'}
    </button>
  );
}
```

Then in `app/(store)/blog/[slug]/page.tsx`:
- Remove the inline `CopyLinkButton` function at the bottom (lines 219–237)
- Add import: `import { CopyLinkButton } from '@/components/store/blog/CopyLinkButton';`

---

### A-02 🔴 No `generateStaticParams` — blog slug pages are never pre-rendered

**File:** `app/(store)/blog/[slug]/page.tsx`

**Problem:** Without `generateStaticParams`, Next.js treats `/blog/[slug]` as fully dynamic. Every visitor triggers a DB query. For SEO crawlers (Googlebot, Gemini-bot), slow TTFB hurts ranking.

**Fix:** Add `generateStaticParams` that exports all published slugs:

```tsx
export async function generateStaticParams() {
  const posts = await db.query.blogPosts.findMany({
    where: eq(blogPosts.isPublished, true),
    columns: { slug: true },
  });
  return posts.map(p => ({ slug: p.slug }));
}

// Keep revalidate at 86400 for ISR updates
export const revalidate = 86400;
```

This pre-builds all blog post pages at deploy time and revalidates daily — critical for SEO crawl budget.

---

### A-03 🟠 Blog listing `force-dynamic` kills caching

**File:** `app/(store)/blog/page.tsx` line 8

**Problem:** `export const dynamic = 'force-dynamic'` means every page visit hits the DB cold. The blog listing (with zero posts) gets no benefit from caching.

**Fix:** Use ISR with `revalidate` and only go dynamic when search params are present:

```tsx
// Remove: export const dynamic = 'force-dynamic';

// Add:
export const revalidate = 3600; // 1 hour cache for listing

// For search/filter, pass searchParams to a Suspense-wrapped client component
// OR keep the current approach but remove force-dynamic for the base route
```

If you need search to work server-side, wrap the results in a `<Suspense>` with a `searchParams` prop — the base cached page stays fast while searches hit the server.

---

## SECTION B — Missing Features

### B-01 🟠 No reading time estimate

**Files to change:** `components/store/blog/BlogCard.tsx`, `app/(store)/blog/[slug]/page.tsx`

**Fix:** Add a utility function and display it:

```ts
// lib/utils/reading-time.ts
export function getReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200)); // avg 200 wpm Indonesian
}
```

In `BlogCard.tsx`:
```tsx
import { getReadingTime } from '@/lib/utils/reading-time';

// Inside the card, after the date:
<span className="text-xs text-text-secondary">
  {post.publishedAt ? formatWIB(new Date(post.publishedAt)) : 'Draft'} · {getReadingTime(post.contentId)} mnt baca
</span>
```

In the blog post page header:
```tsx
<p className="text-sm text-text-secondary">
  {post.publishedAt && formatWIB(new Date(post.publishedAt))} · {getReadingTime(post.contentId)} menit baca
</p>
```

---

### B-02 🟠 No pagination on blog listing

**File:** `app/(store)/blog/page.tsx`

**Problem:** As blog grows to 50+ posts, one page will load all of them. This is slow and bad for UX.

**Fix:** Add page-based pagination using search params:

```tsx
// In getPosts function, add limit/offset
async function getPosts(search?: string, categoryId?: string, page = 1) {
  const limit = 12;
  const offset = (page - 1) * limit;
  // ... existing conditions
  
  const [postResults, totalCount] = await Promise.all([
    db.query.blogPosts.findMany({
      where: and(...conditions),
      orderBy: [desc(blogPosts.publishedAt)],
      with: { category: true },
      limit,
      offset,
    }),
    db.select({ count: sql<number>`count(*)` })
      .from(blogPosts)
      .where(and(...conditions))
      .then(r => r[0]?.count ?? 0),
  ]);
  
  return { posts: postResults, total: Number(totalCount), pages: Math.ceil(Number(totalCount) / limit) };
}
```

Add pagination UI at the bottom:
```tsx
// Simple prev/next pagination with page in searchParams
<div className="mt-8 flex justify-center gap-2">
  {currentPage > 1 && (
    <a href={`/blog?page=${currentPage - 1}${search ? `&q=${search}` : ''}`} 
       className="px-4 py-2 border border-brand-cream-dark rounded-button text-sm hover:border-brand-red">
      ← Sebelumnya
    </a>
  )}
  {currentPage < totalPages && (
    <a href={`/blog?page=${currentPage + 1}${search ? `&q=${search}` : ''}`}
       className="px-4 py-2 border border-brand-cream-dark rounded-button text-sm hover:border-brand-red">
      Selanjutnya →
    </a>
  )}
</div>
```

---

### B-03 🟠 No RSS feed

**Why it matters:** RSS feeds are indexed by Google News, Feedly, and AI aggregators. Gemini and Perplexity crawl RSS feeds to discover fresh content.

**Fix:** Create `app/feed.xml/route.ts`:

```ts
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dapurdekaka.com';

export async function GET() {
  const posts = await db.query.blogPosts.findMany({
    where: eq(blogPosts.isPublished, true),
    orderBy: [desc(blogPosts.publishedAt)],
    limit: 20,
    with: { category: true },
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Blog Dapur Dekaka</title>
    <link>${BASE_URL}/blog</link>
    <description>Artikel dan tips seputar makanan frozen, resep, dan informasi menarik dari Dapur Dekaka.</description>
    <language>id-ID</language>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    ${posts.map(post => `
    <item>
      <title><![CDATA[${post.titleId}]]></title>
      <link>${BASE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${post.slug}</guid>
      <description><![CDATA[${post.excerptId || ''}]]></description>
      <pubDate>${new Date(post.publishedAt!).toUTCString()}</pubDate>
      <dc:creator>Dapur Dekaka</dc:creator>
      ${post.category ? `<category>${post.category.nameId}</category>` : ''}
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
```

Also add to `robots.ts`:
```ts
// Add to robots.ts rules
{
  userAgent: '*',
  allow: ['/feed.xml'],
}
```

And reference in `<head>` in `app/layout.tsx`:
```tsx
export const metadata: Metadata = {
  // ... existing
  alternates: {
    types: {
      'application/rss+xml': `${BASE_URL}/feed.xml`,
    },
  },
};
```

---

### B-04 🟡 No author bio section on blog posts

**Why it matters:** Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) requires author signals. Gemini uses author context to assess content credibility.

**Fix:** Add author data to blog post query and render an author card:

```tsx
// In app/(store)/blog/[slug]/page.tsx, add author to query:
const post = await db.query.blogPosts.findFirst({
  where: eq(blogPosts.slug, slug),
  with: {
    category: true,
    author: {
      columns: { name: true, id: true },
    },
  },
});

// Render after article content:
<div className="mt-8 pt-6 border-t border-brand-cream-dark flex items-start gap-4">
  <div className="w-12 h-12 rounded-full bg-brand-red/10 flex items-center justify-center flex-shrink-0">
    <span className="text-brand-red font-bold text-lg">
      {post.author?.name?.[0] ?? 'D'}
    </span>
  </div>
  <div>
    <p className="font-semibold">{post.author?.name ?? 'Tim Dapur Dekaka'}</p>
    <p className="text-sm text-text-secondary">
      Tim editorial Dapur Dekaka. Kami berbagi tips memasak, resep, dan informasi seputar frozen food premium dari Bandung.
    </p>
  </div>
</div>
```

---

### B-05 🟡 No breadcrumb UI component on blog listing and post pages

**Problem:** JSON-LD breadcrumbs exist on the post page but there's no visible breadcrumb navigation, which helps both UX and SEO (Google shows breadcrumbs in SERPs).

**Fix:** Add a visual breadcrumb above the article:

```tsx
// In app/(store)/blog/[slug]/page.tsx, before the <article> tag:
<nav aria-label="breadcrumb" className="mb-6 text-sm text-text-secondary flex items-center gap-2">
  <Link href="/" className="hover:text-brand-red">Beranda</Link>
  <span>/</span>
  <Link href="/blog" className="hover:text-brand-red">Blog</Link>
  <span>/</span>
  {post.category && (
    <>
      <Link href={`/blog?category=${post.category.id}`} className="hover:text-brand-red">
        {post.category.nameId}
      </Link>
      <span>/</span>
    </>
  )}
  <span className="text-text-primary line-clamp-1">{post.titleId}</span>
</nav>
```

---

### B-06 🟡 Blog post page missing canonical URL

**File:** `app/(store)/blog/[slug]/page.tsx` in `generateMetadata`

**Fix:** Add canonical to metadata:

```tsx
return {
  // ... existing metadata
  alternates: {
    canonical: `https://dapurdekaka.com/blog/${slug}`,
  },
};
```

---

### B-07 🟡 Blog listing page missing canonical URL and pagination metadata

**File:** `app/(store)/blog/page.tsx`

**Fix:**

```tsx
export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = params.page || '1';
  
  return {
    title: page === '1' ? 'Blog - Dapur Dekaka' : `Blog - Halaman ${page} | Dapur Dekaka`,
    description: 'Artikel dan tips seputar makanan frozen, resep, dan informasi menarik dari Dapur Dekaka.',
    alternates: {
      canonical: `https://dapurdekaka.com/blog${page !== '1' ? `?page=${page}` : ''}`,
    },
    robots: {
      index: page === '1', // only index page 1
      follow: true,
    },
  };
}
```

---

### B-08 🟢 No "Table of Contents" for long-form articles

**Why it matters:** Long articles (2000+ words) benefit from a floating or sticky ToC. Google and AI assistants use heading structure to understand article sections.

**Fix:** Create a `TableOfContents` client component that parses `h2`/`h3` from the HTML content and renders a sticky sidebar on desktop. This is a progressive enhancement — implement after initial content is live.

---

## SECTION C — Admin CMS Gaps

### C-01 🟠 Blog admin: no slug auto-generation from title

**File:** `app/(admin)/admin/blog/new/page.tsx`

**Problem:** Admin has to manually enter the slug. If left empty or wrong, it creates broken URLs.

**Fix:** Add client-side slug generation from titleId using a `useEffect`:

```tsx
// In the new/edit blog form:
const generateSlug = (title: string) => 
  title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

// Auto-generate when title changes, but allow manual override
useEffect(() => {
  if (!isSlugManuallySet) {
    setValue('slug', generateSlug(watchedTitleId));
  }
}, [watchedTitleId]);
```

---

### C-02 🟠 Blog API missing category creation endpoint

**File:** `app/api/admin/blog/route.ts`

**Problem:** The blog admin UI shows categories but there's no way to create blog categories from the admin (only product categories have their own page). Blog categories must be seeded or manually inserted.

**Fix:** Either:
1. Add blog categories management to the admin blog page (inline create)
2. Create `app/api/admin/blog/categories/route.ts` with `GET` and `POST` handlers

---

### C-03 🟡 Blog admin editor: no word count display

**Problem:** For SEO, articles should be at minimum 800 words. Editors have no feedback on length.

**Fix:** Add word count to TipTap editor toolbar using the `CharacterCount` extension (already available in TipTap).

---

## SECTION D — Database Seed Requirements

### D-01 🔴 Zero blog content — completely empty

The database has:
- 0 blog categories
- 0 blog posts

This is the most critical gap. See **AUDIT-07** for the complete seed content.

**Blog categories to create (run in seed-blog.ts):**

```ts
const blogCategories = [
  { nameId: 'Resep & Memasak', nameEn: 'Recipes & Cooking', slug: 'resep-memasak', sortOrder: 1 },
  { nameId: 'Tips & Trik', nameEn: 'Tips & Tricks', slug: 'tips-trik', sortOrder: 2 },
  { nameId: 'Edukasi Halal', nameEn: 'Halal Education', slug: 'edukasi-halal', sortOrder: 3 },
  { nameId: 'Gaya Hidup', nameEn: 'Lifestyle', slug: 'gaya-hidup', sortOrder: 4 },
  { nameId: 'Berita & Promo', nameEn: 'News & Promos', slug: 'berita-promo', sortOrder: 5 },
];
```

Target: **15 published blog posts** for launch (see AUDIT-07).

---

## SECTION E — Checklist Summary

| # | Issue | Severity | File | Status |
|---|-------|----------|------|--------|
| A-01 | CopyLinkButton broken (no 'use client') | 🔴 | `blog/[slug]/page.tsx` | ❌ |
| A-02 | No generateStaticParams | 🔴 | `blog/[slug]/page.tsx` | ❌ |
| A-03 | force-dynamic on blog listing | 🟠 | `blog/page.tsx` | ❌ |
| B-01 | No reading time | 🟠 | `BlogCard.tsx`, `[slug]/page.tsx` | ❌ |
| B-02 | No pagination | 🟠 | `blog/page.tsx` | ❌ |
| B-03 | No RSS feed | 🟠 | `app/feed.xml/route.ts` (new) | ❌ |
| B-04 | No author bio | 🟡 | `[slug]/page.tsx` | ❌ |
| B-05 | No breadcrumb UI | 🟡 | `[slug]/page.tsx` | ❌ |
| B-06 | No canonical URL on posts | 🟡 | `[slug]/page.tsx` | ❌ |
| B-07 | No canonical on listing | 🟡 | `blog/page.tsx` | ❌ |
| C-01 | No slug auto-generation | 🟠 | Admin blog form | ❌ |
| C-02 | No blog category API | 🟠 | `api/admin/blog/categories/route.ts` | ❌ |
| D-01 | Zero blog content | 🔴 | `scripts/seed-blog.ts` (new) | ❌ |
