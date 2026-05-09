import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  blogPosts,
  menuItems,
  pages,
  sauces,
  users,
  type BlogPost,
  type InsertBlogPost,
  type InsertMenuItem,
  type InsertSauce,
  type InsertUser,
  type MenuItem,
  type PageContent,
  type Sauce,
  type User,
} from "../shared/schema";
import { sql } from "@vercel/postgres";

export interface PublishedBlogOptions {
  page?: number;
  limit?: number;
  category?: string;
  featured?: boolean;
  author?: string;
  search?: string;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;
  getAllBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  getBlogPostBySlug(slug: string): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost & { authorId: number; slug?: string; readTime?: number }): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost & { slug?: string; readTime?: number }>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: number): Promise<boolean>;
  reorderBlogPosts(postIds: number[]): Promise<BlogPost[]>;
  getPublishedBlogPosts(opts: PublishedBlogOptions): Promise<{ posts: BlogPost[]; total: number; totalPages: number }>;
  getRelatedBlogPosts(id: number, limit?: number): Promise<BlogPost[]>;
  getAllMenuItems(): Promise<MenuItem[]>;
  getMenuItem(id: number): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: number): Promise<boolean>;
  reorderMenuItems(itemIds: number[]): Promise<MenuItem[]>;
  getAllSauces(): Promise<Sauce[]>;
  getSauce(id: number): Promise<Sauce | undefined>;
  createSauce(sauce: InsertSauce): Promise<Sauce>;
  updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined>;
  deleteSauce(id: number): Promise<boolean>;
  reorderSauces(sauceIds: number[]): Promise<Sauce[]>;
  getPageContent(pageName: string): Promise<PageContent | undefined>;
  updatePageContent(pageName: string, content: PageContent): Promise<PageContent>;
}

function requireDb() {
  return sql;
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    return operation();
  }
}

