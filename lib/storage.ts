import bcrypt from "bcryptjs";
import { sql } from "@vercel/postgres";
import type { PageContent } from "../shared/schema";

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
  reorderSauces(saucesIds: number[]): Promise<Sauce[]>;
  getPageContent(pageName: string): Promise<PageContent | undefined>;
  updatePageContent(pageName: string, content: PageContent): Promise<PageContent>;
}

interface User {
  id: number;
  username: string;
  email: string;
  passwordHash?: string;
  role: string;
  createdAt?: Date;
}
interface InsertUser {
  username: string;
  email: string;
  role?: string;
}
interface BlogPost {
  id: number;
  title: string;
  content: string;
  imageUrl?: string;
  authorId: number;
  published: number;
  orderIndex?: number;
  excerpt?: string;
  authorName?: string;
  slug?: string;
  category?: string;
  featured: number;
  readTime?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
interface InsertBlogPost {
  title: string;
  content: string;
  imageUrl?: string;
  authorId: number;
  published?: number;
  excerpt?: string;
  authorName?: string;
  slug?: string;
  category?: string;
  featured?: number;
  readTime?: number;
}
interface MenuItem {
  id: number;
  name: string;
  description?: string;
  /** Stored as text in Postgres for formatted display */
  price: string;
  imageUrl?: string;
  orderIndex?: number;
}
interface InsertMenuItem {
  name: string;
  description?: string;
  price: string;
  imageUrl?: string;
  orderIndex?: number;
}
interface Sauce {
  id: number;
  name: string;
  description?: string;
  /** Stored as text in Postgres for formatted display */
  price: string;
  imageUrl?: string;
  orderIndex?: number;
}
interface InsertSauce {
  name: string;
  description?: string;
  price: string;
  imageUrl?: string;
  orderIndex?: number;
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
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
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (item.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      values.push(item.name);
    }
    if (item.description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      values.push(item.description);
    }
    if (item.price !== undefined) {
      sets.push(`price = $${paramIndex++}`);
      values.push(item.price);
    }
    if (item.imageUrl !== undefined) {
      sets.push(`image_url = $${paramIndex++}`);
      values.push(item.imageUrl);
    }
    if (item.orderIndex !== undefined) {
      sets.push(`order_index = $${paramIndex++}`);
      values.push(item.orderIndex);
    }
    if (sets.length === 0) return this.getMenuItem(id);
    const setClause = sets.join(", ");
    const allValues: unknown[] = [...values, id];
    const query = `UPDATE menu_items SET ${setClause} WHERE id = $${paramIndex} RETURNING *`;
    const result = await sql.query(query, allValues);
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
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (sauce.name !== undefined) {
      sets.push(`sauce_name = $${paramIndex++}`);
      values.push(sauce.name);
    }
    if (sauce.description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      values.push(sauce.description);
    }
    if (sauce.price !== undefined) {
      sets.push(`price = $${paramIndex++}`);
      values.push(sauce.price);
    }
    if (sauce.imageUrl !== undefined) {
      sets.push(`image_url = $${paramIndex++}`);
      values.push(sauce.imageUrl);
    }
    if (sauce.orderIndex !== undefined) {
      sets.push(`order_index = $${paramIndex++}`);
      values.push(sauce.orderIndex);
    }
    if (sets.length === 0) return this.getSauce(id);
    const setClause = sets.join(", ");
    const allValues: unknown[] = [...values, id];
    const query = `UPDATE sauces SET ${setClause} WHERE id = $${paramIndex} RETURNING *`;
    const result = await sql.query(query, allValues);
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

    const conditions: string[] = ["published = 1"];
    const values: unknown[] = [];

    if (opts.category) {
      values.push(opts.category);
      conditions.push(`category = $${values.length}`);
    }
    if (opts.featured !== undefined) {
      values.push(opts.featured ? 1 : 0);
      conditions.push(`featured = $${values.length}`);
    }
    if (opts.author) {
      values.push(opts.author);
      conditions.push(`author_name = $${values.length}`);
    }
    if (opts.search) {
      values.push(`%${opts.search}%`, `%${opts.search}%`);
      conditions.push(`(title ILIKE $${values.length - 1} OR content ILIKE $${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await sql.query(`SELECT COUNT(*) as total FROM blog_posts ${whereClause}`, values);
    const total = Number((countResult.rows[0] as { total: string }).total);
    const totalPages = Math.ceil(total / limit);

    const postValues = [...values, limit, offset];
    const postsResult = await sql.query(`SELECT * FROM blog_posts ${whereClause} ORDER BY featured DESC, order_index ASC LIMIT $${postValues.length - 1} OFFSET $${postValues.length}`, postValues);
    const posts = postsResult.rows as unknown as BlogPost[];

    return { posts, total, totalPages };
  }

  async getRelatedBlogPosts(id: number, limit = 3): Promise<BlogPost[]> {
    const current = await this.getBlogPost(id);
    if (!current) return [];

    const conditions: string[] = ["published = 1", `id != ${id}`];
    const values: unknown[] = [];

    if (current.category) {
      values.push(current.category);
      conditions.push(`category = $${values.length}`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const limitValues = [...values, limit];
    const result = await sql.query(`SELECT * FROM blog_posts ${whereClause} ORDER BY order_index ASC LIMIT $${limitValues.length}`, limitValues);
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
    const sets: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (post.title !== undefined) {
      sets.push(`title = $${paramIndex++}`);
      values.push(post.title);
    }
    if (post.content !== undefined) {
      sets.push(`content = $${paramIndex++}`);
      values.push(post.content);
    }
    if (post.imageUrl !== undefined) {
      sets.push(`image_url = $${paramIndex++}`);
      values.push(post.imageUrl);
    }
    if (post.excerpt !== undefined) {
      sets.push(`excerpt = $${paramIndex++}`);
      values.push(post.excerpt);
    }
    if (post.slug !== undefined) {
      sets.push(`slug = $${paramIndex++}`);
      values.push(post.slug);
    }
    if (post.category !== undefined) {
      sets.push(`category = $${paramIndex++}`);
      values.push(post.category);
    }
    if (post.featured !== undefined) {
      sets.push(`featured = $${paramIndex++}`);
      values.push(post.featured);
    }
    if (post.readTime !== undefined) {
      sets.push(`read_time = $${paramIndex++}`);
      values.push(post.readTime);
    }
    if (post.published !== undefined) {
      sets.push(`published = $${paramIndex++}`);
      values.push(post.published);
    }
    if (sets.length === 0) return this.getBlogPost(id);
    const setClause = sets.join(", ");
    const allValues: unknown[] = [...values, id];
    const query = `UPDATE blog_posts SET ${setClause} WHERE id = $${paramIndex} RETURNING *`;
    const result = await sql.query(query, allValues);
    const rows = result.rows as unknown as BlogPost[];
    return rows[0];
  }

  async deleteBlogPost(id: number): Promise<boolean> {
    await sql`DELETE FROM blog_posts WHERE id = ${id}`;
    return true;
  }

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