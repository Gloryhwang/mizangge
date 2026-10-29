/* 密藏阁 v1.0 — 前端逻辑（vanilla JS，零依赖） */
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ---------- 状态 ---------- */
const S = {
  index: null,            // {vols, works}
  volCache: {},           // volFile -> entries[]
  view: 'catalog',
  reader: null,           // {work, volFile, juan}
  term: '',
  fs: store.get('mzg-fs', 19),
  simp: store.get('mzg-simp', false),   // 简体显示模式
  vert: store.get('mzg-vert', false),   // 竖排书模式
  scanning: false
};

/* ---------- 主题 ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  store.set('mzg-theme', t);
  $('#btn-theme').textContent = t === 'ink' ? '☀' : '☾';
  try { if (window.MzgNative && window.MzgNative.setTheme) window.MzgNative.setTheme(t); } catch {}
}
$('#btn-theme').onclick = () =>
  applyTheme(document.documentElement.dataset.theme === 'ink' ? 'light' : 'ink');
applyTheme(store.get('mzg-theme', 'light'));

/* ---------- 繁→简 显示切换 ---------- */
let T2S = null;   // 繁字 -> 简字 映射（由 s2t.json 反转生成）
function buildT2S(s2t) {
  const t = {};
  for (const [simp, trad] of Object.entries(s2t.map || {})) t[trad] = simp;
  for (const [simp, arr] of Object.entries(s2t.multi || {})) arr.forEach(trad => { if (!(trad in t)) t[trad] = simp; });
  return t;
}
async function ensureT2S() {
  const s2t = await loadS2T();
  if (!T2S) T2S = buildT2S(s2t);
  return T2S;
}
/** 显示层文本：简体模式下繁→简逐字转换 */
function disp(s) {
  if (!S.simp || !T2S || !s) return s;
  let out = '';
  for (const ch of s) out += (T2S[ch] || ch);
  return out;
}
function applySimpUI() { $('#btn-simp').textContent = S.simp ? '简' : '繁'; }
$('#btn-simp').onclick = async () => {
  S.simp = !S.simp;
  store.set('mzg-simp', S.simp);
  applySimpUI();
  if (S.simp) await ensureT2S();
  renderCatalog();
  if (S.view === 'reader' && S.reader) { $('#appbar-title').textContent = disp(S.reader.work.title); renderJuan(); }
  else if (S.view === 'search' && S.term) doSearch();
};
applySimpUI();

/* 原生壳：返回键协议（阅读器→目录，其余交给系统退出） */
window.mzgBack = function () {
  if (S.view === 'reader') { go('catalog'); return 'true'; }
  return 'false';
};

/* ---------- 路由 ---------- */
const VIEWS = ['catalog', 'reader', 'search', 'marks'];
const TITLES = { catalog: '密藏阁', reader: '', search: '检索', marks: '书签' };
function go(view, push = true) {
  S.view = view;
  VIEWS.forEach(v => { $('#view-' + v).hidden = v !== view; });
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.go === view));
  const inReader = view === 'reader';
  $('#btn-back').hidden = !inReader;
  $('#btn-search').hidden = view !== 'catalog';
  $('#appbar-title').textContent = inReader
    ? (S.reader ? S.reader.work.title : $('#appbar-title').textContent)
    : TITLES[view];
  $('#tabbar').hidden = inReader;
  if (view === 'marks') renderMarks();
  syncVert();
  if (push && view !== 'reader') store.set('mzg-last-view', view);
  window.scrollTo(0, 0);
}
$('#btn-back').onclick = () => go('catalog');
$$('#tabbar button').forEach(b => b.onclick = () => go(b.dataset.go));

/* ---------- 数据加载 ---------- */
async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

async function loadVol(vf) {
  if (S.volCache[vf]) return S.volCache[vf];
  const entries = await loadJSON('data/' + vf + '.json');
  S.volCache[vf] = entries;
  return entries;
}

