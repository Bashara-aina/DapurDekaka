# AUDIT-10 — AI & Gemini SEO Strategy
**Date:** 2026-05-16  
**Scope:** Getting DapurDekaka.com recommended by AI assistants (Gemini, ChatGPT, Perplexity, Claude)  
**Priority:** 🔴 Critical for long-term organic growth · Strategy + Implementation Guide

---

## WHY THIS MATTERS NOW

AI-powered search (Google's AI Overviews, Gemini, ChatGPT with browsing, Perplexity) is rapidly replacing traditional "10 blue links" search. When someone asks Gemini "where can I buy halal dimsum online in Indonesia?" or "recommend frozen food brand Bandung" — we need DapurDekaka to appear.

This is fundamentally different from traditional SEO. AI systems don't just look at keywords — they:
1. **Understand entities** (who is DapurDekaka? What do they sell?)
2. **Assess trustworthiness** (E-E-A-T signals across the web)
3. **Parse structured content** (FAQs, how-tos, product specs)
4. **Crawl and index fresh content** (recent, updated pages)
5. **Aggregate from multiple sources** (social media, reviews, news)

---

## SECTION A — Entity Optimization (Knowledge Graph)

### A-01 🔴 Establish DapurDekaka as a recognized entity

**What:** Google and Gemini use the Knowledge Graph to recognize brands. Once an entity is in the graph, AI can recommend it confidently.

**How to build entity recognition:**

**Step 1: Consistent NAP (Name, Address, Phone) across all platforms**
- Every online mention of Dapur Dekaka must use EXACTLY the same format
- Name: `Dapur Dekaka` (not "DapurDekaka" or "Dapur Dekaka Food")
- Location: `Bandung, Jawa Barat, Indonesia`
- Phone: Always the same WhatsApp number

**Step 2: Google Business Profile**
- Create a verified Google Business Profile at `business.google.com`
- Category: "Frozen Food Manufacturer" + "Online Food Store"
- Add all products to the profile
- Upload photos of production, products, packaging
- Get customers to leave Google reviews

**Step 3: Wikipedia/Wikidata entry** (long-term)
- Build enough online presence first (press mentions, social proof)
- Then create a Wikidata entry for the brand

**Step 4: Schema.org Organization markup (see AUDIT-08 A-01)**
- Already covered in technical SEO audit
- This is the code-level entity signal

**Step 5: Consistent profiles on major platforms**
- Tokopedia, Shopee (marketplace presence)
- Instagram, TikTok (social signals)
- LinkedIn (B2B credibility)
- Ensure website URL is linked from all profiles

---

### A-02 🔴 Build topical authority around frozen food niche

**What Topical Authority means:** Instead of one good article, you need to be THE resource on the topic. Gemini and AI systems give preference to sites that comprehensively cover a topic.

**Topic clusters to build:**

```
PILLAR: Dimsum (main category)
├── What is dimsum?
├── Types of dimsum (ha gao, siu mai, char siu bao, etc.)
├── How to cook dimsum (steam, fry, microwave)
├── Dimsum nutrition
├── Dimsum halal — what to look for
├── Dimsum for parties and events
├── Where to buy dimsum in Bandung
├── Dimsum online delivery Indonesia
└── Dimsum vs. other dim sum dishes

PILLAR: Frozen Food Education
├── How long does frozen food last?
├── Is frozen food healthy?
├── How to store frozen food correctly
├── Freezer burn — causes and prevention
├── Frozen food safety guidelines
├── Best frozen food brands Indonesia
└── How to choose quality frozen food online

PILLAR: Indonesian-Chinese Food Culture
├── History of Chinese-Indonesian cuisine
├── Peranakan cooking explained
├── Famous Chinese-Indonesian dishes
├── Chinese food traditions in Indonesia (Imlek, etc.)
└── How food from China became Indonesian

PILLAR: Cooking Tips & Recipes
├── Dimsum dipping sauces
├── Meatball soup recipes
├── Spring roll variations
├── Siomay serving ideas
└── Party food ideas with frozen food
```

**Target:** 4–6 articles per pillar = 20–30 total articles within 3 months of launch.

---

## SECTION B — Content Structure for AI Parsing

### B-01 🔴 Every blog post MUST have a clear answer to a question

**The Rule:** AI assistants are built to answer questions. If your content doesn't answer a clear question, it won't be cited. Every blog post should start with a clear answer to its primary question within the first 150 words.

**Example:**
- Title: "Frozen Food Tahan Berapa Lama?"
- First paragraph MUST directly answer: "Frozen food umumnya tahan 2–3 bulan di freezer dengan suhu -18°C..."
- Then elaborate with details, tips, FAQ

This is called the "inverted pyramid" structure — most important information first.

**Template for blog post structure:**
```
H1: [Question or clear statement]
[Direct answer paragraph — 2-3 sentences, covers the core answer]

H2: [Elaboration / Context]
[Detailed explanation]

H2: [Step-by-step / How-to]
[Numbered steps if applicable]

H2: [Variations / Edge cases]
[Additional details]

[BlogCTA component — product recommendation]

H2: FAQ
H3: [Question 1]
[Answer 1]
H3: [Question 2]
[Answer 2]
H3: [Question 3]
[Answer 3]

[Author bio]
[Related posts]
```

---

### B-02 🔴 FAQ sections are mandatory for AI citation

**Why:** When Gemini or Perplexity answers a user's question, they often pull from FAQ sections because the Q&A format is perfect for extracting structured answers.

**Rule for every blog post:**
- Minimum 3 FAQ items
- Questions should use natural language search queries (how do people actually ask this?)
- Answers should be 2–4 sentences — complete but concise
- Use `<h3>` for questions and `<p>` for answers (for FAQPage JSON-LD parsing)

**Good FAQ questions for food blog:**
- "Apakah [product] perlu dicairkan sebelum dimasak?" → Direct operational question
- "Berapa lama [product] bisa disimpan di freezer?" → Storage question
- "Apa perbedaan antara X dan Y?" → Comparison question
- "Apakah [product] halal?" → Trust/safety question
- "Berapa kalori [product] per porsi?" → Health question

---

### B-03 🟠 Use "Speakable" markup for voice search / AI voice responses

**Already covered in AUDIT-08 H-01, implementing here for emphasis.**

For Indonesian voice search (Google Assistant, Gemini voice), the `speakable` specification tells Google which content is suitable for audio playback:

```tsx
speakable: {
  '@type': 'SpeakableSpecification',
  xpath: [
    "/html/head/title",
    "//article/h1",
    "//article/p[1]",  // First paragraph (the direct answer)
  ],
},
```

---

## SECTION C — Trust & Authority Signals (E-E-A-T)

### C-01 🔴 Build E-E-A-T signals — AI won't recommend untrustworthy sources

Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) applies doubly to AI recommendations. Here's what to build:

