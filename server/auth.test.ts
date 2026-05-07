/**
 * Auth middleware unit tests
 * Tests requireAuth middleware for route protection
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockUser, createMockStorage, createMockResponse, createMockNext } from "./test-setup";
import type { IStorage } from "./storage";

describe("Auth Middleware", () => {
  let requireAuth: (req: Record<string, unknown>, res: Record<string, unknown>, next: () => void) => Promise<void>;
  let storage: IStorage;
  let mockReq: Record<string, unknown>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: () => void;

  beforeEach(async () => {
    vi.resetModules();

    // Mock the storage module before requiring auth
    storage = createMockStorage();

    vi.doMock("./storage", () => ({
      storage,
    }));

    // Import requireAuth after mocking
    const authModule = await import("./auth");
    requireAuth = authModule.requireAuth;

    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("requireAuth middleware", () => {
    it("returns 401 when no session userId is present", async () => {
      mockReq = {
        session: {},
      };

      await requireAuth(mockReq, mockRes as unknown as Record<string, unknown>, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining("Unauthorized") })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("returns 401 when session has userId but user not found in DB", async () => {
      mockReq = {
        session: { userId: 999 },
      };

      vi.mocked(storage.getUser).mockResolvedValueOnce(undefined);

      await requireAuth(mockReq, mockRes as unknown as Record<string, unknown>, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "User not found" })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("calls next() when valid session with existing user", async () => {
      mockReq = {
        session: { userId: 1 },
      };

      vi.mocked(storage.getUser).mockResolvedValueOnce(mockUser);

      await requireAuth(mockReq, mockRes as unknown as Record<string, unknown>, mockNext);

      expect(storage.getUser).toHaveBeenCalledWith(1);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("returns 500 on storage error", async () => {
      mockReq = {
        session: { userId: 1 },
      };

      vi.mocked(storage.getUser).mockRejectedValueOnce(new Error("DB connection failed"));

      await requireAuth(mockReq, mockRes as unknown as Record<string, unknown>, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Authentication error" })
      );
    });
  });
});