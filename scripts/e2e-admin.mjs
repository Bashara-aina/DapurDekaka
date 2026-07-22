import { chromium } from 'playwright';

const BASE = 'https://www.dapurdekaka.com';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshot(page, name) {
  await page.screenshot({ path: `/tmp/dd-admin-${name}.png`, fullPage: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true, slowMo: 20 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID' });
  const page = await ctx.newPage();
  const errors = [];
  const results = [];

  page.on('pageerror', (e) => errors.push(e.message.substring(0, 120)));

  let stepNum = 0;
  async function step(name, fn) {
    stepNum++;
    process.stdout.write(`\n[${stepNum}] ${name}... `);
    try {
      const r = await fn();
      console.log(`✅`);
      results.push({ step: name, status: '✅' });
      return r;
    } catch (e) {
      console.log(`❌ ${e.message.substring(0, 80)}`);
      results.push({ step: name, status: '❌', error: e.message.substring(0, 100) });
      await screenshot(page, `error-${stepNum}`).catch(() => {});
    }
  }

  try {

    // ═══════════════════════════════════════════════════════════════
    // 1. ADMIN ACCESS CONTROL (Unauthenticated)
    // ═══════════════════════════════════════════════════════════════
    await step('Admin / → redirects to /login', async () => {
      await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1500);
      const url = page.url();
      if (!url.includes('/login')) throw new Error('Did not redirect: ' + url);
    });

    await step('Admin /dashboard → redirects to /login', async () => {
      const resp = await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      if (!page.url().includes('/login')) throw new Error('Did not redirect');
    });

    await step('Admin /orders → redirects to /login', async () => {
      await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      if (!page.url().includes('/login')) throw new Error('Did not redirect');
    });

    await step('Admin /products → redirects to /login', async () => {
      await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      if (!page.url().includes('/login')) throw new Error('Did not redirect');
    });

    await step('Admin /inventory → redirects to /login', async () => {
      await page.goto(`${BASE}/admin/inventory`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      if (!page.url().includes('/login')) throw new Error('Did not redirect');
    });

    await step('Admin /users → redirects to /login', async () => {
      await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      if (!page.url().includes('/login')) throw new Error('Did not redirect');
    });

    await step('Admin /settings → redirects to /login', async () => {
      await page.goto(`${BASE}/admin/settings`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      if (!page.url().includes('/login')) throw new Error('Did not redirect');
    });

    // ═══════════════════════════════════════════════════════════════
    // 2. LOGIN AS ADMIN
    // ═══════════════════════════════════════════════════════════════
    // We need admin credentials. Try to use the login page.
    await step('Admin login page renders', async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1500);
      const h1 = await page.locator('h1').textContent();
      if (!h1 || !h1.includes('Masuk')) throw new Error('Not login page');
      const inputs = await page.locator('input').count();
      if (inputs < 2) throw new Error('Not enough inputs');
      await screenshot(page, '01-login-page');
    });

    // Try admin credentials from env or common test creds
    const adminEmail = process.env.ADMIN_EMAIL || '';
    const adminPassword = process.env.ADMIN_PASSWORD || '';

    if (adminEmail && adminPassword) {
      await step('Login as admin', async () => {
        await page.locator('input[type="email"], input[name="email"]').first().fill(adminEmail);
        await page.locator('input[type="password"]').first().fill(adminPassword);
        await page.locator('button[type="submit"]').first().click();
        await sleep(5000);

        const url = page.url();
        if (url.includes('/login')) {
          const errorText = await page.locator('body').textContent();
          if (errorText.includes('Error') || errorText.includes('error')) {
            throw new Error('Login failed: ' + errorText.substring(0, 100));
          }
          throw new Error('Still on login page after submit');
        }
        console.log(`  Redirected to: ${url.substring(0, 60)}`);
        await screenshot(page, '02-after-login');
      });

      // Only proceed if logged in
      const isLoggedIn = !page.url().includes('/login');

      if (isLoggedIn) {
        // ═══════════════════════════════════════════════════════════
        // 3. ADMIN DASHBOARD
        // ═══════════════════════════════════════════════════════════
        await step('Admin dashboard loads', async () => {
          await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(3000);
          const body = await page.locator('body').textContent();
          if (body.includes('Masuk') || body.includes('login')) throw new Error('Redirected to login');
          const hasKpi = body.includes('Revenue') || body.includes('Revenue') || body.includes('Pendapatan') || body.includes('Pesanan');
          console.log(`  ${hasKpi ? '✅' : '⚠️'} Dashboard metrics visible`);
          await screenshot(page, '03-dashboard');
        });

        // ═══════════════════════════════════════════════════════════
        // 4. ADMIN ORDERS
        // ═══════════════════════════════════════════════════════════
        await step('Admin orders list', async () => {
          await page.goto(`${BASE}/admin/orders`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const table = await page.locator('table, [class*="order"], [class*="pesanan"]').count();
          console.log(`  Order elements: ${table}`);
          await screenshot(page, '04-admin-orders');
        });

        // ═══════════════════════════════════════════════════════════
        // 5. ADMIN PRODUCTS
        // ═══════════════════════════════════════════════════════════
        await step('Admin products list', async () => {
          await page.goto(`${BASE}/admin/products`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const table = await page.locator('table, [class*="product"], [class*="produk"]').count();
          const searchInput = await page.locator('input[placeholder*="Cari"]').count();
          console.log(`  Table/items: ${table} | Search: ${searchInput > 0 ? '✅' : '❌'}`);
          await screenshot(page, '05-admin-products');
        });

        // ═══════════════════════════════════════════════════════════
        // 6. ADMIN CATEGORIES
        // ═══════════════════════════════════════════════════════════
        await step('Admin categories', async () => {
          await page.goto(`${BASE}/admin/categories`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const table = await page.locator('table, [class*="category"], [class*="kategori"]').count();
          await screenshot(page, '06-admin-categories');
        });

        // ═══════════════════════════════════════════════════════════
        // 7. ADMIN INVENTORY
        // ═══════════════════════════════════════════════════════════
        await step('Admin inventory', async () => {
          await page.goto(`${BASE}/admin/inventory`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const body = await page.locator('body').textContent();
          const hasStock = body.includes('Stok') || body.includes('stock') || body.includes('SKU');
          console.log(`  ${hasStock ? '✅' : '⚠️'} Inventory data visible`);
          await screenshot(page, '07-admin-inventory');
        });

        // ═══════════════════════════════════════════════════════════
        // 8. ADMIN CUSTOMERS
        // ═══════════════════════════════════════════════════════════
        await step('Admin customers', async () => {
          await page.goto(`${BASE}/admin/customers`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const body = await page.locator('body').textContent();
          const hasCustomers = body.includes('pelanggan') || body.includes('customer') || body.includes('email');
          console.log(`  ${hasCustomers ? '✅' : '⚠️'} Customer data`);
          await screenshot(page, '08-admin-customers');
        });

        // ═══════════════════════════════════════════════════════════
        // 9. ADMIN SHIPMENTS
        // ═══════════════════════════════════════════════════════════
        await step('Admin shipments', async () => {
          await page.goto(`${BASE}/admin/shipments`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          await screenshot(page, '09-admin-shipments');
        });

        // ═══════════════════════════════════════════════════════════
        // 10. ADMIN COUPONS
        // ═══════════════════════════════════════════════════════════
        await step('Admin coupons', async () => {
          await page.goto(`${BASE}/admin/coupons`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const body = await page.locator('body').textContent();
          const hasCreate = body.includes('Buat') || body.includes('Tambah') || body.includes('New');
          console.log(`  ${hasCreate ? '✅' : '⚠️'} Coupon management`);
          await screenshot(page, '10-admin-coupons');
        });

        // ═══════════════════════════════════════════════════════════
        // 11. ADMIN BLOG
        // ═══════════════════════════════════════════════════════════
        await step('Admin blog', async () => {
          await page.goto(`${BASE}/admin/blog`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          await screenshot(page, '11-admin-blog');
        });

        // ═══════════════════════════════════════════════════════════
        // 12. ADMIN SETTINGS
        // ═══════════════════════════════════════════════════════════
        await step('Admin settings', async () => {
          await page.goto(`${BASE}/admin/settings`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const body = await page.locator('body').textContent();
          const hasSettings = body.includes('Setting') || body.includes('setting') || body.includes('Pengaturan');
          console.log(`  ${hasSettings ? '✅' : '⚠️'} Settings page`);
          await screenshot(page, '12-admin-settings');
        });

        // ═══════════════════════════════════════════════════════════
        // 13. ADMIN FIELD (GUDANG)
        // ═══════════════════════════════════════════════════════════
        await step('Admin field/gudang', async () => {
          await page.goto(`${BASE}/admin/field`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          await screenshot(page, '13-admin-field');
        });

        // ═══════════════════════════════════════════════════════════
        // 14. ADMIN USERS (superadmin only)
        // ═══════════════════════════════════════════════════════════
        await step('Admin users', async () => {
          await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const body = await page.locator('body').textContent();
          const hasUsers = body.includes('pengguna') || body.includes('email') && body.includes('role');
          console.log(`  ${hasUsers ? '✅' : '⚠️'} Users page`);
          await screenshot(page, '14-admin-users');
        });

        // ═══════════════════════════════════════════════════════════
        // 15. ADMIN OPS / KPI
        // ═══════════════════════════════════════════════════════════
        await step('Admin ops checklist', async () => {
          await page.goto(`${BASE}/admin/ops`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          await screenshot(page, '15-admin-ops');
        });

        await step('Admin KPI', async () => {
          await page.goto(`${BASE}/admin/kpi`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          await screenshot(page, '16-admin-kpi');
        });

        // ═══════════════════════════════════════════════════════════
        // 16. SIDEBAR NAVIGATION
        // ═══════════════════════════════════════════════════════════
        await step('Admin sidebar renders', async () => {
          await page.goto(`${BASE}/admin/dashboard`, { waitUntil: 'networkidle', timeout: 20000 });
          await sleep(2000);
          const sidebarLinks = await page.locator('aside a, nav a, [class*="sidebar"] a, [class*="nav"] a').count();
          console.log(`  Sidebar/ nav links: ${sidebarLinks}`);
          await screenshot(page, '17-admin-sidebar');
        });
      } else {
        console.log('\n  ⚠️ Skipping admin pages — not authenticated');
      }
    } else {
      console.log('\n  ⚠️ No admin credentials provided (set ADMIN_EMAIL and ADMIN_PASSWORD env vars)');
      console.log('  Skipping authenticated admin tests');
    }

    // ═══════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n\n' + '═'.repeat(58));
    console.log('  ADMIN E2E TEST RESULTS');
    console.log('═'.repeat(58));
    const passed = results.filter(r => r.status === '✅').length;
    const failed = results.filter(r => r.status === '❌').length;

    console.log(`\n  Total steps: ${results.length}`);
    console.log(`  Passed:      ${passed} ✅`);
    console.log(`  Failed:      ${failed} ❌`);

    console.log('\n  Results:');
    results.forEach(r => {
      console.log(`    ${r.status} ${r.step}`);
    });

    if (errors.length > 0) {
      console.log(`\n  Page errors (${errors.length}):`);
      errors.slice(0, 5).forEach(e => console.log(`    • ${e.substring(0, 100)}`));
    }

    console.log('\n' + '═'.repeat(58));

  } catch (e) {
    console.error(`\n❌ FATAL: ${e.message}`);
    await screenshot(page, 'fatal').catch(() => {});
  }

  await browser.close();
}

run();