/* ---------- 目录 ---------- */
function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderCatalog() {
  const openVols = new Set(Array.from($$('#catalog .volgroup.open'), el => el.dataset.vol));
  const byVol = {};
  S.index.works.forEach(w => (byVol[w.vol] = byVol[w.vol] || []).push(w));
  const order = Object.keys(S.index.vols).sort((a, b) =>
    ({ 18: 1, 19: 2, 20: 3, 21: 4, 0: 5 }[a] ?? 9) - ({ 18: 1, 19: 2, 20: 3, 21: 4, 0: 5 }[b] ?? 9));
  let html = '';
  for (const v of order) {
    const meta = S.index.vols[String(v)];
    const ws = byVol[v] || [];
    if (!ws.length) continue;
    const label = v === 0 ? '附收 · 论疏三种' : meta.name;
    html += `<div class="volgroup${openVols.has(String(v)) ? ' open' : ''}" data-vol="${v}">
      <div class="volhead"><b>${disp(label)}</b><small>${ws.length} 部 · ${fmtChars(meta.chars)}字</small></div>
      <div class="volbody">`;
    for (const w of ws) {
      html += `<div class="work" data-id="${w.id}">
        <span class="tno">${w.id.replace('T0', 'T')}</span>
        <span class="tname">${esc(disp(w.title))}</span>
        <span class="tmeta">${w.juans.length}卷</span></div>`;
    }
    html += '</div></div>';
  }
  $('#catalog').innerHTML = html;
  $$('#catalog .volhead').forEach(h =>
    h.onclick = () => h.parentElement.classList.toggle('open'));
  $$('#catalog .work').forEach(el =>
    el.onclick = () => openReader(el.dataset.id));
  renderRecent();
}

function fmtChars(n) { return n >= 10000 ? (n / 10000).toFixed(1) + '万' : n; }

/* ---------- 阅读 ---------- */
const CN_NUM = '〇一二三四五六七八九十';
function juanLabel(n) {
  if (n <= 10) return '第' + CN_NUM[n] + '卷';
  if (n < 20) return '第十' + CN_NUM[n - 10] + '卷';
  return '第' + n + '卷';
}

function findWork(id) { return S.index.works.find(w => w.id === id); }

async function openReader(id, juan, term) {
  const work = findWork(id);
  if (!work) return;
  const vf = String(work.vol) === '0' ? 'vol00' : 'vol' + work.vol;
  $('#appbar-title').textContent = disp(work.title);
  go('reader');
  $('#reader-body').innerHTML = '<p style="text-align:center;color:var(--soft)">…</p>';
  try {
    await loadVol(vf);
  } catch (e) {
    $('#reader-body').innerHTML = '<p>数据加载失败：' + esc(e.message) + '</p>';
    return;
  }
  juan = juan || store.get('pos:' + id, {}).juan || work.juans[0];
  S.reader = { work, volFile: vf, juan, term: term || '' };
  renderJuan();
  // 恢复滚动位置（仅当是该卷）
  const pos = store.get('pos:' + id, {});
  if (pos.juan === juan && pos.ratio) requestAnimationFrame(() => setScrollRatio(pos.ratio));
  pushRecent(id, juan);
}

function renderJuan() {
  const { work, volFile, juan } = S.reader;
  const entry = (S.volCache[volFile] || []).find(e => e.id === work.id && e.juan === juan);
  if (!entry) { $('#reader-body').innerHTML = '<p>未找到该卷文本。</p>'; return; }
  $('#reader-body').innerHTML = mdRender(disp(entry.md));
  if (S.reader.term) highlight($('#reader-body'), S.reader.term);

  const js = work.juans;
  const i = js.indexOf(juan);
  $('#juan-pos').textContent = juanLabel(juan) + ' · 共' + js.length + '卷';
  $('#btn-prev').disabled = i <= 0;
  $('#btn-next').disabled = i >= js.length - 1;
  const sel = $('#juan-select');
  sel.innerHTML = js.map(j =>
    `<option value="${j}" ${j === juan ? 'selected' : ''}>${juanLabel(j)}</option>`).join('');
  window.scrollTo(0, 0);
  if (S.vert) requestAnimationFrame(() => vertStart($('#reader-body')));
  else $('#reader-body').scrollLeft = 0;
}

