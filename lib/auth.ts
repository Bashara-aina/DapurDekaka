import { storage } from "./storage";
import { getSession } from "./session";
import { error } from "./api-response";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function requireAuth(request: Request, response: Response): Promise<Response | null> {
  const session = await getSession(request, response);
  if (!session.userId) {
    return jsonResponse(error("UNAUTHORIZED", "Authentication required", 401), 401);
  }

  const user = await storage.getUser(session.userId);
  if (!user) {
    return jsonResponse(error("UNAUTHORIZED", "Authentication required", 401), 401);
  }

  return null;
}

export async function requireAdmin(request: Request, response: Response): Promise<Response | null> {
  const session = await getSession(request, response);
  if (!session.userId) {
    return jsonResponse(error("UNAUTHORIZED", "Authentication required", 401), 401);
  }

  const user = await storage.getUser(session.userId);
  if (!user) {
    return jsonResponse(error("UNAUTHORIZED", "Authentication required", 401), 401);
  }

  if (user.role !== "admin") {
    return jsonResponse(error("FORBIDDEN", "Admin access required", 403), 403);
  }

  return null;
}
