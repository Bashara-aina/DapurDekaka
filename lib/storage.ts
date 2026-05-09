import { sql } from "@vercel/postgres";
import type { PageContent } from "../shared/schema";

export interface IStorage {
  getPageContent(pageName: string): Promise<PageContent | undefined>;
  updatePageContent(pageName: string, content: PageContent): Promise<PageContent>;
}

export class DatabaseStorage implements IStorage {
  async getPageContent(pageName: string): Promise<PageContent | undefined> {
    const rows = await sql`SELECT * FROM pages WHERE page_name = ${pageName}`;
    const result = rows.rows as unknown as { id: number; page_name: string; content: string }[];
    if (!result[0]) return undefined;
    return { content: JSON.parse(result[0].content) };
  }

  async updatePageContent(pageName: string, content: PageContent): Promise<PageContent> {
    const contentStr = JSON.stringify(content.content);
    const existing = await sql`SELECT id FROM pages WHERE page_name = ${pageName}`;
    let result;
    if (existing.rows.length > 0) {
      result = await sql`UPDATE pages SET content = ${contentStr} WHERE page_name = ${pageName} RETURNING *`;
    } else {
      result = await sql`INSERT INTO pages (page_name, content) VALUES (${pageName}, ${contentStr}) RETURNING *`;
    }
    const rows = result.rows as unknown as { id: number; page_name: string; content: string }[];
    return { content: JSON.parse(rows[0].content) };
  }
}

export const storage = new DatabaseStorage();