/**
 * Apply standalone performance migrations 0051–0053 in order, then verify.
 * (These live outside the drizzle journal by repo convention — see 0050.)
 *
 * Usage: tsx --env-file=.env scripts/migrate-perf-indexes.ts
 * Uses DATABASE_URL_UNPOOLED (DDL-safe direct connection).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import pg from 'pg';

const { Pool } = pg;

const FILES = [
  'drizzle/0051_drop_webhook_error_index.sql',
  'drizzle/0052_widen_points_fifo_index.sql',
  'drizzle/0053_admin_search_trgm.sql',
];

// Indexes that must exist afterwards (name → table).
const EXPECTED: Array<[string, string]> = [
  ['idx_points_expire_candidates', 'points_history'],
  ['idx_products_name_trgm', 'products'],
  ['idx_products_name_en_trgm', 'products'],
  ['idx_products_slug_trgm', 'products'],
  ['idx_orders_number_trgm', 'orders'],
  ['idx_orders_recipient_trgm', 'orders'],
  ['idx_users_name_trgm', 'users'],
  ['idx_users_email_trgm', 'users'],
];

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED/DATABASE_URL is not set');
  const pool = new Pool({ connectionString: url });

  try {
    for (const f of FILES) {
      const sql = readFileSync(join(process.cwd(), f), 'utf8');
      console.log(`Applying ${f} ...`);
      await pool.query(sql);
      console.log(`  ok`);
    }

    console.log('\nVerifying indexes ...');
    const { rows } = await pool.query(
      `SELECT indexname, tablename, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1)`,
      [EXPECTED.map(([name]) => name)]
    );
    const found = new Map(rows.map((r: { indexname: string; tablename: string; indexdef: string }) => [r.indexname, r]));
    let missing = 0;
    for (const [name, table] of EXPECTED) {
      const hit = found.get(name) as { tablename: string; indexdef: string } | undefined;
      if (!hit) {
        console.log(`  MISSING ${name} on ${table}`);
        missing++;
      } else if (hit.tablename !== table) {
        console.log(`  WRONG TABLE ${name}: on ${hit.tablename}, expected ${table}`);
        missing++;
      } else {
        console.log(`  ok ${name} on ${table}`);
      }
    }

    // 0051 receipt: the bloat index must be gone.
    const dropped = await pool.query(
      `SELECT count(*)::int AS c FROM pg_indexes WHERE schemaname='public' AND indexname='idx_webhook_events_error'`
    );
    const stillThere = (dropped.rows[0] as { c: number }).c > 0;
    console.log(stillThere ? '  STILL PRESENT idx_webhook_events_error (unexpected)' : '  ok idx_webhook_events_error dropped');
    if (stillThere) missing++;

    if (missing > 0) {
      console.error(`\nFAILED: ${missing} check(s) did not pass`);
      process.exitCode = 1;
    } else {
      console.log('\nAll performance migrations applied and verified.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
