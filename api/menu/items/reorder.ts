import { error, ok } from "../../../lib/api-response";
import { requireAdmin, requireAuth } from "../../../lib/auth";
import { storage } from "../../../lib/storage";

export const config = { runtime: "nodejs" };

interface ReorderPayload {
  itemIds: number[];
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createAuthResponseBridge(): Response {
  return new Response(null, { headers: new Headers() });
}

async function ensureAdmin(request: Request): Promise<Response | null> {
  const authBridge = createAuthResponseBridge();
  const authError = await requireAuth(request, authBridge);
  if (authError) return authError;
  return requireAdmin(request, authBridge);
}

function parsePayload(payload: unknown): ReorderPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const maybeItemIds = (payload as { itemIds?: unknown }).itemIds;
  if (!Array.isArray(maybeItemIds) || maybeItemIds.length === 0) return null;

  const parsed = maybeItemIds.map((value) => Number(value));
  if (parsed.some((value) => !Number.isInteger(value) || value <= 0)) return null;

  return { itemIds: parsed };
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  const adminError = await ensureAdmin(request);
  if (adminError) return adminError;

  try {
    const body = (await request.json()) as unknown;
    const payload = parsePayload(body);

    if (!payload) {
      return json(
        error("VALIDATION_FAILED", "Invalid item IDs. Expected a non-empty array of menu item IDs.", 400),
        400,
      );
    }

    const updated = await storage.reorderMenuItems(payload.itemIds);
    return json(ok(updated), 200);
  } catch {
    return json(error("REORDER_FAILED", "Failed to reorder menu items", 500), 500);
  }
}
