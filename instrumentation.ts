export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    const { validateAuthSecret, validateProductionAppUrl } = await import('./lib/config/validate-env');
    validateAuthSecret();
    validateProductionAppUrl();
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}