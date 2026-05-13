import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  
  await context.route('**/*firestore*', route => route.continue());

  console.log("Navigating to app...");
  await page.goto('https://localhost:5176/');
  
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', 'issam.chabaa@gmail.com');
  await page.fill('input[type="password"]', 'Un2345678');
  await page.click('button:has-text("Establish Link")');
  
  await page.waitForTimeout(2000);
  
  await page.locator('header button.glass-panel').nth(1).click();
  await page.waitForTimeout(2000);

  const cards = await page.$$('div[role="button"].glass-panel');
  console.log(`Found ${cards.length} cards.`);
  
  const lastCard = cards[cards.length - 1];
  const lastCardHTML = await lastCard.evaluate(node => node.outerHTML);
  console.log(`Last card HTML: ${lastCardHTML.substring(0, 300)}`);
  
  const expectedTextRaw = await lastCard.innerText();
  console.log(`Last card text:\n${expectedTextRaw}`);

  // Get the bounding box to see where we're clicking
  const box = await lastCard.boundingBox();
  console.log(`Last card bounding box:`, box);

  await lastCard.click();
  await page.waitForTimeout(2000);

  const textarea = await page.$('textarea');
  if (textarea) {
    const loadedText = await textarea.inputValue();
    console.log(`Loaded textarea text: ${loadedText.substring(0, 100)}`);
  } else {
    // maybe check what is displayed instead of textarea?
    const previewBody = await page.$('div.glass-panel .p-8');
    if (previewBody) {
      const previewText = await previewBody.innerText();
      console.log(`Loaded preview text:\n${previewText.substring(0, 100)}`);
    } else {
      console.log("Could not find loaded text area");
    }
  }

  await browser.close();
}

run().catch(console.error);
