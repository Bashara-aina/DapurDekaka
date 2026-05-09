import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, {
  max: 1,
  connect_timeout: 10,
  idle_timeout: 20,
  ssl: "require",
  prepare: false,
});

export const db = drizzle(client, { schema });

export function getDb() {
  return db;
}

export function isConnectionError(error: unknown): boolean {
  if (!error) return false;
  const messages: string[] = [];
  if (error instanceof Error) {
    messages.push(error.message);
    let cause: unknown = (error as Error & { cause?: unknown }).cause;
    while (cause) {
      if (cause instanceof Error) {
        messages.push(cause.message);
        cause = (cause as Error & { cause?: unknown }).cause;
      } else if (typeof cause === "string") {
        messages.push(cause);
        break;
      } else if (typeof cause === "object" && cause !== null && "message" in cause) {
        messages.push(String((cause as { message: unknown }).message));
        break;
      } else {
        break;
      }
    }
    if ("code" in error) messages.push(String((error as { code: unknown }).code));
  } else if (typeof error === "string") {
    messages.push(error);
  } else if (typeof error === "object" && error !== null) {
    if ("message" in error) messages.push(String((error as { message: unknown }).message));
    if ("code" in error) messages.push(String((error as { code: unknown }).code));
  } else {
    messages.push(String(error));
  }
  const combined = messages.join("|");
  return (
    combined.includes("Connection terminated") ||
    combined.includes("Connection terminated unexpectedly") ||
    combined.includes("Server closed the connection") ||
    combined.includes("Connection refused") ||
    combined.includes("getaddrinfo") ||
    combined.includes("ECONNREFUSED") ||
    combined.includes("ENOTFOUND") ||
    combined.includes("fetch failed") ||
    combined.includes("Connection timeout") ||
    combined.includes("SocketError") ||
    combined.includes("SSL") ||
    combined.includes("certificate") ||
    combined.includes("pg_hba") ||
    combined.includes("Too many connections") ||
    combined.includes("password authentication failed") ||
    combined.includes("FATAL") ||
    combined.includes("ErrorEvent") ||
    combined.includes("CONNECTION_ENDED") ||
    combined.includes("Connection ended") ||
    combined.includes("Tenant or user not found")
  );
}

export async function resetPool(): Promise<void> {
  try {
    await client.end();
  } catch {
    // ignore
  }
}

export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isConnectionError(error)) {
      await resetPool();
      return operation();
    }
    throw error;
  }
}