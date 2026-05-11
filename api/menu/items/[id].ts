import { insertMenuItemSchema } from "@shared/schema";
import { error, ok } from "@lib/api-response";
import { requireAdmin } from "@lib/auth";
import { uploadFile } from "@lib/blob";
import { storage } from "@lib/storage";

export const config = { runtime: "nodejs" };

const CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

function json(body: unknown, status: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { status, headers });
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function parseIdFromPathname(pathname: string): number | null {
  const segments = pathname.split("/").filter(Boolean);
  const rawId = segments.at(-1);
  if (!rawId) return null;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = parseIdFromPathname(url.pathname);
  if (id === null) return json(error("INVALID_ID", "Invalid menu item ID", 400), 400);

  if (request.method === "GET") {
    try {
      const item = await storage.getMenuItem(id);
      if (!item) return json(error("NOT_FOUND", "Menu item not found", 404), 404);
      return json(ok(item), 200, { "Cache-Control": CACHE_CONTROL });
    } catch {
      return json(error("FETCH_FAILED", "Failed to fetch menu item", 500), 500);
    }
  }

  if (request.method === "PUT") {
    const adminGate = await requireAdmin(request, new Response());
    if (adminGate instanceof Response) return adminGate;

    try {
      const existing = await storage.getMenuItem(id);
      if (!existing) return json(error("NOT_FOUND", "Menu item not found", 404), 404);

      const formData = await request.formData();
      const file = formData.get("imageFile");
      const imageUrl = file instanceof File ? await uploadFile(file, "menu/items") : getFormString(formData, "imageUrl");

      const candidate = {
        name: getFormString(formData, "name") ?? "",
        description: getFormString(formData, "description") ?? "",
        price: getFormString(formData, "price") ?? "0",
        imageUrl: imageUrl ?? "",
      };

      const validation = insertMenuItemSchema.partial().omit({ orderIndex: true }).safeParse(candidate);
      if (!validation.success) return json(error("VALIDATION_FAILED", validation.error.message, 400), 400);

      const updated = await storage.updateMenuItem(id, validation.data);
      if (!updated) return json(error("NOT_FOUND", "Menu item not found", 404), 404);

      return json(ok(updated), 200);
    } catch {
      return json(error("UPDATE_FAILED", "Failed to update menu item", 500), 500);
    }
  }

  if (request.method === "DELETE") {
    const adminGate = await requireAdmin(request, new Response());
    if (adminGate instanceof Response) return adminGate;

    try {
      const success = await storage.deleteMenuItem(id);
      if (!success) return json(error("NOT_FOUND", "Menu item not found", 404), 404);
      return new Response(null, { status: 204 });
    } catch {
      return json(error("DELETE_FAILED", "Failed to delete menu item", 500), 500);
    }
  }

  return new Response(null, { status: 405, headers: { Allow: "GET, PUT, DELETE" } });
}