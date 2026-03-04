const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(3000);
  
  // The Play button has a lucide-play icon in it.
  const playBtn = await page.$('svg.lucide-play');
  if (playBtn) {
     const parentBtn = await playBtn.evaluateHandle(el => el.closest('button'));
     await parentBtn.click();
     console.log("CLICKED PLAY BTN");
  } else {
     console.log("PLAY BTN NOT FOUND");
  }
  
  await page.waitForTimeout(2000);
  
  console.log("TEST FINISHED");
  await browser.close();
})();
