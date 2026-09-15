import pino, { type Logger } from 'pino';

/**
 * Structured logger for DapurDekaka.
 *
 * Powered by Pino (https://github.com/pinojs/pino) — the same logger NextAuth
 * ships internally. JSON output is compatible with Vercel log drains, Logtail,
 * Datadog, and any other structured log aggregator.
 *
 * - In development: pretty-prints via `pino-pretty` (dev-only transport).
 * - In production: raw JSON to stdout (Vercel/CloudWatch captures it).
 * - `redact` removes PII fields (`password`, `passwordHash`, `token`,
 *   `signatureKey`) before they reach logs — even if a caller forgets.
 *
 * The exported `logger` object has the same `.info/.warn/.error(ctx, data)`
 * shape as the previous custom logger, so this is a drop-in replacement at
 * every call site (`logger.info('[ctx]', { foo: bar })`).
 */
const isDev = process.env.NODE_ENV !== 'production';

const redactPaths = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'signatureKey',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.tokenHash',
  '*.signatureKey',
  'req.headers.authorization',
  'req.headers.cookie',
];

function buildLogger(): Logger {
  if (isDev) {
    // pino-pretty is a dev-only transport — pass the target string and let
    // pino dynamically require it. This keeps the devDep out of the prod bundle.
    return pino({
      level: process.env.LOG_LEVEL ?? 'info',
      redact: { paths: redactPaths, censor: '[REDACTED]' },
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false,
        },
      },
    }) as Logger;
  }

  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: { paths: redactPaths, censor: '[REDACTED]' },
    base: { service: 'dapur-dekaka', env: process.env.NODE_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
  }) as Logger;
}

const pinoInstance: Logger = buildLogger();

/**
 * Drop-in replacement for the previous custom logger. Call sites can use:
 *
 *   logger.info('[ctx]', { foo: 'bar' });
 *   logger.warn('[ctx]', { warning: 'something' });
 *   logger.error('[ctx]', { error });
 *
 * Pino accepts ctx as the first arg via `msg` semantics; we normalise to the
 * existing signature: `(ctx: string, data?: object) => void`.
 */
export const logger = {
  info(ctx: string, data: Record<string, unknown> = {}): void {
    pinoInstance.info(data, ctx);
  },
  warn(ctx: string, data: Record<string, unknown> = {}): void {
    pinoInstance.warn(data, ctx);
  },
  error(ctx: string, data: Record<string, unknown> = {}): void {
    pinoInstance.error(data, ctx);
  },
  debug(ctx: string, data: Record<string, unknown> = {}): void {
    pinoInstance.debug(data, ctx);
  },
};

/** Underlying pino instance for callers that need the full API (child loggers, transports). */
export const pinoLogger: Logger = pinoInstance;