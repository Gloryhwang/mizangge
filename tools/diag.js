const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright/index.js');
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 400, height: 850 } });
  await p.goto('http://127.0.0.1:8600/#search', { waitUntil: 'networkidle', timeout: 15000 });
  await p.click('#tabbar button[data-go="search"]'); await p.waitForTimeout(300);
  await p.fill('#search-input', '金刚界'); await p.click('#btn-do-search');
  await p.waitForTimeout(4500);
  const r = await p.evaluate(() => {
    const out = { scrollLeft: document.scrollingElement.scrollLeft, bodySL: document.body.scrollLeft, bodyST: document.body.scrollTop,
      sw: document.scrollingElement.scrollWidth, cw: document.scrollingElement.clientWidth, wide: [] };
    document.querySelectorAll('*').forEach(el => {
      const w = el.getBoundingClientRect();
      if (w.right > 401 || w.left < -1) out.wide.push(`${el.tagName}.${el.className && el.className.baseVal === undefined ? el.className : ''} L${Math.round(w.left)} R${Math.round(w.right)}`);
    });
    return { ...out, wide: out.wide.slice(0, 8) };
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})().catch(e => console.error(e.message.slice(0, 150)));
