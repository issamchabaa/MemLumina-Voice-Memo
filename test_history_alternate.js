import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  
  await context.route('**/*firestore*', route => route.continue());

  console.log("Navigating to app...");
  await page.goto('https://localhost:5176/');
  
  console.log("Logging in...");
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'issam.chabaa@gmail.com');
  await page.fill('input[type="password"]', 'Un2345678');
  await page.click('button:has-text("Establish Link")');
  
  await page.waitForTimeout(2000);
  
  console.log("Navigating to history...");
  await page.locator('header button.glass-panel').nth(1).click();
  await page.waitForTimeout(2000);

  await page.waitForSelector('div[role="button"].glass-panel', { timeout: 30000 }).catch(() => console.log('Timeout waiting for cards'));
  await page.waitForTimeout(2000);

  const cards = await page.$$('div[role="button"].glass-panel');
  console.log(`Found ${cards.length} memo cards.`);
  
  if (cards.length > 0) {
    const indices = [];
    let start = 0;
    let end = cards.length - 1;
    while (start <= end) {
      indices.push(end);
      if (start !== end) indices.push(start);
      start++;
      end--;
    }
    
    console.log(`Testing alternating order: ${indices.join(', ')}`);

    for (const idx of indices) {
      console.log(`\n--- Test clicking card ${idx} ---`);
      
      const currentCards = await page.$$('div[role="button"].glass-panel');
      if (!currentCards[idx]) {
        console.log(`Card ${idx} not found.`);
        continue;
      }

      const expectedTextRaw = await currentCards[idx].innerText();
      const expectedLines = expectedTextRaw.split('\n').filter(l => l.trim().length > 0);
      const summaryText = expectedLines.slice(1).join(' ');
      console.log(`Expected summary: ${summaryText.substring(0, 80)}...`);

      await currentCards[idx].click();
      await page.waitForTimeout(1000);

      const textarea = await page.$('textarea');
      if (textarea) {
        const loadedText = await textarea.inputValue();
        console.log(`Loaded text: ${loadedText.replace(/\n/g, ' ')}`);
        // The text is mostly in the 3rd line of the card text if the card has status + date + text
        let cardSnippet = expectedLines[2] ? expectedLines[2].substring(0, 20) : "";
        if (!loadedText.includes(cardSnippet)) {
            console.log("!!! MISMATCH !!!");
        }
      } else {
        console.log("Could not find textarea after click");
      }

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
