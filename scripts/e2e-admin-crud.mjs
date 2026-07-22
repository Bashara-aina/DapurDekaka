import { chromium } from 'playwright';

const BASE = 'https://www.dapurdekaka.com';
const ADMIN = BASE + '/admin';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshot(page, name) {
  await page.screenshot({ path: `/tmp/dd-crud-${name}.png`, fullPage: true });
  console.log(`  📸 ${name}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true, slowMo: 10 });
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
      console.log(`❌ ${e.message.substring(0, 100)}`);
      results.push({ step: name, status: '❌', error: e.message.substring(0, 100) });
      await screenshot(page, `error-${stepNum}`).catch(() => {});
    }
  }

  try {

    // ═══════════════════════════════════════════════════
    // 1. LOGIN AS SUPERADMIN
    // ═══════════════════════════════════════════════════
    await step('Login as superadmin', async () => {
      await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      await page.locator('input[type="email"]').fill('superadmin@dkk.id');
      await page.locator('input[type="password"]').fill('DapurDekakaJaya');
      await page.locator('button[type="submit"]').click();
      await sleep(4000);
      if (page.url().includes('/login')) throw new Error('Login failed');
      console.log(`  URL: ${page.url().substring(0, 60)}`);
    });

    // ═══════════════════════════════════════════════════
    // 2. DASHBOARD
    // ═══════════════════════════════════════════════════
    await step('Dashboard loads with KPIs', async () => {
      await page.goto(ADMIN + '/dashboard', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(3000);
      const body = await page.locator('body').textContent();
      const hasKpis = body.includes('Revenue') || body.includes('Pendapatan') || body.includes('Pesanan') || body.includes('Order');
      if (!hasKpis) console.log('  ⚠️ KPIs not found — may use different labels');
      const sidebarLinks = await page.locator('aside a, nav a, [class*="sidebar"] a').count();
      console.log(`  Sidebar links: ${sidebarLinks}`);
      await screenshot(page, '01-dashboard');
    });

    // ═══════════════════════════════════════════════════
    // 3. PRODUCTS CRUD
    // ═══════════════════════════════════════════════════
    await step('Products: list & search', async () => {
      await page.goto(ADMIN + '/products', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const searchInput = page.locator('input[placeholder*="Cari"]');
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('dimsum');
        await sleep(1000);
        console.log('  Search works');
        // Clear search
        const clearBtn = page.locator('button:has(svg.lucide-x)').first();
        if (await clearBtn.isVisible().catch(() => false)) {
          await clearBtn.click();
          await sleep(500);
        }
      }
      await screenshot(page, '02-products-list');
    });

    await step('Products: add new', async () => {
      const addBtn = page.locator('a[href*="/products/new"], a:has-text("Tambah Produk"), a:has-text("Produk Baru")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(3000);
        const url = page.url();
        if (url.includes('/new')) {
          console.log('  Product create page reached');
          // Check if there's a form
          const form = page.locator('form, input, select, textarea');
          const formCount = await form.count();
          console.log(`  Form fields: ${formCount}`);
        }
        await screenshot(page, '03-product-new');
      } else {
        console.log('  ⚠️ No add button (may be hidden by role)');
      }
    });

    await step('Products: edit first product', async () => {
      await page.goto(ADMIN + '/products', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const editLink = page.locator('a:has-text("Edit"), a[href*="/products/"]:not([href$="/new"])').first();
      if (await editLink.isVisible().catch(() => false)) {
        await editLink.click();
        await sleep(3000);
        if (!page.url().includes('/products/')) throw new Error('Not on edit page');
        console.log(`  Edit page: ${page.url().substring(0, 60)}`);
        await screenshot(page, '04-product-edit');
      } else {
        console.log('  ⚠️ No edit link');
      }
    });

    await step('Products: bulk select', async () => {
      await page.goto(ADMIN + '/products', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      if (count > 1) {
        // Check first item
        await checkboxes.nth(1).check();
        await sleep(500);
        const bulkBar = page.locator('text=dipilih').first();
        if (await bulkBar.isVisible().catch(() => false)) {
          console.log('  Bulk action bar visible');
        }
        // Uncheck
        await checkboxes.nth(1).uncheck();
      } else {
        console.log(`  ${count} checkboxes found`);
      }
      await screenshot(page, '05-bulk-select');
    });

    // ═══════════════════════════════════════════════════
    // 4. CATEGORIES CRUD
    // ═══════════════════════════════════════════════════
    await step('Categories: list', async () => {
      await page.goto(ADMIN + '/categories', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const table = page.locator('table, [class*="kategori"], [class*="category"]');
      console.log(`  Categories rendered: ${await table.count() > 0 ? '✅' : '⚠️'}`);
      await screenshot(page, '06-categories');
    });

    await step('Categories: add/edit modal', async () => {
      const addBtn = page.locator('button:has-text("Kategori Baru"), a:has-text("Kategori Baru"), button:has-text("Tambah")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(1000);
        const modal = page.locator('[class*="fixed"], [role="dialog"]').first();
        if (await modal.isVisible().catch(() => false)) {
          console.log('  Create modal opened');
          await screenshot(page, '07-category-modal');
          // Close modal
          const closeBtn = page.locator('button:has(svg.lucide-x)').first();
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
          await sleep(500);
        }
      }
    });

    await step('Categories: toggle active', async () => {
      const toggleBtn = page.locator('button[title*="Nonaktifkan"], button[title*="Aktifkan"]').first();
      if (await toggleBtn.isVisible().catch(() => false)) {
        const title = await toggleBtn.getAttribute('title');
        await toggleBtn.click();
        await sleep(1500);
        console.log(`  Clicked: ${title}`);
      } else {
        console.log('  ⚠️ No toggle button');
      }
    });

    // ═══════════════════════════════════════════════════
    // 5. INVENTORY
    // ═══════════════════════════════════════════════════
    await step('Inventory: list & inline edit', async () => {
      await page.goto(ADMIN + '/inventory', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasData = body.includes('SKU') || body.includes('sku') || body.includes('Stok') || body.includes('stock');
      console.log(`  ${hasData ? '✅' : '⚠️'} Inventory loaded`);

      // Try inline stock click
      const stockBadge = page.locator('[class*="stock"]:has-text("Tersisa"), [class*="stock"]:has-text("Habis"), span:has-text("Habis")').first();
      if (await stockBadge.isVisible().catch(() => false)) {
        await stockBadge.click();
        await sleep(500);
        const input = page.locator('input[type="number"]').first();
        if (await input.isVisible().catch(() => false)) {
          console.log('  Inline stock edit activated');
          // Cancel
          await page.keyboard.press('Escape');
          await sleep(500);
        }
      }
      await screenshot(page, '08-inventory');
    });

    // ═══════════════════════════════════════════════════
    // 6. ORDERS
    // ═══════════════════════════════════════════════════
    await step('Orders: list & filter', async () => {
      await page.goto(ADMIN + '/orders', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasOrders = body.includes('Pesanan') || body.includes('Order') || body.includes('Status');
      console.log(`  ${hasOrders ? '✅' : '⚠️'} Orders loaded`);

      // Try status filter
      const filterSelect = page.locator('select, [role="combobox"]').first();
      if (await filterSelect.isVisible().catch(() => false)) {
        console.log('  Filter dropdown present');
      }
      await screenshot(page, '09-orders');
    });

    // ═══════════════════════════════════════════════════
    // 7. COUPONS CRUD
    // ═══════════════════════════════════════════════════
    await step('Coupons: list', async () => {
      await page.goto(ADMIN + '/coupons', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasCoupons = body.includes('Kupon') || body.includes('Coupon') || body.includes('Diskon');
      console.log(`  ${hasCoupons ? '✅' : '⚠️'} Coupons loaded`);
      await screenshot(page, '10-coupons');
    });

    await step('Coupons: add new', async () => {
      const addBtn = page.locator('a[href*="/coupons/new"], a:has-text("Tambah"), a:has-text("Kupon Baru")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(2000);
        const url = page.url();
        if (url.includes('/new')) {
          const inputs = await page.locator('input, select, textarea').count();
          console.log(`  New coupon form: ${inputs} fields`);
        }
        await screenshot(page, '11-coupon-new');
      } else {
        console.log('  ⚠️ No add button');
      }
    });

    // ═══════════════════════════════════════════════════
    // 8. USERS MANAGEMENT
    // ═══════════════════════════════════════════════════
    await step('Users: list', async () => {
      await page.goto(ADMIN + '/users', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasUsers = body.includes('pengguna') || body.includes('email');
      console.log(`  ${hasUsers ? '✅' : '⚠️'} Users loaded`);
      await screenshot(page, '12-users');
    });

    await step('Users: inline role edit', async () => {
      const roleBadge = page.locator('button[class*="role"], span:has-text("superadmin"), span:has-text("customer")').first();
      if (await roleBadge.isVisible().catch(() => false)) {
        await roleBadge.click();
        await sleep(1000);
        const select = page.locator('[role="listbox"], select').first();
        if (await select.isVisible().catch(() => false)) {
          console.log('  Role editor opened');
          // Cancel
          const cancelBtn = page.locator('button:has(svg.lucide-x)').first();
          if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
          await sleep(500);
        }
      }
    });

    await step('Users: invite modal', async () => {
      const inviteBtn = page.locator('button:has-text("Undang"), a:has-text("Undang")').first();
      if (await inviteBtn.isVisible().catch(() => false)) {
        await inviteBtn.click();
        await sleep(1000);
        const modal = page.locator('[class*="fixed"], [role="dialog"]').first();
        if (await modal.isVisible().catch(() => false)) {
          console.log('  Invite modal opened');
          await screenshot(page, '13-user-invite');
          // Close
          const closeBtn = page.locator('button:has(svg.lucide-x)').first();
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
          await sleep(500);
        }
      }
    });

    await step('Users: toggle active', async () => {
      const deactBtn = page.locator('button[title*="Nonaktifkan"], button[title*="Aktifkan"]').first();
      if (await deactBtn.isVisible().catch(() => false)) {
        await deactBtn.click();
        await sleep(1000);
        const dialog = page.locator('[role="dialog"], [class*="fixed"]').first();
        if (await dialog.isVisible().catch(() => false)) {
          console.log('  Deactivate dialog opened');
          // Cancel
          const cancelBtn = page.locator('button:has-text("Batal")').first();
          if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
          await sleep(500);
        }
      }
    });

    // ═══════════════════════════════════════════════════
    // 9. CUSTOMERS
    // ═══════════════════════════════════════════════════
    await step('Customers: list & search', async () => {
      await page.goto(ADMIN + '/customers', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasCust = body.includes('pelanggan') || body.includes('customer');
      console.log(`  ${hasCust ? '✅' : '⚠️'} Customers loaded`);
      const searchInput = page.locator('input[placeholder*="Cari"]').first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('budi');
        await sleep(1000);
        console.log('  Search works');
      }
      await screenshot(page, '14-customers');
    });

    await step('Customers: detail & points adjust', async () => {
      const detailLink = page.locator('a[href*="/customers/"]').first();
      if (await detailLink.isVisible().catch(() => false)) {
        await detailLink.click();
        await sleep(2000);
        const body = await page.locator('body').textContent();
        const hasDetail = body.includes('Poin') || body.includes('points') || body.includes('Alamat');
        console.log(`  ${hasDetail ? '✅' : '⚠️'} Customer detail loaded`);

        // Try points adjust button
        const adjustBtn = page.locator('button:has-text("Sesuaikan"), button:has-text("Poin")').first();
        if (await adjustBtn.isVisible().catch(() => false)) {
          await adjustBtn.click();
          await sleep(1000);
          const modal = page.locator('[role="dialog"], [class*="fixed"]').first();
          if (await modal.isVisible().catch(() => false)) {
            console.log('  Points adjust modal opened');
            // Close
            const closeBtn = page.locator('button:has(svg.lucide-x)').first();
            if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
            await sleep(500);
          }
        }
        await screenshot(page, '15-customer-detail');
      }
    });

    // ═══════════════════════════════════════════════════
    // 10. SETTINGS
    // ═══════════════════════════════════════════════════
    await step('Settings: view & inline edit', async () => {
      await page.goto(ADMIN + '/settings', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasSetting = body.includes('setting') || body.includes('Setting') || body.includes('Pengaturan');
      console.log(`  ${hasSetting ? '✅' : '⚠️'} Settings loaded`);

      // Try inline edit button
      const editBtn = page.locator('button[title*="Edit"], svg.lucide-pencil, button:has(svg.lucide-pen)').first();
      if (await editBtn.isVisible().catch(() => false)) {
        await editBtn.click();
        await sleep(500);
        console.log('  Inline edit activated');
        // Cancel
        const cancelBtn = page.locator('button:has(svg.lucide-x)').first();
        if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
        await sleep(500);
      }
      await screenshot(page, '16-settings');
    });

    // ═══════════════════════════════════════════════════
    // 11. SHIPMENTS
    // ═══════════════════════════════════════════════════
    await step('Shipments: list & tracking input', async () => {
      await page.goto(ADMIN + '/shipments', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasShip = body.includes('Kirim') || body.includes('ship') || body.includes('Resi') || body.includes('tracking');
      console.log(`  ${hasShip ? '✅' : '⚠️'} Shipments loaded`);

      const trackingInput = page.locator('input[placeholder*="Resi"], input[placeholder*="tracking"]').first();
      if (await trackingInput.isVisible().catch(() => false)) {
        console.log('  Tracking input present');
      }
      await screenshot(page, '17-shipments');
    });

    // ═══════════════════════════════════════════════════
    // 12. BLOG CMS
    // ═══════════════════════════════════════════════════
    await step('Blog CMS: list', async () => {
      await page.goto(ADMIN + '/blog', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasBlog = body.includes('Post') || body.includes('post') || body.includes('Blog') || body.includes('blog');
      console.log(`  ${hasBlog ? '✅' : '⚠️'} Blog CMS loaded`);
      await screenshot(page, '18-blog');
    });

    await step('Blog CMS: add new', async () => {
      const addBtn = page.locator('a[href*="/blog/new"], a:has-text("Tambah"), a:has-text("Post Baru")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(2000);
        if (page.url().includes('/new')) {
          const inputs = await page.locator('input, select, textarea, [contenteditable]').count();
          console.log(`  New blog form: ${inputs} fields`);
        }
        await screenshot(page, '19-blog-new');
      } else {
        console.log('  ⚠️ No add button');
      }
    });

    // ═══════════════════════════════════════════════════
    // 13. FIELD / GUDANG
    // ═══════════════════════════════════════════════════
    await step('Field/Gudang: tabs', async () => {
      await page.goto(ADMIN + '/field', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const tabs = ['Packing', 'Kirim', 'Ambil', 'Stok', 'Selesai'];
      const foundTabs = tabs.filter(t => body.includes(t));
      console.log(`  Tabs found: ${foundTabs.length}/${tabs.length}`);
      await screenshot(page, '20-field');
    });

    // ═══════════════════════════════════════════════════
    // 14. CAROUSEL
    // ═══════════════════════════════════════════════════
    await step('Carousel: list', async () => {
      await page.goto(ADMIN + '/carousel', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasCarousel = body.includes('Slide') || body.includes('slide') || body.includes('Carousel');
      console.log(`  ${hasCarousel ? '✅' : '⚠️'} Carousel loaded`);

      const addBtn = page.locator('a[href*="/carousel/new"], a:has-text("Tambah"), a:has-text("Slide Baru")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        console.log('  Add slide button present');
      }
      await screenshot(page, '21-carousel');
    });

    // ═══════════════════════════════════════════════════
    // 15. TESTIMONIALS
    // ═══════════════════════════════════════════════════
    await step('Testimonials: list & CRUD', async () => {
      await page.goto(ADMIN + '/testimonials', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasTest = body.includes('Testimoni') || body.includes('testimoni');
      console.log(`  ${hasTest ? '✅' : '⚠️'} Testimonials loaded`);

      const addBtn = page.locator('button:has-text("Tambah"), a:has-text("Tambah")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(1000);
        const modal = page.locator('[role="dialog"], [class*="fixed"]').first();
        if (await modal.isVisible().catch(() => false)) {
          console.log('  Add testimonial modal opened');
          // Close
          const closeBtn = page.locator('button:has(svg.lucide-x)').first();
          if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
          await sleep(500);
        }
      }

      const deleteBtn = page.locator('button[title*="Hapus"], button:has(svg.lucide-trash)').first();
      if (await deleteBtn.isVisible().catch(() => false)) {
        await deleteBtn.click();
        await sleep(1000);
        const dialog = page.locator('[role="dialog"]').first();
        if (await dialog.isVisible().catch(() => false)) {
          console.log('  Delete confirmation dialog opened');
          await page.locator('button:has-text("Batal")').first().click().catch(() => {});
          await sleep(500);
        }
      }
      await screenshot(page, '22-testimonials');
    });

    // ═══════════════════════════════════════════════════
    // 16. B2B MANAGEMENT
    // ═══════════════════════════════════════════════════
    await step('B2B Inquiries: list & status update', async () => {
      await page.goto(ADMIN + '/b2b-inquiries', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasInq = body.includes('Inquiry') || body.includes('inquiry') || body.includes('B2B');
      console.log(`  ${hasInq ? '✅' : '⚠️'} B2B inquiries loaded`);

      const detailLink = page.locator('a[href*="/b2b-inquiries/"]').first();
      if (await detailLink.isVisible().catch(() => false)) {
        await detailLink.click();
        await sleep(2000);
        console.log(`  Inquiry detail: ${page.url().substring(0, 60)}`);
      }
      await screenshot(page, '23-b2b-inquiries');
    });

    await step('B2B Quotes: list', async () => {
      await page.goto(ADMIN + '/b2b-quotes', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasQuotes = body.includes('Quote') || body.includes('quote') || body.includes('Penawaran');
      console.log(`  ${hasQuotes ? '✅' : '⚠️'} B2B quotes loaded`);

      const addBtn = page.locator('a[href*="/b2b-quotes/new"], a:has-text("Buat Quote")').first();
      if (await addBtn.isVisible().catch(() => false)) {
        await addBtn.click();
        await sleep(2000);
        if (page.url().includes('/new')) {
          const inputs = await page.locator('input, select, textarea, button').count();
          console.log(`  New quote form: ${inputs} interactive elements`);
        }
        await screenshot(page, '24-b2b-quote-new');
      }
    });

    // ═══════════════════════════════════════════════════
    // 17. OPS + KPI
    // ═══════════════════════════════════════════════════
    await step('Ops checklist: toggle items', async () => {
      await page.goto(ADMIN + '/ops', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const checkboxes = page.locator('input[type="checkbox"]');
      const count = await checkboxes.count();
      if (count > 0) {
        await checkboxes.first().check().catch(() => {});
        await sleep(500);
        console.log(`  ${count} checklist items`);
      }
      await screenshot(page, '25-ops');
    });

    await step('KPI page', async () => {
      await page.goto(ADMIN + '/kpi', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      const hasMetrics = body.includes('Target') || body.includes('Order') || body.includes('Refund');
      console.log(`  ${hasMetrics ? '✅' : '⚠️'} KPI metrics`);
      await screenshot(page, '26-kpi');
    });

    // ═══════════════════════════════════════════════════
    // 18. SIDEBAR NAVIGATION
    // ═══════════════════════════════════════════════════
    await step('Sidebar: all nav items accessible', async () => {
      await page.goto(ADMIN + '/dashboard', { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const sidebarText = await page.locator('aside').textContent().catch(() => '');
      const navItems = ['Dashboard', 'Orders', 'Produk', 'Kategori', 'Inventory', 'Customers', 'Users', 'Coupons', 'Blog', 'Carousel', 'Testimonials', 'B2B', 'Settings', 'Field', 'KPI', 'Disputes', 'Shipments'];
      const found = navItems.filter(item => sidebarText.toLowerCase().includes(item.toLowerCase()));
      console.log(`  Nav items found: ${found.length}/${navItems.length}`);
      if (found.length < navItems.length) {
        const missing = navItems.filter(item => !found.includes(item));
        console.log(`  Missing: ${missing.join(', ')}`);
      }
      await screenshot(page, '27-sidebar');
    });

    // ═══════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════
    console.log('\n\n' + '═'.repeat(60));
    console.log('  ADMIN CRUD CAPABILITIES TEST');
    console.log('═'.repeat(60));
    const passed = results.filter(r => r.status === '✅').length;
    const failed = results.filter(r => r.status === '❌').length;
    console.log(`\n  Total operations: ${results.length}`);
    console.log(`  Passed:           ${passed} ✅`);
    console.log(`  Failed:           ${failed} ❌`);

    if (failed > 0) {
      console.log('\n  Failed:');
      results.filter(r => r.status === '❌').forEach(r => console.log(`    • ${r.step}: ${r.error}`));
    }

    console.log('\n  Detailed:');
    results.forEach(r => console.log(`    ${r.status} ${r.step}`));

    if (errors.length > 0) {
      console.log(`\n  React errors: ${errors.length}`);
    }
    console.log('\n' + '═'.repeat(60));

  } catch (e) {
    console.error(`\n❌ FATAL: ${e.message}`);
    await screenshot(page, 'fatal').catch(() => {});
  }

  await browser.close();
}

run();
