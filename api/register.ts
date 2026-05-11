import bcrypt from "bcryptjs";
import { insertUserSchema } from "@shared/schema";
import { created, error } from "../lib/api-response";
import { storage } from "../lib/storage";
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
    const payload = await request.json();
    const parsed = insertUserSchema.safeParse(payload);
    if (!parsed.success) {
      return json(error("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "Invalid input", 400), 400);
    }

    const { username, email, password } = parsed.data;

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return json(error("USERNAME_TAKEN", "Username already taken", 409), 409);
    }

    const newUser = await storage.createUser({ username, email, password });

    const sessionResponse = new Response();
    const { session, save } = await getSession(request, sessionResponse);
    session.userId = newUser.id;
    await save();

    return withSessionHeaders(json(created({ message: "User registered successfully" }), 201), sessionResponse);
  } catch {
    return json(error("REGISTER_FAILED", "Failed to register user", 500), 500);
  }
}
