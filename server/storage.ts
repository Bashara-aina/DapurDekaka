
import multer from 'multer';
import path from 'path';

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      // Ensure uploads directory exists
      const fs = require('fs');
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
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

import { users, type User, type InsertUser } from "@shared/schema";
import { menuItems, type MenuItem, type InsertMenuItem } from "@shared/schema";
import { blogPosts, type BlogPost, type InsertBlogPost } from "@shared/schema";
import { sauces, type Sauce, type InsertSauce } from "@shared/schema";
import { pages, type Page, type PageContent } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;

  // Blog post methods
  getAllBlogPosts(): Promise<BlogPost[]>;
  getBlogPost(id: number): Promise<BlogPost | undefined>;
  createBlogPost(post: InsertBlogPost & { authorId: number }): Promise<BlogPost>;
  updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost | undefined>;
  deleteBlogPost(id: number): Promise<boolean>;

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
  // Menu item methods with optimized querying and error handling
  async getAllMenuItems(): Promise<MenuItem[]> {
    try {
      console.log("Fetching all menu items");
      return await db.select().from(menuItems).orderBy(menuItems.orderIndex);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      throw new Error("Failed to fetch menu items");
    }
  }

  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    try {
      console.log(`Fetching menu item with ID: ${id}`);
      const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
      return item;
    } catch (error) {
      console.error(`Error fetching menu item ${id}:`, error);
      throw new Error("Failed to fetch menu item");
    }
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    try {
      console.log("Creating menu item with data:", item);
      
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

      console.log("Successfully created menu item:", newItem);
      return newItem;
    } catch (error) {
      console.error("Detailed error creating menu item:", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        item
      });
      throw error;
    }
  }

  async updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    try {
      console.log(`Updating menu item ${id} with data:`, item);
      const [updatedItem] = await db
        .update(menuItems)
        .set(item)
        .where(eq(menuItems.id, id))
        .returning();
      return updatedItem;
    } catch (error) {
      console.error(`Error updating menu item ${id}:`, error);
      throw new Error("Failed to update menu item");
    }
  }

  async deleteMenuItem(id: number): Promise<boolean> {
    try {
      console.log(`Deleting menu item with ID: ${id}`);
      const [deletedItem] = await db
        .delete(menuItems)
        .where(eq(menuItems.id, id))
        .returning();
      return !!deletedItem;
    } catch (error) {
      console.error(`Error deleting menu item ${id}:`, error);
      throw new Error("Failed to delete menu item");
    }
  }
  
  async reorderMenuItems(itemIds: number[]): Promise<MenuItem[]> {
    try {
      console.log("Reordering menu items with IDs:", itemIds);
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
      console.error("Error reordering menu items:", error);
      throw new Error("Failed to reorder menu items");
    }
  }

  // Sauce methods with optimized querying and error handling
  async getAllSauces(): Promise<Sauce[]> {
    try {
      console.log("Fetching all sauces");
      return await db.select().from(sauces).orderBy(sauces.orderIndex);
    } catch (error) {
      console.error("Error fetching sauces:", error);
      throw new Error("Failed to fetch sauces");
    }
  }

  async getSauce(id: number): Promise<Sauce | undefined> {
    try {
      console.log(`Fetching sauce with ID: ${id}`);
      const [sauce] = await db.select().from(sauces).where(eq(sauces.id, id));
      return sauce;
    } catch (error) {
      console.error(`Error fetching sauce ${id}:`, error);
      throw new Error("Failed to fetch sauce");
    }
  }

  async createSauce(sauce: InsertSauce): Promise<Sauce> {
    try {
      console.log("Creating sauce with data:", sauce);
      
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
      return newSauce;
    } catch (error) {
      console.error("Error creating sauce:", error);
      throw new Error("Failed to create sauce");
    }
  }

  async updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined> {
    try {
      console.log(`Updating sauce ${id} with data:`, sauce);
      const [updatedSauce] = await db
        .update(sauces)
        .set(sauce)
        .where(eq(sauces.id, id))
        .returning();
      return updatedSauce;
    } catch (error) {
      console.error(`Error updating sauce ${id}:`, error);
      throw new Error("Failed to update sauce");
    }
  }

  async deleteSauce(id: number): Promise<boolean> {
    try {
      console.log(`Deleting sauce with ID: ${id}`);
      const [deletedSauce] = await db
        .delete(sauces)
        .where(eq(sauces.id, id))
        .returning();
      return !!deletedSauce;
    } catch (error) {
      console.error(`Error deleting sauce ${id}:`, error);
      throw new Error("Failed to delete sauce");
    }
  }
  
  async reorderSauces(sauceIds: number[]): Promise<Sauce[]> {
    try {
      console.log("Reordering sauces with IDs:", sauceIds);
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
      console.error("Error reordering sauces:", error);
      throw new Error("Failed to reorder sauces");
    }
  }

  // Existing user methods
  async getUser(id: number): Promise<User | undefined> {
    console.log(`Fetching user with ID: ${id}`);
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log(`Fetching user with username: ${username}`);
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    try {
      console.log("Creating user with data:", userData);
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
      return newUser;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  // Blog post methods
  async getAllBlogPosts(): Promise<BlogPost[]> {
    console.log("Fetching all blog posts");
    return await db.select().from(blogPosts).orderBy(blogPosts.createdAt);
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    console.log(`Fetching blog post with ID: ${id}`);
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, id));
    return post;
  }

  async createBlogPost(post: InsertBlogPost & { authorId: number }): Promise<BlogPost> {
    try {
      console.log("Creating blog post with data:", post);
      const [newPost] = await db
        .insert(blogPosts)
        .values(post)
        .returning();
      return newPost;
    } catch (error) {
      console.error("Error creating blog post:", error);
      throw error;
    }
  }

  async updateBlogPost(id: number, post: Partial<InsertBlogPost>): Promise<BlogPost | undefined> {
    console.log(`Updating blog post ${id} with data:`, post);
    const [updatedPost] = await db
      .update(blogPosts)
      .set(post)
      .where(eq(blogPosts.id, id))
      .returning();
    return updatedPost;
  }

  async deleteBlogPost(id: number): Promise<boolean> {
    console.log(`Deleting blog post with ID: ${id}`);
    const [deletedPost] = await db
      .delete(blogPosts)
      .where(eq(blogPosts.id, id))
      .returning();
    return !!deletedPost;
  }


  // Page content methods
  async getPageContent(pageName: string): Promise<PageContent | undefined> {
    try {
      console.log(`Fetching page content for ${pageName}`);
      const [page] = await db
        .select()
        .from(pages)
        .where(eq(pages.pageName, pageName));

      if (page) {
        return { content: JSON.parse(page.content) };
      }
      return undefined;
    } catch (error) {
      console.error(`Error fetching page content for ${pageName}:`, error);
      throw new Error(`Failed to fetch page content for ${pageName}`);
    }
  }

  async updatePageContent(pageName: string, content: PageContent): Promise<PageContent> {
    try {
      console.log(`Updating page content for ${pageName} with data:`, content);
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
      console.error(`Error updating page content for ${pageName}:`, error);
      throw new Error(`Failed to update page content for ${pageName}`);
    }
  }
}

export const storage = new DatabaseStorage();