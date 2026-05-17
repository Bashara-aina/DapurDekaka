# AUDIT-08 — SEO Technical Audit
**Date:** 2026-05-16  
**Scope:** JSON-LD structured data, sitemap, canonical URLs, hreflang, Core Web Vitals, missing schema types  
**Severity:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## EXECUTIVE SUMMARY

The site has basic SEO in place (meta tags, Open Graph, sitemap, robots.txt) but is **missing all structured data (JSON-LD) that AI and search engines rely on for rich results and recommendations**. Current state:

- ✅ Meta title/description on all pages
- ✅ Open Graph tags
- ✅ Dynamic sitemap.xml
- ✅ Robots.txt
- ✅ BreadcrumbList JSON-LD on blog posts only
- ❌ Organization / LocalBusiness schema on homepage
- ❌ Product schema on product detail pages
- ❌ Article / BlogPosting schema on blog posts
- ❌ FAQPage schema (critical for AI answer boxes)
- ❌ HowTo schema on recipe/tutorial posts
- ❌ Canonical URLs on most pages
- ❌ hreflang tags for bilingual content
- ❌ Sitemap missing legal pages and B2B landing
- ❌ No `speakable` property for voice search
- ❌ Home page missing WebSite schema with SearchAction

---

## SECTION A — JSON-LD Structured Data

### A-01 🔴 Homepage missing Organization + WebSite schema

**File:** `app/(store)/page.tsx`

**Problem:** Google and Gemini use Organization schema to understand who the website is and build knowledge graph entries. Without it, the site doesn't get entity recognition.

**Fix:** Add to the homepage page component, before the JSX:

```tsx
// In app/(store)/page.tsx, add inside the component return:
<>
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Dapur Dekaka',
      alternateName: 'Dapur Dekaka Frozen Food',
      url: 'https://dapurdekaka.com',
      logo: 'https://dapurdekaka.com/assets/icons/logo.png',
      description: 'Produsen frozen food premium Chinese-Indonesia dari Bandung. Dimsum, siomay, bakso, dan lumpia halal bersertifikat.',
      foundingLocation: {
        '@type': 'Place',
        addressLocality: 'Bandung',
        addressRegion: 'Jawa Barat',
        addressCountry: 'ID',
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER,
        availableLanguage: ['Indonesian', 'English'],
      },
      sameAs: [
        'https://www.instagram.com/dapurdekaka',
        'https://www.tokopedia.com/dapurdekaka',
        'https://shopee.co.id/dapurdekaka',
      ],
    }) }}
  />
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Dapur Dekaka',
      url: 'https://dapurdekaka.com',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://dapurdekaka.com/products?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    }) }}
  />
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{ __html: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': 'https://dapurdekaka.com/#business',
      name: 'Dapur Dekaka',
      description: 'Produsen dan toko online frozen food premium Chinese-Indonesia dari Bandung.',
      url: 'https://dapurdekaka.com',
      telephone: '+62-xxx-xxxx-xxxx',
      priceRange: 'Rp 30.000 - Rp 200.000',
      currenciesAccepted: 'IDR',
      paymentAccepted: 'Credit Card, Bank Transfer, E-Wallet',
      servesCuisine: ['Chinese', 'Indonesian', 'Chinese-Indonesian'],
      hasMenu: 'https://dapurdekaka.com/products',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Bandung',
        addressRegion: 'Jawa Barat',
        addressCountry: 'ID',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: -6.9175,
        longitude: 107.6191,
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
          opens: '09:00',
          closes: '17:00',
        },
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: ['Sunday'],
          opens: '09:00',
          closes: '15:00',
        },
      ],
    }) }}
  />
  {/* ... rest of page content */}
</>
```

---

### A-02 🔴 Product pages missing Product + Offer schema

**File:** `app/(store)/products/[slug]/page.tsx`

**Problem:** Product pages have no structured data. Google cannot show rich product snippets (price, availability, rating) in search results. Gemini cannot reference product details in recommendations.

**Fix:** Add to the `ProductDetailClient` component or the server page component. First, pass the necessary product data to the JSON-LD:

```tsx
// In app/(store)/products/[slug]/page.tsx, add after product fetch:
// Build product JSON-LD
const cheapestVariant = product.variants.reduce((min, v) => 
  v.price < min.price ? v : min, product.variants[0]);

const productJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: product.nameId,
  description: product.shortDescriptionId || product.metaDescriptionId,
  image: product.images.map(img => img.cloudinaryUrl),
  brand: {
    '@type': 'Brand',
    name: 'Dapur Dekaka',
  },
  manufacturer: {
    '@type': 'Organization',
    name: 'Dapur Dekaka',
    url: 'https://dapurdekaka.com',
  },
  offers: {
    '@type': 'Offer',
    priceCurrency: 'IDR',
    price: cheapestVariant?.price,
    priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    availability: cheapestVariant?.stock > 0 
      ? 'https://schema.org/InStock' 
      : 'https://schema.org/OutOfStock',
    seller: {
      '@type': 'Organization',
      name: 'Dapur Dekaka',
    },
    url: `https://dapurdekaka.com/products/${product.slug}`,
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type': 'MonetaryAmount',
        currency: 'IDR',
        value: '0',
      },
      shippingDestination: {
        '@type': 'DefinedRegion',
        addressCountry: 'ID',
      },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: {
          '@type': 'QuantitativeValue',
          minValue: 1,
          maxValue: 2,
          unitCode: 'DAY',
        },
        transitTime: {
          '@type': 'QuantitativeValue',
          minValue: 1,
          maxValue: 5,
          unitCode: 'DAY',
        },
      },
    },
  },
  additionalProperty: [
    {
      '@type': 'PropertyValue',
      name: 'Halal Status',
      value: product.isHalal ? 'Bersertifikat Halal MUI' : 'Tidak Berlabel Halal',
    },
    {
      '@type': 'PropertyValue',
      name: 'Storage',
      value: 'Simpan di freezer -18°C',
    },
  ],
};

// Add to return JSX:
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
/>
```

---

### A-03 🔴 Blog posts missing Article + BlogPosting schema

**File:** `app/(store)/blog/[slug]/page.tsx`

**Problem:** Blog post page only has BreadcrumbList JSON-LD. Missing Article schema means Google cannot classify the content type, and Gemini cannot extract author, publish date, and topic for recommendations.

**Fix:** Add alongside the existing breadcrumb JSON-LD:

```tsx
const articleJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  '@id': `https://dapurdekaka.com/blog/${slug}`,
  headline: post.titleId,
  description: post.excerptId || post.metaDescriptionId,
  image: post.coverImageUrl ? {
    '@type': 'ImageObject',
    url: post.coverImageUrl,
    width: 1200,
    height: 630,
  } : undefined,
  datePublished: post.publishedAt?.toISOString(),
  dateModified: post.updatedAt?.toISOString() || post.publishedAt?.toISOString(),
  author: {
    '@type': 'Person',
    name: post.author?.name || 'Tim Dapur Dekaka',
    url: 'https://dapurdekaka.com/blog',
  },
  publisher: {
    '@type': 'Organization',
    name: 'Dapur Dekaka',
    logo: {
      '@type': 'ImageObject',
      url: 'https://dapurdekaka.com/assets/icons/logo.png',
    },
  },
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': `https://dapurdekaka.com/blog/${slug}`,
  },
  inLanguage: 'id-ID',
  isPartOf: {
    '@type': 'Blog',
    name: 'Blog Dapur Dekaka',
    url: 'https://dapurdekaka.com/blog',
  },
  articleSection: post.category?.nameId,
  keywords: [post.titleId, 'frozen food', 'dapur dekaka', post.category?.nameId].filter(Boolean).join(', '),
  speakable: {
    '@type': 'SpeakableSpecification',
    cssSelector: ['h1', 'h2', '.article-intro'],
  },
};
```

---

### A-04 🔴 Blog posts missing FAQPage schema

**Why it matters:** FAQPage JSON-LD enables FAQ rich results in Google Search — expanding your listing to take up more SERP space. More importantly, Gemini and AI assistants parse FAQ schemas to extract direct answers for their responses.

**Implementation approach:** Since blog posts use TipTap HTML, the FAQ section must be structured in a way we can parse. 

**Option A (Recommended) — Store FAQ separately in DB:**

Add columns to `blogPosts` schema:
```sql
ALTER TABLE blog_posts ADD COLUMN faq_items jsonb;
```

In Drizzle schema:
```ts
faqItems: jsonb('faq_items').$type<Array<{ question: string; answer: string }>>(),
```

Then in admin editor, add a FAQ section builder below the main content editor.

**Option B (Simpler) — Parse from HTML:**

Parse `<h3>` tags inside a `<div id="faq">` section:
```ts
function extractFaqFromHtml(html: string): Array<{ question: string; answer: string }> {
  // Only extract from the FAQ section
  const faqMatch = html.match(/<h2[^>]*>[^<]*FAQ[^<]*<\/h2>([\s\S]*?)(?:<h2|$)/i);
  if (!faqMatch) return [];
  
  const faqHtml = faqMatch[1];
  const items: Array<{ question: string; answer: string }> = [];
  
  const h3Regex = /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = h3Regex.exec(faqHtml)) !== null) {
    const question = match[1].replace(/<[^>]*>/g, '').trim();
    const answer = match[2].replace(/<[^>]*>/g, '').trim();
    if (question && answer) {
      items.push({ question, answer });
    }
  }
  return items;
}

