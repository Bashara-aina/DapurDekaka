export interface RateLimitResult {
  limited: boolean;
  retryAfterSeconds?: number;
}

export async function defaultLimiter(): Promise<RateLimitResult> {
  return { limited: false };
}

export async function authLimiter(): Promise<RateLimitResult> {
  return { limited: false };
}

export async function contactLimiter(): Promise<RateLimitResult> {
  return { limited: false };
}
