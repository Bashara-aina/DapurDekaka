// @ts-ignore — express-rate-limit ships its own types but TS can't locate them in some configs
import rateLimit from "express-rate-limit";
// @ts-ignore - express-rate-limit lacks type declarations
const rateLimitHandler = (
  _req: unknown,
  res: { status: (code: number) => { json: (body: unknown) => unknown } }
) => {
  return res.status(429).json({
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests" },
  });
};

export const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});