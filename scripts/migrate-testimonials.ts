import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  console.log('Running migration: add deleted_at to testimonials');
  try {
    await sql`ALTER TABLE "testimonials" ADD COLUMN "deleted_at" timestamp with time zone;`;
    console.log('✅ Migration complete: deleted_at column added to testimonials');
  } catch (error) {
    const errStr = String(error);
    if (errStr.includes('duplicate') || errStr.includes('already exists')) {
      console.log('ℹ️ Column already exists, skipping');
    } else {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  }
}

migrate();