/**
 * Production guest checkout smoke (through payment step UI, before Midtrans popup).
 * Run: npx --yes playwright@1.49.1 install chromium && node scripts/e2e-prod-flow.mjs
 */
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL ?? 'https://www.dapurdekaka.com';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function screenshot(page, name) {
  await page.screenshot({ path: `/tmp/dapurdekaka-${name}.png`, fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function clickVisibleButton(page, texts) {
  const buttons = page.locator('button');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const text = ((await btn.textContent().catch(() => '')) || '').trim();
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) continue;
    if (texts.some((t) => text.includes(t))) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click({ force: true });
      return text;
    }
  }
  return null;
}

async function run() {
  const browser = await chromium.launch({ headless: true, slowMo: 40 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'id-ID',
  });
  const page = await context.newPage();
  const apiErrors = [];
  page.on('response', async (res) => {
    if (res.url().includes('/api/') && res.status() >= 400) {
      const body = await res.text().catch(() => '');
      apiErrors.push(`${res.status()} ${res.url()} ${body.slice(0, 160)}`);
    }
  });

  const results = [];

  try {
    console.log(`\nBase: ${BASE}`);

    console.log('\n═══ 1. HOMEPAGE ═══');
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2000);
    results.push(['Homepage', true]);
    await screenshot(page, '01-homepage');

    console.log('\n═══ 2. PRODUCTS ═══');
    await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2000);
    const productLinks = await page.locator('a[href*="/products/"]').count();
    console.log(`  Product links: ${productLinks}`);
    results.push(['Products', productLinks > 0]);
    await screenshot(page, '02-products');

    console.log('\n═══ 3. PDP + ADD TO CART ═══');
    await page.goto(`${BASE}/products/dimsum-tuna`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2500);
    // Clear prior cart/draft so guest identity is visible
    await page.evaluate(() => {
      localStorage.removeItem('dapur-cart');
      sessionStorage.removeItem('checkout-draft');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2000);

    const clicked = await clickVisibleButton(page, ['Tambah', 'Keranjang']);
    console.log(clicked ? `  ✅ Add to cart: ${clicked}` : '  ❌ Add to cart failed');
    results.push(['PDP + Add to Cart', Boolean(clicked)]);
    await sleep(1500);
    await screenshot(page, '03-pdp');

    console.log('\n═══ 4. CART ═══');
    await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(2000);
    const cartText = (await page.locator('body').textContent()) || '';
    const hasItems = /Rp\s*[\d.]+/.test(cartText) && !/kosong/i.test(cartText);
    console.log(`  Cart has items: ${hasItems ? '✅' : '❌'}`);
    results.push(['Cart', hasItems]);
    await screenshot(page, '04-cart');

    console.log('\n═══ 5. CHECKOUT IDENTITY ═══');
    await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(() => sessionStorage.removeItem('checkout-draft'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(2500);

    const nameField = page.locator('#fullName, input[name="recipientName"], input[placeholder*="nama" i]').first();
    let nameVisible = await nameField.isVisible().catch(() => false);
    if (!nameVisible) {
      // Cart may have been cleared by reload — re-add via evaluate if store exists
      await page.goto(`${BASE}/products/dimsum-tuna`, { waitUntil: 'domcontentloaded' });
      await sleep(1500);
      await clickVisibleButton(page, ['Tambah', 'Keranjang']);
      await sleep(1000);
      await page.goto(`${BASE}/checkout`, { waitUntil: 'domcontentloaded' });
      await sleep(2500);
      nameVisible = await nameField.isVisible().catch(() => false);
    }

    if (nameVisible) {
      const emailField = page.locator('input[name="recipientEmail"], input[type="email"]').first();
      const phoneField = page.locator('input[name="recipientPhone"], input[type="tel"]').first();
      await nameField.click();
      await nameField.fill('Budi Santoso');
      await emailField.click();
      await emailField.fill('budi.e2e@dapurdekaka.com');
      await phoneField.click();
      await phoneField.fill('081234567890');
      await page.locator('form button[type="submit"]').click();
      await sleep(2000);
      const body = (await page.locator('body').textContent()) || '';
      const advanced = /Diantar|Ambil di Toko|Pengiriman/.test(body) && !/Data Diri/.test(body);
      // Data Diri may still appear in stepper label — check delivery controls
      const deliveryVisible = await page.locator('text=Diantar').first().isVisible().catch(() => false)
        || await page.locator('text=Ambil di Toko').first().isVisible().catch(() => false);
      console.log(`  Identity advanced: ${deliveryVisible ? '✅' : '❌'}`);
      results.push(['Checkout identity', deliveryVisible]);
    } else {
      console.log('  ❌ Identity form not visible');
      results.push(['Checkout identity', false]);
    }
    await sleep(1500);
    await screenshot(page, '05-checkout-identity');

    console.log('\n═══ 6. DELIVERY + COURIER ═══');
    // Prefer delivery path — rates now work with BITESHIP on prod
    const deliveryLabel = page.locator('label:has-text("Diantar"), button:has-text("Diantar"), text=Diantar').first();
    if (await deliveryLabel.isVisible().catch(() => false)) {
      await deliveryLabel.click();
      await sleep(800);
    }

    const addr = page.locator('#addressLine, input[name="addressLine"]').first();
    if (await addr.isVisible().catch(() => false)) {
      await addr.fill('Jl. Asia Afrika No. 1, Sumur Bandung');
      const city = page.locator('#city').first();
      if (await city.isVisible().catch(() => false)) await city.fill('Bandung');
      const province = page.locator('#province').first();
      if (await province.isVisible().catch(() => false)) await province.fill('Jawa Barat');
      const postal = page.locator('#postalCode').first();
      if (await postal.isVisible().catch(() => false)) await postal.fill('40111');
      const cont = await clickVisibleButton(page, ['Lanjut ke Kurir', 'continueToCourier', 'Lanjut']);
      console.log(`  Address confirm: ${cont || 'none'}`);
      await sleep(5000);
    } else {
      // Fallback: pickup path
      const pickup = page.locator('label:has-text("Ambil"), button:has-text("Ambil"), text=Ambil di Toko').first();
      if (await pickup.isVisible().catch(() => false)) {
        await pickup.click();
        await sleep(800);
        await clickVisibleButton(page, ['Lanjut', 'Bayar', 'Konfirmasi']);
        await sleep(2000);
      }
    }
    await screenshot(page, '06-delivery');

    // Prefer Kilat/express tier (available in phase0); frozen tiers may be phase-locked
    const kilatTab = page.locator('button').filter({ hasText: /Kilat/i }).first();
    if (await kilatTab.isVisible().catch(() => false)) {
      await kilatTab.click();
      await sleep(800);
    }

    const courierOption = page
      .locator('button')
      .filter({ hasText: /Grab|GoSend|Goje|instant|same_day/i })
      .first();
    if (await courierOption.isVisible().catch(() => false)) {
      await courierOption.click();
      await sleep(500);
      const ack = page.locator('#instant-ack, input[type="checkbox"]').first();
      if (await ack.count()) {
        await ack.check({ force: true }).catch(async () => {
          await page.locator('label[for="instant-ack"]').click({ force: true }).catch(() => {});
        });
      }
      await clickVisibleButton(page, ['Lanjut ke Pembayaran']);
      await sleep(2500);
      const payVisible = await page.locator('button:has-text("Bayar Sekarang")').first().isVisible().catch(() => false);
      console.log(payVisible ? '  ✅ Courier → payment' : '  ⚠️ Courier selected but payment not shown');
      results.push(['Delivery + Courier', payVisible]);
    } else {
      console.log('  ⚠️ No selectable courier option');
      results.push(['Delivery + Courier', false]);
    }
    await screenshot(page, '07-courier');

    console.log('\n═══ 7. PAYMENT STEP ═══');
    await sleep(1500);
    const paymentBody = (await page.locator('body').textContent()) || '';
    const payBtn = page.locator('button:has-text("Bayar Sekarang")').first();
    const payVisible = await payBtn.isVisible().catch(() => false);
    const atPayment = payVisible || /Bayar Sekarang/i.test(paymentBody);
    console.log(`  Payment CTA: ${atPayment ? '✅' : '❌'}`);
    results.push(['Payment Step', atPayment]);
    await screenshot(page, '08-payment-step');

    console.log('\n' + '═'.repeat(55));
    console.log('  E2E FLOW TEST — PRODUCTION');
    console.log('═'.repeat(55));
    for (const [name, ok] of results) {
      console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    }
    if (apiErrors.length) {
      console.log('\n  API errors:');
      apiErrors.slice(0, 8).forEach((e) => console.log(`    • ${e}`));
    }
    console.log('═'.repeat(55));

    const failed = results.filter(([, ok]) => !ok);
    if (failed.length) process.exitCode = 1;
  } catch (err) {
    console.error(`\n❌ FATAL: ${err.message}`);
    await page.screenshot({ path: '/tmp/dapurdekaka-fatal.png' }).catch(() => {});
    process.exitCode = 1;
  }

  await browser.close();
}

run();
