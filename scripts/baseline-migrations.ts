/**
 * One-shot script: mark all existing migrations as already-applied.
 *
 * Context: This DB was originally synced via `drizzle-kit push` (which does not
 * create a `__drizzle_migrations` tracking table). As a result, `drizzle-kit
 * migrate` re-runs every migration from scratch and errors on duplicate enums
 * and tables. To restore a healthy migration state we:
 *   1. Create `__drizzle_migrations` (Drizzle's bookkeeping table).
 *   2. Insert one row per migration file (matching the hash format that
 *      drizzle-kit expects: sha256 of the migration SQL, first 32 hex chars).
 *
 * After this script runs successfully, `npm run db:migrate` will only apply
 * migrations that have been added since this point in time.
 */

import { createHash } from 'crypto';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('ABORT: DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const DRIZZLE_DIR = join(process.cwd(), 'drizzle');
const files = readdirSync(DRIZZLE_DIR)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort();

function hashMigration(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log(`Found ${files.length} migration file(s):`);
  for (const f of files) console.log('  -', f);

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint NOT NULL
    )
  `;

  const existing = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
  const existingHashes = new Set(existing.map((r) => (r as { hash: string }).hash));
  console.log(`Already-tracked hashes: ${existingHashes.size}`);

  let inserted = 0;
  let now = Date.now();
  for (const file of files) {
    const content = readFileSync(join(DRIZZLE_DIR, file), 'utf8');
    const hash = hashMigration(content);
    if (existingHashes.has(hash)) {
      console.log(`  · skip ${file} (already tracked)`);
      continue;
    }
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${now})`;
    now += 1;
    inserted += 1;
    console.log(`  + mark ${file}`);
  }

  console.log(`Done — inserted ${inserted} migration record(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
