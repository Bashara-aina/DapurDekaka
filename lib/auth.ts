import { error } from "./api-response";
import { getSession } from "./session";
import { storage } from "./storage";

/**
 * Requires a logged-in user with a valid DB record. Uses the same `sessionResponse`
 * for iron-session cookie reads/writes as the caller's handler.
 */
export async function requireAuth(
  request: Request,
  sessionResponse: Response
): Promise<{ userId: number } | Response> {
  const { session } = await getSession(request, sessionResponse);
  if (!session.userId) {
    return new Response(
      JSON.stringify(error("UNAUTHORIZED", "Authentication required", 401)),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const user = await storage.getUser(session.userId);
  if (!user) {
    return new Response(
      JSON.stringify(error("UNAUTHORIZED", "Authentication required", 401)),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return { userId: session.userId };
}

/**
 * Requires an admin user. Session cookie is read/written via `sessionResponse`.
 */
export async function requireAdmin(
  request: Request,
  sessionResponse: Response
): Promise<{ userId: number } | Response> {
  const { session } = await getSession(request, sessionResponse);
  if (!session.userId) {
    return new Response(
      JSON.stringify(error("UNAUTHORIZED", "Authentication required", 401)),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const user = await storage.getUser(session.userId);
  if (!user) {
    return new Response(
      JSON.stringify(error("UNAUTHORIZED", "Authentication required", 401)),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  if (user.role !== "admin") {
    return new Response(
      JSON.stringify(error("FORBIDDEN", "Admin access required", 403)),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return { userId: session.userId };
}
