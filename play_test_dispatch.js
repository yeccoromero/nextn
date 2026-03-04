const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
     document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
     console.log('SPACEBAR DISPATCHED');
  });
  
  await page.waitForTimeout(2000);
  console.log("TEST FINISHED");
  await browser.close();
})();