// In blog post page:
const faqItems = extractFaqFromHtml(post.contentId);

const faqJsonLd = faqItems.length > 0 ? {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
} : null;
```

---

### A-05 🟠 Recipe/HowTo posts missing HowTo schema

**Why it matters:** HowTo schema enables rich results that show step-by-step instructions directly in Google Search. For our cooking tutorial posts, this is significant visibility.

**Fix:** For posts in the "Resep & Memasak" category, add HowTo schema:

```tsx
// Auto-detect recipe posts by category
if (post.category?.slug === 'resep-memasak') {
  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: post.titleId,
    description: post.excerptId,
    image: post.coverImageUrl,
    totalTime: `PT${post.cookTimeMinutes || 30}M`, // add this field to DB
    tool: [
      { '@type': 'HowToTool', name: 'Kukusan atau wajan' },
      { '@type': 'HowToTool', name: 'Piring saji' },
    ],
    supply: [
      { '@type': 'HowToSupply', name: 'Dimsum/bakso frozen Dapur Dekaka' },
    ],
    step: extractStepsFromHtml(post.contentId), // parse <ol> inside H2 "Cara Membuat"
  };
}
```

---

### A-06 🟠 Products listing page missing ItemList schema

**File:** `app/(store)/products/page.tsx`

**Fix:**

```tsx
const itemListJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Produk Frozen Food Dapur Dekaka',
  description: 'Koleksi lengkap dimsum, siomay, bakso, dan lumpia premium halal dari Bandung',
  url: 'https://dapurdekaka.com/products',
  numberOfItems: products.length,
  itemListElement: products.map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: product.nameId,
    url: `https://dapurdekaka.com/products/${product.slug}`,
    image: product.images?.[0]?.cloudinaryUrl,
  })),
};
```

---

## SECTION B — Canonical URLs

### B-01 🟠 Missing canonical on all store pages

**Problem:** Pages accessible via multiple URLs (e.g., `/products?sort=price`, `/products?category=dimsum`) create duplicate content issues. Canonical URLs tell Google which URL is the "master" version.

**Fix:** Add canonical to each page's metadata:

```tsx
// app/(store)/products/page.tsx
export const metadata: Metadata = {
  // ...existing
  alternates: {
    canonical: 'https://dapurdekaka.com/products',
  },
};

// app/(store)/products/[slug]/page.tsx - in generateMetadata:
alternates: {
  canonical: `https://dapurdekaka.com/products/${slug}`,
},

// app/(store)/page.tsx (homepage)
alternates: {
  canonical: 'https://dapurdekaka.com',
},
```

---

## SECTION C — hreflang for Bilingual Content

### C-01 🟠 No hreflang tags — bilingual content not properly signaled

**Problem:** The site serves content in both Indonesian (id) and English (en), but there are no hreflang tags. Google doesn't know which language version to show to which users, and may serve the wrong language.

**Current setup:** next-intl with `localePrefix: 'never'` — both locales serve on the same URLs, language detected from cookie/header.

**Fix for hreflang:** Since both languages serve on the same URL, use `x-default` and language-specific tags:

```tsx
// In app/layout.tsx metadata:
export const metadata: Metadata = {
  alternates: {
    canonical: 'https://dapurdekaka.com',
    languages: {
      'id-ID': 'https://dapurdekaka.com',
      'en-US': 'https://dapurdekaka.com',
      'x-default': 'https://dapurdekaka.com',
    },
  },
};

