import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Keep existing tables
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sauces = pgTable("sauces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  authorId: integer("author_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  published: integer("published").default(0),
});

export const footer = pgTable('footer',{
  id: serial('id').primaryKey(),
  address: text('address').notNull(),
  phone: text('phone').notNull()
});

// Simplified about page schema
export const pages = pgTable('pages', {
  id: serial('id').primaryKey(),
  pageName: text('page_name').notNull(),
  content: text('content').notNull(), // Will store JSON stringified content
});

// Keep existing schemas
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({
  id: true,
  createdAt: true,
});

export const insertSauceSchema = createInsertSchema(sauces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users)
  .pick({
    username: true,
    email: true,
  })
  .extend({
    password: z.string().min(8, "Password must be at least 8 characters"),
  });

export const insertBlogPostSchema = createInsertSchema(blogPosts)
  .pick({
    title: true,
    content: true,
  })
  .extend({
    published: z.number().optional().default(0),
    imageUrl: z.string().optional(),
  });

// New page content schema
export const pageContentSchema = z.object({
  content: z.object({
    title: z.string(),
    description: z.string(),
    mainImage: z.string(),
    mainDescription: z.string(),
    sections: z.array(z.object({
      title: z.string(),
      description: z.string()
    })),
    features: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      image: z.string()
    }))
  })
});

// Keep existing type exports
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type MenuItem = typeof menuItems.$inferSelect;

export type InsertSauce = z.infer<typeof insertSauceSchema>;
export type Sauce = typeof sauces.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

export type PageContent = z.infer<typeof pageContentSchema>;
export type Page = typeof pages.$inferSelect;