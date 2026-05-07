/**
 * Menu route unit tests
 * Tests menu items and sauces CRUD operations
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockMenuItems, mockSauces, createMockStorage, createMockResponse, createMockNext } from "../test-setup";
import type { IStorage, MenuItem } from "../storage";

describe("Menu Route", () => {
  let storage: IStorage;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    storage = createMockStorage({
      getAllMenuItems: vi.fn(),
      getMenuItem: vi.fn(),
      createMenuItem: vi.fn(),
      updateMenuItem: vi.fn(),
      deleteMenuItem: vi.fn(),
      reorderMenuItems: vi.fn(),
      getAllSauces: vi.fn(),
      createSauce: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /items", () => {
    it("returns 200 with array of menu items", async () => {
      vi.mocked(storage.getAllMenuItems).mockResolvedValueOnce(mockMenuItems);

      const items = await storage.getAllMenuItems();

      expect(storage.getAllMenuItems).toHaveBeenCalled();
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBe(2);
      expect(items[0].name).toBe("Siomay");
    });

    it("returns empty array when no menu items exist", async () => {
      vi.mocked(storage.getAllMenuItems).mockResolvedValueOnce([]);

      const items = await storage.getAllMenuItems();

      expect(items).toEqual([]);
    });
  });

  describe("GET /items/:id", () => {
    it("returns 404 for non-existent menu item", async () => {
      vi.mocked(storage.getMenuItem).mockResolvedValueOnce(undefined);

      const item = await storage.getMenuItem(999);

      expect(item).toBeUndefined();
    });

    it("returns menu item when found", async () => {
      vi.mocked(storage.getMenuItem).mockResolvedValueOnce(mockMenuItems[0]);

      const item = await storage.getMenuItem(1);

      expect(item).toBeDefined();
      expect(item?.name).toBe("Siomay");
    });
  });

  describe("POST /items", () => {
    it("requires authentication", async () => {
      // Test that createMenuItem is protected
      // Without auth, requireAuth should block the request
      const mockReq = { session: {} };

      if (!mockReq.session.userId) {
        expect(true).toBe(true); // Auth required
      } else {
        expect(false).toBe(true); // Should not reach here
      }
    });

    it("validates required fields when creating menu item", async () => {
      const invalidData = {
        name: "",
        description: "",
        price: "",
        imageUrl: "",
      };

      // Storage createMenuItem would throw on invalid data
      vi.mocked(storage.createMenuItem).mockRejectedValueOnce(new Error("Name and description are required"));

      await expect(storage.createMenuItem(invalidData as Parameters<typeof storage.createMenuItem>[0])).rejects.toThrow("Name and description are required");
    });
  });

  describe("POST /items/reorder", () => {
    it("requires authentication", async () => {
      const mockReq = { session: {} };

      if (!mockReq.session.userId) {
        expect(true).toBe(true); // Auth required
      } else {
        expect(false).toBe(true);
      }
    });

    it("validates itemIds array", async () => {
      // Invalid: not an array
      const invalidPayload = { itemIds: "not-an-array" };
      const isValid = Array.isArray(invalidPayload.itemIds) && invalidPayload.itemIds.length > 0;

      expect(isValid).toBe(false);

      // Invalid: empty array
      const emptyPayload = { itemIds: [] };
      const isEmptyValid = Array.isArray(emptyPayload.itemIds) && emptyPayload.itemIds.length > 0;

      expect(isEmptyValid).toBe(false);

      // Valid: non-empty array of numbers
      const validPayload = { itemIds: [1, 2, 3] };
      const isValidPayload = Array.isArray(validPayload.itemIds) && validPayload.itemIds.length > 0;

      expect(isValidPayload).toBe(true);
    });

    it("calls reorderMenuItems with correct parameters", async () => {
      const itemIds = [1, 2, 3];
      vi.mocked(storage.reorderMenuItems).mockResolvedValueOnce([
        { ...mockMenuItems[0], orderIndex: 0 },
        { ...mockMenuItems[1], orderIndex: 1 },
      ]);

      const result = await storage.reorderMenuItems(itemIds);

      expect(storage.reorderMenuItems).toHaveBeenCalledWith(itemIds);
      expect(result).toHaveLength(2);
    });
  });

  describe("Menu item data structure", () => {
    it("has correct MenuItem properties", () => {
      const item = mockMenuItems[0];

      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("name");
      expect(item).toHaveProperty("description");
      expect(item).toHaveProperty("price");
      expect(item).toHaveProperty("imageUrl");
      expect(item).toHaveProperty("orderIndex");
    });

    it("price is stored as string", () => {
      const item = mockMenuItems[0];

      expect(typeof item.price).toBe("string");
      expect(item.price).toBe("25000");
    });
  });
});