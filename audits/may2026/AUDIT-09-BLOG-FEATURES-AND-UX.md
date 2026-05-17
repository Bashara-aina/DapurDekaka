# AUDIT-09 — Blog Features & UX
**Date:** 2026-05-16  
**Scope:** Blog user experience, missing features, engagement components, newsletter, social proof  
**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## EXECUTIVE SUMMARY

The blog frontend has a minimal but functional skeleton. It can display posts and handle search. But it's missing all the features that make a blog **sticky** — things that keep users on the page longer, encourage return visits, and convert readers into customers. Higher time-on-page signals quality to both Google and Gemini.

Current gaps:
- No reading progress indicator
- No "Back to Top" button
- No newsletter/WhatsApp subscribe
- Related posts section exists but uses weak matching (category only)
- No social proof (view counts, share counts)
- No blog post table of contents for long-form content
- No featured post highlighting
- BlogCard component missing category badge display
- Blog listing has no featured/pinned post section
- No print/PDF view for recipes
- No comment/feedback mechanism
- Missing link to blog from main navigation (nav audit needed)

---

## SECTION A — BlogCard Component Improvements

### A-01 🟠 BlogCard missing category badge

**File:** `components/store/blog/BlogCard.tsx`

**Current:** The card shows title, date, and excerpt but never displays the category.

**Fix:** Add category badge to the card:

```tsx
// Full updated BlogCard.tsx:
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import type { BlogPost } from '@/lib/db/schema';
import { formatWIB } from '@/lib/utils/format-date';
import { getReadingTime } from '@/lib/utils/reading-time';

interface BlogCardProps {
  post: BlogPost & { category?: { nameId: string; id: string } | null };
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="group overflow-hidden hover:shadow-card-hover transition-all duration-200 h-full flex flex-col">
        <div className="aspect-[16/9] relative overflow-hidden bg-brand-cream flex-shrink-0">
          {post.coverImageUrl ? (
            <Image
              src={post.coverImageUrl}
              alt={post.titleId}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 400px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-cream to-brand-cream-dark">
              <span className="text-4xl">🥟</span>
            </div>
          )}
        </div>
        <div className="p-4 space-y-2 flex-1 flex flex-col">
          {/* Category badge */}
          {post.category && (
            <span className="inline-block self-start px-2 py-0.5 bg-brand-red/10 text-brand-red text-xs font-medium rounded-full">
              {post.category.nameId}
            </span>
          )}
          <h3 className="font-display font-semibold text-lg line-clamp-2 group-hover:text-brand-red transition-colors flex-1">
            {post.titleId}
          </h3>
          {post.excerptId && (
            <p className="text-sm text-text-secondary line-clamp-2">
              {post.excerptId}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-text-secondary pt-1 mt-auto">
            <span>{post.publishedAt ? formatWIB(new Date(post.publishedAt)) : 'Draft'}</span>
            <span>·</span>
            <span>{getReadingTime(post.contentId)} mnt baca</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
```

---

### A-02 🟡 BlogCard has no placeholder image for posts without cover

**Current:** If `post.coverImageUrl` is null, the image area just shows nothing (the aspect ratio div is empty).

**Fix:** Show a branded placeholder as shown in A-01 above — a gradient background with an emoji. This prevents the card from looking broken for posts without images.

---

## SECTION B — Blog Listing Page

### B-01 🟠 No featured/pinned post hero section

**File:** `app/(store)/blog/page.tsx`

**Problem:** All posts are shown in an equal 3-column grid. The first and best post should be featured prominently to drive clicks.

**Fix:** Show the first post as a full-width hero card:

```tsx
// Separate the first post from the rest:
{posts.length > 0 && (
  <>
    {/* Featured post - first item */}
    <div className="mb-8">
      <Link href={`/blog/${posts[0].slug}`} className="group">
        <div className="relative rounded-2xl overflow-hidden bg-brand-cream">
          {posts[0].coverImageUrl && (
            <div className="relative h-72 md:h-96">
              <Image
                src={posts[0].coverImageUrl}
                alt={posts[0].titleId}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 text-white">
                {posts[0].category && (
                  <span className="inline-block px-3 py-1 bg-brand-red text-xs font-medium rounded-full mb-3">
                    {posts[0].category.nameId}
                  </span>
                )}
                <h2 className="font-display text-2xl md:text-3xl font-bold mb-2 line-clamp-2">
                  {posts[0].titleId}
                </h2>
                {posts[0].excerptId && (
                  <p className="text-white/80 text-sm line-clamp-2">{posts[0].excerptId}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Link>
    </div>

    {/* Remaining posts in grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {posts.slice(1).map((post) => (
        <BlogCard key={post.id} post={post as Parameters<typeof BlogCard>[0]['post']} />
      ))}
    </div>
  </>
)}
```

---

### B-02 🟡 Search form reloads entire page — should use client-side filtering or URL state

