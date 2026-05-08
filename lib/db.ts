import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";

let pool: Pool | null = null;
let dbConnection: ReturnType<typeof drizzle> | null = null;

function createDbConnection(): ReturnType<typeof drizzle> | null {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    if (pool) {
      pool.end().catch(() => {});
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    dbConnection = drizzle({ client: pool, schema });

    pool.on("error", () => {
      // Let callers handle retries via isNeonTerminationError + withNeonRetry.
    });

    return dbConnection;
  } catch {
    return null;
  }
}

export function isNeonTerminationError(error: unknown): boolean {
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

    const sourceError = (error as Error & { sourceError?: unknown }).sourceError;
    if (sourceError instanceof Error) {
      messages.push(sourceError.message);
    } else if (typeof sourceError === "string") {
      messages.push(sourceError);
    } else if (typeof sourceError === "object" && sourceError !== null && "message" in sourceError) {
      messages.push(String((sourceError as { message: unknown }).message));
    }

    if ("code" in error) {
      messages.push(String((error as { code: unknown }).code));
    }
  } else if (typeof error === "string") {
    messages.push(error);
  } else if (typeof error === "object" && error !== null && "message" in error) {
    messages.push(String((error as { message: unknown }).message));
    if ("code" in error) {
      messages.push(String((error as { code: unknown }).code));
    }
  } else if (typeof error === "object" && error !== null && "code" in error) {
    messages.push(String((error as { code: unknown }).code));
  } else {
    messages.push(String(error));
  }

  const combined = messages.join("|");
  return (
    combined.includes("terminating connection due to administrator command") ||
    combined.includes("57P01") ||
    combined.includes("Connection terminated") ||
    combined.includes("Connection accidentally") ||
    combined.includes("SocketError") ||
    combined.includes("fetch failed") ||
    combined.includes("Connection terminated unexpectedly") ||
    combined.includes("Server closed the connection") ||
    combined.includes("Connection refused") ||
    combined.includes("getaddrinfo") ||
    combined.includes("ECONNREFUSED") ||
    combined.includes("ENOTFOUND") ||
    combined.includes("Cannot set property message of #<ErrorEvent>") ||
    combined.includes("ErrorEvent")
  );
}

export function resetPool(): void {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
    dbConnection = null;
  }
}

export function getDb(): ReturnType<typeof drizzle> | null {
  if (!dbConnection) {
    return createDbConnection();
  }
  return dbConnection;
}

export async function withNeonRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isNeonTerminationError(error)) {
      resetPool();
      return operation();
    }
    throw error;
  }
}

export const db = createDbConnection();
export { pool };
