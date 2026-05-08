# DapurDekaka

## Purpose

Vite SPA + Vercel Functions backend for Dapur Dekaka content, menu, blog, and admin management, with Neon Postgres (Drizzle), iron-session auth, and Vercel Blob media storage.

## Setup

1. Install dependencies:
   - `npm install`
2. Pull Vercel environment values locally:
   - `vercel env pull .env.local`
3. Run local development:
   - `npm run dev`

## Environment Variables

- `DATABASE_URL`: Neon Postgres connection string.
- `SESSION_SECRET`: secret string (minimum 32 chars) used by `iron-session`.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token required for upload APIs and migration script.

## API Routes

- Auth:
  - `POST /api/register`
  - `POST /api/login`
  - `POST /api/logout`
  - `GET /api/auth-check`
- Menu:
  - `GET|POST /api/menu/items`
  - `PUT|DELETE /api/menu/items/:id`
  - `POST /api/menu/items/reorder`
  - `GET|POST /api/menu/sauces`
  - `PUT|DELETE /api/menu/sauces/:id`
  - `POST /api/menu/sauces/reorder`
- Blog:
  - `GET|POST /api/blog`
  - `GET /api/blog/list`
  - `GET|PUT|DELETE /api/blog/:id`
  - `GET /api/blog/:id/related`
  - `GET /api/blog/admin/all`
  - `POST /api/blog/reorder`
  - `GET /api/blog/sitemap/all`
- Pages:
  - `GET|PUT /api/pages/homepage`
  - `PUT /api/pages/homepage/customers`
  - `PUT /api/pages/homepage/customers/logos/reorder`
  - `DELETE /api/pages/homepage/customers/logos/:index`
  - `PUT /api/pages/homepage/carousel/reorder`
  - `DELETE /api/pages/homepage/carousel/:index`
  - `GET|PUT /api/pages/about`
  - `POST /api/pages/about/upload`
  - `GET|PUT|POST /api/pages/contact`
  - `POST /api/pages/contact/upload`
  - `GET|PUT /api/pages/footer`
- Other:
  - `POST /api/contact`
  - `GET /api/sitemap.xml`

## Scripts

- `npm run dev`: run Vercel local runtime (`vercel dev`)
- `npm run build`: build frontend (`vite build`)
- `npm run check`: TypeScript check
- `npm run test`: run Vitest suite
- `npm run db:push`: apply Drizzle schema to database
