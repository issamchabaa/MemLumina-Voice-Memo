import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  console.log("Navigating to app...");
  await page.goto('https://localhost:5176/', { waitUntil: 'networkidle' });

  // Login
  console.log("Logging in...");
  const hasEmail = await page.locator('input[type="email"]').count();
  if (hasEmail > 0) {
    await page.fill('input[type="email"]', 'issam.chabaa@gmail.com');
    await page.fill('input[type="password"]', 'Un2345678');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  } else {
    console.log("Already logged in or no login form.");
  }

  // Go to history by URL
  console.log("Navigating to history...");
  await page.goto('https://localhost:5176/history', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Get all memo cards
  const cards = page.locator('.space-y-4 > div[role="button"]');
  const count = await cards.count();
  console.log(`Found ${count} memo cards.`);

  if (count < 2) {
    console.log("Not enough cards to test top/bottom.");
    await browser.close();
    return;
  }

  // Click top card
  console.log("Clicking top card...");
  await cards.nth(0).click();
  await page.waitForTimeout(1000);
  
  const detailTitleTop = await page.locator('h3').first().innerText();
  console.log(`Top card detail title: ${detailTitleTop}`);
  
  // Close detail view
  const closeButton = page.locator('button:has-text("Close")').or(page.locator('.lucide-x').locator('..'));
  if (await closeButton.count() > 0) {
    await closeButton.first().click();
  } else {
    // maybe just click outside or ESC
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(1000);

  // Click bottom card
  console.log("Clicking bottom card...");
  await cards.nth(count - 1).click();
  await page.waitForTimeout(1000);
  
  const detailTitleBottom = await page.locator('h3').first().innerText();
  console.log(`Bottom card detail title: ${detailTitleBottom}`);
  
  await browser.close();
})();