// Add to each page's generateMetadata:
alternates: {
  canonical: `https://dapurdekaka.com/blog/${slug}`,
  languages: {
    'id-ID': `https://dapurdekaka.com/blog/${slug}`,
    'en-US': `https://dapurdekaka.com/blog/${slug}`,
    'x-default': `https://dapurdekaka.com/blog/${slug}`,
  },
},
```

---

## SECTION D — Sitemap Improvements

### D-01 🟠 Sitemap missing important pages

**File:** `app/sitemap.ts`

**Missing pages:**
- `/privacy-policy`
- `/refund-policy`
- `/b2b/quote`
- `/b2b/products`
- All blog category filter pages (low priority — skip for now)

**Fix:**

```ts
// Add to routes array in sitemap.ts:
{
  url: `${BASE_URL}/privacy-policy`,
  lastModified: new Date('2026-01-01'),
  changeFrequency: 'yearly' as const,
  priority: 0.3,
},
{
  url: `${BASE_URL}/refund-policy`,
  lastModified: new Date('2026-01-01'),
  changeFrequency: 'yearly' as const,
  priority: 0.3,
},
{
  url: `${BASE_URL}/b2b/quote`,
  lastModified: new Date(),
  changeFrequency: 'monthly' as const,
  priority: 0.6,
},
```

### D-02 🟠 Sitemap not submitted to Google Search Console

**Action required (not a code change):**
1. Go to Google Search Console
2. Verify ownership of dapurdekaka.com
3. Submit `https://dapurdekaka.com/sitemap.xml`
4. Also submit to Bing Webmaster Tools
5. Add sitemap URL to Google Search Console's URL inspection for all key pages

### D-03 🟡 Blog post sitemap priority too low

**Current:** `priority: 0.6` for blog posts

**Fix:** Increase to `0.75` — blog posts are the primary SEO content:

```ts
const blogUrls: MetadataRoute.Sitemap = allPosts.map((post) => ({
  url: `${BASE_URL}/blog/${post.slug}`,
  lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
  changeFrequency: 'monthly' as const,
  priority: 0.75, // was 0.6
}));
```

---

## SECTION E — Robots.txt Improvements

### E-01 🟡 Add specific Googlebot and GPTBot rules

**File:** `app/robots.ts`

**Fix:** Add specific rules for AI crawlers:

```ts
export default function robots(): MetadataRoute.Robots {
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://dapurdekaka.com';
  
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/checkout/',
          '/account/',
          '/b2b/account/',
          '/_next/',
          '/static/',
        ],
      },
      // Explicitly allow AI crawlers to access blog and products
      {
        userAgent: 'GPTBot',
        allow: ['/blog/', '/products/', '/b2b/'],
        disallow: ['/api/', '/admin/', '/checkout/', '/account/'],
      },
      {
        userAgent: 'Google-Extended', // Gemini's crawler
        allow: ['/blog/', '/products/', '/b2b/'],
        disallow: ['/api/', '/admin/', '/checkout/', '/account/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/blog/', '/products/'],
        disallow: ['/api/', '/admin/', '/checkout/', '/account/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
```

---

## SECTION F — Meta Tags Improvements

### F-01 🟠 Homepage keywords missing important terms

**Current keywords:** `['frozen food', 'dimsum', 'siomay', 'bakso', 'Bandung', 'halal', 'makanan frozen']`

**Fix:** Expand with long-tail and local keywords:

```tsx
keywords: [
  'frozen food premium',
  'dimsum halal',
  'dimsum Bandung',
  'siomay premium',
  'bakso halal',
  'lumpia frozen',
  'makanan beku berkualitas',
  'frozen food online Indonesia',
  'pesan dimsum online',
  'dimsum kirim ke rumah',
  'Chinese Indonesian food halal',
  'frozen food tanpa pengawet',
  'dapur dekaka',
],
```

### F-02 🟠 Product pages missing `og:type: product`

**Current:** Product pages use `og:type: 'website'`

**Fix:** Change to `og:type: 'product'` (Facebook/Instagram shopping):

```tsx
openGraph: {
  type: 'website', // change to appropriate type
  // Add product-specific OG tags
}
```

Note: Next.js metadata API doesn't natively support `og:type: product` — use a custom head meta for this:

