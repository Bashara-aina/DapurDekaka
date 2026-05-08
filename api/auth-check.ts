import { error, ok } from "../lib/api-response";
import { storage } from "../lib/storage";
import { getSession } from "../lib/session";

export const config = { runtime: "nodejs" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return json(error("METHOD_NOT_ALLOWED", "Method not allowed", 405), 405);
  }

  try {
    const response = json(ok({ authenticated: false }), 200);
    const session = await getSession(request, response);
    if (!session.userId) {
      return response;
    }

    const user = await storage.getUser(session.userId);
    if (!user) {
      session.userId = undefined;
      await session.save();
      return response;
    }

    return json(ok({ authenticated: true }), 200);
  } catch {
    return json(error("AUTH_CHECK_FAILED", "Auth check failed", 500), 500);
  }
}
