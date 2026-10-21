// 本地预览截图
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright/index.js');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 850 }, deviceScaleFactor: 2 });
  await page.goto(process.argv[2] || 'http://127.0.0.1:8600/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: process.argv[3] || '/tmp/shot.png', fullPage: process.argv[4] === 'full' });
  await browser.close();
  console.log('shot saved');
})().catch(e => { console.error(e.message); process.exit(1); });
