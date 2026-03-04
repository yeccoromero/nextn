const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(5000);
  
  await page.evaluate(() => {
     const stateNode = document.createElement('div');
     stateNode.id = 'playwright_state';
     document.body.appendChild(stateNode);
     
     // Let's hook into console log directly
     const orgLog = console.log;
     console.log = (...args) => {
         stateNode.innerHTML += args.join(' ') + '<br/>';
         orgLog(...args);
     };
     
     // Click play
     const btns = Array.from(document.querySelectorAll('button'));
     const playBtn = btns.find(b => b.innerHTML.includes('lucide-play'));
     if (playBtn) playBtn.click();
     else document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
  });
  
  await page.waitForTimeout(2000);
  
  const content = await page.evaluate(() => document.getElementById('playwright_state').innerText);
  console.log("DOM LOGS:\n" + content);
  
  await browser.close();
})();