$('#juan-select').onchange = e => { S.reader.juan = +e.target.value; renderJuan(); };
$('#btn-prev').onclick = () => stepJuan(-1);
$('#btn-next').onclick = () => stepJuan(1);
function stepJuan(d) {
  const js = S.reader.work.juans;
  const i = js.indexOf(S.reader.juan) + d;
  if (i < 0 || i >= js.length) return;
  S.reader.juan = js[i];
  renderJuan();
}

/* 字号 */
function applyFS() { document.documentElement.style.setProperty('--fs', S.fs + 'px'); store.set('mzg-fs', S.fs); }
$('#btn-fs-inc').onclick = () => { S.fs = Math.min(28, S.fs + 1); applyFS(); };
$('#btn-fs-dec').onclick = () => { S.fs = Math.max(14, S.fs - 1); applyFS(); };
applyFS();

/* ---------- 滚动位置记忆（横排走窗口，竖排走阅读容器） ---------- */
/* 竖排 scrollLeft 语义因内核而异：新版 Chromium 负值域（0=最右起点），
   部分内核正值域（0=最左）。首次使用时探测并缓存，读写全部走统一换算。 */
let vertNeg = null;   // null=未探测
function vertMax(el) { return el.scrollWidth - el.clientWidth; }
function vertDomainNeg(el) {
  if (vertNeg !== null) return vertNeg;
  const max = vertMax(el);
  if (max <= 0) return true;
  el.scrollLeft = -max;
  if (el.scrollLeft === -max) { vertNeg = true; el.scrollLeft = 0; }
  else { vertNeg = false; el.scrollLeft = max; }
  return vertNeg;
}
function vertStart(el) { el.scrollLeft = vertDomainNeg(el) ? 0 : vertMax(el); }
function vertRatio(el) {
  const max = vertMax(el);
  if (max <= 0) return 0;
  return vertDomainNeg(el) ? (-el.scrollLeft) / max : el.scrollLeft / max;
}
function vertSetRatio(el, r) {
  const max = vertMax(el);
  el.scrollLeft = vertDomainNeg(el) ? -max * r : max * r;
}
function scrollRatio() {
  if (!S.vert) {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    return h > 0 ? window.scrollY / h : 0;
  }
  return vertRatio($('#reader-body'));
}
function setScrollRatio(r) {
  if (!S.vert) {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, h * r);
  } else {
    vertSetRatio($('#reader-body'), r);
  }
}
let scrollTimer = null;
function savePos() {
  if (S.view !== 'reader' || !S.reader) return;
  store.set('pos:' + S.reader.work.id, { juan: S.reader.juan, ratio: +scrollRatio().toFixed(4) });
}
window.addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(savePos, 350); });
$('#reader-body').addEventListener('scroll', () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(savePos, 350); });

/* ---------- 竖排 / 横排书 ---------- */
function syncVert() {
  $('#btn-vert').classList.toggle('on', S.vert);
  document.documentElement.classList.toggle('vert', S.vert && S.view === 'reader');
}
$('#btn-vert').onclick = () => {
  const inReader = S.view === 'reader' && S.reader;
  const ratio = inReader ? scrollRatio() : null;
  S.vert = !S.vert;
  store.set('mzg-vert', S.vert);
  syncVert();
  if (inReader) requestAnimationFrame(() => setScrollRatio(ratio));
};

/* ---------- 亮度 ---------- */
function setBright(v, save) {
  v = Math.max(10, Math.min(100, v));
  $('#bright-range').value = v;
  if (save) store.set('mzg-bright', v);
  let native = false;
  try { if (window.MzgNative && window.MzgNative.setBrightness) { window.MzgNative.setBrightness(v / 100); native = true; } } catch {}
  document.documentElement.style.filter = (!native && v < 100)
    ? `brightness(${(0.35 + 0.65 * v / 100).toFixed(3)})` : '';
}
$('#btn-bright').onclick = () => { $('#bright-range').hidden = !$('#bright-range').hidden; };
$('#bright-range').oninput = e => setBright(+e.target.value, true);
setBright(store.get('mzg-bright', 100), false);

