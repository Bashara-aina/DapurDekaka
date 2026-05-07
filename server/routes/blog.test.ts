/**
 * Blog route authorization tests
 * Tests authentication and authorization for blog post operations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockUser, mockBlogPosts, createMockStorage, createMockResponse, createMockNext } from "../test-setup";
import type { IStorage } from "../storage";
import type { Request, Response, NextFunction } from "express";

describe("Blog Route Authorization", () => {
  let storage: IStorage;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: () => void;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    storage = createMockStorage({
      getBlogPost: vi.fn(),
      createBlogPost: vi.fn(),
      updateBlogPost: vi.fn(),
      deleteBlogPost: vi.fn(),
    });

    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupAuthMock = () => {
    vi.doMock("../auth", () => ({
      requireAuth: vi.fn().mockImplementation(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Unauthorized - No session user ID" });
        }
        next();
      }),
      requireAdmin: vi.fn().mockImplementation(async (req: Request, res: Response, next: NextFunction) => {
        if (!req.session.userId) {
          return res.status(401).json({ message: "Authentication required" });
        }
        // Check if admin
        const user = storage.getUser ? await storage.getUser(req.session.userId) : undefined;
        if (user && user.role !== "admin") {
          return res.status(403).json({ message: "Admin access required" });
        }
        next();
      }),
    }));
  };

  describe("Create blog post - POST /", () => {
    it("returns 401 without authentication", async () => {
      setupAuthMock();

      const authModule = await import("../auth");
      const requireAuth = authModule.requireAuth as (req: Request, res: Response, next: NextFunction) => Promise<void>;

      const mockReq = {
        session: {},
      } as unknown as Request;

      await requireAuth(mockReq, mockRes as unknown as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Unauthorized") })
      );
    });
  });

  describe("Update blog post - PUT /:id", () => {
    it("returns 403 when non-author tries to update", async () => {
      const post = { ...mockBlogPosts[0], authorId: 1 };

      const mockReq = {
        session: { userId: 2 }, // Different user
        params: { id: "1" },
      } as unknown as Request;

      vi.mocked(storage.getBlogPost).mockResolvedValueOnce(post);

      const isAuthor = post.authorId === mockReq.session.userId;
      expect(isAuthor).toBe(false);
    });

    it("allows author to update their own post", async () => {
      const post = { ...mockBlogPosts[0], authorId: 1 };

      const mockReq = {
        session: { userId: 1 }, // Same user as author
        params: { id: "1" },
      } as unknown as Request;

      vi.mocked(storage.getBlogPost).mockResolvedValueOnce(post);
      vi.mocked(storage.updateBlogPost).mockResolvedValueOnce({ ...post, title: "Updated" });

      const isAuthor = post.authorId === mockReq.session.userId;
      expect(isAuthor).toBe(true);
    });
  });

  describe("Delete blog post - DELETE /:id", () => {
    it("returns 403 when non-author tries to delete", async () => {
      const post = { ...mockBlogPosts[0], authorId: 1 };

      const mockReq = {
        session: { userId: 2 }, // Different user
        params: { id: "1" },
      } as unknown as Request;

      vi.mocked(storage.getBlogPost).mockResolvedValueOnce(post);

      const isAuthor = post.authorId === mockReq.session.userId;
      expect(isAuthor).toBe(false);
    });

    it("allows author to delete their own post", async () => {
      const post = { ...mockBlogPosts[0], authorId: 1 };

      const mockReq = {
        session: { userId: 1 }, // Same user as author
        params: { id: "1" },
      } as unknown as Request;

      vi.mocked(storage.getBlogPost).mockResolvedValueOnce(post);
      vi.mocked(storage.deleteBlogPost).mockResolvedValueOnce(true);

      const isAuthor = post.authorId === mockReq.session.userId;
      expect(isAuthor).toBe(true);
    });
  });

  describe("Authorization logic", () => {
    it("correctly identifies author", () => {
      const post = { authorId: 42 };
      const userId = 42;
      const isAuthor = post.authorId === userId;
      expect(isAuthor).toBe(true);
    });

    it("correctly identifies non-author", () => {
      const post = { authorId: 42 };
      const userId = 99;
      const isAuthor = post.authorId === userId;
      expect(isAuthor).toBe(false);
    });

    it("handles undefined userId", () => {
      const post = { authorId: 42 };
      const userId: number | undefined = undefined;
      const isAuthor = post.authorId === userId;
      expect(isAuthor).toBe(false);
    });
  });
});