# Deployment Guide — DapurDekaka.com

## Vercel Deployment

### Standard Deploy (Preview)

Every push to a feature branch automatically creates a preview deployment on Vercel.

```bash
# Push your branch
git push origin feature/your-feature-name
```

Check deployment status:

```bash
vercel
```

### Production Deploy

Merge to `main` branch triggers production deployment.

```bash
git checkout main
git merge feature/your-feature-name
git push origin main
```

### Rollback via Vercel CLI

If a production deployment is broken, rollback immediately:

```bash
# List recent deployments
vercel list

# Rollback to previous deployment
vercel rollback [deployment-url]

# Or use deployment ID from the list
vercel rollback dpl_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

To get the production deployment URL:

```bash
vercel inspect --prod
```

### Rollback via Dashboard

1. Go to https://vercel.com/dapurdekaka/dapurdekaka/deployments
2. Find the last healthy production deployment
3. Click the `...` menu → "Promote to Production"

---

## Environment Variables

Sync `.env.example` to Vercel dashboard:

```bash
vercel env pull .env.local
```

Or add manually in Vercel dashboard → Settings → Environment Variables.

Required variables:
- `DATABASE_URL` — Neon pooled connection
- `DATABASE_URL_UNPOOLED` — Neon direct connection
- `AUTH_SECRET` — NextAuth session secret
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google OAuth
- `MIDTRANS_SERVER_KEY` / `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` — Payment
- `RAJAONGKIR_API_KEY` — Shipping calculation
- `CLOUDINARY_*` — Image hosting
- `RESEND_API_KEY` / `RESEND_FROM_EMAIL` — Transactional email
- `MINIMAX_API_KEY` / `MINIMAX_GROUP_ID` — AI content (superadmin)
- `CRON_SECRET` — Cron job authentication (REQUIRED for scheduled jobs)
- `NEXT_PUBLIC_APP_URL` — Canonical URL
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — WhatsApp Business number

---

## Database — Neon PostgreSQL

### Connection

All DB operations use the `lib/db/index.ts` singleton. For migrations, use the unpooled URL:

```bash
npx drizzle-kit push --dialect=postgres
```

### Rollback Migrations

Drizzle does not have native rollback. For emergency data fixes:

1. **Create a fix migration** manually in `drizzle/migrations/`:
   ```sql
   -- rollback_YYYYMMDD_description.sql
   UPDATE products SET is_active = true WHERE id = 'xxx';
   ```

2. **Run via psql**:
   ```bash
   psql "your-neon-direct-url"
   -- Paste the SQL
   ```

3. **Or use Neon SQL Editor** in the dashboard for emergency hotfixes.

### Backup Before Migration

Always create a manual snapshot before running migrations in production:

1. Go to Neon Dashboard → Branching
2. Create a shadow branch for testing migration
3. Verify migration works on shadow branch
4. Apply to production

---

## Cron Jobs

Configured in `vercel.json`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/cancel-expired-orders` | `*/5 * * * *` | Cancel orders unpaid after 15 min |
| `/api/cron/expire-points` | `0 7 * * *` | 14:00 WIB — expire aged points |
| `/api/cron/points-expiry-warning` | `0 2 * * *` | 09:00 WIB — notify users 30 days before expiry |

All cron routes require `CRON_SECRET` in the `Authorization` header.

To test locally:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://dapurdekaka.com/api/cron/cancel-expired-orders
```

---

## Emergency Contacts

### Vercel Support
- Dashboard: https://vercel.com/dapurdekaka/dapurdekaka/support
- Email: support@vercel.com
- Documentation: https://vercel.com/docs

### Midtrans (Payment Issues)
- Dashboard: https://dashboard.midtrans.com
- Support: support@midtrans.com
- Sandbox: https://dashboard.sandbox.midtrans.com

### Neon (Database Issues)
- Dashboard: https://neon.tech
- Support: via Neon dashboard chat

### Cloudinary (Image CDN)
- Dashboard: https://cloudinary.com/console
- Support: support@cloudinary.com

---

## Disable Site (Emergency)

If critical issue requires disabling the storefront:

1. **Vercel Dashboard → Settings → Environment → Set `NEXT_PUBLIC_SITE_ENABLED=false`**
2. All pages check this var and show "Maintenance" page if false

Or via vercel CLI:

```bash
vercel env add NEXT_PUBLIC_SITE_ENABLED false production
```

---

## Monitoring

- **Vercel Analytics**: https://vercel.com/dapurdekaka/dapurdekaka/analytics
- **Function Logs**: https://vercel.com/dapurdekaka/dapurdekaka/functions
- **Cron Monitoring**: Set up Vercel Cron monitoring alerts in dashboard