/* ---------- 迷你 Markdown 渲染 ---------- */
function inline(s) {
  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/\*(.+?)\*/g, '<i>$1</i>');
  return s;
}
function mdRender(md) {
  const lines = md.split('\n');
  let html = '', inQuote = false, footer = false, buf = [];
  const seenT = new Set(), seenB = new Set();
  let skipPair = false;
  const flush = () => { if (buf.length) { html += '<p>' + buf.map(inline).join('<br>') + '</p>'; buf = []; } };
  const endQuote = () => { if (inQuote) { html += '</blockquote>'; inQuote = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^# /.test(line)) { flush(); endQuote(); html += `<div class="doc-title">${inline(line.slice(2))}</div>`; continue; }
    if (/^## /.test(line)) { flush(); endQuote(); html += `<h3>${inline(line.slice(3))}</h3>`; continue; }
    if (/^&gt;-{2,}|^-{3,}$/.test(line)) { flush(); endQuote(); footer = true; continue; }
    if (/^&gt; /.test(line) || /^> /.test(line)) { flush(); if (!inQuote) { html += '<blockquote>'; inQuote = true; } html += inline(line.replace(/^>\s?/, '')) + '<br>'; continue; }
    endQuote();
    if (!line) { flush(); continue; }
    if (/^\*\*(.+)\*\*$/.test(line)) {
      flush();
      const inner = line.slice(2, -2);
      if (seenT.has(inner)) { skipPair = true; continue; }
      seenT.add(inner); skipPair = false;
      html += `<div class="doc-title" style="font-size:1.05em">${inline(line)}</div>`; continue;
    }
    if (/^\*([^*]+)\*$/.test(line)) {
      flush();
      const inner = line.slice(1, -1);
      if (skipPair && seenB.has(inner)) { continue; }
      seenB.add(inner); skipPair = false;
      html += `<p class="byline">${inline(line)}</p>`; continue;
    }
    if (/^No\.\s*\d+$/.test(line) || /^[（(]\d+[)）]$/.test(line)) { flush(); html += `<div class="meta-line">${inline(line)}</div>`; continue; }
    if (/^!\[\]\(data\/figures\/[\w.-]+\)$/.test(line)) {   /* 经文原图（v1.2.0） */
      flush(); endQuote();
      html += `<figure class="fig"><img src="${line.slice(4, -1)}" alt="经文原图" loading="lazy" decoding="async"></figure>`;
      continue;
    }
    if (footer) {
      flush();
      buf.push(line);
      if (buf.length >= 1) { html += '<div class="src-footer">' + buf.map(inline).join('<br>') + '</div>'; buf = []; }
      continue;
    }
    buf.push(line);
  }
  flush(); endQuote();
  return html;
}

function highlight(root, term) {
  if (!term) return;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const node of nodes) {
    const text = node.nodeValue;
    const idx = text.indexOf(term);
    if (idx < 0) continue;
    const frag = document.createDocumentFragment();
    let last = 0, pos;
    let rest = text;
    while ((pos = rest.indexOf(term)) >= 0) {
      frag.appendChild(document.createTextNode(rest.slice(0, pos)));
      const mk = document.createElement('mark');
      mk.textContent = term;
      frag.appendChild(mk);
      rest = rest.slice(pos + term.length);
      if (frag.childNodes.length > 60) break;
    }
    frag.appendChild(document.createTextNode(rest));
    node.parentNode.replaceChild(frag, node);
  }
}

/* ---------- 书签 ---------- */
$('#btn-mark').onclick = () => {
  if (!S.reader) return;
  const { work, juan } = S.reader;
  const marks = store.get('mzg-marks', []);
  if (marks.some(m => m.id === work.id && m.juan === juan)) { flashMark(true); return; }
  marks.unshift({ id: work.id, title: work.title, juan, ts: Date.now() });
  store.set('mzg-marks', marks.slice(0, 100));
  flashMark(false);
};
function flashMark(exists) {
  const b = $('#btn-mark');
  b.textContent = exists ? '✓ 已有' : '✓ 已签';
  setTimeout(() => b.textContent = '☆ 签', 1200);
}
function renderMarks() {
  const marks = store.get('mzg-marks', []);
  if (!marks.length) { $('#marks-list').innerHTML = '<div class="empty">尚无书签 · 阅读时点「☆ 签」</div>'; return; }
  $('#marks-list').innerHTML = marks.map((m, i) =>
    `<div class="mark-item" data-i="${i}"><span class="m-title">${esc(disp(m.title))}</span>
     <span class="m-juan">${juanLabel(m.juan)}</span>
     <button class="m-del" data-i="${i}" aria-label="删除">×</button></div>`).join('');
  $$('#marks-list .mark-item').forEach(el => el.onclick = e => {
    if (e.target.classList.contains('m-del')) {
      const marks = store.get('mzg-marks', []);
      marks.splice(+e.target.dataset.i, 1);
      store.set('mzg-marks', marks);
      renderMarks();
      return;
    }
    const m = store.get('mzg-marks', []) [+el.dataset.i];
    openReader(m.id, m.juan);
  });
}

/* ---------- 最近阅读 ---------- */
function pushRecent(id, juan) {
  let rec = store.get('mzg-recent', []).filter(r => r.id !== id);
  rec.unshift({ id, juan, ts: Date.now() });
  store.set('mzg-recent', rec.slice(0, 5));
  if (S.index) renderRecent();
}
function renderRecent() {
  const rec = store.get('mzg-recent', []).slice(0, 3);
  const box = $('#recent');
  if (!rec.length) { box.hidden = true; return; }
  box.hidden = false;
  box.querySelector('#recent-list').innerHTML = rec.map(r => {
    const w = findWork(r.id); if (!w) return '';
    return `<div class="work" data-id="${w.id}"><span class="tno">${w.id.replace('T0', 'T')}</span>
      <span class="tname">${esc(disp(w.title))}</span>
      <span class="tmeta">${juanLabel(r.juan)}</span></div>`;
  }).join('');
  $$('#recent-list .work').forEach(el => el.onclick = () => openReader(el.dataset.id));
}

/* ---------- 检索 ---------- */
$('#btn-search').onclick = () => go('search');
$('#search-input').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
$('#btn-do-search').onclick = doSearch;

/* 册文件与名称由 index.vols 动态决定（公开版 5 组，个人版含续部组） */
const FILE_OF = k => (String(k) === '0' ? 'vol00' : 'vol' + k);
function volTables() {
  const files = [], names = {};
  Object.keys(S.index.vols).forEach(k => {
    const f = FILE_OF(k);
    files.push(f);
    names[f] = S.index.vols[k].name || f;
  });
  return { files, names };
}
function stripMd(s) { return s.replace(/^#+\s?/gm, '').replace(/\*\*|\*|^>\s?/gm, ''); }

/* 简→繁查询转换（含歧义字多变体） */
let S2T = null;
async function loadS2T() {
  if (S2T) return S2T;
  try { S2T = await loadJSON('data/s2t.json'); } catch { S2T = { map: {}, multi: {} }; }
  return S2T;
}
function termVariants(term, s2t) {
  const opts = [];
  let combo = 1;
  for (const ch of term) {
    const alts = new Set([ch]);
    const t = s2t.map[ch]; if (t) alts.add(t);
    const m = s2t.multi[ch]; if (m) m.forEach(a => alts.add(a));
    const arr = [...alts];
    opts.push(arr);
    combo *= arr.length;
    if (combo > 24) { opts.length = 0; opts.push([term]); break; }  // 兜底：整词原样
  }
  let vs = [''];
  for (const o of opts) {
    const nv = [];
    for (const v of vs) for (const c of o) nv.push(v + c);
    vs = nv;
    if (vs.length > 24) { vs = vs.slice(0, 24); }
  }
  return [...new Set(vs)];
}

async function doSearch() {
  const term = $('#search-input').value.trim();
  if (!term || S.scanning) return;
  S.term = term;
  S.scanning = true;
  $('#search-results').innerHTML = '';
  $('#scan-status').hidden = false;
  const s2t = await loadS2T();
  const variants = termVariants(term, s2t);
  const results = [];
  const { files: VOLF, names: VOLN } = volTables();
  try {
    for (let i = 0; i < VOLF.length; i++) {
      const vf = VOLF[i];
      $('#scan-text').textContent = `扫描 ${VOLN[vf]}…`;
      const entries = await loadVol(vf);
      for (const e of entries) {
        const plain = stripMd(e.md);
        let best = -1, hitV = '';
        for (const v of variants) {
          const p = plain.indexOf(v);
          if (p >= 0 && (best < 0 || p < best)) { best = p; hitV = v; }
        }
        let idx = best, hits = 0;
        while (idx >= 0 && hits < 2) {
          const a = Math.max(0, idx - 26), b = Math.min(plain.length, idx + hitV.length + 30);
          results.push({ id: e.id, title: e.title, juan: e.juan, v: hitV,
            snip: (a > 0 ? '…' : '') + plain.slice(a, b) + (b < plain.length ? '…' : '') });
          hits++;
          if (results.length >= 400) break;
          idx = plain.indexOf(hitV, idx + hitV.length);
        }
        if (results.length >= 400) break;
      }
      $('#scan-fill').style.width = ((i + 1) / VOLF.length * 100) + '%';
      if (results.length >= 400) break;
    }
  } catch (e) {
    $('#scan-text').textContent = '扫描出错：' + e.message;
  }
  S.scanning = false;
  setTimeout(() => $('#scan-status').hidden = true, 600);
  renderResults(term, results);
}

function renderResults(term, results) {
  const box = $('#search-results');
  if (!results.length) {
    box.innerHTML = '<div class="search-empty">未检得 · 换个关键词试试</div>';
    return;
  }
  const byWork = {};
  results.forEach(r => (byWork[r.id + '|' + r.title] = byWork[r.id + '|' + r.title] || []).push(r));
  let html = `<div class="sr-group">检得 ${results.length} 处 · ${Object.keys(byWork).length} 部</div>`;
  for (const key of Object.keys(byWork)) {
    const [id, title] = key.split('|');
    html += `<div class="sr-group">${id.replace('T0', 'T')} ${esc(disp(title))}</div>`;
    for (const r of byWork[key]) {
      const v = disp(r.v || term);
      const snip = esc(disp(r.snip)).split(v).join('<mark>' + esc(v) + '</mark>');
      html += `<div class="sr-item" data-id="${r.id}" data-juan="${r.juan}">
        <span class="sr-j">${juanLabel(r.juan)}</span>${snip}</div>`;
    }
  }
  box.innerHTML = html;
  $$('#search-results .sr-item').forEach(el =>
    el.onclick = () => openReader(el.dataset.id, +el.dataset.juan, term));
}

/* ---------- 经图点击放大（v1.2.0） ---------- */
(function () {
  let ov = null, big = null;
  function open(src) {
    if (!ov) {
      ov = document.createElement('div'); ov.id = 'figbox';
      const wrap = document.createElement('div'); wrap.className = 'fb-wrap';
      big = document.createElement('img'); big.alt = '经文原图';
      big.onclick = () => { big.classList.toggle('z2'); };        /* 点图缩放切换 */
      const x = document.createElement('button'); x.id = 'figbox-x'; x.textContent = '×';
      x.setAttribute('aria-label', '关闭');
      x.onclick = e => { e.stopPropagation(); ov.hidden = true; };
      wrap.appendChild(big);
      ov.appendChild(wrap); ov.appendChild(x);
      ov.onclick = e => { if (e.target === wrap || e.target === ov) ov.hidden = true; };
      document.body.appendChild(ov);
    }
    big.classList.remove('z2');
    big.src = src;
    ov.hidden = false;
  }
  document.addEventListener('click', e => {
    const t = e.target;
    if (t instanceof HTMLImageElement && t.closest('.fig')) { e.preventDefault(); open(t.src); }
  });
})();

/* ---------- 启动 ---------- */
(async function init() {
  try {
    S.index = await loadJSON('data/index.json');
    if (S.simp) await ensureT2S();
    renderCatalog();
    const last = store.get('mzg-last-view', 'catalog');
    go(last === 'reader' ? 'catalog' : last);
  } catch (e) {
    $('#catalog').innerHTML = '<div class="empty">数据未就绪：' + esc(e.message) + '</div>';
  }
})();
