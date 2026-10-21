// 嗅探 cbetaonline 加载经文时的 XHR 端点
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright/index.js');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const hits = new Set();
  page.on('response', async (res) => {
    const url = res.url();
    if (/\.(json|txt|xml)(\?|$)/.test(url) || /api|juan|work|text|sutra/i.test(url)) {
      if (!/\.(js|css|png|jpg|woff2?|svg|ico)(\?|$)/.test(url)) {
        hits.add(`${res.status()} ${url}`);
      }
    }
  });
  await page.goto('https://cbetaonline.dila.edu.tw/zh/T2425_001', { waitUntil: 'networkidle', timeout: 60000 }).catch(e => console.log('nav:', e.message.slice(0, 80)));
  await page.waitForTimeout(4000);
  for (const h of hits) console.log(h);
  await browser.close();
})();