**Experience signals:**
- Author bios that mention real experience ("Kami sudah memproduksi dimsum sejak [year]...")
- Production process content (photos/videos of how food is made)
- Customer testimonials with names and locations
- Before/after stories

**Expertise signals:**
- Technically accurate content (don't just write fluff)
- Cite sources where appropriate (BPOM, MUI regulations, etc.)
- Use correct food science terminology
- Have content reviewed by someone with culinary expertise

**Authority signals:**
- Get featured in food blogs, media, or social accounts
- Guest posts or mentions in culinary publications
- Backlinks from established food sites

**Trustworthiness signals:**
- Clear About page with company information
- Physical address and contact information
- Halal certification visible on website
- HTTPS (already done)
- Privacy policy and refund policy (already done)
- Transparent pricing and no hidden fees

---

### C-02 🟠 Create an "About" page that AI can parse for entity context

**File to create:** `app/(store)/about/page.tsx`

**Minimum content required:**

```tsx
// Content outline for About page:
export const metadata: Metadata = {
  title: 'Tentang Kami | Dapur Dekaka',
  description: 'Dapur Dekaka adalah produsen frozen food premium Chinese-Indonesia dari Bandung. Dimsum, siomay, bakso halal bersertifikat MUI.',
  alternates: { canonical: 'https://dapurdekaka.com/about' },
};

// JSON-LD for the About page:
{
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'Tentang Dapur Dekaka',
  description: '...',
  url: 'https://dapurdekaka.com/about',
  mainEntity: {
    '@type': 'FoodEstablishment',
    name: 'Dapur Dekaka',
    description: 'Produsen dan toko online frozen food premium Chinese-Indonesia dari Bandung...',
    foundingDate: '2020',  // adjust to actual date
    foundingLocation: {
      '@type': 'Place',
      addressLocality: 'Bandung',
      addressRegion: 'Jawa Barat',
      addressCountry: 'ID',
    },
    servesCuisine: ['Dimsum', 'Chinese-Indonesian', 'Frozen Food'],
    hasCredential: {
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'Sertifikat Halal MUI',
      recognizedBy: {
        '@type': 'Organization',
        name: 'Majelis Ulama Indonesia (MUI)',
      },
    },
  },
}
```

---

## SECTION D — Content Calendar for Maximum AI Indexing

### D-01 🟠 Publish frequency matters to AI systems

**Target publishing cadence:**
- Weeks 1–4: Publish 2–3 posts/week to build initial index momentum
- Weeks 5–12: 1 post/week to maintain freshness signals
- Ongoing: Update older posts with new information quarterly

**Why freshness matters for Gemini:** When Gemini answers a query about "best frozen food in Indonesia 2026", it prefers recently updated sources. An article that was published 6 months ago but updated this month will rank higher than a 3-year-old article.

**Implementation:** Add `updatedAt` to blog post metadata and show "Terakhir diperbarui: [date]" on posts.

---

### D-02 🟡 Target "zero-click" queries with structured answers

**What AI Overview triggers:** Google's AI Overview (Gemini in Search) appears for queries where there's a clear, factual answer. Target these with blog content:

| Query Type | Example | Content to Create |
|------------|---------|-------------------|
| Definition | "apa itu dimsum" | Wikipedia-style explanation article |
| How-to | "cara masak dimsum beku" | Step-by-step tutorial |
| Comparison | "perbedaan siomay dan dimsum" | Comparison table article |
| Best X | "frozen food halal terbaik" | Roundup/recommendation article |
| How long | "frozen food tahan berapa lama" | Specific duration with table |
| Nutrition | "berapa kalori dimsum" | Nutrition table with context |

---

## SECTION E — Off-Page AI SEO Signals

### E-01 🔴 Get mentioned on platforms AI crawls

AI assistants (especially ChatGPT with browsing and Perplexity) actively crawl the web. Being mentioned on these platforms increases the chance of being recommended:

**Priority platforms to target:**

1. **Food blogs & review sites (Indonesian):**
   - Zomato Indonesia
   - TripAdvisor (for the brand)
   - Kuliner.info
   - Pergi Kuliner

2. **Marketplace reviews:**
   - Tokopedia product reviews
   - Shopee product reviews
   - High-quality reviews here appear in AI-generated roundups

3. **Social media:**
   - Instagram food accounts (micro-influencers work well)
   - TikTok food content (SERP integration growing)
   - YouTube (product unboxing/review videos)

4. **Press/media:**
   - Pikiran Rakyat (Bandung-based news)
   - Detikfood / CNN Indonesia food section
   - Even a small local press mention builds authority

5. **Community forums:**
   - Reddit (r/Indonesia, r/FrozenFood)
   - Quora Indonesia answers
   - KASKUS food section
   - Facebook Groups (Bumbu dan Resep, etc.)

**Target:** 10+ external mentions in first 3 months.

---

### E-02 🟠 Answer questions in Quora/Reddit to build citations

**Strategy:** Find questions about frozen food, dimsum, siomay on Indonesian platforms and provide genuine, helpful answers. Include a natural mention of Dapur Dekaka as a specific example.

**Example questions to answer:**
- "Merk frozen dimsum halal yang enak?" → Answer genuinely with Dapur Dekaka as one recommendation among others
- "Frozen food bisa dikirim ke luar kota?" → Answer about proper packaging, mention Dapur Dekaka's shipping process
- "Cara masak siomay frozen yang benar?" → Link to the tutorial blog post

AI systems (especially Perplexity) frequently pull from Quora and Reddit for recommendations.

---

## SECTION F — Technical Freshness Signals for AI Crawlers

### F-01 🟠 Ping Google/Bing after publishing new blog posts

When a new blog post is published, actively request indexing:

```ts
// In the blog post publish API (app/api/admin/blog/route.ts), after setting isPublished:
// Ping Google Search Console Indexing API
async function requestIndexing(url: string) {
  try {
    const response = await fetch(
      `https://indexing.googleapis.com/v3/urlNotifications:publish`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getGoogleAccessToken()}`,
        },
        body: JSON.stringify({
          url,
          type: 'URL_UPDATED',
        }),
      }
    );
    console.log('Indexing requested:', await response.json());
  } catch (err) {
    console.error('Indexing request failed:', err);
  }
}

