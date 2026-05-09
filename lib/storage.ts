import bcrypt from "bcryptjs";
import { and, eq, like, ne, or, sql } from "drizzle-orm";
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
import { getDb, isNeonTerminationError, resetPool } from "./db";
import { logger } from "./utils/logger";

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
  // #region agent debug log
  fetch('http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8670c'},body:JSON.stringify({sessionId:'d8670c',location:'lib/storage.ts:60',message:'requireDb called',data:{DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'MISSING'},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_UNAVAILABLE");
  }
  return db;
}

async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isNeonTerminationError(error)) {
      resetPool();
      return operation();
    }
    throw error;
  }
}

export class DatabaseStorage implements IStorage {
  async getAllMenuItems(): Promise<MenuItem[]> {
    return withRetry(async () => requireDb().select().from(menuItems).orderBy(menuItems.orderIndex));
  }

  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    return withRetry(async () => {
      const [item] = await requireDb().select().from(menuItems).where(eq(menuItems.id, id));
      return item;
    });
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    return withRetry(async () => {
      const max = await requireDb().select({ maxOrder: sql<number>`COALESCE(MAX(${menuItems.orderIndex}), -1)` }).from(menuItems);
      const [createdItem] = await requireDb().insert(menuItems).values({ ...item, orderIndex: (max[0]?.maxOrder ?? -1) + 1 }).returning();
      return createdItem;
    });
  }

  async updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    return withRetry(async () => {
      const [updated] = await requireDb().update(menuItems).set(item).where(eq(menuItems.id, id)).returning();
      return updated;
    });
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    return withRetry(async () => {
      const [deleted] = await requireDb().delete(menuItems).where(eq(menuItems.id, id)).returning();
      return Boolean(deleted);
    });
  }

  async reorderMenuItems(itemIds: number[]): Promise<MenuItem[]> {
    return withRetry(async () => {
      const updated: MenuItem[] = [];
      for (let index = 0; index < itemIds.length; index += 1) {
        const [item] = await requireDb().update(menuItems).set({ orderIndex: index }).where(eq(menuItems.id, itemIds[index])).returning();
        if (item) updated.push(item);
      }
      return updated;
    });
  }

  async getAllSauces(): Promise<Sauce[]> {
    return withRetry(async () => requireDb().select().from(sauces).orderBy(sauces.orderIndex));
  }

  async getSauce(id: number): Promise<Sauce | undefined> {
    return withRetry(async () => {
      const [sauce] = await requireDb().select().from(sauces).where(eq(sauces.id, id));
      return sauce;
    });
  }

  async createSauce(sauce: InsertSauce): Promise<Sauce> {
    return withRetry(async () => {
      const max = await requireDb().select({ maxOrder: sql<number>`COALESCE(MAX(${sauces.orderIndex}), -1)` }).from(sauces);
      const [createdSauce] = await requireDb().insert(sauces).values({ ...sauce, orderIndex: (max[0]?.maxOrder ?? -1) + 1 }).returning();
      return createdSauce;
    });
  }

  async updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined> {
    return withRetry(async () => {
      const [updated] = await requireDb().update(sauces).set(sauce).where(eq(sauces.id, id)).returning();
      return updated;
    });
  }

  async deleteSauce(id: number): Promise<boolean> {
    return withRetry(async () => {
      const [deleted] = await requireDb().delete(sauces).where(eq(sauces.id, id)).returning();
      return Boolean(deleted);
    });
  }

  async reorderSauces(sauceIds: number[]): Promise<Sauce[]> {
    return withRetry(async () => {
      const updated: Sauce[] = [];
      for (let index = 0; index < sauceIds.length; index += 1) {
        const [sauce] = await requireDb().update(sauces).set({ orderIndex: index }).where(eq(sauces.id, sauceIds[index])).returning();
        if (sauce) updated.push(sauce);
      }
      return updated;
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return withRetry(async () => {
      const [user] = await requireDb().select().from(users).where(eq(users.id, id));
      return user;
    });
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return withRetry(async () => {
      const [user] = await requireDb().select().from(users).where(eq(users.username, username));
      return user;
    });
  }

  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    return withRetry(async () => {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(userData.password, salt);
      const [createdUser] = await requireDb()
        .insert(users)
        .values({ username: userData.username, email: userData.email, passwordHash })
        .returning();
      return createdUser;
    });
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    return withRetry(async () => requireDb().select().from(blogPosts).orderBy(blogPosts.orderIndex));
  }

  async getPublishedBlogPosts(opts: PublishedBlogOptions): Promise<{ posts: BlogPost[]; total: number; totalPages: number }> {
    return withRetry(async () => {
      const page = Math.max(1, opts.page ?? 1);
      const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
      const offset = (page - 1) * limit;
      const conditions = [eq(blogPosts.published, 1)];
      if (opts.category) conditions.push(eq(blogPosts.category, opts.category));
      if (opts.featured !== undefined) conditions.push(eq(blogPosts.featured, opts.featured ? 1 : 0));
      if (opts.author) conditions.push(eq(blogPosts.authorName, opts.author));
      if (opts.search) {
        const term = `%${opts.search}%`;
        const searchCond = or(like(blogPosts.title, term), like(blogPosts.content, term));
        if (searchCond) conditions.push(searchCond);
      }

      const countResult = await requireDb()
        .select({ count: sql<number>`count(*)` })
        .from(blogPosts)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;
      const totalPages = Math.ceil(total / limit);

      const posts = await requireDb()
        .select()
        .from(blogPosts)
        .where(and(...conditions))
        .orderBy(blogPosts.featured, blogPosts.orderIndex)
        .limit(limit)
        .offset(offset);

      return { posts, total, totalPages };
    });
  }

  async getRelatedBlogPosts(id: number, limit = 3): Promise<BlogPost[]> {
    return withRetry(async () => {
      const current = await this.getBlogPost(id);
      if (!current) return [];

      const conditions = [eq(blogPosts.published, 1), ne(blogPosts.id, id)];
      if (current.category) conditions.push(eq(blogPosts.category, current.category));

      return requireDb().select().from(blogPosts).where(and(...conditions)).orderBy(blogPosts.orderIndex).limit(limit);
    });
  }

  async reorderBlogPosts(postIds: number[]): Promise<BlogPost[]> {
    return withRetry(async () => {
      const updated: BlogPost[] = [];
      for (let index = 0; index < postIds.length; index += 1) {
        const [post] = await requireDb().update(blogPosts).set({ orderIndex: index }).where(eq(blogPosts.id, postIds[index])).returning();
        if (post) updated.push(post);
      }
      return updated;
    });
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    return withRetry(async () => {
      const [post] = await requireDb().select().from(blogPosts).where(eq(blogPosts.id, id));
      return post;
    });
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    return withRetry(async () => {
      const [post] = await requireDb().select().from(blogPosts).where(eq(blogPosts.slug, slug));
      return post;
    });
  }

  async createBlogPost(post: InsertBlogPost & { authorId: number; slug?: string; readTime?: number }): Promise<BlogPost> {
    return withRetry(async () => {
      const max = await requireDb().select({ maxOrder: sql<number>`COALESCE(MAX(${blogPosts.orderIndex}), -1)` }).from(blogPosts);
      const [createdPost] = await requireDb().insert(blogPosts).values({ ...post, orderIndex: (max[0]?.maxOrder ?? -1) + 1 }).returning();
      return createdPost;
    });
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost & { slug?: string; readTime?: number }>): Promise<BlogPost | undefined> {
    return withRetry(async () => {
      const [updatedPost] = await requireDb().update(blogPosts).set(post).where(eq(blogPosts.id, id)).returning();
      return updatedPost;
    });
  }

  async deleteBlogPost(id: number): Promise<boolean> {
    return withRetry(async () => {
      const [deletedPost] = await requireDb().delete(blogPosts).where(eq(blogPosts.id, id)).returning();
      return Boolean(deletedPost);
    });
  }

  async getPageContent(pageName: string): Promise<PageContent | undefined> {
    return withRetry(async () => {
      // #region agent debug log
      fetch('http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8670c'},body:JSON.stringify({sessionId:'d8670c',location:'lib/storage.ts:293',message:'getPageContent start',data:{pageName},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const [page] = await requireDb().select().from(pages).where(eq(pages.pageName, pageName));
      // #region agent debug log
      fetch('http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5', {method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d8670c'},body:JSON.stringify({sessionId:'d8670c',location:'lib/storage.ts:295',message:'getPageContent query done',data:{pageFound: !!page, pageName},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!page) return undefined;
      return { content: JSON.parse(page.content) };
    });
  }

  async updatePageContent(pageName: string, content: PageContent): Promise<PageContent> {
    return withRetry(async () => {
      const [existing] = await requireDb().select().from(pages).where(eq(pages.pageName, pageName));

      if (existing) {
        const [updated] = await requireDb()
          .update(pages)
          .set({ content: JSON.stringify(content.content) })
          .where(eq(pages.pageName, pageName))
          .returning();
        return { content: JSON.parse(updated.content) };
      }

      const [createdPage] = await requireDb()
        .insert(pages)
        .values({ pageName, content: JSON.stringify(content.content) })
        .returning();

      return { content: JSON.parse(createdPage.content) };
    });
  }
}

export const storage = new DatabaseStorage();
logger.debug("Storage initialized");
