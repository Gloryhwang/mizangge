const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright/index.js');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const urls = new Set();
  page.on('response', r => urls.add(r.status() + ' ' + r.url()));
  await page.goto('https://21dzk.l.u-tokyo.ac.jp/SAT2018/master.php', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const form = await page.$eval('form', f => f.outerHTML).catch(() => 'NO FORM');
  console.log('=== FORM ===');
  console.log(form.slice(0, 2500));
  await browser.close();
})().catch(e => { console.error('ERR', e.message.slice(0, 120)); process.exit(1); });
