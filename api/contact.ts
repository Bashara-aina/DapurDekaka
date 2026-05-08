import { z } from "zod";
import { error, ok } from "../lib/api-response";

export const config = { runtime: "nodejs" };

const contactSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  message: z.string().min(1).max(2000),
  phone: z.string().optional(),
  subject: z.string().optional(),
});

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

  try {
    const payload = await request.json();
    const parsed = contactSchema.safeParse(payload);
    if (!parsed.success) {
      return json(error("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Invalid input", 400), 400);
    }

    return json(ok({ message: "Thank you for your message. We will get back to you soon." }), 200);
  } catch {
    return json(error("SERVER_ERROR", "Failed to submit form", 500), 500);
  }
}