**Current:** The search form does a full page `GET` reload on submit.

**Improvement:** For better UX, use `router.push` and `useSearchParams` from `next/navigation` in a client component wrapper around the search input. This prevents full page flicker.

```tsx
// components/store/blog/BlogSearchForm.tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function BlogSearchForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q') as string;
    startTransition(() => {
      router.push(q ? `/blog?q=${encodeURIComponent(q)}` : '/blog');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder="Cari artikel..."
        className="flex-1 h-11 px-4 rounded-button border border-brand-cream-dark bg-white text-sm focus:outline-none focus:border-brand-red"
      />
      {isPending && <span className="text-xs text-text-secondary self-center">Mencari...</span>}
      <button
        type="submit"
        disabled={isPending}
        className="h-11 px-4 bg-brand-red text-white text-sm font-medium rounded-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
      >
        Cari
      </button>
    </form>
  );
}
```

---

## SECTION C — Blog Post Page

### C-01 🟠 No reading progress bar

**Why it matters:** Reading progress bars are proven to increase time-on-page and reduce bounce rate. Both are positive engagement signals for Google.

**Fix:** Create a client component:

```tsx
// components/store/blog/ReadingProgress.tsx
'use client';
import { useState, useEffect } from 'react';

export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-50 bg-brand-cream-dark">
      <div
        className="h-full bg-brand-red transition-all duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
```

Add to `app/(store)/blog/[slug]/page.tsx`:
```tsx
import { ReadingProgress } from '@/components/store/blog/ReadingProgress';

// In the return JSX, before everything:
<ReadingProgress />
```

---

### C-02 🟠 No "Back to Top" button

**Fix:** Simple client component:

```tsx
// components/store/blog/BackToTop.tsx
'use client';
import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-4 md:bottom-8 z-40 w-10 h-10 bg-brand-red text-white rounded-full shadow-button flex items-center justify-center hover:bg-brand-red-dark transition-colors"
      aria-label="Kembali ke atas"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
```

---

### C-03 🟠 No sticky Table of Contents for long articles

**Why it matters:** ToC improves navigation UX and signals good content structure to Google. Long articles (2000+ words) need this.

**Fix:**

```tsx
// components/store/blog/TableOfContents.tsx
'use client';
import { useEffect, useState } from 'react';

interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export function TableOfContents({ contentHtml }: { contentHtml: string }) {
  const [activeId, setActiveId] = useState<string>('');
  const [items, setItems] = useState<TocItem[]>([]);

  useEffect(() => {
    // Parse headings from rendered HTML
    const headings = document.querySelectorAll('article h2, article h3');
    const tocItems: TocItem[] = [];

    headings.forEach((heading) => {
      if (!heading.id) {
        // Auto-generate ID from text
        heading.id = heading.textContent
          ?.toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50) || '';
      }
      tocItems.push({
        id: heading.id,
        text: heading.textContent || '',
        level: heading.tagName === 'H2' ? 2 : 3,
      });
    });

    setItems(tocItems);
  }, []);

  useEffect(() => {
    if (items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  if (items.length < 3) return null; // Only show ToC if there are 3+ headings

  return (
    <nav className="hidden xl:block sticky top-24 w-64 flex-shrink-0 pl-8">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
        Daftar Isi
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? 'pl-4' : ''}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`text-sm leading-relaxed block py-0.5 transition-colors ${
                activeId === item.id
                  ? 'text-brand-red font-medium'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

Update `app/(store)/blog/[slug]/page.tsx` to use a 2-column layout on large screens:

```tsx
// Wrap article and ToC in a flex container:
<div className="flex gap-8 items-start">
  <article className="flex-1 min-w-0">
    {/* existing article content */}
  </article>
  <TableOfContents contentHtml={post.contentId} />
</div>
```

---

### C-04 🟡 Related posts uses weak matching — same category only

**File:** `app/(store)/blog/[slug]/page.tsx` lines 131–145

**Current:** Related posts only filters by category. If the category has fewer than 3 other posts, it falls back to "any published post" — which may not be related at all.

**Fix:** Implement tag/keyword-based matching using title similarity:

```tsx
// Better related posts: combine category matching + exclude current, limit properly
const relatedPosts = await db.query.blogPosts.findMany({
  where: and(
    eq(blogPosts.isPublished, true),
    ne(blogPosts.id, post.id), // exclude current post
    post.category ? eq(blogPosts.blogCategoryId, post.category.id) : undefined,
  ),
  orderBy: [desc(blogPosts.publishedAt)],
  limit: 3,
  with: { category: true },
});

// Only show if we have at least 1 related post
const filteredRelated = relatedPosts.slice(0, 3);
```

---

### C-05 🟡 No WhatsApp/newsletter CTA in blog posts

**Why it matters:** Blog readers are warm leads. Converting them to WhatsApp subscribers or customers is the main business goal of the blog.

**Fix:** Add a CTA block in the middle of long posts and at the end:

```tsx
// components/store/blog/BlogCTA.tsx
export function BlogCTA() {
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-brand-red/5 to-brand-cream rounded-xl border border-brand-red/20">
      <h3 className="font-display text-lg font-bold mb-2">
        Mau coba dimsum premium dari Bandung?
      </h3>
      <p className="text-sm text-text-secondary mb-4">
        Pesan sekarang dan nikmati gratis ongkir untuk pembelian pertama. Dikirim ke seluruh Indonesia.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href="/products"
          className="inline-flex items-center px-4 py-2 bg-brand-red text-white text-sm font-medium rounded-button hover:bg-brand-red-dark transition-colors"
        >
          Lihat Produk
        </a>
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Halo! Saya tertarik dengan produk Dapur Dekaka`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-medium rounded-button hover:bg-[#20BD5A] transition-colors"
        >
          <span>💬</span> Chat WhatsApp
        </a>
      </div>
    </div>
  );
}
```

Insert after every 3rd heading in the content, and always at the bottom.

---

## SECTION D — Navigation & Discovery

### D-01 🔴 Blog not in main navigation

**Problem:** The blog is a dead end if no one can find it. Check if "Blog" is in the main navbar.

**Files to check:**
- `components/store/layout/Navbar.tsx`
- `components/store/layout/BottomNav.tsx` (mobile)
- `components/store/layout/Footer.tsx`

**Fix:** Ensure Blog link appears in:
1. Desktop navbar (between Products and B2B)
2. Footer "Jelajahi" section
3. Mobile bottom navigation or hamburger menu

---

### D-02 🟠 No "Latest from Blog" section on homepage

**Problem:** The homepage showcases products but doesn't link to blog content. This is a missed opportunity to build content authority.

**Fix:** Add a "Dari Blog Kami" section to the homepage after the WhyDapurDekaka section:

```tsx
// components/store/home/LatestBlogPosts.tsx
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { BlogCard } from '@/components/store/blog/BlogCard';

