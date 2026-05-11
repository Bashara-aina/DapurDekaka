import bcrypt from "bcryptjs";
import { z } from "zod";
import { error, ok } from "../lib/api-response";
import { storage } from "../lib/storage";
import { getSession, withSessionHeaders } from "../lib/session";

export const config = { runtime: "nodejs" };

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
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
    const parsed = loginSchema.safeParse(payload);
    if (!parsed.success) {
      return json(error("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Invalid input", 400), 400);
    }

    const { username, password } = parsed.data;
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return json(error("INVALID_CREDENTIALS", "Invalid credentials", 401), 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash ?? "");
    if (!isValidPassword) {
      return json(error("INVALID_CREDENTIALS", "Invalid credentials", 401), 401);
    }

    const sessionResponse = new Response();
    const { session, save } = await getSession(request, sessionResponse);
    session.userId = user.id;
    await save();

    return withSessionHeaders(json(ok({ message: "Logged in successfully" }), 200), sessionResponse);
  } catch {
    return json(error("LOGIN_FAILED", "Login failed", 500), 500);
  }
}
