import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }
    // Scrub common PII fields from breadcrumbs / extras before leaving the edge.
    if (event.request?.data && typeof event.request.data === 'object') {
      const data = event.request.data as Record<string, unknown>;
      for (const key of ['email', 'phone', 'password', 'totp', 'token']) {
        if (key in data) data[key] = '[redacted]';
      }
    }
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
  denyUrls: [
    /\/api\/health/,
  ],
});