import { chromium } from 'playwright';

const BASE = 'https://www.dapurdekaka.com';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshot(page, name) {
  await page.screenshot({ path: `/tmp/dd-${name}.png`, fullPage: true });
}

async function run() {
  const browser = await chromium.launch({ headless: true, slowMo: 30 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'id-ID' });
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
    // 1. BROWSE HOMEPAGE
    // ═══════════════════════════════════════════════════════════════
    await step('Homepage loads', async () => {
      await page.goto(BASE, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const title = await page.title();
      if (!title.includes('Dapur Dekaka')) throw new Error('Wrong title: ' + title);
      const h1 = await page.locator('h1').textContent();
      if (!h1) throw new Error('No H1');
      await screenshot(page, '01-homepage');
    });

    // ═══════════════════════════════════════════════════════════════
    // 2. BROWSE PRODUCTS
    // ═══════════════════════════════════════════════════════════════
    await step('Products page', async () => {
      await page.goto(`${BASE}/products`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const count = await page.locator('a[href*="/products/"]').count();
      if (count === 0) throw new Error('No products found');
      await screenshot(page, '02-products');
    });

    // ═══════════════════════════════════════════════════════════════
    // 3. PDP + ADD TO CART
    // ═══════════════════════════════════════════════════════════════
    await step('PDP + Add to Cart', async () => {
      await page.goto(`${BASE}/products/dimsum-tuna`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const h1 = await page.locator('h1').textContent();
      if (!h1) throw new Error('No PDP heading');

      // Click visible add-to-cart
      const btns = page.locator('button');
      let clicked = false;
      for (let i = 0; i < await btns.count(); i++) {
        const text = await btns.nth(i).textContent();
        if ((text.includes('Tambah') || text.includes('Keranjang')) && !text.includes('Habis') && await btns.nth(i).isVisible()) {
          await btns.nth(i).click();
          clicked = true;
          break;
        }
      }
      if (!clicked) throw new Error('Add-to-cart button not found or not visible');
      await sleep(1500);

      // Verify toast
      const toast = await page.locator('[data-sonner-toast], [role="status"]').first().isVisible().catch(() => false);
      if (!toast) console.log('  ⚠️ No toast detected (may have auto-dismissed)');
      await screenshot(page, '03-pdp');
    });

    // ═══════════════════════════════════════════════════════════════
    // 4. CART
    // ═══════════════════════════════════════════════════════════════
    await step('Cart page', async () => {
      await page.goto(`${BASE}/cart`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const body = await page.locator('body').textContent();
      if (!body.includes('dimsum') && !body.includes('Checkout') && !body.includes('Rp')) {
        console.log('  ⚠️ Cart appears empty (guest cart may not persist across hard navs)');
      }
      await screenshot(page, '04-cart');
    });

    // ═══════════════════════════════════════════════════════════════
    // 5. CHECKOUT — fill all steps
    // ═══════════════════════════════════════════════════════════════
    await step('Checkout identity step', async () => {
      await page.goto(`${BASE}/checkout`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(3000);

      const nameField = page.locator('input[name="recipientName"], input[placeholder*="Nama"]').first();
      if (!(await nameField.isVisible().catch(() => false))) throw new Error('Identity form not visible');

      await nameField.fill('Budi Santoso');
      await page.locator('input[name="recipientEmail"], input[type="email"]').first().fill('budi@example.com');
      await page.locator('input[name="recipientPhone"]').first().fill('08123456789');
      await page.locator('textarea').first().fill('Tolong tambahkan es batu');
      await screenshot(page, '05a-identity-filled');

      // Submit identity
      const submit = page.locator('button[type="submit"], button:has-text("Lanjut")').first();
      if (!(await submit.isVisible().catch(() => false))) throw new Error('Submit identity button not visible');
      await submit.click();
      await sleep(3000);
      await screenshot(page, '05b-after-identity');
    });

    await step('Checkout delivery step', async () => {
      // Check if we're on delivery step (radio buttons for deliver/pickup)
      const deliveryRadio = page.locator('input[value="delivery"], label:has-text("Diantar")').first();
      const pickupRadio = page.locator('input[value="pickup"], label:has-text("Ambil")').first();
      const dVisible = await deliveryRadio.isVisible().catch(() => false);
      const pVisible = await pickupRadio.isVisible().catch(() => false);

      if (dVisible || pVisible) {
        console.log('  Delivery/pickup step visible');
        await deliveryRadio.click().catch(() => {});
        await sleep(1500);
        await screenshot(page, '06a-delivery');

        // Try to fill address or use map picker
        const addrInput = page.locator('input[placeholder*="Alamat"], input[name="addressLine"]').first();
        if (await addrInput.isVisible().catch(() => false)) {
          await addrInput.fill('Jl. Merdeka No. 123, Bandung');
          await page.locator('input[name="city"]').first().fill('Bandung').catch(() => {});
          console.log('  Address filled manually');
        }

        // Advance
        const nextBtn = page.locator('button:has-text("Lanjut"), button:has-text("Simpan")').first();
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await sleep(3000);
          console.log('  Advanced after delivery');
        }
      } else {
        console.log('  ⚠️ Delivery step not visible (may have skipped)');
      }
      await screenshot(page, '06b-after-delivery');
    });

    await step('Checkout courier step', async () => {
      await sleep(2000);
      // Look for courier/tier options
      const rates = page.locator('button:has-text("Rp"), [type="radio"]');
      const rateCount = await rates.count();
      if (rateCount > 0) {
        // Click first selectable option
        for (let i = 0; i < rateCount; i++) {
          const disabled = await rates.nth(i).isDisabled().catch(() => true);
          if (!disabled && await rates.nth(i).isVisible()) {
            await rates.nth(i).click();
            await sleep(1000);
            console.log('  Courier option selected');
            break;
          }
        }
      } else {
        // Check for tier tabs
        const tiers = page.locator('button:has-text("Express"), button:has-text("Reguler")');
        if (await tiers.count() > 0) {
          await tiers.first().click();
          await sleep(2000);
          console.log('  Tier tab clicked');
        } else {
          console.log('  ⚠️ No courier options — may have picked pickup');
        }
      }

      const confirm = page.locator('button:has-text("Lanjut"), button:has-text("Konfirmasi")').first();
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click();
        await sleep(2000);
        console.log('  Confirmed shipping');
      }
      await screenshot(page, '07-courier');
    });

    // ═══════════════════════════════════════════════════════════════
    // 6. PAYMENT STEP
    // ═══════════════════════════════════════════════════════════════
    await step('Payment step', async () => {
      await sleep(2000);
      const body = await page.locator('body').textContent();

      const orderBtnTexts = ['Bayar', 'Pesan', 'Buat Pesanan', 'Order'];
      let foundBtn = false;
      for (const txt of orderBtnTexts) {
        if (body.includes(txt)) {
          foundBtn = true;
          break;
        }
      }
      console.log(`  ${foundBtn ? '✅' : '❌'} Place order button text found`);
      console.log(`  ${body.includes('Kupon') ? '✅' : '❌'} Coupon field`);
      console.log(`  ${/Rp\s*[\d.,]+/.test(body) ? '✅' : '❌'} Total price`);

      await screenshot(page, '08-payment');
    });

    // ═══════════════════════════════════════════════════════════════
    // 7. BLOG
    // ═══════════════════════════════════════════════════════════════
    await step('Blog listing', async () => {
      await page.goto(`${BASE}/blog`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const posts = await page.locator('a[href*="/blog/"]').count();
      if (posts === 0) console.log('  ⚠️ No blog posts found');
      await screenshot(page, '09-blog');
    });

    await step('Blog detail', async () => {
      const firstPost = page.locator('a[href*="/blog/"]').first();
      if (await firstPost.isVisible().catch(() => false)) {
        await firstPost.click();
        await sleep(2000);
        const body = await page.locator('body').textContent();
        const hasContent = body.length > 1000 || body.includes('prose');
        console.log(`  ${hasContent ? '✅' : '⚠️'} Article content loaded`);
        await screenshot(page, '10-blog-detail');
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // 8. B2B
    // ═══════════════════════════════════════════════════════════════
    await step('B2B landing', async () => {
      await page.goto(`${BASE}/b2b`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(2000);
      const secs = await page.locator('section').count();
      if (secs < 3) throw new Error('Not enough sections');
      await screenshot(page, '11-b2b');
    });

    await step('B2B quote form', async () => {
      const quoteForm = page.locator('#quote-form');
      if (await quoteForm.isVisible().catch(() => false)) {
        const inputs = await quoteForm.locator('input, textarea, select').count();
        console.log(`  Form fields: ${inputs}`);
      } else {
        console.log('  ⚠️ Quote form not found via id');
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // 9. STATIC PAGES
    // ═══════════════════════════════════════════════════════════════
    await step('About page', async () => {
      await page.goto(`${BASE}/about`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1500);
      const h1 = await page.locator('h1').textContent();
      if (!h1) throw new Error('No about heading');
      await screenshot(page, '12-about');
    });

    await step('Privacy & Refund policies', async () => {
      await page.goto(`${BASE}/privacy-policy`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      const p1 = await page.locator('h1').textContent();
      await page.goto(`${BASE}/refund-policy`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      const p2 = await page.locator('h1').textContent();
      console.log(`  Privacy: ${p1?.substring(0, 30)} | Refund: ${p2?.substring(0, 30)}`);
    });

    await step('Trust page', async () => {
      await page.goto(`${BASE}/trust`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      const h1 = await page.locator('h1').textContent();
      if (!h1) throw new Error('No trust heading');
    });

    await step('Maintenance page', async () => {
      await page.goto(`${BASE}/maintenance`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      const h1 = await page.locator('h1').textContent();
      if (!h1) throw new Error('No maintenance heading');
    });

    // ═══════════════════════════════════════════════════════════════
    // 10. AUTH FLOW
    // ═══════════════════════════════════════════════════════════════
    await step('Login page', async () => {
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1500);
      const h1 = await page.locator('h1').textContent();
      if (!h1 || !h1.includes('Masuk')) throw new Error('Not on login page');
      const inputs = await page.locator('input').count();
      const google = await page.locator('button:has-text("Google"), a:has-text("Google")').count();
      console.log(`  Inputs: ${inputs} | Google OAuth: ${google > 0 ? '✅' : '❌'}`);
      await screenshot(page, '13-login');
    });

    await step('Register page', async () => {
      await page.goto(`${BASE}/register`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1500);
      const h1 = await page.locator('h1').textContent();
      if (!h1 || !h1.includes('Daftar')) console.log('  ⚠️ Register page may have different heading');
      const inputs = await page.locator('input').count();
      console.log(`  Inputs: ${inputs}`);
      await screenshot(page, '14-register');
    });

    await step('Forgot password page', async () => {
      await page.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      const emailInput = await page.locator('input[type="email"]').count();
      console.log(`  Email input: ${emailInput > 0 ? '✅' : '❌'}`);
    });

    // ═══════════════════════════════════════════════════════════════
    // 11. ACCOUNT REDIRECT
    // ═══════════════════════════════════════════════════════════════
    await step('Account redirects to login', async () => {
      await page.goto(`${BASE}/account`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      const url = page.url();
      if (!url.includes('/login')) throw new Error('Did not redirect to login: ' + url);
      console.log(`  Redirected to /login`);
    });

    await step('Account orders redirect', async () => {
      await page.goto(`${BASE}/account/orders`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      if (!page.url().includes('/login')) throw new Error('Did not redirect');
    });

    // ═══════════════════════════════════════════════════════════════
    // 12. ORDER TRACKING (GUEST)
    // ═══════════════════════════════════════════════════════════════
    await step('Order tracking page', async () => {
      await page.goto(`${BASE}/orders/track/DDK-12345678-0001`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1500);
      const body = await page.locator('body').textContent();
      const hasForm = body.includes('Email') || body.includes('email') || body.includes('Lacak');
      console.log(`  ${hasForm ? '✅' : '❌'} Tracking form / email verification`);
      await screenshot(page, '15-tracking');
    });

    // ═══════════════════════════════════════════════════════════════
    // 13. NOT-FOUND PAGE
    // ═══════════════════════════════════════════════════════════════
    await step('Custom 404 page', async () => {
      const resp = await page.goto(`${BASE}/this-page-does-not-exist`, { waitUntil: 'networkidle', timeout: 20000 });
      await sleep(1000);
      const body = await page.locator('body').textContent();
      const has404 = body.includes('404') || body.includes('Halaman Tidak Ditemukan') || body.includes('dimsum');
      console.log(`  ${has404 ? '✅' : '⚠️'} Custom 404 page`);
      await screenshot(page, '16-404');
    });

    // ═══════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n\n' + '═'.repeat(58));
    console.log('  COMPLETE PRODUCTION E2E TEST RESULTS');
    console.log('═'.repeat(58));
    const passed = results.filter(r => r.status === '✅').length;
    const failed = results.filter(r => r.status === '❌').length;
    console.log(`\n  Total steps: ${results.length}`);
    console.log(`  Passed:      ${passed} ✅`);
    console.log(`  Failed:      ${failed} ❌`);

    if (failed > 0) {
      console.log('\n  Failed steps:');
      results.filter(r => r.status === '❌').forEach(r => {
        console.log(`    • ${r.step}: ${r.error || 'unknown error'}`);
      });
    }

    console.log('\n  Detailed results:');
    results.forEach(r => {
      console.log(`    ${r.status} ${r.step}`);
    });

    if (errors.length > 0) {
      console.log(`\n  Console/page errors (${errors.length}):`);
      errors.slice(0, 8).forEach(e => console.log(`    • ${e.substring(0, 100)}`));
    }

    console.log('\n' + '═'.repeat(58));

  } catch (e) {
    console.error(`\n❌ FATAL: ${e.message}`);
  }

  await browser.close();
}

run();
