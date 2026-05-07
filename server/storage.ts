
import multer from 'multer';
import path from 'path';
import * as fs from 'fs';
import { logger } from './utils/logger.js';

/**
 * Unified file size limit for all multer uploads across the application.
 * Ensures consistent upload limits regardless of which route handles the request.
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit shared across all file uploads

/**
 * Multer middleware configured for disk storage with unique filename generation.
 * Used by menu and blog routes for image uploads.
 */
export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      // Ensure uploads directory exists
      const dir = 'uploads/';
      if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

import { users, type User, type InsertUser } from "@shared/schema";
import { menuItems, type MenuItem, type InsertMenuItem } from "@shared/schema";
import { blogPosts, type BlogPost, type InsertBlogPost } from "@shared/schema";
import { sauces, type Sauce, type InsertSauce } from "@shared/schema";
import { pages, type Page, type PageContent } from "@shared/schema";
import { db } from "./db";
import { eq, and, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;

  // Blog post methods
  getAllBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost & { authorId: number; slug?: string; readTime?: number }): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost & { slug?: string; readTime?: number }>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: number): Promise<boolean>;
  reorderBlogPosts(postIds: number[]): Promise<BlogPost[]>;
  getPublishedBlogPosts(opts: { page?: number; limit?: number; category?: string; featured?: boolean; author?: string }): Promise<{ posts: BlogPost[]; total: number; totalPages: number }>;
  getRelatedBlogPosts(id: number, limit?: number): Promise<BlogPost[]>;

  // Menu item methods
  getAllMenuItems(): Promise<MenuItem[]>;
  getMenuItem(id: number): Promise<MenuItem | undefined>;
  createMenuItem(item: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined>;
  deleteMenuItem(id: number): Promise<boolean>;
  reorderMenuItems(itemIds: number[]): Promise<MenuItem[]>;

  // Sauce methods
  getAllSauces(): Promise<Sauce[]>;
  getSauce(id: number): Promise<Sauce | undefined>;
  createSauce(sauce: InsertSauce): Promise<Sauce>;
  updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined>;
  deleteSauce(id: number): Promise<boolean>;
  reorderSauces(sauceIds: number[]): Promise<Sauce[]>;

  // New page content methods
  getPageContent(pageName: string): Promise<PageContent | undefined>;
  updatePageContent(pageName: string, content: PageContent): Promise<PageContent>;
}

