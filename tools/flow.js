// 流程截图：目录→部→经→阅读器→检索→夜间
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright/index.js');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 850 }, deviceScaleFactor: 2 });
  const P = 'http://127.0.0.1:8600/';
  await page.goto(P, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(800);
  // 进入册18
  await page.click('text=密教部 · 一'); await page.waitForTimeout(900);
  await page.screenshot({ path: '/tmp/ui-works.png' });
  // 打开第一部经（大日经 T0848 在最前）
  await page.click('.work >> nth=0'); await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/ui-reader.png' });
  // 夜间模式
  await page.click('#btn-theme'); await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/ui-night.png' });
  await page.click('#btn-theme'); await page.waitForTimeout(300);
  await page.click('#btn-back'); await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/ui-catalog.png' });
  // 检索
  await page.click('#tabbar button[data-go="search"]'); await page.waitForTimeout(500);
  await page.fill('#search-input', '金刚界'); await page.click('#btn-do-search');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: '/tmp/ui-search.png' });
  await browser.close(); console.log('flow shots done');
})().catch(e => { console.error('ERR', e.message.slice(0, 200)); process.exit(1); });
