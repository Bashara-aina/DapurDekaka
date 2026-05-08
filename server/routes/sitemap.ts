import { Router } from "express";
import { storage } from "../storage";
import { ok } from "../apiResponse";

const blogSitemapRouter = Router();

blogSitemapRouter.get("/sitemap.xml", async (_req, res) => {
  try {
    const siteUrl = process.env.SITE_URL || 'https://dapurdekaka.com';
    const allPosts = await storage.getAllBlogPosts();
    const publishedPosts = allPosts.filter(post => post.published === 1);

    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/menu', priority: '0.8', changefreq: 'weekly' },
      { url: '/articles', priority: '0.9', changefreq: 'daily' },
      { url: '/contact', priority: '0.6', changefreq: 'monthly' },
      { url: '/about', priority: '0.6', changefreq: 'monthly' },
    ];

    const today = new Date().toISOString().split('T')[0];

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Static pages
    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += `    <loc>${siteUrl}${page.url}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += '  </url>\n';
    }

    // Blog posts
    for (const post of publishedPosts) {
      const lastmod = post.updatedAt
        ? new Date(post.updatedAt).toISOString().split('T')[0]
        : new Date(post.createdAt).toISOString().split('T')[0];

      xml += '  <url>\n';
      xml += `    <loc>${siteUrl}/article/${post.id}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');
    res.send(xml);
  } catch (err) {
    console.error("Error generating sitemap:", err);
    res.status(500).send('Error generating sitemap');
  }
});

export default blogSitemapRouter;