import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }
    return event;
  },
  denyUrls: [
    /\/api\/health/,
  ],
});