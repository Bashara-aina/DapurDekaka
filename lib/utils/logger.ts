type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  ctx: string;
  timestamp: string;
  [key: string]: unknown;
}

function formatLogEntry(level: LogLevel, ctx: string, data: Record<string, unknown>): LogEntry {
  return {
    level,
    ctx,
    timestamp: new Date().toISOString(),
    ...data,
  };
}

function output(level: LogLevel, ctx: string, data: Record<string, unknown>): void {
  const entry = formatLogEntry(level, ctx, data);
  const outputStr = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(outputStr);
      break;
    case 'warn':
      console.warn(outputStr);
      break;
    default:
      console.log(outputStr);
  }
}

/**
 * Structured logger for production use.
 * Outputs JSON-formatted logs with level, context, timestamp, and metadata.
 * Use instead of console.log in production code paths (cron jobs, webhooks, etc.)
 */
export const logger = {
  info: (ctx: string, data: Record<string, unknown> = {}): void => {
    output('info', ctx, data);
  },

  warn: (ctx: string, data: Record<string, unknown> = {}): void => {
    output('warn', ctx, data);
  },

  error: (ctx: string, data: Record<string, unknown> = {}): void => {
    output('error', ctx, data);
  },
};