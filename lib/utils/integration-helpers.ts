/**
 * Integration helpers for third-party API calls.
 * Provides retry logic, timeout handling, and typed error classes.
 */

export class IntegrationError extends Error {
  constructor(
    public readonly service: string,
    public readonly statusCode: number,
    message: string,
    public readonly raw?: unknown
  ) {
    super(`[${service}] ${message}`);
    this.name = 'IntegrationError';
  }
}

export interface WithRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
  context?: string;
}

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

/**
 * Retry wrapper for external API calls.
 * Use for all third-party calls except Midtrans webhook processing.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    context = 'unknown',
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof IntegrationError) {
        if (!retryableStatuses.includes(error.statusCode)) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        const jitter = delay * (0.5 + Math.random() * 0.5);
        console.warn(
          `[${context}] Attempt ${attempt + 1} failed, retrying in ${Math.round(jitter)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, jitter));
      }
    }
  }

  console.error(`[${context}] All ${maxRetries + 1} attempts failed`);
  throw lastError;
}

/**
 * Timeout wrapper. Throws if fn doesn't resolve within ms.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  context: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const result = await fn();
    return result;
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new IntegrationError(context, 408, `Request timed out after ${ms}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}