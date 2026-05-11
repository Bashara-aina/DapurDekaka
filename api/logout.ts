import { error, ok } from "../lib/api-response";
import { getSession, withSessionHeaders } from "../lib/session";

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

  try {
    const sessionResponse = new Response();
    const { session } = await getSession(request, sessionResponse);
    session.destroy();
    return withSessionHeaders(json(ok({ message: "Logged out successfully" }), 200), sessionResponse);
  } catch {
    return json(error("LOGOUT_FAILED", "Logout failed", 500), 500);
  }
}
