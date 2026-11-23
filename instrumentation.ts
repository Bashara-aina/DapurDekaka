export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    const { validateAuthSecret, validateProductionAppUrl, validateEnv } = await import(
      './lib/config/validate-env'
    );
    validateAuthSecret();
    validateProductionAppUrl();
    const envCheck = validateEnv();
    if (!envCheck.valid) {
      // Fail-soft at boot: log missing required keys so deploy health is visible
      // without crashing every route during partial preview env.
      console.error('[validateEnv] missing required env', envCheck.missing);
    }
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}