const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(4000);
  
  // Click the canvas to focus
  await page.mouse.click(500, 500);
  await page.waitForTimeout(500);
  
  // Now try pressing space
  await page.keyboard.press('Space');
  await page.waitForTimeout(2000);
  
  console.log("TEST FINISHED");
  await browser.close();
})();
