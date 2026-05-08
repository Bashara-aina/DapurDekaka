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
  if (auth) return auth;

  try {
    const formData = await request.formData();
    const contentRaw = formData.get("content");
    if (typeof contentRaw !== "string") return json(error("VALIDATION_FAILED", "Missing content data", 400), 400);
    const contentObj = JSON.parse(contentRaw) as Record<string, unknown>;
    const mainImage = formData.get("mainImage");
    if (mainImage instanceof File && mainImage.size > 0) {
      contentObj.mainImage = await uploadFile(mainImage, "pages/about");
    }
    const updatedContent = await storage.updatePageContent("about", { content: contentObj });
    return json(ok({ content: updatedContent }), 200);
  } catch {
    return json(error("UPLOAD_FAILED", "Failed to process file uploads", 500), 500);
  }
}
