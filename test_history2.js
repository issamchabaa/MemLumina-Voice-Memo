import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  console.log("Navigating to app...");
  await page.goto('https://localhost:5176/');
  await page.waitForTimeout(2000);

  // Login
  console.log("Logging in...");
  const hasEmail = await page.locator('input[type="email"]').count();
  if (hasEmail > 0) {
    await page.fill('input[type="email"]', 'issam.chabaa@gmail.com');
    await page.fill('input[type="password"]', 'Un2345678');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  console.log("Navigating to history...");
  await page.goto('https://localhost:5176/history');
  await page.waitForSelector('.space-y-4 > div[role="button"]', { timeout: 15000 }).catch(()=>null);
  await page.waitForTimeout(3000);

  const cards = page.locator('.space-y-4 > div[role="button"]');
  const count = await cards.count();
  console.log(`Found ${count} memo cards.`);

  if (count >= 2) {
    console.log("Clicking top card...");
    await cards.nth(0).click();
    await page.waitForTimeout(1000);
    const topText = await page.locator('h3').first().innerText();
    console.log(`Top card opened: ${topText}`);
    
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    console.log("Clicking bottom card...");
    await cards.nth(count - 1).click();
    await page.waitForTimeout(1000);
    const bottomText = await page.locator('h3').first().innerText();
    console.log(`Bottom card opened: ${bottomText}`);
  } else {
    console.log("Not enough cards.");
  }
  
  await browser.close();
})();
