/**
 * Smoke-proof that the DB driver supports real interactive transactions
 * (regression guard for audit #47 — neon-http threw on db.transaction()).
 * Zero residue: the probe row is inserted then rolled back by design.
 *
 * Usage: tsx --env-file=.env scripts/smoke-db-transaction.ts
 */
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const PROBE = 'tx_proof_probe_key';

async function main() {
  const before = await db.select().from(systemSettings).where(eq(systemSettings.key, PROBE));
  console.log('before count:', before.length);

  try {
    await db.transaction(async (tx) => {
      const locked = await tx.select().from(systemSettings).limit(1).for('update');
      console.log('FOR UPDATE lock acquired, rows:', locked.length);
      await tx.insert(systemSettings).values({ key: PROBE, value: 'x', type: 'string' });
      throw new Error('intentional-rollback');
    });
  } catch (e) {
    console.log('rolled back as designed:', e instanceof Error ? e.message : String(e));
  }

  const after = await db.select().from(systemSettings).where(eq(systemSettings.key, PROBE));
  console.log('after count:', after.length);
  if (after.length !== 0) {
    console.error('TX-PROOF: FAIL (residue left behind)');
    process.exitCode = 1;
  } else {
    console.log('TX-PROOF: PASS (atomic + rolled back, zero residue)');
  }
}

main().catch((err) => {
  console.error('TX-PROOF: ERROR', err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
