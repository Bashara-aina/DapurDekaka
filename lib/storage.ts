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
import { getDb } from "./db";

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
  return getDb();
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
    const db = requireDb();
    const result = await withRetry(async () => {
      return db.select().from(menuItems).orderBy(menuItems.orderIndex);
    });
    return result;
  }

  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    const db = requireDb();
    const result = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return result[0];
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    const db = requireDb();
    const maxResult = await db.select().from(menuItems);
    const maxOrder = maxResult.reduce((max, m) => Math.max(max, m.orderIndex ?? -1), -1);
    const newOrder = maxOrder + 1;
    const result = await db.insert(menuItems).values({
      name: item.name,
      description: item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      orderIndex: newOrder,
    }).returning();
    return result[0];
  }

  async updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    const db = requireDb();
    const updateData: Partial<InsertMenuItem> = {};
    if (item.name !== undefined) updateData.name = item.name;
    if (item.description !== undefined) updateData.description = item.description;
    if (item.price !== undefined) updateData.price = item.price;
    if (item.imageUrl !== undefined) updateData.imageUrl = item.imageUrl;
    if (item.orderIndex !== undefined) updateData.orderIndex = item.orderIndex;
    if (Object.keys(updateData).length === 0) return this.getMenuItem(id);
    const result = await db.update(menuItems).set(updateData).where(eq(menuItems.id, id)).returning();
    return result[0];
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    const db = requireDb();
    await db.delete(menuItems).where(eq(menuItems.id, id));
    return true;
  }

  async reorderMenuItems(itemIds: number[]): Promise<MenuItem[]> {
    const db = requireDb();
    const updated: MenuItem[] = [];
    for (let index = 0; index < itemIds.length; index++) {
      const result = await db.update(menuItems).set({ orderIndex: index }).where(eq(menuItems.id, itemIds[index])).returning();
      if (result[0]) updated.push(result[0]);
    }
    return updated;
  }

  async getAllSauces(): Promise<Sauce[]> {
    const db = requireDb();
    return db.select().from(sauces).orderBy(sauces.orderIndex);
  }

  async getSauce(id: number): Promise<Sauce | undefined> {
    const db = requireDb();
    const result = await db.select().from(sauces).where(eq(sauces.id, id));
    return result[0];
  }

  async createSauce(sauce: InsertSauce): Promise<Sauce> {
    const db = requireDb();
    const maxResult = await db.select().from(sauces);
    const maxOrder = maxResult.reduce((max, s) => Math.max(max, s.orderIndex ?? -1), -1);
    const newOrder = maxOrder + 1;
    const result = await db.insert(sauces).values({
      name: sauce.name,
      description: sauce.description,
      price: sauce.price,
      imageUrl: sauce.imageUrl,
      orderIndex: newOrder,
    }).returning();
    return result[0];
  }

  async updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined> {
    const db = requireDb();
    const updateData: Partial<InsertSauce> = {};
    if (sauce.name !== undefined) updateData.name = sauce.name;
    if (sauce.description !== undefined) updateData.description = sauce.description;
    if (sauce.price !== undefined) updateData.price = sauce.price;
    if (sauce.imageUrl !== undefined) updateData.imageUrl = sauce.imageUrl;
    if (sauce.orderIndex !== undefined) updateData.orderIndex = sauce.orderIndex;
    if (Object.keys(updateData).length === 0) return this.getSauce(id);
    const result = await db.update(sauces).set(updateData).where(eq(sauces.id, id)).returning();
    return result[0];
  }

  async deleteSauce(id: number): Promise<boolean> {
    const db = requireDb();
    await db.delete(sauces).where(eq(sauces.id, id));
    return true;
  }

  async reorderSauces(sauceIds: number[]): Promise<Sauce[]> {
    const db = requireDb();
    const updated: Sauce[] = [];
    for (let index = 0; index < sauceIds.length; index++) {
      const result = await db.update(sauces).set({ orderIndex: index }).where(eq(sauces.id, sauceIds[index])).returning();
      if (result[0]) updated.push(result[0]);
    }
    return updated;
  }

  async getUser(id: number): Promise<User | undefined> {
    const db = requireDb();
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = requireDb();
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    const db = requireDb();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(userData.password, salt);
    const result = await db.insert(users).values({
      username: userData.username,
      email: userData.email,
      passwordHash,
      role: "customer",
    }).returning();
    return result[0];
  }

  async getAllBlogPosts(): Promise<BlogPost[]> {
    const db = requireDb();
    return db.select().from(blogPosts).orderBy(blogPosts.orderIndex);
  }

  async getPublishedBlogPosts(opts: PublishedBlogOptions): Promise<{ posts: BlogPost[]; total: number; totalPages: number }> {
    const db = requireDb();
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 10));
    const offset = (page - 1) * limit;

    let conditions: ReturnType<typeof eq>[] = [];
    if (opts.category) {
      conditions.push(eq(blogPosts.category, opts.category));
    }
    if (opts.featured !== undefined) {
      conditions.push(eq(blogPosts.featured, opts.featured));
    }

    const allPosts = await db.select().from(blogPosts).where(eq(blogPosts.published, true));
    const total = allPosts.length;
    const totalPages = Math.ceil(total / limit);

    const posts = await db.select().from(blogPosts)
      .where(eq(blogPosts.published, true))
      .orderBy(blogPosts.orderIndex)
      .limit(limit)
      .offset(offset);

    return { posts, total, totalPages };
  }

  async getRelatedBlogPosts(id: number, limit = 3): Promise<BlogPost[]> {
    const current = await this.getBlogPost(id);
    if (!current) return [];

    const db = requireDb();
    let conditions: ReturnType<typeof eq>[] = [eq(blogPosts.published, true), eq(blogPosts.id, id)];
    if (current.category) {
      conditions.push(eq(blogPosts.category, current.category));
    }

    return db.select().from(blogPosts)
      .where(eq(blogPosts.published, true))
      .orderBy(blogPosts.orderIndex)
      .limit(limit);
  }

  async reorderBlogPosts(postIds: number[]): Promise<BlogPost[]> {
    const db = requireDb();
    const updated: BlogPost[] = [];
    for (let index = 0; index < postIds.length; index++) {
      const result = await db.update(blogPosts).set({ orderIndex: index }).where(eq(blogPosts.id, postIds[index])).returning();
      if (result[0]) updated.push(result[0]);
    }
    return updated;
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const db = requireDb();
    const result = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return result[0];
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const db = requireDb();
    const result = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return result[0];
  }

  async createBlogPost(post: InsertBlogPost & { authorId: number; slug?: string; readTime?: number }): Promise<BlogPost> {
    const db = requireDb();
    const maxResult = await db.select().from(blogPosts);
    const maxOrder = maxResult.reduce((max, b) => Math.max(max, b.orderIndex ?? -1), -1);
    const newOrder = maxOrder + 1;

    const result = await db.insert(blogPosts).values({
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      authorId: post.authorId,
      published: post.published ?? false,
      orderIndex: newOrder,
      excerpt: post.excerpt,
      authorName: post.authorName,
      slug: post.slug,
      category: post.category,
      featured: post.featured ?? false,
      readTime: post.readTime,
    }).returning();
    return result[0];
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost & { slug?: string; readTime?: number }>): Promise<BlogPost | undefined> {
    const db = requireDb();
    const updateData: Partial<InsertBlogPost> = {};
    if (post.title !== undefined) updateData.title = post.title;
    if (post.content !== undefined) updateData.content = post.content;
    if (post.imageUrl !== undefined) updateData.imageUrl = post.imageUrl;
    if (post.excerpt !== undefined) updateData.excerpt = post.excerpt;
    if (post.slug !== undefined) updateData.slug = post.slug;
    if (post.category !== undefined) updateData.category = post.category;
    if (post.featured !== undefined) updateData.featured = post.featured;
    if (post.readTime !== undefined) updateData.readTime = post.readTime;
    if (post.published !== undefined) updateData.published = post.published;
    if (Object.keys(updateData).length === 0) return this.getBlogPost(id);
    const result = await db.update(blogPosts).set(updateData).where(eq(blogPosts.id, id)).returning();
    return result[0];
  }

  async deleteBlogPost(id: number): Promise<boolean> {
    const db = requireDb();
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    return true;
  }

  async getPageContent(pageName: string): Promise<PageContent | undefined> {
    const db = requireDb();
    const result = await db.select().from(pages).where(eq(pages.pageName, pageName));
    if (!result[0]) return undefined;
    return { content: result[0].content as PageContent["content"] };
  }

  async updatePageContent(pageName: string, content: PageContent): Promise<PageContent> {
    const db = requireDb();
    const existing = await db.select().from(pages).where(eq(pages.pageName, pageName));
    if (existing[0]) {
      const result = await db.update(pages).set({ content: content.content }).where(eq(pages.pageName, pageName)).returning();
      return { content: result[0].content as PageContent["content"] };
    } else {
      const result = await db.insert(pages).values({ pageName, content: content.content }).returning();
      return { content: result[0].content as PageContent["content"] };
    }
  }
}

export const storage = new DatabaseStorage();