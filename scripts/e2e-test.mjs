import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'id-ID',
  });
  const page = await context.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`[CONSOLE ERROR] ${msg.text().substring(0, 120)}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[PAGE ERROR] ${err.message.substring(0, 120)}`);
  });

  let pageNum = 0;
  async function checkPage(url, name, check) {
    pageNum++;
    console.log(`\n[${pageNum}] === ${name}: ${url} ===`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Wait a bit for dynamic content
      await page.waitForTimeout(1500);
      const title = await page.title();
      console.log(`  Title: ${title.substring(0, 80)}`);

      // Check for 404 page
      const bodyText = await page.textContent('body').catch(() => '');
      if (bodyText.includes('Halaman Tidak Ditemukan') || bodyText.includes('404')) {
        console.log(`  ⚠️  404 page detected`);
      }

      if (check) await check(page);
    } catch (err) {
      console.log(`  ❌ Error: ${err.message.substring(0, 120)}`);
      errors.push(`[${name}] ${err.message.substring(0, 120)}`);
      // Take screenshot on error
      await page.screenshot({ path: `/tmp/dapurdekaka-error-${pageNum}.png` }).catch(() => {});
    }
  }

  // 1. Homepage
  await checkPage(BASE, 'Homepage', async (p) => {
    const heroTitle = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  H1: ${heroTitle.substring(0, 60)}`);
    const navLinks = await p.$$('nav a, header a');
    console.log(`  Nav links: ${navLinks.length}`);
    const footer = await p.$('footer');
    console.log(`  Footer: ${footer ? '✅' : '❌'}`);
    const waBtn = await p.$('a[href*="wa.me"]');
    console.log(`  WhatsApp button: ${waBtn ? '✅' : '❌'}`);
  });

  // 2. Products page
  await checkPage(`${BASE}/products`, 'Products', async (p) => {
    const pageTitle = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  Title: ${pageTitle.substring(0, 60)}`);
    // Check product card count
    const cards = await p.$$('[class*="rounded-card"], [class*="shadow-card"]');
    console.log(`  Cards: ${cards.length}`);
    // Check for product images
    const images = await p.$$('img');
    console.log(`  Images: ${images.length}`);
  });

  // 3. Product detail - try known product
  await checkPage(`${BASE}/products/pangsit-ayam`, 'PDP (pangsit-ayam)', async (p) => {
    const title = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  Product: ${title.substring(0, 60)}`);
    const price = await p.textContent('[class*="text-2xl"]').catch(() => 'no price');
    console.log(`  Price: ${price?.substring(0, 30)}`);
    const breadcrumbLinks = await p.$$('nav a');
    console.log(`  Breadcrumb links: ${breadcrumbLinks.length}`);
    // Check for add-to-cart
    const cartBtns = await p.$$('button:has-text("Keranjang"), button:has-text("Tambah"), a:has-text("Keranjang")');
    console.log(`  Add-to-cart triggers: ${cartBtns.length}`);
  });

  // 4. Blog
  await checkPage(`${BASE}/blog`, 'Blog', async (p) => {
    const h1 = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  H1: ${h1.substring(0, 60)}`);
    const posts = await p.$$('a[href*="/blog/"]');
    console.log(`  Blog post links: ${posts.length}`);
    const bg = await p.evaluate(() => {
      const el = document.querySelector('[class*="bg-brand-cream"]');
      return el ? el.className.substring(0, 60) : 'no bg-brand-cream';
    });
    console.log(`  Background: ${bg}`);
  });

  // 5. About
  await checkPage(`${BASE}/about`, 'About', async (p) => {
    const h1 = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  H1: ${h1?.substring(0, 60)}`);
    const aboutHero = await p.$('[class*="bg-brand-navy"]');
    console.log(`  Brand navy bg: ${aboutHero ? '✅' : '❌'}`);
  });

  // 6. B2B
  await checkPage(`${BASE}/b2b`, 'B2B', async (p) => {
    const h1 = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  H1: ${h1?.substring(0, 80)}`);
    const sections = await p.$$('section');
    console.log(`  Sections: ${sections.length}`);
    const quoteForm = await p.$('#quote-form, form');
    console.log(`  Quote form: ${quoteForm ? '✅' : '❌'}`);
  });

  // 7. Cart
  await checkPage(`${BASE}/cart`, 'Cart', async (p) => {
    const bodyText = await p.textContent('body').catch(() => '');
    console.log(`  Loaded: ${bodyText.substring(0, 80)}`);
    const checkoutBtns = await p.$$('a[href*="checkout"], button:has-text("Checkout")');
    console.log(`  Checkout triggers: ${checkoutBtns.length}`);
  });

  // 8. Check account routes
  await checkPage(`${BASE}/account`, 'Account', async (p) => {
    // Should redirect to login since not logged in
    const url = p.url();
    console.log(`  Final URL: ${url.substring(0, 80)}`);
    if (url.includes('/login')) {
      console.log(`  ✅ Redirected to login (expected)`);
    }
    const loginForm = await p.$('input[type="email"], input[name="email"]');
    console.log(`  Login form: ${loginForm ? '✅' : '❌'}`);
  });

  // 9. Login page
  await checkPage(`${BASE}/login`, 'Login', async (p) => {
    const title = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  Title: ${title?.substring(0, 60)}`);
    const inputs = await p.$$('input');
    console.log(`  Form inputs: ${inputs.length}`);
    const googleBtn = await p.$('button:has-text("Google"), a:has-text("Google")');
    console.log(`  Google OAuth: ${googleBtn ? '✅' : '❌'}`);
  });

  // 10. Privacy & Refund policies
  await checkPage(`${BASE}/privacy-policy`, 'Privacy', async (p) => {
    const h1 = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  H1: ${h1?.substring(0, 60)}`);
  });
  await checkPage(`${BASE}/refund-policy`, 'Refund', async (p) => {
    const h1 = await p.textContent('h1').catch(() => 'no h1');
    console.log(`  H1: ${h1?.substring(0, 60)}`);
  });

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`TEST SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  console.log(`  Pages tested: ${pageNum}`);
  const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('Sentry'));
  console.log(`  Console errors: ${realErrors.length}`);
  if (realErrors.length > 0) {
    console.log(`  Errors:`);
    realErrors.slice(0, 10).forEach(e => console.log(`    • ${e}`));
  }
  console.log(`${'='.repeat(50)}`);

  // Full page screenshot
  await page.screenshot({ path: '/tmp/dapurdekaka-final.png', fullPage: true });
  console.log(`\nScreenshot: /tmp/dapurdekaka-final.png`);

  await browser.close();
}

run().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
});
