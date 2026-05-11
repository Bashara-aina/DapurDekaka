import { error, ok } from "../../../lib/api-response";
import { requireAdmin } from "../../../lib/auth";
import { uploadFile } from "../../../lib/blob";
import { storage } from "../../../lib/storage";

export const config = { runtime: "nodejs" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
  const auth = await requireAdmin(request, new Response());
  if (auth instanceof Response) return auth;

  try {
    const formData = await request.formData();
    const contentRaw = formData.get("content");
    if (typeof contentRaw !== "string") return json(error("VALIDATION_ERROR", "Missing content data", 400), 400);
    const contentObj = JSON.parse(contentRaw) as Record<string, unknown>;

    const mainImage = formData.get("mainImage");
    if (mainImage instanceof File && mainImage.size > 0) {
      contentObj.mainImage = await uploadFile(mainImage, "pages/contact");
    }

    const updated = await storage.updatePageContent("contact", { content: contentObj });
    return json(ok({ message: "Contact page updated successfully", content: updated }), 200);
  } catch {
    return json(error("SERVER_ERROR", "Failed to process file uploads", 500), 500);
  }
}
