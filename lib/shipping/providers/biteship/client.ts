import { logger } from '@/lib/utils/logger';

const BASE_URL = process.env.BITESHIP_BASE_URL ?? 'https://api.biteship.com/v1';

export class BiteshipApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'BiteshipApiError';
  }
}

interface BiteshipRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
}

/**
 * Authenticated fetch wrapper for Biteship API v1.
 */
export async function biteshipFetch<T>(
  path: string,
  options: BiteshipRequestOptions = {}
): Promise<T> {
  const apiKey = process.env.BITESHIP_API_KEY;
  if (!apiKey) {
    throw new BiteshipApiError('BITESHIP_API_KEY tidak dikonfigurasi', 500);
  }

  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    logger.error('[Biteship] API error', { path, status: res.status, body: parsed });
    const msg =
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: string }).error === 'string'
        ? (parsed as { error: string }).error
        : `Biteship API error (${res.status})`;
    throw new BiteshipApiError(msg, res.status, parsed);
  }

  return parsed as T;
}
