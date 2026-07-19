import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-inline' required for Next.js inline script hashing (/_next/static chunks)
  "script-src 'self' 'unsafe-inline' https://app.midtrans.com https://app.sandbox.midtrans.com https://maps.googleapis.com",
  "frame-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://res.cloudinary.com https://lh3.googleusercontent.com https://cdn.jsdelivr.net https://maps.googleapis.com https://maps.gstatic.com",
  "connect-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com https://api.biteship.com https://maps.googleapis.com https://res.cloudinary.com",
  "frame-ancestors 'none'",
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
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: `/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '*'}/**`,
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        // Restrict to avatar-sized paths only to prevent over-permissioning
        pathname: '/s64/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui'],
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
