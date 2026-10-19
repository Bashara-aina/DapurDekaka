const REQUIRED = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'MIDTRANS_SERVER_KEY',
  'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
  'CLOUDINARY_API_SECRET',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'CLOUDINARY_API_KEY',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'BITESHIP_API_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const;

/**
 * Validates that AUTH_SECRET is at least 32 characters.
 * Called on module load to fail fast at startup.
 */
export function validateAuthSecret(): void {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is not set');
  }
  if (secret.length < 32) {
    throw new Error(
      'AUTH_SECRET must be at least 32 characters. Generate with: openssl rand -base64 32'
    );
  }
  // Basic entropy check: ensure the secret has mixed character types
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasDigit = /[0-9]/.test(secret);
  const hasSpecial = /[^a-zA-Z0-9]/.test(secret);
  const entropyTypes = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
  if (entropyTypes < 3) {
    throw new Error(
      'AUTH_SECRET lacks entropy (needs at least 3 of: lower, upper, digit, special). ' +
        'Generate with: openssl rand -base64 32'
    );
  }
}

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
}

/**
 * Validates that all critical environment variables are present.
 * Called on first API route hit to fail fast if env vars are missing.
 * Skipped in test environment to allow unit tests to run without env setup.
 */
export function validateEnv(): EnvValidationResult {
  if (process.env.NODE_ENV === 'test') {
    return { valid: true, missing: [] };
  }

  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return { valid: false, missing };
  }

  return { valid: true, missing: [] };
}

/**
 * BLOCKER 2: `NEXT_PUBLIC_*` is inlined at build time. A production build or
 * runtime that still points at localhost breaks payment redirects, reset
 * emails and sitemap URLs. This fails the Vercel production build fast.
 */
export function validateProductionAppUrl(): void {
  const isVercelProduction =
    process.env.VERCEL_ENV === 'production' && Boolean(process.env.VERCEL_DEPLOYMENT_ID);
  const isProductionRuntime =
    process.env.NODE_ENV === 'production' && process.env.STRICT_APP_URL_CHECK === 'true';

  if (!isVercelProduction && !isProductionRuntime) return;

  const url = process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (!url || url.includes('localhost') || url.startsWith('http://')) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must be the public https origin in production (got "${url || '(unset)'}").`
    );
  }
}

/**
 * Throws a descriptive error if required env vars are missing.
 * Use at the start of API routes or in a global initializer.
 */
export function requireEnv(): void {
  const result = validateEnv();
  if (!result.valid) {
    throw new Error(
      `Missing required environment variables: ${result.missing.join(', ')}. ` +
        'Please ensure all required env vars are set in .env.local or deployment environment.'
    );
  }
}