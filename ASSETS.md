*(Note: All 33 present — no gaps detected)*

### Intended Usage
- Homepage **Gallery/Lifestyle section** — masonry or grid layout
- Blog post **cover images** (temporary, until Cloudinary uploads)
- **Carousel slides** background images (use high-res ones)
- Social proof / brand story section

### Cloudinary Upload
```typescript
// Upload entire gallery folder
const GALLERY_IMAGES = Array.from({ length: 33 }, (_, i) => ({
  file: `${i + 1}.jpg`,
  publicId: `gallery-${String(i + 1).padStart(2, '0')}`,
}));
// folder: 'dapurdekaka/gallery'
```

### Recommended Gallery Picks for Homepage
```typescript
// Use these specific numbers for key sections
// (Review visually and update these picks before launch)
const HOMEPAGE_GALLERY_PICKS =;[1][2][3][4][5][6][7][8][9][10][11]
const CAROUSEL_BG_CANDIDATES =; // large scenic/brand shots[12][13][14][15][16]
const BRAND_STORY_PICKS =;          // process/kitchen/family shots[17][18][19][20]
```

### Local Reference During Development
```typescript
// Helper to get gallery image path during dev
export function getGalleryImagePath(n: number): string {
  return `/assets/gallery/${n}.jpg`;
}

// Or use Cloudinary URL after upload:
export function getGalleryCloudinaryUrl(n: number): string {
  const padded = String(n).padStart(2, '0');
  return `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/f_webp,q_auto,w_800/dapurdekaka/gallery/gallery-${padded}`;
}
```

---

## 6. NEXT.JS IMAGE DOMAIN CONFIGURATION

Add Cloudinary and local asset paths to `next.config.ts`:

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: `/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/**`,
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google profile photos
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
```

---

## 7. ASSET MIGRATION CHECKLIST

Run this before launch:

```bash
# Step 1: Copy assets to public/
cp -r assets/ public/assets/

# Step 2: Verify favicon in public root
cp public/assets/logo/favicon.ico public/favicon.ico
cp public/assets/logo/generated-icon.png public/apple-touch-icon.png

# Step 3: Upload to Cloudinary (run scripts)
npx tsx scripts/upload-product-images.ts
npx tsx scripts/upload-sauce-images.ts
npx tsx scripts/upload-gallery-images.ts

# Step 4: After upload — update DB seed with Cloudinary URLs
# Run db:seed again with UPLOAD_DONE=true flag

# Step 5: Verify all Cloudinary URLs work in browser
# Step 6: Remove local /public/assets/menu-items/ and /gallery/
#         from Vercel deploy (add to .vercelignore or .gitignore if large)
```

---

## 8. FILE NAMING GOTCHAS

```typescript
// ⚠️ Menu item files have SPACES and PARENTHESES in names
// "7. Lumpia (Kulit Tahu).png" → URL-encode when using as src

// ✅ Safe approach: always use the LOCAL_PRODUCT_IMAGES map (Section 3)
// rather than constructing paths dynamically from filenames

// ⚠️ Sauce files have SPACES
// "Chilli Oil.jpg" → encode as "Chilli%20Oil.jpg" in URLs
// ✅ Safe approach: use Cloudinary URLs after upload (no spaces)

// ✅ Gallery files are safe — numeric names, no spaces
// "/assets/gallery/1.jpg" works without encoding
```

---

## 9. SUMMARY TABLE

| Folder | Count | Format | Stays Local | Goes to Cloudinary |
|---|---|---|---|---|
| `logo/` | 5 files | PNG, ICO, ICNS | ✅ Yes | ❌ No |
| `icons/` | 3 files | ICO, ICNS, SVG | ✅ Yes | ❌ No |
| `menu-items/` | 11 files | PNG | Dev only | ✅ Yes (products) |
| `sauces/` | 3 files | JPG | Dev only | ✅ Yes (sauces) |
| `gallery/` | 33 files | JPG | Dev only | ✅ Yes (gallery) |

---

*End of ASSETS.md v1.0*
*Total local assets: 55 files across 5 folders*
*Next step: Run `cp -r assets/ public/assets/` then start Phase 0*