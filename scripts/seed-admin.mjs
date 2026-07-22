import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_L1dRMGZ5psYD@ep-late-butterfly-ao1ltrql-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function main() {
  const sql = neon(url);
  const password = 'DapurDekakaJaya';
  const hash = await bcrypt.hash(password, 12);

  const admins = [
    { email: 'superadmin@dkk.id', name: 'Super Admin', role: 'superadmin' },
    { email: 'owner@dkk.id', name: 'Owner', role: 'owner' },
    { email: 'worker@dkk.id', name: 'Worker', role: 'warehouse' },
  ];

  for (const admin of admins) {
    const existing = await sql`SELECT id FROM users WHERE email = ${admin.email}`;
    if (existing.length > 0) {
      await sql`UPDATE users SET password_hash = ${hash}, is_active = true WHERE email = ${admin.email}`;
      console.log(`✅ Updated password for ${admin.email} (${admin.role})`);
    } else {
      await sql`
        INSERT INTO users (email, name, role, password_hash, is_active, points_balance, language_preference)
        VALUES (${admin.email}, ${admin.name}, ${admin.role}, ${hash}, true, 0, 'id')
      `;
      console.log(`✅ Created ${admin.email} (${admin.role})`);
    }
  }

  const allUsers = await sql`SELECT email, name, role, is_active FROM users WHERE role IN ('superadmin', 'owner', 'warehouse') ORDER BY role`;
  console.log('\nAdmin users in DB:');
  allUsers.forEach(u => console.log(`  ${u.email} (${u.role}) active=${u.is_active}`));
}

main().catch(console.error);