export class DatabaseStorage implements IStorage {
  async getAllMenuItems(): Promise<MenuItem[]> {
    const result = await withRetry(async () => {
      const rows = await sql`SELECT * FROM menu_items ORDER BY order_index ASC NULLS LAST`;
      return rows as unknown as MenuItem[];
    });
    return result;
  }

  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    const rows = await withRetry(async () => {
      const result = await sql`SELECT * FROM menu_items WHERE id = ${id}`;
      return result.rows as unknown as MenuItem[];
    });
    return rows[0];
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const result = await withRetry(async () => {
      const maxResult = await sql`SELECT COALESCE(MAX(order_index), -1) as max_order FROM menu_items`;
      const maxOrder = (maxResult.rows[0] as { max_order: number | null })?.max_order ?? -1;
      const newOrder = maxOrder + 1;
      const insertResult = await sql`INSERT INTO menu_items (name, description, price, image_url, order_index) 
        VALUES (${item.name}, ${item.description}, ${item.price}, ${item.imageUrl}, ${newOrder}) 
        RETURNING *`;
      return insertResult.rows as unknown as MenuItem[];
    });
    return result[0];
  }

  async updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (item.name !== undefined) { updates.push(`name = $${idx++}`); values.push(item.name); }
    if (item.description !== undefined) { updates.push(`description = $${idx++}`); values.push(item.description); }
    if (item.price !== undefined) { updates.push(`price = $${idx++}`); values.push(item.price); }
    if (item.imageUrl !== undefined) { updates.push(`image_url = $${idx++}`); values.push(item.imageUrl); }
    if (item.orderIndex !== undefined) { updates.push(`order_index = $${idx++}`); values.push(item.orderIndex); }
    if (updates.length === 0) return this.getMenuItem(id);
    values.push(id);
    const result = await sql`UPDATE menu_items SET ${sql.raw(updates.join(', '))} WHERE id = $${idx} RETURNING *`;
    const rows = result.rows as unknown as MenuItem[];
    return rows[0];
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    await sql`DELETE FROM menu_items WHERE id = ${id}`;
    return true;
  }

  async reorderMenuItems(itemIds: number[]): Promise<MenuItem[]> {
    const updated: MenuItem[] = [];
    for (let index = 0; index < itemIds.length; index++) {
      const result = await sql`UPDATE menu_items SET order_index = ${index} WHERE id = ${itemIds[index]} RETURNING *`;
      const row = result.rows[0] as unknown as MenuItem;
      if (row) updated.push(row);
    }
    return updated;
  }

  async getAllSauces(): Promise<Sauce[]> {
    const result = await sql`SELECT * FROM sauces ORDER BY order_index ASC NULLS LAST`;
    return result.rows as unknown as Sauce[];
  }

  async getSauce(id: number): Promise<Sauce | undefined> {
    const result = await sql`SELECT * FROM sauces WHERE id = ${id}`;
    const rows = result.rows as unknown as Sauce[];
    return rows[0];
  }

  async createSauce(sauce: InsertSauce): Promise<Sauce> {
    const maxResult = await sql`SELECT COALESCE(MAX(order_index), -1) as max_order FROM sauces`;
    const maxOrder = (maxResult.rows[0] as { max_order: number | null })?.max_order ?? -1;
    const newOrder = maxOrder + 1;
    const result = await sql`INSERT INTO sauces (name, description, price, image_url, order_index) 
      VALUES (${sauce.name}, ${sauce.description}, ${sauce.price}, ${sauce.imageUrl}, ${newOrder}) 
      RETURNING *`;
    const rows = result.rows as unknown as Sauce[];
    return rows[0];
  }

  async updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (sauce.name !== undefined) { updates.push(`name = $${idx++}`); values.push(sauce.name); }
    if (sauce.description !== undefined) { updates.push(`description = $${idx++}`); values.push(sauce.description); }
    if (sauce.price !== undefined) { updates.push(`price = $${idx++}`); values.push(sauce.price); }
    if (sauce.imageUrl !== undefined) { updates.push(`image_url = $${idx++}`); values.push(sauce.imageUrl); }
    if (sauce.orderIndex !== undefined) { updates.push(`order_index = $${idx++}`); values.push(sauce.orderIndex); }
    if (updates.length === 0) return this.getSauce(id);
    values.push(id);
    const result = await sql`UPDATE sauces SET ${sql.raw(updates.join(', '))} WHERE id = $${idx} RETURNING *`;
    const rows = result.rows as unknown as Sauce[];
    return rows[0];
  }

  async deleteSauce(id: number): Promise<boolean> {
    await sql`DELETE FROM sauces WHERE id = ${id}`;
    return true;
  }

  async reorderSauces(sauceIds: number[]): Promise<Sauce[]> {
    const updated: Sauce[] = [];
    for (let index = 0; index < sauceIds.length; index++) {
      const result = await sql`UPDATE sauces SET order_index = ${index} WHERE id = ${sauceIds[index]} RETURNING *`;
      const row = result.rows[0] as unknown as Sauce;
      if (row) updated.push(row);
    }
    return updated;
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await sql`SELECT * FROM users WHERE id = ${id}`;
    const rows = result.rows as unknown as User[];
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await sql`SELECT * FROM users WHERE username = ${username}`;
    const rows = result.rows as unknown as User[];
    return rows[0];
  }

  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);
    const result = await sql`INSERT INTO users (username, email, password_hash, role) 
      VALUES (${userData.username}, ${userData.email}, ${passwordHash}, 'customer') 
      RETURNING *`;
    const rows = result.rows as unknown as User[];
    return rows[0];
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    const result = await sql`SELECT * FROM blog_posts ORDER BY order_index ASC NULLS LAST`;
    return result.rows as unknown as BlogPost[];
  }

  async getPublishedBlogPosts(opts: PublishedBlogOptions): Promise<{ posts: BlogPost[]; total: number; totalPages: number }> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
    const offset = (page - 1) * limit;
    
    let whereClause = "WHERE published = 1";
    const params: unknown[] = [];
    let paramIdx = 1;
    
    if (opts.category) {
      whereClause += ` AND category = $${paramIdx++}`;
      params.push(opts.category);
    }
    if (opts.featured !== undefined) {
      whereClause += ` AND featured = ${opts.featured ? 1 : 0}`;
    }
    if (opts.author) {
      whereClause += ` AND author_name = $${paramIdx++}`;
      params.push(opts.author);
    }
    if (opts.search) {
      whereClause += ` AND (title ILIKE $${paramIdx} OR content ILIKE $${paramIdx++})`;
      params.push(`%${opts.search}%`);
    }
    
    const countResult = await sql`SELECT COUNT(*) as total FROM blog_posts ${sql.raw(whereClause)}`;
    const total = Number((countResult.rows[0] as { total: string }).total);
    const totalPages = Math.ceil(total / limit);
    
    const postsResult = await sql`SELECT * FROM blog_posts ${sql.raw(whereClause)} ORDER BY featured DESC, order_index ASC LIMIT ${limit} OFFSET ${offset}`;
    const posts = postsResult.rows as unknown as BlogPost[];
    
    return { posts, total, totalPages };
  }

  async getRelatedBlogPosts(id: number, limit = 3): Promise<BlogPost[]> {
    const current = await this.getBlogPost(id);
    if (!current) return [];
    
    let whereClause = "WHERE published = 1 AND id != ${id}";
    if (current.category) {
      whereClause += ` AND category = ${current.category}`;
    }
    
    const result = await sql`SELECT * FROM blog_posts ${sql.raw(whereClause)} ORDER BY order_index ASC LIMIT ${limit}`;
    return result.rows as unknown as BlogPost[];
  }

  async reorderBlogPosts(postIds: number[]): Promise<BlogPost[]> {
    const updated: BlogPost[] = [];
    for (let index = 0; index < postIds.length; index++) {
      const result = await sql`UPDATE blog_posts SET order_index = ${index} WHERE id = ${postIds[index]} RETURNING *`;
      const row = result.rows[0] as unknown as BlogPost;
      if (row) updated.push(row);
    }
    return updated;
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const result = await sql`SELECT * FROM blog_posts WHERE id = ${id}`;
    const rows = result.rows as unknown as BlogPost[];
    return rows[0];
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const result = await sql`SELECT * FROM blog_posts WHERE slug = ${slug}`;
    const rows = result.rows as unknown as BlogPost[];
    return rows[0];
  }

  async createBlogPost(post: InsertBlogPost & { authorId: number; slug?: string; readTime?: number }): Promise<BlogPost> {
    const maxResult = await sql`SELECT COALESCE(MAX(order_index), -1) as max_order FROM blog_posts`;
    const maxOrder = (maxResult.rows[0] as { max_order: number | null })?.max_order ?? -1;
    const newOrder = maxOrder + 1;
    
    const result = await sql`INSERT INTO blog_posts (title, content, image_url, author_id, published, order_index, excerpt, author_name, slug, category, featured, read_time)
      VALUES (${post.title}, ${post.content}, ${post.imageUrl ?? null}, ${post.authorId}, ${post.published ?? 0}, ${newOrder}, ${post.excerpt ?? null}, ${post.authorName ?? null}, ${post.slug ?? null}, ${post.category ?? null}, ${post.featured ?? 0}, ${post.readTime ?? null})
      RETURNING *`;
    const rows = result.rows as unknown as BlogPost[];
    return rows[0];
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost & { slug?: string; readTime?: number }>): Promise<BlogPost | undefined> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (post.title !== undefined) { updates.push(`title = $${idx++}`); values.push(post.title); }
    if (post.content !== undefined) { updates.push(`content = $${idx++}`); values.push(post.content); }
    if (post.imageUrl !== undefined) { updates.push(`image_url = $${idx++}`); values.push(post.imageUrl); }
    if (post.excerpt !== undefined) { updates.push(`excerpt = $${idx++}`); values.push(post.excerpt); }
    if (post.slug !== undefined) { updates.push(`slug = $${idx++}`); values.push(post.slug); }
    if (post.category !== undefined) { updates.push(`category = $${idx++}`); values.push(post.category); }
    if (post.featured !== undefined) { updates.push(`featured = $${idx++}`); values.push(post.featured); }
    if (post.readTime !== undefined) { updates.push(`read_time = $${idx++}`); values.push(post.readTime); }
    if (post.published !== undefined) { updates.push(`published = $${idx++}`); values.push(post.published); }
    if (updates.length === 0) return this.getBlogPost(id);
    values.push(id);
    const result = await sql`UPDATE blog_posts SET ${sql.raw(updates.join(', '))} WHERE id = $${idx} RETURNING *`;
    const rows = result.rows as unknown as BlogPost[];
    return rows[0];
  }

  async deleteBlogPost(id: number): Promise<boolean> {
    await sql`DELETE FROM blog_posts WHERE id = ${id}`;
    return true;
  }

  async getPageContent(pageName: string): Promise<PageContent | undefined> {
    const result = await sql`SELECT * FROM pages WHERE page_name = ${pageName}`;
    const rows = result.rows as unknown as { id: number; page_name: string; content: string }[];
    if (!rows[0]) return undefined;
    return { content: JSON.parse(rows[0].content) };
  }

  async updatePageContent(pageName: string, content: PageContent): Promise<PageContent> {
    const contentStr = JSON.stringify(content.content);
    const existing = await sql`SELECT id FROM pages WHERE page_name = ${pageName}`;
    if (existing.rows.length > 0) {
      const result = await sql`UPDATE pages SET content = ${contentStr} WHERE page_name = ${pageName} RETURNING *`;
      const rows = result.rows as unknown as { id: number; page_name: string; content: string }[];
      return { content: JSON.parse(rows[0].content) };
    } else {
      const result = await sql`INSERT INTO pages (page_name, content) VALUES (${pageName}, ${contentStr}) RETURNING *`;
      const rows = result.rows as unknown as { id: number; page_name: string; content: string }[];
      return { content: JSON.parse(rows[0].content) };
    }
  }
}

export const storage = new DatabaseStorage();