/** @type {import('next-sitemap').Config} */
const config = {
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://dapurdekaka.com',
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/checkout/',
          '/account/',
          '/b2b/account/',
        ],
      },
    ],
  },
  sitemaps: [
    `${process.env.NEXT_PUBLIC_APP_URL || 'https://dapurdekaka.com'}/sitemap.xml`,
  ],
};

module.exports = config;