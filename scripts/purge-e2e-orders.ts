/**
 * Remove E2E test orders (`DDK-E2E-*`) from the production database.
 *
 * Audit 01 HIGH-6: the 4 seeded E2E orders pollute the warehouse queue, KPI
 * dashboard and phase-gate metrics.
 *
 * Usage:
 *   tsx --env-file=.env scripts/purge-e2e-orders.ts --dry-run
 *   tsx --env-file=.env scripts/purge-e2e-orders.ts --confirm
 */
import { neon } from '@neondatabase/serverless';

const args = new Set(process.argv.slice(2));
const dryRun = !args.has('--confirm');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('ABORT: DATABASE_URL is not set.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    SELECT id, order_number, status, total_amount, created_at
    FROM orders
    WHERE order_number LIKE 'DDK-E2E-%'
    ORDER BY created_at
  `;

  if (rows.length === 0) {
    console.log('No E2E orders found.');
    return;
  }

  console.table(rows.map((r) => ({
    order_number: r.order_number,
    status: r.status,
    total_amount: r.total_amount,
    created_at: r.created_at,
  })));

  if (dryRun) {
    console.log(`\nDry run — ${rows.length} order(s) would be deleted. Re-run with --confirm.`);
    return;
  }

  // order_items / order_status_history / refunds / coupon_usages cascade from
  // orders; points_history has a non-cascading order_id FK → null it first.
  for (const row of rows) {
    await sql`UPDATE points_history SET order_id = NULL WHERE order_id = ${row.id}`;
    await sql`DELETE FROM orders WHERE id = ${row.id}`;
  }

  console.log(`\nDeleted ${rows.length} E2E order(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
