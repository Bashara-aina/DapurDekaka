import { error, ok } from "../../../lib/api-response";
import { requireAdmin } from "../../../lib/auth";
import { storage } from "../../../lib/storage";

export const config = { runtime: "nodejs" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  const adminGate = await requireAdmin(request, new Response());
  if (adminGate instanceof Response) return adminGate;

  try {
    const body = await request.json() as unknown;
    const maybeSauceIds = (body as { sauceIds?: unknown })?.sauceIds;
    if (!Array.isArray(maybeSauceIds) || maybeSauceIds.length === 0) {
      return json(error("VALIDATION_FAILED", "Invalid sauce IDs. Expected a non-empty array of sauce IDs.", 400), 400);
    }

    const parsed = maybeSauceIds.map((v: unknown) => Number(v));
    if (parsed.some((v: number) => !Number.isInteger(v) || v <= 0)) {
      return json(error("VALIDATION_FAILED", "All sauce IDs must be positive integers", 400), 400);
    }

    const updated = await storage.reorderSauces(parsed);
    return json(ok(updated), 200);
  } catch {
    return json(error("REORDER_FAILED", "Failed to reorder sauces", 500), 500);
  }
}