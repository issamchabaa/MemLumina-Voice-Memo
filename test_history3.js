import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  
  // Route to bypass Firestore long polling which blocks networkidle
  await context.route('**/*firestore*', route => route.continue());

  console.log("Navigating to app...");
  await page.goto('https://localhost:5176/');
  
  console.log("Logging in...");
  // AuthModal is already shown, no need to click Identity Link
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'issam.chabaa@gmail.com');
  await page.fill('input[type="password"]', 'Un2345678');
  await page.click('button:has-text("Establish Link")');
  
  await page.waitForTimeout(2000);
  
  console.log("Navigating to history...");
  await page.locator('header button.glass-panel').nth(1).click();
  await page.waitForTimeout(2000);

  // Wait for at least one card
  await page.waitForSelector('div[role="button"].glass-panel', { timeout: 30000 }).catch(() => console.log('Timeout waiting for cards'));
  await page.waitForTimeout(2000);

  const cards = await page.$$('div[role="button"].glass-panel');
  console.log(`Found ${cards.length} memo cards.`);
  
  if (cards.length > 0) {
    for (let i = 0; i < cards.length; i++) {
      const text = await cards[i].innerText();
      console.log(`Card ${i}: ${text.split('\\n').join(' ').substring(0, 100)}`);
    }
    // Test all cards
    for (let idx = 0; idx < cards.length; idx++) {
      console.log(`\n--- Test clicking card ${idx} ---`);
      
      // We need to re-fetch cards after navigation
      const currentCards = await page.$$('div[role="button"].glass-panel');
      if (!currentCards[idx]) {
        console.log(`Card ${idx} not found.`);
        continue;
      }

      const expectedTextRaw = await currentCards[idx].innerText();
      // the first line is usually the title or date, the rest is text
      const expectedLines = expectedTextRaw.split('\n').filter(l => l.trim().length > 0);
      const summaryText = expectedLines.slice(1).join(' ');
      console.log(`Expected summary to include: ${summaryText.substring(0, 80)}...`);

      await currentCards[idx].click();
      await page.waitForTimeout(1000);

      const textarea = await page.$('textarea');
      if (textarea) {
        const loadedText = await textarea.inputValue();
        console.log(`Loaded text: ${loadedText.replace(/\n/g, ' ')}`);
        if (!loadedText.includes(expectedLines[2] ? expectedLines[2].substring(0, 20) : "MISSING")) {
            console.log("!!! MISMATCH !!!");
        }
      } else {
        console.log("Could not find textarea after click");
      }

      // Go back to history list
      await page.locator('header button.glass-panel').nth(1).click();
      await page.waitForTimeout(1000);
    }
  } else {
    console.log("Not enough cards. Taking screenshot...");
    await page.screenshot({ path: 'screenshot.png' });
  }
  
  await browser.close();
}

run().catch(console.error);
