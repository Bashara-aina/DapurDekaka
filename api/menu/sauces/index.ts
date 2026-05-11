import { insertSauceSchema } from "@shared/schema";
import { created, error, ok } from "@lib/api-response";
import { requireAdmin, requireAuth } from "@lib/auth";
import { uploadFile } from "@lib/blob";
import { storage } from "@lib/storage";

export const config = { runtime: "nodejs" };

const CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

function json(body: unknown, status: number, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function createAuthResponseBridge(): Response {
  return new Response(null, { headers: new Headers() });
}

function getFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

async function ensureAdmin(request: Request): Promise<Response | { userId: number }> {
  const authBridge = createAuthResponseBridge();
  const authError = await requireAuth(request, authBridge);
  if (authError instanceof Response) return authError;
  return requireAdmin(request, authBridge);
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "GET") {
    try {
      const sauces = await storage.getAllSauces();
      return json(ok(sauces), 200, { "Cache-Control": CACHE_CONTROL });
    } catch {
      return json(error("FETCH_FAILED", "Failed to fetch sauces", 500), 500);
    }
  }

  if (request.method === "POST") {
    const adminError = await ensureAdmin(request);
    if (adminError instanceof Response) return adminError;

    try {
      const formData = await request.formData();
      const file = formData.get("imageFile");

      if (!(file instanceof File)) {
        return json(error("IMAGE_REQUIRED", "Image file is required", 400), 400);
      }

      const imageUrl = await uploadFile(file, "menu/sauces");
      const candidate = {
        name: (getFormString(formData, "name") ?? "") as string,
        description: (getFormString(formData, "description") ?? "") as string,
        price: (getFormString(formData, "price") ?? "0") as string,
        imageUrl: imageUrl as string,
      };

      const validation = insertSauceSchema.safeParse(candidate);
      if (!validation.success) {
        return json(error("VALIDATION_FAILED", validation.error.message, 400), 400);
      }

      const sauce = await storage.createSauce({
        name: validation.data.name,
        description: validation.data.description ?? "",
        price: validation.data.price ?? "0",
        imageUrl: validation.data.imageUrl,
      });
      return json(created(sauce), 201);
    } catch {
      return json(error("CREATE_FAILED", "Failed to create sauce", 500), 500);
    }
  }

  return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
}
