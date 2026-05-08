import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";

const URL_PREFIXES = ["/uploads/", "/asset/", "/logo/", "/footer/", "/public/logo/customers/"];

interface BlobCache {
  [sourcePath: string]: string;
}

function isLegacyLocalUrl(value: string): boolean {
  return URL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function normalizeFilePath(urlValue: string): string {
  if (urlValue.startsWith("/uploads/")) return path.join(process.cwd(), urlValue.slice(1));
  if (urlValue.startsWith("/asset/")) return path.join(process.cwd(), "public", urlValue.slice(1));
  if (urlValue.startsWith("/logo/")) return path.join(process.cwd(), urlValue.slice(1));
  if (urlValue.startsWith("/footer/")) return path.join(process.cwd(), "public", urlValue.slice(1));
  if (urlValue.startsWith("/public/logo/customers/")) return path.join(process.cwd(), urlValue.slice(1));
  return path.join(process.cwd(), urlValue.slice(1));
}

function blobKeyFor(urlValue: string): string {
  const cleaned = urlValue.replace(/^\/+/, "");
  return `migrated/${cleaned}`;
}

async function uploadLegacyUrl(urlValue: string, cache: BlobCache): Promise<string> {
  if (urlValue.startsWith("https://")) {
    return urlValue;
  }
  if (cache[urlValue]) {
    return cache[urlValue];
  }

  const localPath = normalizeFilePath(urlValue);
  const fileBuffer = await readFile(localPath);
  const result = await put(blobKeyFor(urlValue), fileBuffer, {
    access: "public",
    addRandomSuffix: false,
  });
  cache[urlValue] = result.url;
  return result.url;
}

async function migrateColumnTable(
  db: ReturnType<typeof drizzle>,
  tableName: "menu_items" | "sauces" | "blog_posts",
  columnName: "image_url",
  cache: BlobCache,
): Promise<void> {
  const rows = await db.execute<{ id: number; image_url: string | null }>(
    sql.raw(`SELECT id, ${columnName} FROM ${tableName}`),
  );

  for (const row of rows.rows) {
    if (!row.image_url || !isLegacyLocalUrl(row.image_url)) continue;
    const migrated = await uploadLegacyUrl(row.image_url, cache);
    await db.execute(
      sql`UPDATE ${sql.raw(tableName)} SET ${sql.raw(columnName)} = ${migrated} WHERE id = ${row.id}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function migrateJsonNode(value: unknown, cache: BlobCache): Promise<unknown> {
  if (typeof value === "string") {
    if (!isLegacyLocalUrl(value)) return value;
    return uploadLegacyUrl(value, cache);
  }

  if (Array.isArray(value)) {
    const migrated = await Promise.all(value.map((item) => migrateJsonNode(item, cache)));
    return migrated;
  }

  if (isRecord(value)) {
    const migratedEntries = await Promise.all(
      Object.entries(value).map(async ([key, node]) => [key, await migrateJsonNode(node, cache)] as const),
    );
    return Object.fromEntries(migratedEntries);
  }

  return value;
}

async function migratePagesContent(db: ReturnType<typeof drizzle>, cache: BlobCache): Promise<void> {
  const rows = await db.execute<{ id: number; content: string }>(sql.raw("SELECT id, content FROM pages"));
  for (const row of rows.rows) {
    const parsed = JSON.parse(row.content) as unknown;
    const migrated = await migrateJsonNode(parsed, cache);
    await db.execute(sql`UPDATE pages SET content = ${JSON.stringify(migrated)} WHERE id = ${row.id}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const db = drizzle({ client: pool });
  const cache: BlobCache = {};

  await migrateColumnTable(db, "menu_items", "image_url", cache);
  await migrateColumnTable(db, "sauces", "image_url", cache);
  await migrateColumnTable(db, "blog_posts", "image_url", cache);
  await migratePagesContent(db, cache);

  await pool.end();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[migrate-uploads-to-blob] ${message}`);
  process.exitCode = 1;
});
