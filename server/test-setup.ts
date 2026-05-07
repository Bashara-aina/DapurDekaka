/**
 * Test setup utilities for Vitest
 * Provides mocks for storage, db, and other shared modules
 */
import { vi } from "vitest";
import type { IStorage } from "./storage";
import type { User, MenuItem, BlogPost, Sauce, PageContent } from "@shared/schema";

// Mock user for auth tests
export const mockUser: User = {
  id: 1,
  username: "testuser",
  email: "test@example.com",
  passwordHash: "hashedpassword",
  role: "customer",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock admin user
export const mockAdminUser: User = {
  id: 2,
  username: "admin",
  email: "admin@example.com",
  passwordHash: "hashedpassword",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock menu items
export const mockMenuItems: MenuItem[] = [
  {
    id: 1,
    name: "Siomay",
    description: "Steamed fish dumpling",
    price: "25000",
    imageUrl: "/uploads/siomay.jpg",
    orderIndex: 0,
    createdAt: new Date(),
  },
  {
    id: 2,
    name: "Hakau",
    description: "Shrimp dumpling",
    price: "28000",
    imageUrl: "/uploads/hakau.jpg",
    orderIndex: 1,
    createdAt: new Date(),
  },
];

// Mock blog posts
export const mockBlogPosts: BlogPost[] = [
  {
    id: 1,
    title: "Test Post",
    content: "Test content",
    excerpt: "Test excerpt",
    authorName: "Test Author",
    slug: "test-post",
    category: "general",
    featured: 0,
    readTime: 5,
    imageUrl: "/uploads/post1.jpg",
    authorId: 1,
    published: 1,
    orderIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock sauces
export const mockSauces: Sauce[] = [
  {
    id: 1,
    name: "Chili Sauce",
    description: "Spicy sauce",
    price: "5000",
    imageUrl: "/uploads/sauce1.jpg",
    orderIndex: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

/**
 * Creates a mock IStorage implementation
 */
export function createMockStorage(overrides?: Partial<IStorage>): IStorage {
  const storageMock: IStorage = {
    getUser: vi.fn(),
    getUserByUsername: vi.fn(),
    createUser: vi.fn(),
    getAllBlogPosts: vi.fn(),
    getBlogPost: vi.fn(),
    createBlogPost: vi.fn(),
    updateBlogPost: vi.fn(),
    deleteBlogPost: vi.fn(),
    reorderBlogPosts: vi.fn(),
    getAllMenuItems: vi.fn(),
    getMenuItem: vi.fn(),
    createMenuItem: vi.fn(),
    updateMenuItem: vi.fn(),
    deleteMenuItem: vi.fn(),
    reorderMenuItems: vi.fn(),
    getAllSauces: vi.fn(),
    getSauce: vi.fn(),
    createSauce: vi.fn(),
    updateSauce: vi.fn(),
    deleteSauce: vi.fn(),
    reorderSauces: vi.fn(),
    getPageContent: vi.fn(),
    updatePageContent: vi.fn(),
    getPublishedBlogPosts: vi.fn(),
    getRelatedBlogPosts: vi.fn(),
    ...overrides,
  };

  return storageMock;
}

/**
 * Creates a mock Express Request object
 */
export function createMockRequest(overrides?: Record<string, unknown>) {
  return {
    session: { userId: undefined as number | undefined },
    body: {},
    params: {},
    query: {},
    headers: {},
    file: undefined,
    files: undefined,
    ...overrides,
  } as unknown as Record<string, unknown>;
}

/**
 * Creates a mock Express Response object
 */
export function createMockResponse() {
  const res: Record<string, unknown> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res as unknown as {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

/**
 * Creates a mock Express NextFunction
 */
export function createMockNext() {
  return vi.fn();
}

/**
 * Setup mock for storage module
 */
export function setupStorageMock(overrides?: Partial<IStorage>) {
  const mock = createMockStorage(overrides);
  vi.mocked(mock.getUser).mockResolvedValue(mockUser);
  vi.mocked(mock.getAllMenuItems).mockResolvedValue(mockMenuItems);
  vi.mocked(mock.getMenuItem).mockResolvedValue(mockMenuItems[0]);
  vi.mocked(mock.getAllBlogPosts).mockResolvedValue(mockBlogPosts);
  vi.mocked(mock.getBlogPost).mockResolvedValue(mockBlogPosts[0]);
  vi.mocked(mock.getAllSauces).mockResolvedValue(mockSauces);
  return mock;
}

/**
 * Reset all mocks after each test
 */
export function resetAllMocks() {
  vi.restoreAllMocks();
}
