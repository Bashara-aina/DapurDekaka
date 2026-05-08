// Simple in-memory rate limiter for Vercel serverless
// Note: This resets on cold starts (normal for serverless), use Redis for persistent limits

const requestCounts = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const DEBUG_SERVER = 'http://127.0.0.1:7810/ingest/48e4779b-a190-4144-bebe-5f691c4717c5';
const SESSION_ID = '7b7753';

function rateLimitHandler(
  res: { status: (code: number) => { json: (body: unknown) => unknown } }
) {
  // #region agent log
  fetch(DEBUG_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      id: `log_${Date.now()}_rh`,
      timestamp: Date.now(),
      location: 'rateLimit.ts:rateLimitHandler',
      message: 'rateLimitHandler called - returning 429',
      data: {},
      runId: 'debug',
      hypothesisId: 'H1-H5'
    })
  }).catch(() => {});
  // #endregion
  return res.status(429).json({
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests" },
  });
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const record = requestCounts.get(key);

  // #region agent log
  fetch(DEBUG_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      id: `log_${Date.now()}_clr`,
      timestamp: Date.now(),
      location: 'rateLimit.ts:checkRateLimit',
      message: `checkRateLimit key=${key} limit=${limit}`,
      data: { key, limit, record: record ? { count: record.count, resetTime: record.resetTime } : null, now },
      runId: 'debug',
      hypothesisId: 'H1-H5'
    })
  }).catch(() => {});
  // #endregion

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
  // #region agent log
  fetch(DEBUG_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      id: `log_${Date.now()}_dl`,
      timestamp: Date.now(),
      location: 'rateLimit.ts:defaultLimiter',
      message: 'defaultLimiter called - passing through (disabled)',
      data: { _req: (_req as Record<string, unknown>)?.path },
      runId: 'debug',
      hypothesisId: 'H1-H5'
    })
  }).catch(() => {});
  // #endregion
  // Rate limiting disabled in development to avoid blocking Vite HMR and page loads
  // The in-memory Map persists across tsx hot reloads, causing unexpected 429s
  next();
};

export const authLimiter = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  next: () => void
) => {
  // #region agent log
  fetch(DEBUG_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      id: `log_${Date.now()}_al`,
      timestamp: Date.now(),
      location: 'rateLimit.ts:authLimiter',
      message: 'authLimiter called',
      data: { path: (_req as Record<string, unknown>)?.path },
      runId: 'debug',
      hypothesisId: 'H1-H5'
    })
  }).catch(() => {});
  // #endregion
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
  // #region agent log
  fetch(DEBUG_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify({
      sessionId: SESSION_ID,
      id: `log_${Date.now()}_cl`,
      timestamp: Date.now(),
      location: 'rateLimit.ts:contactLimiter',
      message: 'contactLimiter called',
      data: { path: (_req as Record<string, unknown>)?.path },
      runId: 'debug',
      hypothesisId: 'H1-H5'
    })
  }).catch(() => {});
  // #endregion
  const key = "contact";
  if (!checkRateLimit(key, 5)) {
    return rateLimitHandler(res);
  }
  next();
};
