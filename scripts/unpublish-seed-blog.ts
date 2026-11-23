import { db } from '../lib/db';
import { blogPosts } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function main(): Promise<void> {
  const rows = await db
    .update(blogPosts)
    .set({ isPublished: false, updatedAt: sql`now()` })
    .returning({ slug: blogPosts.slug });
  console.log('unpublished', rows.map((r) => r.slug));
  const u = process.env.DATABASE_URL ?? '';
  console.log('DATABASE_URL pooler:', u.includes('-pooler'));
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