// Call after publish:
if (body.isPublished && !existingPost.isPublished) {
  requestIndexing(`https://dapurdekaka.com/blog/${body.slug}`).catch(console.error);
}
```

Note: Requires setting up Google Indexing API credentials (service account).

### F-02 🟡 Add `lastmod` to sitemap with actual content change timestamps

**Current:** `lastmod` uses `updatedAt` from DB but blogPosts `updatedAt` is set automatically by ORM.

**Fix:** Ensure that when blog content is edited, `updatedAt` is explicitly updated (most ORMs handle this, but verify):

```ts
// In blog PUT handler:
await db.update(blogPosts)
  .set({
    ...updates,
    updatedAt: new Date(), // explicit update
  })
  .where(eq(blogPosts.id, id));
```

---

## SECTION G — Keyword Research for Indonesian AI Queries

### G-01 Priority keywords with AI intent

These are queries that frequently trigger AI Overviews and AI assistant responses:

**Question queries (high AI intent):**
```
Cara memasak dimsum beku
Frozen food halal terbaik Indonesia
Dimsum tahan berapa lama di freezer
Apakah frozen food sehat
Cara membuat saus dimsum
Apa itu bakso
Perbedaan siomay dan dimsum
Frozen food untuk anak-anak
Tips menyimpan makanan beku
Dimsum tanpa pengawet
```

**Commercial queries (purchase intent):**
```
Beli dimsum online
Frozen food kirim ke rumah
Dimsum halal Bandung
Pesan siomay online
Harga dimsum premium
Frozen food sertifikat halal
```

**Informational long-tail:**
```
Makanan beku china indonesia
Resep saus kacang siomay bandung
Cara goreng lumpia agar crispy
Frozen food BPOM halal
Makanan beku untuk acara ulang tahun
Cara masak bakso frozen kuah bening
```

**B2B queries:**
```
Supplier frozen food Jakarta
Grosir dimsum halal Bandung
Frozen food untuk katering
Dimsum untuk reseller
B2B frozen food Indonesia
```

---

## SECTION H — Measuring AI SEO Success

### H-01 Metrics to track

1. **Google Search Console:** Monitor "Search Appearance" for Rich Results (FAQ, HowTo, Product)
2. **Google AI Overview appearances:** Use Search Console's "AI Overviews" report once available
3. **Brand mention tracking:** Set up Google Alerts for "Dapur Dekaka"
4. **Direct traffic growth:** Indicates brand recognition (people searching directly)
5. **Organic click-through rate (CTR):** Rich results should significantly increase CTR
6. **Index coverage:** Ensure all blog posts are indexed in GSC

---

## QUICK WIN CHECKLIST (Do This Week)

- [ ] 1. Create Google Business Profile for Dapur Dekaka
- [ ] 2. Submit sitemap to Google Search Console
- [ ] 3. Add Organization JSON-LD to homepage (AUDIT-08 A-01)
- [ ] 4. Run seed-blog.ts to publish first 10 posts
- [ ] 5. Add Blog link to navigation (AUDIT-09 D-01)
- [ ] 6. Update robots.txt to allow AI crawlers (AUDIT-08 E-01)
- [ ] 7. Verify all blog posts have FAQ sections with 3+ Q&A items
- [ ] 8. Create About page with E-E-A-T content
- [ ] 9. Add canonical URLs to homepage, product pages, blog pages
- [ ] 10. Post 2–3 times on Instagram linking to blog content

---

## 90-DAY CONTENT PLAN

**Month 1 (Foundation):**
- 15 seed blog posts published
- Technical SEO fixes applied (AUDIT-08)
- Google Business Profile verified
- Sitemap submitted to GSC and Bing

**Month 2 (Expansion):**
- 8 more blog posts (target new keyword clusters)
- External mentions: 5+ food blog collaborations
- Marketplace reviews: 20+ reviews on Tokopedia/Shopee
- Update seed posts with FAQ sections

**Month 3 (Optimization):**
- Analyze GSC data: which posts get traffic
- Double down on working content types
- Begin press outreach (Pikiran Rakyat, Detikfood)
- Add HowTo schema to recipe posts

**Month 6 Target:**
- 30+ published blog posts
- 50+ external brand mentions
- Appearing in AI Overview for at least 5 target queries
- 500+ monthly organic visitors from blog
