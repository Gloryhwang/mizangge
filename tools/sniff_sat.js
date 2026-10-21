// 嗅探 SAT2018：结构 + 搜索 T2425 时的真实数据 URL
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright/index.js');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const reqs = [];
  page.on('response', r => { if (r.url().includes('2425')) reqs.push(r.status() + ' ' + r.url()); });
  await page.goto('https://21dzk.l.u-tokyo.ac.jp/SAT2018/master.php', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('nav:', e.message.slice(0, 60)));
  await page.waitForTimeout(3000);
  // 框架结构
  const frames = page.frames().map(f => f.url());
  console.log('FRAMES:'); frames.forEach(f => console.log('  ', f.slice(0, 120)));
  // 找所有输入框
  for (const fr of page.frames()) {
    const inputs = await fr.$$eval('input, select', els => els.map(e => `${e.tagName}[type=${e.type || '-'} name=${e.name || '-'} id=${e.id || '-'}] form=${e.form ? e.form.action || '-' : '-'}`).slice(0, 12)).catch(() => []);
    if (inputs.length) { console.log('FRAME INPUTS:', fr.url().slice(0, 60)); inputs.forEach(i => console.log('  ', i)); }
  }
  await browser.close();
})().catch(e => { console.error('ERR', e.message.slice(0, 120)); process.exit(1); });
