# -*- coding: utf-8 -*-
"""SAT BFS 抓取器：沿导航链接爬整部经（个人版 14 部）"""
import re, json, os, time, urllib.request, html as H
BASE = 'https://21dzk.l.u-tokyo.ac.jp/SAT/ddb-sat2.php'
ROOT = '/home/z/my-project/mikkyo-app/data'
os.makedirs(ROOT + '/extra', exist_ok=True)

LINE_RE = re.compile(
    r'<span style="color:black">(?P<wid>T(?P<wno>[0-9a-z]+)_\.(?P<vol>\d+)\.\d+[a-d]\d+):\s*</span>'
    r'<a name="[^"]+">(?P<body>.*?)</a>', re.S)
JUAN_RE = re.compile(r'^(?:&nbsp;|\s)*(?:<vol>)?(.*?卷第[一二三四五六七八九十百]+)$')

WORKS = [
    ('2377', 74, '山家學生式', '日本 最澄撰'),
    ('2376', 74, '顯戒論', '日本 最澄撰'),
    ('2362', 74, '守護國界章', '日本 最澄撰'),
    ('2395a', 75, '教時諍', '日本 安然撰'),
    ('2395b', 75, '教時諍論', '日本 安然撰'),
    ('2396', 75, '眞言宗教時義', '日本 安然撰'),
    ('2425', 77, '秘密漫荼羅十住心論', '日本 空海撰'),
    ('2426', 77, '祕藏寶鑰', '日本 空海撰'),
    ('2427', 77, '辨顯密二教論', '日本 空海撰'),
    ('2428', 77, '即身成佛義', '日本 空海撰'),
    ('2429', 77, '聲字實相義', '日本 空海撰'),
    ('2430', 77, '吽字義', '日本 空海撰'),
    ('2431', 77, '御遺告', '日本 空海撰'),
    ('2203a', 57, '般若心經祕鍵', '日本 空海撰'),
]

def fetch(u, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
            return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
        except Exception as e:
            if i == tries - 1:
                print('  fetch fail:', str(e)[:60], flush=True)
                return ''
            time.sleep(1.5)
    return ''

def parse(h, satid, vol):
    lines, nav = [], set()
    for m in LINE_RE.finditer(h):
        if m['wno'].lower() != satid.lower() or int(m['vol']) != vol:
            continue
        raw = m['body']
        is_jh = '<vol>' in raw
        body = re.sub(r'<button[^>]*>.*?</button>', '', raw, flags=re.S)
        body = body.replace('<vbr/>', '\n')
        body = H.unescape(re.sub(r'<[^>]+>', '', body)).replace('\u00a0', ' ').strip()
        lines.append((m['wid'], body, is_jh))
    for m in re.finditer(r'useid=(?P<s>[0-9a-z]+)_,(?P<v>\d+),(?P<p>\d{4})[^>]*>(?P<lbl>\d{1,4})<', h):
        if m['s'] == satid and int(m['v']) == vol:
            nav.add(int(m['p']))
    return lines, nav

def crawl(satid, vol):
    got, seen_pg, queue = [], set(), set()
    def visit(page):
        n = None
        h = fetch(f'{BASE}?mode=detail&useid={satid}_,{vol},{int(page):04d}')
        ls, nav = parse(h, satid, vol)
        got.extend(ls)
        seen_pg.add(int(page))
        if len(ls) or n is not None:
            pass
        print(f'    页{int(page):04d}: {len(ls)} 行', flush=True)
        for p in nav:
            if p not in seen_pg:
                queue.add(p)
    visit(1)
    if got:
        m = re.search(r'\.(\d{4})[a-d]\d+', got[0][0])
        if m:
            p0 = int(m.group(1))
            if p0 != 1 and p0 not in seen_pg:
                visit(p0)
    # 整经视图通常一次给全；不足再按带标签的页码补抓
    n = 0
    while queue and n < 150 and len(got) < 500:
        page = min(queue); queue.discard(page); n += 1
        if page in seen_pg: continue
        visit(page)
        time.sleep(1.2)
    seen, out = set(), []
    for row in got:
        if row[0] in seen: continue
        seen.add(row[0]); out.append(row)
    return out

def to_juans(satid, title, byline, lines):
    """卷首行（含卷第X）切卷，输出 deerpark 风格 md"""
    juans, cur, no = [], None, 0
    for wid, t, is_jh in lines:
        if is_jh and t:
            no += 1
            head = re.sub(r'^(?:&nbsp;|\s|<vol>)+', '', t.replace('\n', ' ')).strip()
            head = re.sub(r'\s+', ' ', head)
            if cur:
                juans.append(cur)
            cur = [f'#{title}', f'*{byline}*', f'**{head}**', '']
        else:
            if not t:
                continue
            if cur is None:
                cur = [f'#{title}', f'*{byline}*', '']
            if t.startswith('　') or t.startswith('  '):
                cur.append('\n' + t)
            else:
                cur.append(t)
    if cur:
        juans.append(cur)
    out = []
    for no, arr in enumerate(juans, 1):
        out.append({'juan': no, 'md': '\n'.join(arr)})
    return out

def main():
    idx = []
    for satid, vol, title, byline in WORKS:
        fp_exist = f'{ROOT}/extra/T{satid}.json'
        if os.path.exists(fp_exist) and os.path.getsize(fp_exist) > 3000:
            print(f'== T{satid} {title} 已有数据，跳过', flush=True)
            rows = json.load(open(fp_exist, encoding='utf-8'))
            idx.append({'id': 'T' + satid, 'title': title, 'byline': byline,
                        'juans': [r['juan'] for r in rows],
                        'chars': sum(len(r['md']) for r in rows),
                        'group': f'续部 · 第{vol}册'})
            continue
        print(f'== T{satid} {title} (vol {vol})', flush=True)
        lines = crawl(satid, vol)
        if not lines and satid[-1] in 'ab':
            print(f'  小写无果，试大写 {satid.upper()}…', flush=True)
            lines = crawl(satid.upper(), vol)
        if not lines:
            print('  0 行，跳过', flush=True)
            continue
        chars = sum(len(t) for _, t, _ in lines)
        print(f'  共 {len(lines)} 行 {chars} 字', flush=True)
        juans = to_juans(satid, title, byline, lines)
        wid = 'T' + satid
        with open(f'{ROOT}/extra/{wid}.json', 'w', encoding='utf-8') as f:
            json.dump([{'id': wid, 'title': title, 'byline': byline,
                        'juan': j['juan'], 'md': j['md']} for j in juans],
                      f, ensure_ascii=False, separators=(',', ':'))
        idx.append({'id': wid, 'title': title, 'byline': byline,
                    'juans': [j['juan'] for j in juans],
                    'chars': chars, 'group': f'续部 · 第{vol}册'})
        print(f'  -> {len(juans)} 卷 已存', flush=True)
    json.dump(idx, open(ROOT + '/extra_index.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('EXTRA DONE', flush=True)

if __name__ == '__main__':
    main()
