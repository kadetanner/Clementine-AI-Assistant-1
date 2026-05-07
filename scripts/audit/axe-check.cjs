const { chromium } = require('@playwright/test');
const { injectAxe, getViolations } = require('axe-playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('lexi-onboarding-seen', '999'); } catch {} });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3030/#/logs');
  await page.waitForSelector('lexi-logs-view', { timeout: 5000 });
  await injectAxe(page);
  const v = await getViolations(page);
  for (const x of v) {
    if (x.impact !== 'serious' && x.impact !== 'critical') continue;
    console.log(`\n=== ${x.id} (${x.impact}) — ${x.help}`);
    for (const n of x.nodes.slice(0, 4)) {
      console.log(`  ${n.html.slice(0, 180)}`);
      console.log(`    target: ${n.target.join(' > ')}`);
      if (n.failureSummary) console.log(`    why: ${n.failureSummary.split('\n').slice(0,2).join(' | ')}`);
    }
  }
  await browser.close();
})();
