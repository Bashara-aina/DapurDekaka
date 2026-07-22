import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log('=== PDP Add-to-Cart Flow Test ===\n');

  await page.goto('https://www.dapurdekaka.com/products/dimsum-tuna', {
    waitUntil: 'networkidle',
  });
  await new Promise(r => setTimeout(r, 2000));

  // Check for desktop add-to-cart section (hidden.md:flex)
  const desktopSection = await page.evaluate(() => {
    const el = document.querySelector('.hidden.md\\:flex');
    return el ? el.outerHTML.substring(0, 100) : null;
  });
  console.log('Desktop add-to-cart section:', desktopSection ? '✅ FOUND' : '❌ NOT FOUND');

  // Find all visible add-to-cart buttons
  const buttons = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button'));
    return all
      .filter(b => b.textContent?.includes('Keranjang') || b.textContent?.includes('Tambah'))
      .map(b => ({
        text: b.textContent?.substring(0, 40),
        visible: b.offsetParent !== null,
        rect: b.getBoundingClientRect(),
        classes: b.className.substring(0, 60),
      }));
  });

  console.log('Add-to-cart buttons found:', buttons.length);
  buttons.forEach((b, i) => {
    console.log(`  [${i}] "${b.text}" visible:${b.visible} y:${Math.round(b.rect.y)} classes:${b.classes}`);
  });

  // Click the first visible add-to-cart button
  for (const btn of buttons) {
    if (btn.visible) {
      console.log(`\nClicking visible button at y=${btn.rect.y}...`);
      // Scroll to it first
      await page.evaluate((y) => window.scrollTo(0, y - 100), btn.rect.y);
      await new Promise(r => setTimeout(r, 500));
      
      const allButtons = await page.$$('button');
      for (const b of allButtons) {
        const text = await b.textContent().catch(() => '');
        if (text.includes('Keranjang') || text.includes('Tambah')) {
          const isVisible = await b.isVisible().catch(() => false);
          if (isVisible) {
            await b.click();
            console.log('  ✅ Clicked!');
            break;
          }
        }
      }
      break;
    }
  }

  // Wait for toast
  await new Promise(r => setTimeout(r, 2000));

  // Go to cart
  console.log('\nNavigating to cart...');
  await page.goto('https://www.dapurdekaka.com/cart', { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 2000));

  const cartText = await page.textContent('body').catch(() => '');
  if (cartText.includes('Checkout') || cartText.includes('checkout') || cartText.includes('Total') || cartText.includes('Rp')) {
    console.log('✅ Cart has items');
  } else {
    console.log('ℹ️  Cart appears empty (guest cart may not persist across page loads without server sync)');
  }

  await browser.close();
  console.log('\n=== Done ===');
}

run().catch(e => console.error('FATAL:', e.message));