export async function LatestBlogPosts() {
  const posts = await db.query.blogPosts.findMany({
    where: eq(blogPosts.isPublished, true),
    orderBy: [desc(blogPosts.publishedAt)],
    limit: 3,
    with: { category: true },
  });

  if (posts.length === 0) return null;

  return (
    <section className="py-12 bg-white">
      <div className="container">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold">Dari Blog Kami</h2>
          <Link href="/blog" className="text-brand-red text-sm font-medium hover:underline">
            Semua Artikel →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map(post => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
```

---

## SECTION E — Missing Pages Needed for Blog Ecosystem

### E-01 🟡 No `/about` page — critical for E-E-A-T

Blog content gains authority when it's backed by a credible "About" page. This also helps with Gemini's entity recognition.

**Create:** `app/(store)/about/page.tsx`

Content should include:
- Company story and founding
- Production location (Bandung)
- Halal certification commitment
- Team/founder info
- Contact and social links
- Schema.org Organization + LocalBusiness JSON-LD

### E-02 🟡 No `/contact` page

Blog readers often want to ask questions. A `/contact` page with WhatsApp CTA and email improves trust signals.

---

## SECTION F — Analytics & Measurement

### F-01 🟠 No blog-specific analytics events

**Current:** Vercel Analytics tracks page views automatically, but there are no custom events for:
- Article read completion (scroll to 90%+)
- Share button clicks
- CTA clicks from blog posts
- Category filter usage
- Search usage

**Fix:** Add `analytics.track()` calls in client components:

```tsx
// In CopyLinkButton:
import { track } from '@vercel/analytics';

const handleCopy = async () => {
  await navigator.clipboard.writeText(url);
  track('blog_share', { method: 'copy_link', slug: window.location.pathname });
};

// In WhatsApp share button:
onClick={() => track('blog_share', { method: 'whatsapp', slug: slug })}
```

---

## IMPLEMENTATION PRIORITY

| Priority | Component | File | Effort |
|----------|-----------|------|--------|
| 1 | D-01: Add Blog to navbar | Navbar.tsx, Footer.tsx | Very Low |
| 2 | A-01: BlogCard category badge + placeholder | BlogCard.tsx | Low |
| 3 | B-01: Featured post hero | blog/page.tsx | Low |
| 4 | C-01: Reading progress bar | ReadingProgress.tsx (new) | Low |
| 5 | C-02: Back to top button | BackToTop.tsx (new) | Low |
| 6 | C-05: WhatsApp CTA in posts | BlogCTA.tsx (new) | Low |
| 7 | D-02: Blog section on homepage | LatestBlogPosts.tsx (new) | Medium |
| 8 | C-03: Table of Contents | TableOfContents.tsx (new) | Medium |
| 9 | E-01: About page | app/about/page.tsx (new) | Medium |
| 10 | F-01: Analytics events | Multiple client components | Medium |
