import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

// BLOCKER 2: NEXT_PUBLIC_* is inlined at build time — fail the production build
// before shipping a bundle that points every callback at localhost.
// VERCEL_DEPLOYMENT_ID only exists on an actual Vercel build (pulled env
// dumps spoof VERCEL_ENV locally, which would break local lint/build).
if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_DEPLOYMENT_ID) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  if (!appUrl || appUrl.includes('localhost') || appUrl.startsWith('http://')) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must be the public https origin in production (got "${appUrl || '(unset)'}").`
    );
  }
}

const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-inline' required for Next.js inline script hashing (/_next/static chunks).
  // NOTE: no 'unsafe-eval' — framer-motion works under strict script CSP; the
  // old comment claiming otherwise was wrong (audit #87). If a future lib
  // needs eval, add it back with a link to the failing stack trace.
  "script-src 'self' 'unsafe-inline' https://app.midtrans.com https://app.sandbox.midtrans.com https://maps.googleapis.com",
  "frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://res.cloudinary.com https://lh3.googleusercontent.com https://cdn.jsdelivr.net https://maps.googleapis.com https://maps.gstatic.com",
  "connect-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com https://api.biteship.com https://maps.googleapis.com https://res.cloudinary.com",
  // S9: matches X-Frame-Options SAMEORIGIN (previously 'none' contradicted it).
  "frame-ancestors 'self'",
  // Upgrade-insecure-requests: automatically upgrade HTTP resources to HTTPS
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirectives,
  },
];

const nextConfig = {
  images: {
    // Product, blog and CMS photos are already transformed by Cloudinary
    // (f_auto,q_auto in the URL). Running them through Vercel's optimizer too
    // would double-process them and burn image-transformation quota.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        // Match any cloud name (the env var and the fallback dsnhwfuxh may differ)
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        // Google avatar URLs vary (/a/..., /=s64-c, /s64/...); allow all paths.
        pathname: '/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  async redirects() {
    // HIGH-3: `www` is canonical. Send the apex to `www` permanently (308)
    // so canonical/OG/sitemap URLs never sit behind a 307.
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'dapurdekaka.com' }],
        destination: 'https://www.dapurdekaka.com/:path*',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
