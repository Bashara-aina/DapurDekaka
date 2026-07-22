import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function screenshot(page, name) {
  await page.screenshot({ path: `/tmp/dapurdekaka-${name}.png`, fullPage: true });
  console.log(`  📸 Screenshot: ${name}.png`);
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'id-ID',
  });
  const page = await context.newPage();
  const errors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text().substring(0, 120);
      if (!t.includes('favicon') && !t.includes('Sentry') && !t.includes('source map') && !t.includes('404')) {
        errors.push(`[CONSOLE] ${t}`);
      }
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[PAGE] ${err.message.substring(0, 120)}`);
  });

  try {

    // ═══════════════════════════════════════════════════════════════
    // STEP 1: HOMEPAGE
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 1: HOMEPAGE ═══');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(2000);
    console.log(`  Title: ${await page.title()}`);
    const heroH1 = await page.textContent('h1').catch(() => '(none)');
    console.log(`  Hero: "${heroH1?.substring(0, 60)}"`);
    await screenshot(page, '01-homepage');

    // ═══════════════════════════════════════════════════════════════
    // STEP 2: BROWSE PRODUCTS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 2: BROWSE PRODUCTS ═══');
    // Click "Katalog" in navbar
    await page.click('a[href="/products"]');
    await sleep(2000);
    console.log(`  Title: ${await page.title()}`);
    const productCards = await page.$$('a[href*="/products/"]');
    console.log(`  Products found: ${productCards.length}`);
    await screenshot(page, '02-products');

    // ═══════════════════════════════════════════════════════════════
    // STEP 3: VIEW PRODUCT DETAIL
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 3: PRODUCT DETAIL ═══');
    // Click the first product card
    const firstProductLink = await page.$('a[href*="/products/"][href*="/products/"]');
    if (!firstProductLink) throw new Error('No product link found');
    const productUrl = await firstProductLink.getAttribute('href');
    console.log(`  Clicking: ${productUrl}`);
    await firstProductLink.click();
    await sleep(2000);
    console.log(`  PDP Title: ${await page.title()}`);

    const pdpH1 = await page.textContent('h1').catch(() => '(none)');
    console.log(`  Product: "${pdpH1?.substring(0, 50)}"`);

    // Check price
    const priceEl = await page.$('[class*="font-bold text-brand-red"]');
    if (priceEl) {
      const price = await priceEl.textContent();
      console.log(`  Price: ${price}`);
    }
    await screenshot(page, '03-pdp');

    // ═══════════════════════════════════════════════════════════════
    // STEP 4: ADD TO CART (DESKTOP)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 4: ADD TO CART ═══');

    // Find the visible add-to-cart button
    const addBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cartBtn = btns.find(b =>
        (b.textContent.includes('Keranjang') || b.textContent.includes('Tambah')) &&
        b.offsetParent !== null
      );
      if (cartBtn) {
        const rect = cartBtn.getBoundingClientRect();
        return { found: true, x: rect.x, y: rect.y };
      }
      return { found: false };
    });

    if (addBtn.found) {
      console.log(`  Desktop add-to-cart at (${addBtn.x}, ${addBtn.y})`);
      await page.mouse.click(addBtn.x + 50, addBtn.y + 20);
      await sleep(1500);
      console.log('  ✅ Clicked add to cart');

      // Check for toast notification
      const toast = await page.$('[data-sonner-toast], [role="status"]');
      console.log(`  Toast notification: ${toast ? '✅' : '❌'}`);
    } else {
      console.log('  ⚠️  No visible add-to-cart button');
    }
    await screenshot(page, '04-after-add-to-cart');

    // ═══════════════════════════════════════════════════════════════
    // STEP 5: VIEW CART
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 5: VIEW CART ═══');
    // Click cart icon in navbar
    const cartLink = await page.$('a[aria-label="Keranjang"], a[href="/cart"]');
    if (cartLink) {
      const href = await cartLink.getAttribute('href');
      if (href === '/cart' || href?.startsWith('/cart')) {
        await page.goto(BASE + '/cart', { waitUntil: 'networkidle' });
      } else {
        await cartLink.click();
      }
    } else {
      await page.goto(BASE + '/cart', { waitUntil: 'networkidle' });
    }
    await sleep(2000);

    const cartBody = await page.textContent('body').catch(() => '');
    const hasItems = cartBody.includes('Checkout') || cartBody.includes('checkout') || cartBody.includes('Total');
    console.log(`  Cart has items: ${hasItems ? '✅' : '⚠️  (may need login for server sync)'}`);

    // Check for the item
    const cartItems = await page.$$('[data-slot="card"], [class*="cart-item"]');
    console.log(`  Cart item elements: ${cartItems.length}`);
    await screenshot(page, '05-cart');

    // Try to click checkout
    const checkoutLink = await page.$('a[href*="checkout"], button:has-text("Checkout"), a:has-text("Checkout")');
    if (checkoutLink) {
      console.log('  Checkout button found: ✅');
      // Click checkout to proceed
      const href = await checkoutLink.getAttribute('href').catch(() => null);
      if (href) {
        console.log(`  Navigating to checkout via href: ${href}`);
        await page.goto(BASE + href, { waitUntil: 'networkidle' });
      } else {
        await checkoutLink.click();
      }
    } else {
      // If no checkout button, go directly to checkout
      console.log('  No checkout button — going to checkout URL directly');
      await page.goto(BASE + '/checkout', { waitUntil: 'networkidle' });
    }
    await sleep(2000);

    // ═══════════════════════════════════════════════════════════════
    // STEP 6: CHECKOUT - IDENTITY STEP
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 6: CHECKOUT - IDENTITY ═══');
    const currentUrl = page.url();
    console.log(`  Current URL: ${currentUrl.substring(0, 80)}`);

    // Check if we're on checkout page
    if (currentUrl.includes('/checkout')) {
      console.log('  ✅ On checkout page');

      // Fill identity form if present
      const nameInput = await page.$('input[name="recipientName"], input[placeholder*="Nama"]');
      const emailInput = await page.$('input[name="recipientEmail"], input[type="email"]');
      const phoneInput = await page.$('input[name="recipientPhone"], input[placeholder*="Telepon"]');

      if (nameInput && emailInput && phoneInput) {
        await nameInput.fill('Budi Santoso');
        await emailInput.fill('budi@example.com');
        await phoneInput.fill('08123456789');
        console.log('  ✅ Filled identity form');

        // Check for notes textarea
        const noteInput = await page.$('textarea[name="customerNote"], textarea');
        if (noteInput) {
          await noteInput.fill('Tolong tambahkan es batu');
          console.log('  ✅ Added customer note');
        }

        await screenshot(page, '06-checkout-identity');

        // Submit identity step
        const submitBtn = await page.$('button[type="submit"], button:has-text("Lanjut")');
        if (submitBtn) {
          await submitBtn.click();
          await sleep(2000);
          console.log('  ✅ Submitted identity');
        } else {
          console.log('  ⚠️  No submit button found');
        }
      } else {
        console.log('  ⚠️  Identity form not found (may be logged in)');
      }
    } else {
      console.log('  ⚠️  Not on checkout page — cart may be empty');
    }
    await screenshot(page, '07-after-identity');

    // ═══════════════════════════════════════════════════════════════
    // STEP 7: CHECKOUT - DELIVERY METHOD
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 7: CHECKOUT - DELIVERY ═══');
    await sleep(1000);

    // Check for delivery/pickup toggle
    const deliveryOption = await page.$('input[type="radio"][value="delivery"], label:has-text("Diantar")');
    const pickupOption = await page.$('input[type="radio"][value="pickup"], label:has-text("Ambil")');

    if (deliveryOption) {
      console.log('  Delivery option found: ✅');
      // Select delivery if not already selected
      const isChecked = await deliveryOption.isChecked().catch(() => false);
      if (!isChecked) {
        await deliveryOption.click();
        await sleep(500);
        console.log('  ✅ Selected delivery');
      }
    }

    if (pickupOption) {
      console.log('  Pickup option found: ✅');
    }

    // Look for address/map picker
    const addressInput = await page.$('input[placeholder*="Alamat"], input[name="addressLine"]');
    const savedAddress = await page.$('button:has-text("Alamat"), [class*="address"]');

    if (addressInput) {
      console.log('  Address input found — manual address entry');
      await addressInput.fill('Jl. Merdeka No. 123, Bandung');
      // Fill other address fields
      const cityInput = await page.$('input[name="city"], input[placeholder*="Kota"]');
      if (cityInput) {
        await cityInput.fill('Bandung');
      }
      const postalInput = await page.$('input[name="postalCode"], input[placeholder*="Kode Pos"]');
      if (postalInput) {
        await postalInput.fill('40111');
      }
      console.log('  ✅ Filled address');
    } else if (savedAddress) {
      console.log('  Saved addresses found — selecting first');
      await savedAddress.click();
      await sleep(500);
    } else {
      console.log('  ⚠️  No address input found');
    }

    await screenshot(page, '08-checkout-delivery');

    // Click next
    const nextBtn = await page.$('button:has-text("Lanjut"), button[type="submit"]');
    if (nextBtn) {
      await nextBtn.click();
      await sleep(3000);
      console.log('  ✅ Proceeded to courier step');
    } else {
      console.log('  ⚠️  No next button found — may auto-advance');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 8: CHECKOUT - COURIER SELECTION
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 8: CHECKOUT - COURIER ═══');
    await sleep(2000);

    // Look for courier options / shipping rate selection
    const courierOptions = await page.$$('button:has-text("Reguler"), button:has-text("Express"), [type="radio"]');
    console.log(`  Courier options found: ${courierOptions.length}`);

    // Look for tier tabs
    const tierTabs = await page.$$('button:has-text("Express"), button:has-text("Same Day"), button:has-text("Reguler")');
    console.log(`  Shipping tier tabs: ${tierTabs.length}`);

    // Try to select first available courier
    const selectableOption = await page.$('button:not([disabled])[class*="border"]:has-text("Rp"), [type="radio"]:not([disabled])');
    if (selectableOption) {
      await selectableOption.click();
      await sleep(1000);
      console.log('  ✅ Selected courier option');
    } else {
      console.log('  ⚠️  No selectable courier option');
    }

    await screenshot(page, '09-checkout-courier');

    // Confirm shipping
    const confirmBtn = await page.$('button:has-text("Lanjut"), button:has-text("Konfirmasi"), button[type="submit"]');
    if (confirmBtn) {
      await confirmBtn.click();
      await sleep(2000);
      console.log('  ✅ Confirmed shipping');
    } else {
      console.log('  ⚠️  No confirm button found');
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 9: CHECKOUT - PAYMENT STEP (before Midtrans)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n═══ STEP 9: CHECKOUT - PAYMENT STEP ═══');
    await sleep(2000);

    // Check if we reached the payment step
    const paymentText = await page.textContent('body').catch(() => '');
    const atPayment = paymentText.includes('Pembayaran') || paymentText.includes('payment') || paymentText.includes('Bayar');
    console.log(`  At payment step: ${atPayment ? '✅' : '⚠️'}`);

    // Look for coupon input
    const couponInput = await page.$('input[placeholder*="Kupon"], input[placeholder*="coupon"], input[name="coupon"]');
    console.log(`  Coupon input: ${couponInput ? '✅' : '❌'}`);

    // Look for points toggle
    const pointsToggle = await page.$('[role="switch"], input[type="checkbox"]:has-text("Poin")');
    console.log(`  Points toggle: ${pointsToggle ? '✅' : '❌'}`);

    // Check order summary
    const totalAmount = await page.$('[class*="font-bold"]:has-text("Rp")');
    if (totalAmount) {
      const total = await totalAmount.textContent();
      console.log(`  Total amount: ${total}`);
    }

    // Look for the "Place Order" / "Bayar" button (before Midtrans)
    const placeOrderBtn = await page.$('button:has-text("Bayar"), button:has-text("Pesan"), button:has-text("Order")');
    console.log(`  Place order button: ${placeOrderBtn ? '✅' : '❌'}`);

    await screenshot(page, '10-checkout-payment');

    // ═══════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(50));
    console.log('FULL FLOW TEST COMPLETE');
    console.log('═'.repeat(50));
    console.log('\nFlow completed: Homepage → Products → PDP → Add to Cart → Cart → Checkout (Identity → Delivery → Courier → Payment)');
    console.log(`\nErrors: ${errors.length}`);
    if (errors.length > 0) {
      errors.slice(0, 5).forEach(e => console.log(`  • ${e}`));
    }
    console.log(`\nScreenshots saved to /tmp/dapurdekaka-*.png`);
    console.log('═'.repeat(50));

  } catch (err) {
    console.error(`\n❌ FATAL: ${err.message}`);
    await page.screenshot({ path: '/tmp/dapurdekaka-fatal-error.png', fullPage: true });
  }

  await sleep(2000);
  await browser.close();
}

run();
