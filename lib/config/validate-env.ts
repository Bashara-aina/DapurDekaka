const REQUIRED = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'MIDTRANS_SERVER_KEY',
  'NEXT_PUBLIC_MIDTRANS_CLIENT_KEY',
  'CLOUDINARY_API_SECRET',
  'RESEND_API_KEY',
  'CRON_SECRET',
  'MINIMAX_API_KEY',
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
      'AUTH_SECRET must be at least 32 characters. Run: openssl rand -base64 32'
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