```tsx
// In app/(store)/products/[slug]/page.tsx:
// Add to the page JSX:
<>
  <meta property="product:price:amount" content={cheapestPrice.toString()} />
  <meta property="product:price:currency" content="IDR" />
  <meta property="product:availability" content={inStock ? "in stock" : "out of stock"} />
  <meta property="product:condition" content="new" />
</>
```

### F-03 🟡 Missing `og:locale:alternate` for bilingual content

**Fix:** Add to root layout metadata:

```tsx
openGraph: {
  locale: 'id_ID',
  alternateLocale: ['en_US'],
}
```

---

## SECTION G — Performance & Core Web Vitals

### G-01 🟠 Homepage uses `force-dynamic` — no caching at all

**File:** `app/(store)/page.tsx` line 16

**Problem:** `export const dynamic = 'force-dynamic'` means the homepage is server-rendered on every request. For a homepage that primarily shows featured products and carousel slides, this is unnecessary.

**Fix:** Use ISR with longer revalidation for most sections:

```tsx
// Remove: export const dynamic = 'force-dynamic';
// Add:
export const revalidate = 1800; // 30 minutes cache

// For truly dynamic content (e.g., cart count), use client components
```

### G-02 🟠 Product images missing explicit `sizes` for different breakpoints

**Current:** Product images use `sizes="(max-width: 768px) 100vw, 33vw"` — generic

**Fix:** More precise sizing to reduce unnecessary image downloads:

```tsx
// In ProductCard.tsx:
sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 300px"
```

### G-03 🟡 No `loading="eager"` on hero/LCP images

**Fix:** The first visible image (hero carousel, product hero) should have `priority` prop in Next.js Image:

```tsx
// In HeroCarousel - first slide image:
<Image
  src={slide.imageUrl}
  alt={slide.titleId}
  priority  // adds fetchpriority="high" and disables lazy loading
  fill
  className="object-cover"
/>
```

---

## SECTION H — AI/Gemini-Specific SEO Signals

### H-01 🔴 Missing `speakable` specification

**Why it matters:** Google's speakable property tells Google which parts of the page are ideal for text-to-speech in Google Assistant. Gemini uses similar signals to identify key content.

**Fix:** Add to blog posts and product pages:

```tsx
// In blog post article JSON-LD:
speakable: {
  '@type': 'SpeakableSpecification',
  cssSelector: ['h1', 'h2', '.post-excerpt'],
},
```

### H-02 🔴 No clear "About" page with E-E-A-T signals

**Why it matters:** Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) framework heavily weighs who is behind a website. Gemini uses these signals to decide if content is trustworthy enough to recommend.

**What's needed:**
1. Create `/about` page with:
   - Company story (founded when, by whom, why)
   - Production facility description
   - Halal certification details
   - Contact information
   - Team photos if available
   
2. Add LocalBusiness JSON-LD on the About page
3. Link to the About page from footer and blog post author bios

### H-03 🟡 No Review/AggregateRating schema

**Why it matters:** Products with ratings show rich snippets in Google. AI assistants use ratings to rank recommendations.

**Fix:** Pull from `testimonials` table and attach to product schema:

```tsx
// In product page, if testimonials exist for this product:
aggregateRating: {
  '@type': 'AggregateRating',
  ratingValue: '4.8',
  reviewCount: '47',
  bestRating: '5',
  worstRating: '1',
},
```

Since there's no per-product reviews currently, add a general store review on the homepage Organization schema.

---

## PRIORITY IMPLEMENTATION ORDER

| Priority | Task | Impact | Effort |
|----------|------|--------|--------|
| 1 | A-01: Organization + WebSite schema on homepage | Very High | Low |
| 2 | A-02: Product schema on product pages | Very High | Medium |
| 3 | A-03: Article/BlogPosting schema on posts | High | Low |
| 4 | A-04: FAQPage schema extraction | Very High (AI) | Medium |
| 5 | E-01: robots.txt AI crawlers | High | Low |
| 6 | B-01: Canonical URLs everywhere | High | Low |
| 7 | D-01: Sitemap missing pages | Medium | Low |
| 8 | H-02: About page with E-E-A-T signals | High | Medium |
| 9 | G-01: Remove force-dynamic on homepage | Medium | Low |
| 10 | A-05: HowTo schema on recipe posts | Medium | Medium |