export class DatabaseStorage implements IStorage {
  /**
   * Retrieves all menu items ordered by their position index.
   * @throws Error if database query fails
   */
  async getAllMenuItems(): Promise<MenuItem[]> {
    try {
      logger.debug("Fetching all menu items");
      return await db.select().from(menuItems).orderBy(menuItems.orderIndex);
    } catch (error) {
      logger.error("Error fetching menu items", { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to fetch menu items");
    }
  }

  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    try {
      logger.debug(`Fetching menu item with ID: ${id}`);
      const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
      return item;
    } catch (error) {
      logger.error(`Error fetching menu item ${id}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to fetch menu item");
    }
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    try {
      logger.debug("Creating menu item", { name: item.name });

      // Validate image URL
      if (!item.imageUrl) {
        throw new Error("Image URL is required");
      }

      // Validate data before insertion
      if (!item.name || !item.description) {
        throw new Error("Name and description are required");
      }

      // Get current max orderIndex
      const allItems = await db.select().from(menuItems);
      const maxOrderIndex = allItems.length > 0
        ? Math.max(...allItems.map(item => item.orderIndex || 0))
        : -1;

      // Set the new item's orderIndex to maxOrderIndex + 1
      const itemWithOrder = {
        ...item,
        orderIndex: maxOrderIndex + 1
      };

      const [newItem] = await db
        .insert(menuItems)
        .values(itemWithOrder)
        .returning();

      if (!newItem) {
        throw new Error("Database insert failed - no item returned");
      }

      logger.info("Successfully created menu item", { id: newItem.id, name: newItem.name });
      return newItem;
    } catch (error) {
      logger.error("Error creating menu item", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  async updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    try {
      logger.debug(`Updating menu item ${id}`);
      const [updatedItem] = await db
        .update(menuItems)
        .set(item)
        .where(eq(menuItems.id, id))
        .returning();
      return updatedItem;
    } catch (error) {
      logger.error(`Error updating menu item ${id}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to update menu item");
    }
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    try {
      logger.debug(`Deleting menu item with ID: ${id}`);
      const [deletedItem] = await db
        .delete(menuItems)
        .where(eq(menuItems.id, id))
        .returning();
      return !!deletedItem;
    } catch (error) {
      logger.error(`Error deleting menu item ${id}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to delete menu item");
    }
  }
  
  /**
   * Updates the display order of menu items based on provided ID array.
   * Each item's orderIndex is set to its position in the array.
   */
  async reorderMenuItems(itemIds: number[]): Promise<MenuItem[]> {
    try {
      logger.debug("Reordering menu items", { count: itemIds.length });
      const updatedItems: MenuItem[] = [];

      // Update each item's orderIndex based on its position in the itemIds array
      for (let i = 0; i < itemIds.length; i++) {
        const [updatedItem] = await db
          .update(menuItems)
          .set({ orderIndex: i })
          .where(eq(menuItems.id, itemIds[i]))
          .returning();

        if (updatedItem) {
          updatedItems.push(updatedItem);
        }
      }

      return updatedItems;
    } catch (error) {
      logger.error("Error reordering menu items", { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to reorder menu items");
    }
  }

  /**
   * Retrieves all sauces ordered by their position index.
   * @throws Error if database query fails
   */
  async getAllSauces(): Promise<Sauce[]> {
    try {
      logger.debug("Fetching all sauces");
      return await db.select().from(sauces).orderBy(sauces.orderIndex);
    } catch (error) {
      logger.error("Error fetching sauces", { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to fetch sauces");
    }
  }

  /**
   * Retrieves a sauce by ID.
   * @throws Error if database query fails
   */
  async getSauce(id: number): Promise<Sauce | undefined> {
    try {
      logger.debug(`Fetching sauce with ID: ${id}`);
      const [sauce] = await db.select().from(sauces).where(eq(sauces.id, id));
      return sauce;
    } catch (error) {
      logger.error(`Error fetching sauce ${id}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to fetch sauce");
    }
  }

  /**
   * Creates a new sauce with auto-generated orderIndex.
   */
  async createSauce(sauce: InsertSauce): Promise<Sauce> {
    try {
      logger.debug("Creating sauce", { name: sauce.name });

      // Get current max orderIndex
      const allSauces = await db.select().from(sauces);
      const maxOrderIndex = allSauces.length > 0
        ? Math.max(...allSauces.map(sauce => sauce.orderIndex || 0))
        : -1;

      // Set the new sauce's orderIndex to maxOrderIndex + 1
      const sauceWithOrder = {
        ...sauce,
        orderIndex: maxOrderIndex + 1
      };

      const [newSauce] = await db
        .insert(sauces)
        .values(sauceWithOrder)
        .returning();
      logger.info("Successfully created sauce", { id: newSauce.id, name: newSauce.name });
      return newSauce;
    } catch (error) {
      logger.error("Error creating sauce", { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to create sauce");
    }
  }

  /**
   * Updates an existing sauce by ID.
   */
  async updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined> {
    try {
      logger.debug(`Updating sauce ${id}`);
      const [updatedSauce] = await db
        .update(sauces)
        .set(sauce)
        .where(eq(sauces.id, id))
        .returning();
      return updatedSauce;
    } catch (error) {
      logger.error(`Error updating sauce ${id}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to update sauce");
    }
  }

  /**
   * Deletes a sauce by ID.
   * @returns true if sauce was deleted, false if not found
   */
  async deleteSauce(id: number): Promise<boolean> {
    try {
      logger.debug(`Deleting sauce with ID: ${id}`);
      const [deletedSauce] = await db
        .delete(sauces)
        .where(eq(sauces.id, id))
        .returning();
      return !!deletedSauce;
    } catch (error) {
      logger.error(`Error deleting sauce ${id}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to delete sauce");
    }
  }

  /**
   * Updates the display order of sauces based on provided ID array.
   */
  async reorderSauces(sauceIds: number[]): Promise<Sauce[]> {
    try {
      logger.debug("Reordering sauces", { count: sauceIds.length });
      const updatedSauces: Sauce[] = [];

      // Update each sauce's orderIndex based on its position in the sauceIds array
      for (let i = 0; i < sauceIds.length; i++) {
        const [updatedSauce] = await db
          .update(sauces)
          .set({ orderIndex: i })
          .where(eq(sauces.id, sauceIds[i]))
          .returning();

        if (updatedSauce) {
          updatedSauces.push(updatedSauce);
        }
      }

      return updatedSauces;
    } catch (error) {
      logger.error("Error reordering sauces", { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to reorder sauces");
    }
  }

  /**
   * Retrieves a user by numeric ID.
   */
  async getUser(id: number): Promise<User | undefined> {
    logger.debug(`Fetching user with ID: ${id}`);
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  /**
   * Retrieves a user by username string for authentication.
   */
  async getUserByUsername(username: string): Promise<User | undefined> {
    logger.debug(`Fetching user with username: ${username}`);
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  /**
   * Creates a new user with hashed password.
   * Salt is generated and password is hashed before storage.
   */
  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    try {
      logger.debug("Creating user", { username: userData.username });
      const { password, ...rest } = userData;
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const [newUser] = await db
        .insert(users)
        .values({
          ...rest,
          passwordHash,
        })
        .returning();
      logger.info("Successfully created user", { id: newUser.id, username: newUser.username });
      return newUser;
    } catch (error) {
      logger.error("Error creating user", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Retrieves all blog posts ordered by their position index.
   */
  async getAllBlogPosts(): Promise<BlogPost[]> {
    logger.debug("Fetching all blog posts");
    return await db.select().from(blogPosts).orderBy(blogPosts.orderIndex);
  }

  /**
   * Retrieves published blog posts with pagination and filtering.
   */
  async getPublishedBlogPosts(opts: {
    page?: number;
    limit?: number;
    category?: string;
    featured?: boolean;
    author?: string;
  }): Promise<{ posts: BlogPost[]; total: number; totalPages: number }> {
    try {
      const page = Math.max(1, opts.page || 1);
      const limit = Math.min(100, Math.max(1, opts.limit || 10));
      const offset = (page - 1) * limit;

      logger.debug("Fetching published blog posts", { page, limit, category: opts.category, featured: opts.featured, author: opts.author });

      // Build dynamic filters
      const conditions = [eq(blogPosts.published, 1)];

      if (opts.category) {
        conditions.push(eq(blogPosts.category, opts.category));
      }
      if (opts.featured !== undefined) {
        conditions.push(eq(blogPosts.featured, opts.featured ? 1 : 0));
      }
      if (opts.author) {
        conditions.push(eq(blogPosts.authorName, opts.author));
      }

      // Get total count
      const allPosts = await db.select().from(blogPosts).where(and(...conditions));
      const total = allPosts.length;
      const totalPages = Math.ceil(total / limit);

      // Get paginated results, featured posts first, then by orderIndex
      const posts = await db
        .select()
        .from(blogPosts)
        .where(and(...conditions))
        .orderBy(blogPosts.featured, blogPosts.orderIndex)
        .limit(limit)
        .offset(offset);

      return { posts, total, totalPages };
    } catch (error) {
      logger.error("Error fetching published blog posts", { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to fetch published blog posts");
    }
  }

  /**
   * Retrieves related blog posts for a given post (same category, exclude current).
   */
  async getRelatedBlogPosts(id: number, limit: number = 3): Promise<BlogPost[]> {
    try {
      const currentPost = await this.getBlogPost(id);
      if (!currentPost) return [];

      logger.debug("Fetching related blog posts", { id, category: currentPost.category, limit });

      const conditions = [
        eq(blogPosts.published, 1),
        ne(blogPosts.id, id)
      ];

      if (currentPost.category) {
        conditions.push(eq(blogPosts.category, currentPost.category));
      }

      const related = await db
        .select()
        .from(blogPosts)
        .where(and(...conditions))
        .orderBy(blogPosts.orderIndex)
        .limit(limit);

      return related;
    } catch (error) {
      logger.error("Error fetching related blog posts", { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to fetch related blog posts");
    }
  }

  /**
   * Updates the display order of blog posts based on provided ID array.
   */
  async reorderBlogPosts(postIds: number[]): Promise<BlogPost[]> {
    try {
      logger.debug("Reordering blog posts", { count: postIds.length });
      const updatedPosts: BlogPost[] = [];

      // Update each post's orderIndex based on its position in the postIds array
      for (let i = 0; i < postIds.length; i++) {
        const [updatedPost] = await db
          .update(blogPosts)
          .set({ orderIndex: i })
          .where(eq(blogPosts.id, postIds[i]))
          .returning();

        if (updatedPost) {
          updatedPosts.push(updatedPost);
        }
      }

      return updatedPosts;
    } catch (error) {
      logger.error("Error reordering blog posts", { error: error instanceof Error ? error.message : String(error) });
      throw new Error("Failed to reorder blog posts");
    }
  }

  /**
   * Retrieves a single blog post by ID.
   */
  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    logger.debug(`Fetching blog post with ID: ${id}`);
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, id));
    return post;
  }

  /**
   * Creates a new blog post with auto-generated orderIndex.
   */
  async createBlogPost(post: InsertBlogPost & { authorId: number; slug?: string; readTime?: number }): Promise<BlogPost> {
    try {
      logger.debug("Creating blog post", { title: post.title });

      // Get current max orderIndex for blog posts
      const allPosts = await db.select().from(blogPosts);
      const maxOrderIndex = allPosts.length > 0
        ? Math.max(...allPosts.map(post => post.orderIndex || 0))
        : -1;

      // Set the new post's orderIndex to maxOrderIndex + 1
      const postWithOrder = {
        ...post,
        orderIndex: maxOrderIndex + 1
      };

      const [newPost] = await db
        .insert(blogPosts)
        .values(postWithOrder)
        .returning();
      logger.info("Successfully created blog post", { id: newPost.id, title: newPost.title });
      return newPost;
    } catch (error) {
      logger.error("Error creating blog post", { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Updates an existing blog post by ID.
   */
  async updateBlogPost(id: number, post: Partial<InsertBlogPost & { slug?: string; readTime?: number }>): Promise<BlogPost | undefined> {
    logger.debug(`Updating blog post ${id}`);
    const [updatedPost] = await db
      .update(blogPosts)
      .set(post)
      .where(eq(blogPosts.id, id))
      .returning();
    return updatedPost;
  }

  /**
   * Deletes a blog post by ID.
   * @returns true if post was deleted, false if not found
   */
  async deleteBlogPost(id: number): Promise<boolean> {
    logger.debug(`Deleting blog post with ID: ${id}`);
    const [deletedPost] = await db
      .delete(blogPosts)
      .where(eq(blogPosts.id, id))
      .returning();
    return !!deletedPost;
  }


  // Page content methods
  /**
   * Retrieves page content by pageName.
   * @returns PageContent with parsed JSON content, or undefined if not found
   */
  async getPageContent(pageName: string): Promise<PageContent | undefined> {
    try {
      logger.debug(`Fetching page content for ${pageName}`);
      const [page] = await db
        .select()
        .from(pages)
        .where(eq(pages.pageName, pageName));

      if (page) {
        return { content: JSON.parse(page.content) };
      }
      return undefined;
    } catch (error) {
      logger.error(`Error fetching page content for ${pageName}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to fetch page content for ${pageName}`);
    }
  }

  /**
   * Creates or updates page content by pageName.
   * Content object is JSON-stringified before storage.
   */
  async updatePageContent(pageName: string, content: PageContent): Promise<PageContent> {
    try {
      logger.debug(`Updating page content for ${pageName}`);
      const [page] = await db
        .select()
        .from(pages)
        .where(eq(pages.pageName, pageName));

      let updatedPage;
      if (page) {
        [updatedPage] = await db
          .update(pages)
          .set({
            content: JSON.stringify(content.content)
          })
          .where(eq(pages.pageName, pageName))
          .returning();
      } else {
        [updatedPage] = await db
          .insert(pages)
          .values({
            pageName,
            content: JSON.stringify(content.content)
          })
          .returning();
      }

      return { content: JSON.parse(updatedPage.content) };
    } catch (error) {
      logger.error(`Error updating page content for ${pageName}`, { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to update page content for ${pageName}`);
    }
  }
}

export const storage = new DatabaseStorage();