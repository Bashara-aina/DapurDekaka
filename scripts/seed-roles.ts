/**
 * scripts/seed-roles.ts
 *
 * Production-safe script that upserts the 3 admin dashboard users
 * (superadmin / owner / warehouse) with bcrypt-hashed passwords.
 *
 * Idempotent: re-running will reset passwords to the values below
 * and update names / roles without duplicating rows.
 *
 * Run with:
 *   DATABASE_URL=... npm run db:seed:roles
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import * as schema from '../lib/db/schema';

type AdminRole = 'superadmin' | 'owner' | 'warehouse';

interface AdminSeed {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}

const ADMIN_SEEDS: readonly AdminSeed[] = [
  {
    email: 'superadmin@dkk.id',
    password: 'SuperadminDKK',
    name: 'Super Admin DKK',
    role: 'superadmin',
  },
  {
    email: 'owner@dkk.id',
    password: 'OwnerDKK',
    name: 'Owner DKK',
    role: 'owner',
  },
  {
    email: 'worker@dkk.id',
    password: 'WorkerDKK',
    name: 'Warehouse Worker DKK',
    role: 'warehouse',
  },
] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ABORT: DATABASE_URL is not set.');
    console.error('Export it before running, e.g.:');
    console.error('  export DATABASE_URL="postgresql://...neon.tech/dapurdekaka?sslmode=require"');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const db = drizzle(sql, { schema });

  console.log(`Seeding ${ADMIN_SEEDS.length} admin users into production DB...`);
  console.log('---');

  for (const seed of ADMIN_SEEDS) {
    const passwordHash = await bcrypt.hash(seed.password, 12);

    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, seed.email),
      columns: { id: true, role: true },
    });

    if (existing) {
      await db
        .update(schema.users)
        .set({
          name: seed.name,
          role: seed.role,
          passwordHash,
          isActive: true,
          deletedAt: null,
          languagePreference: 'id',
        })
        .where(eq(schema.users.id, existing.id));
      console.log(`[updated] ${seed.email}  (role=${seed.role})`);
    } else {
      await db.insert(schema.users).values({
        name: seed.name,
        email: seed.email,
        passwordHash,
        role: seed.role,
        isActive: true,
        pointsBalance: 0,
        languagePreference: 'id',
      });
      console.log(`[created] ${seed.email}  (role=${seed.role})`);
    }
  }

  console.log('---');
  console.log('Done. Credentials ready on dapurdekaka.com:');
  for (const seed of ADMIN_SEEDS) {
    console.log(`  ${seed.role.padEnd(11)} ${seed.email}  /  ${seed.password}`);
  }
}

main().catch((err: unknown) => {
  console.error('Seed-roles failed:', err);
  process.exit(1);
});