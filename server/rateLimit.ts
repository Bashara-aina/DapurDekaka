// Simple in-memory rate limiter for Vercel serverless
// Note: This resets on cold starts (normal for serverless), use Redis for persistent limits

const requestCounts = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function rateLimitHandler(
  res: { status: (code: number) => { json: (body: unknown) => unknown } }
) {
  return res.status(429).json({
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests" },
  });
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + WINDOW_MS });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

export const defaultLimiter = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  next: () => void
) => {
  const key = "default";
  if (!checkRateLimit(key, 100)) {
    return rateLimitHandler(res);
  }
  next();
};

export const authLimiter = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  next: () => void
) => {
  const key = "auth";
  if (!checkRateLimit(key, 10)) {
    return rateLimitHandler(res);
  }
  next();
};

export const contactLimiter = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  next: () => void
) => {
  const key = "contact";
  if (!checkRateLimit(key, 5)) {
    return rateLimitHandler(res);
  }
  next();
};
