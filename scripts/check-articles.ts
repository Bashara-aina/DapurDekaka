import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT id, title, slug, category, published, featured FROM blog_posts ORDER BY id');
    console.log(`Found ${result.rows.length} articles in DB:\n`);
    result.rows.forEach(row => {
      console.log(`[${row.id}] ${row.title}`);
      console.log(`  slug: ${row.slug} | category: ${row.category} | published: ${row.published} | featured: ${row.featured}`);
      console.log();
    });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);