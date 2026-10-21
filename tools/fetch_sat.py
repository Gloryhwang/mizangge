# -*- coding: utf-8 -*-
"""从东京大学 SAT 抓取 56-84 册的 14 部个人版经文（个人使用，不公开散布）"""
import re, json, os, time, html, urllib.request, urllib.parse

ROOT = '/home/z/my-project/mikkyo-app/data'
BASE = 'https://21dzk.l.u-tokyo.ac.jp/SAT/ddb-sat2.php'
os.makedirs(ROOT + '/extra', exist_ok=True)

WORKS = [
    ('2203a', 57, '般若心經祕鍵', '日本 空海撰'),
    ('2362', 74, '守護國界章', '日本 最澄撰'),
    ('2376', 74, '顯戒論', '日本 最澄撰'),
    ('2377', 74, '山家學生式', '日本 最澄撰'),
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
]

LINE_RE = re.compile(
    r'<span style="color:black">(T[0-9a-z]+_\.(\d+)\.\d+[a-d]\d+):\s*</span>'
    r'<a name="[^"]+">(.*?)</a>', re.S)
JUAN_RE = re.compile(r'卷第[一二三四五六七八九十百]+$')

def fetch(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            return urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
        except Exception as e:
            if i == tries - 1:
                print('  fetch fail:', url[:70], e, flush=True)
                return ''
            time.sleep(2)

def clean(raw):
    t = re.sub(r'<button[^>]*>.*?</button>', '', raw, flags=re.S)   # 校注标记
    t = t.replace('<vbr/>', '\n')
    t = re.sub(r'<[^>]+>', '', t)
    t = html.unescape(t)
    t = GAIJI.sub('□', t)
    t = t.replace('\u00a0', ' ').replace('&nbsp;', ' ')
    t = re.sub(r' {2,}', ' ', t)
    lines = [x.strip() for x in t.split('\n')]
    return [x for x in lines if x]

def find_start(satid, vol, title):
    """用标题词搜索定位本经起始页"""
    q = urllib.parse.quote(title[:4])
    h = fetch(f'{BASE}?mode=search&key={q}&tall=1')
    pages = [int(m) for m in re.findall(
        r'useid=' + re.escape(satid) + r'_,' + str(vol) + r',(\d{4})', h)]
    if pages:
        p = min(pages)
        print(f'  搜索定位起始页 {p:04d}', flush=True)
        return p
    return None

def parse_page(h, satid, vol):
    out = []
    for m in LINE_RE.finditer(h):
        if m.group(2) != satid or m.group(3) != str(vol):
            continue
        for seg in clean(m.group(4)):
            out.append(seg)
    return out

def crawl_work(satid, vol, title):
    lines_all = []
    first = find_start(satid, vol, title)
    if first is None:
        print('  未定位到起始页，跳过', flush=True)
        return []
    page = first
    empty_streak = 0
    while page <= first + 420:
        h = fetch(f'{BASE}?mode=detail&useid={satid}_,{vol},{page:04d}')
        ls = parse_page(h, satid, vol)
        if not ls:
            empty_streak += 1
            if empty_streak >= 2:
                break
        else:
            empty_streak = 0
            lines_all.extend(ls)
        time.sleep(0.35)
        page += 1
    chars = sum(len(t) for _, t in lines_all)
    print(f'  {len(lines_all)} 行 {chars} 字', flush=True)
    return lines_all

def to_juans(satid, title, byline, lines):
    """按 卷第X 标题行切卷，输出 markdown"""
    juans, cur_no, cur = [], 0, []
    CN = '一二三四五六七八九十百'
    def flush(no, arr):
        if not arr:
            return
        md = f'# {title}\n\n*{byline}*\n\n**{title}卷第{CN[no] if no < 10 else no+1}**\n\n'
        md += ''.join(arr)
        juans.append({'juan': no + 1, 'md': md})
    for seg in lines:
        m = JUAN_RE.search(seg)
        if m and len(seg) <= len(title) + 6:
            flush(cur_no, cur)
            cur_no += 1
            cur = [seg, '\n']
        else:
            cur.append(seg)
            cur.append('\n' if seg.startswith('　') or len(seg) < 14 else '')
    flush(cur_no, cur)
    return juans

def main():
    idx = []
    for satid, vol, title, byline in WORKS:
        print(f'== T{satid} {title} (vol {vol})', flush=True)
        lines = crawl_work(satid, vol, title)
        if not lines:
            continue
        juans = to_juans(satid, title, byline, lines)
        wid = 'T' + satid
        with open(f'{ROOT}/extra/{wid}.json', 'w', encoding='utf-8') as f:
            json.dump([{'id': wid, 'title': title, 'byline': byline,
                        'juan': j['juan'], 'md': j['md']} for j in juans],
                      f, ensure_ascii=False, separators=(',', ':'))
        idx.append({'id': wid, 'title': title, 'byline': byline,
                    'juans': [j['juan'] for j in juans],
                    'chars': sum(len(x) for _, x in lines),
                    'group': f'续部 · 第{vol}册'})
        print(f'  -> {len(juans)} 卷 已存', flush=True)
    json.dump(idx, open(ROOT + '/extra_index.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('EXTRA DONE', flush=True)

if __name__ == '__main__':
    main()
