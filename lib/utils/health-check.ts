import { IntegrationError } from './integration-helpers';

export type IntegrationName = 'midtrans' | 'rajaongkir' | 'resend' | 'cloudinary' | 'minimax';

export interface IntegrationHealth {
  name: IntegrationName;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs: number | null;
  error?: string;
}

export interface HealthCheckResult {
  timestamp: string;
  integrations: IntegrationHealth[];
  overall: 'healthy' | 'degraded' | 'down';
}

const TIMEOUT_MAP: Record<IntegrationName, number> = {
  midtrans: 5000,
  rajaongkir: 8000,
  resend: 10000,
  cloudinary: 15000,
  minimax: 15000,
};

async function withTimeout<T>(
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

/**
 * Check health of a single integration.
 */
async function checkIntegration(
  name: IntegrationName,
  checkFn: () => Promise<boolean>
): Promise<IntegrationHealth> {
  const start = Date.now();

  try {
    const result = await withTimeout(checkFn, TIMEOUT_MAP[name], name);

    return {
      name,
      status: result ? 'healthy' : 'degraded',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const message =
      error instanceof IntegrationError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    return {
      name,
      status: 'down',
      latencyMs: Date.now() - start,
      error: message,
    };
  }
}

/**
 * Check health of all integrations.
 */
export async function checkIntegrationHealth(): Promise<HealthCheckResult> {
  const checks: Promise<IntegrationHealth>[] = [];

  checks.push(
    checkIntegration('midtrans', async () => {
      const key = process.env.MIDTRANS_SERVER_KEY;
      return Boolean(key && key.startsWith('Mid-server'));
    })
  );

  checks.push(
    checkIntegration('rajaongkir', async () => {
      const key = process.env.RAJAONGKIR_API_KEY;
      return Boolean(key && key.length > 10);
    })
  );

  checks.push(
    checkIntegration('resend', async () => {
      const key = process.env.RESEND_API_KEY;
      return Boolean(key && key.startsWith('re_'));
    })
  );

  checks.push(
    checkIntegration('cloudinary', async () => {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      return Boolean(cloudName && apiKey);
    })
  );

  checks.push(
    checkIntegration('minimax', async () => {
      const key = process.env.MINIMAX_API_KEY;
      return Boolean(key && key.startsWith('sk-api-'));
    })
  );

  const results = await Promise.all(checks);
  const downCount = results.filter((r) => r.status === 'down').length;
  const degradedCount = results.filter((r) => r.status === 'degraded').length;

  let overall: 'healthy' | 'degraded' | 'down' = 'healthy';
  if (downCount >= 3) {
    overall = 'down';
  } else if (downCount >= 1 || degradedCount >= 2) {
    overall = 'degraded';
  }

  return {
    timestamp: new Date().toISOString(),
    integrations: results,
    overall,
  };
}