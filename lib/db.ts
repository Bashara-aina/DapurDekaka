import { sql } from "@vercel/postgres";

export function isConnectionError(error: unknown): boolean {
  if (!error) return false;
  const messages: string[] = [];
  if (error instanceof Error) {
    messages.push(error.message);
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
    combined.includes("Connection refused") ||
    combined.includes("getaddrinfo") ||
    combined.includes("ECONNREFUSED") ||
    combined.includes("ENOTFOUND") ||
    combined.includes("fetch failed") ||
    combined.includes("Connection timeout") ||
    combined.includes("SSL") ||
    combined.includes("certificate") ||
    combined.includes("password authentication failed") ||
    combined.includes("FATAL") ||
    combined.includes("ErrorEvent")
  );
}

export async function resetPool(): Promise<void> {
  // @vercel/postgres manages connection pooling internally
}

export async function withRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isConnectionError(error)) {
      return operation();
    }
    throw error;
  }
}

export { sql };