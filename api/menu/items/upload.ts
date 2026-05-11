import { error, ok } from "../../../lib/api-response";
import { requireAdmin } from "../../../lib/auth";
import { uploadFile } from "../../../lib/blob";

export const config = { runtime: "nodejs" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
  }

  const sessionResponse = new Response();
  const auth = await requireAdmin(request, sessionResponse);
  if (auth instanceof Response) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("imageFile");
    if (!(file instanceof File) || file.size <= 0) {
      return json(error("VALIDATION_FAILED", "Image file is required", 400), 400);
    }

    const imageUrl = await uploadFile(file, "menu/items");
    return json(ok({ imageUrl }), 200);
  } catch {
    return json(error("UPLOAD_FAILED", "Failed to upload image", 500), 500);
  }
}
