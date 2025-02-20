import { users, type User, type InsertUser } from "@shared/schema";
import { menuItems, type MenuItem, type InsertMenuItem } from "@shared/schema";
import { blogPosts, type BlogPost, type InsertBlogPost } from "@shared/schema";
import { sauces, type Sauce, type InsertSauce } from "@shared/schema";
import { aboutPage, type AboutPage, type InsertAboutPage } from "@shared/schema";
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

  // Sauce methods
  getAllSauces(): Promise<Sauce[]>;
  getSauce(id: number): Promise<Sauce | undefined>;
  createSauce(sauce: InsertSauce): Promise<Sauce>;
  updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined>;
  deleteSauce(id: number): Promise<boolean>;

  // About page methods
  getAboutPage(): Promise<AboutPage | undefined>;
  updateAboutPage(content: InsertAboutPage): Promise<AboutPage>;
}

export class DatabaseStorage implements IStorage {
  // Menu item methods with optimized querying and error handling
  async getAllMenuItems(): Promise<MenuItem[]> {
    try {
      return await db.select().from(menuItems).orderBy(menuItems.category);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      throw new Error("Failed to fetch menu items");
    }
  }

  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    try {
      const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
      return item;
    } catch (error) {
      console.error(`Error fetching menu item ${id}:`, error);
      throw new Error("Failed to fetch menu item");
    }
  }

  async createMenuItem(item: InsertMenuItem): Promise<MenuItem> {
    try {
      const [newItem] = await db
        .insert(menuItems)
        .values(item)
        .returning();
      return newItem;
    } catch (error) {
      console.error("Error creating menu item:", error);
      throw new Error("Failed to create menu item");
    }
  }

  async updateMenuItem(id: number, item: Partial<InsertMenuItem>): Promise<MenuItem | undefined> {
    try {
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

  // Sauce methods with optimized querying and error handling
  async getAllSauces(): Promise<Sauce[]> {
    try {
      return await db.select().from(sauces).orderBy(sauces.name);
    } catch (error) {
      console.error("Error fetching sauces:", error);
      throw new Error("Failed to fetch sauces");
    }
  }

  async getSauce(id: number): Promise<Sauce | undefined> {
    try {
      const [sauce] = await db.select().from(sauces).where(eq(sauces.id, id));
      return sauce;
    } catch (error) {
      console.error(`Error fetching sauce ${id}:`, error);
      throw new Error("Failed to fetch sauce");
    }
  }

  async createSauce(sauce: InsertSauce): Promise<Sauce> {
    try {
      const [newSauce] = await db
        .insert(sauces)
        .values(sauce)
        .returning();
      return newSauce;
    } catch (error) {
      console.error("Error creating sauce:", error);
      throw new Error("Failed to create sauce");
    }
  }

  async updateSauce(id: number, sauce: Partial<InsertSauce>): Promise<Sauce | undefined> {
    try {
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

  // Existing user methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(userData: InsertUser & { password: string }): Promise<User> {
    try {
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
    return await db.select().from(blogPosts).orderBy(blogPosts.createdAt);
  }

  async getBlogPost(id: number): Promise<BlogPost | undefined> {
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.id, id));
    return post;
  }

  async createBlogPost(post: InsertBlogPost & { authorId: number }): Promise<BlogPost> {
    try {
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
    const [updatedPost] = await db
      .update(blogPosts)
      .set(post)
      .where(eq(blogPosts.id, id))
      .returning();
    return updatedPost;
  }

  async deleteBlogPost(id: number): Promise<boolean> {
    const [deletedPost] = await db
      .delete(blogPosts)
      .where(eq(blogPosts.id, id))
      .returning();
    return !!deletedPost;
  }

  // About page methods
  async getAboutPage(): Promise<AboutPage | undefined> {
    try {
      const [page] = await db.select().from(aboutPage);
      if (page) {
        return {
          ...page,
          features: JSON.parse(page.features)
        };
      }
      return undefined;
    } catch (error) {
      console.error("Error fetching about page:", error);
      throw new Error("Failed to fetch about page");
    }
  }

  async updateAboutPage(content: InsertAboutPage): Promise<AboutPage> {
    try {
      // First try to get existing page
      const [existingPage] = await db.select().from(aboutPage);

      let updatedPage;
      if (existingPage) {
        // If page exists, update it
        [updatedPage] = await db
          .update(aboutPage)
          .set({
            ...content,
            features: JSON.stringify(content.features)
          })
          .where(eq(aboutPage.id, existingPage.id))
          .returning();
      } else {
        // If no page exists, create new one
        [updatedPage] = await db
          .insert(aboutPage)
          .values({
            ...content,
            features: JSON.stringify(content.features)
          })
          .returning();
      }

      return {
        ...updatedPage,
        features: JSON.parse(updatedPage.features)
      };
    } catch (error) {
      console.error("Error updating about page:", error);
      throw new Error("Failed to update about page");
    }
  }
}

export const storage = new DatabaseStorage();