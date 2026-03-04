const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
     // Access zustand store if it's exposed, if not we can't.
     console.log("Timeline durationMs:");
  });
  
  await page.waitForTimeout(2000);
  await browser.close();
})();
