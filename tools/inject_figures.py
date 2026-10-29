# -*- coding: utf-8 -*-
"""A案核心：把 345 张图标记注入 data/text/{ID}/{juan}.md
锚点策略（顺序游标版）：
  1) before 锚：XML 中图前 40 规范字，在 md 中从游标起向后找，命中→段落边界后插
  2) after 锚：图后 40 规范字，从游标起找，命中→该段前插
  3) 都不中：链到同卷上一图之后；卷内首图则插到 --- 尾注前
"""
import json, re, os, sys

REPO = '/home/z/my-project/mikkyo-app/repo/'
TEXT = '/home/z/my-project/mikkyo-app/data/text/'
FIGURL = 'data/figures/'

fl = json.load(open('/home/z/my-project/figures_plan/figure_list.json'))

def strip_tags(s):
    s = re.sub(r'<[^>]+>', '', s)
    s = re.sub(r'\s+', '', s)
    return s

def norm_with_map(text):
    """返回 (规范化串, raw位置数组)"""
    out = []; pos = []
    for i, ch in enumerate(text):
        if ch.isspace():
            continue
        out.append(ch); pos.append(i)
    return ''.join(out), pos

stats = {'works': 0, 'figs': 0, 'before': 0, 'after': 0, 'chain': 0, 'tail': 0, 'missing_juan': 0}

for w in fl:
    wid = 'T' + re.match(r'T\d+n(\w+)', w['work']).group(1)
    xml = open(REPO + w['file'], encoding='utf-8', errors='ignore').read()
    # 卷里程碑位置表
    juan_marks = [(m.start(), m.group(1)) for m in re.finditer(r'<milestone n="([^"]+)" unit="juan"/>', xml)]
    if not juan_marks:
        juan_marks = [(0, '1')]
    # 每图：卷号 + before/after 锚
    figs = []
    for m in re.finditer(r'<figure>', xml):
        url = re.search(r'url="([^"]+)"', xml[m.start():m.start()+300])
        if not url:
            continue
        fig = os.path.basename(url.group(1)).replace('.gif', '.webp')
        juan = '1'
        for pos, jn in juan_marks:
            if pos < m.start():
                juan = jn
        s = max(0, m.start() - 2000)
        before = strip_tags(xml[s:m.start()])[-40:]
        end = xml.find('</figure>', m.start())
        after = strip_tags(xml[end:end+2200])[:40] if end > 0 else ''
        figs.append({'fig': fig, 'juan': juan, 'before': before, 'after': after})
    # 按卷分组
    byjuan = {}
    for f in figs:
        byjuan.setdefault(f['juan'], []).append(f)
    stats['works'] += 1
    for juan, fs in byjuan.items():
        mdpath = f'{TEXT}{wid}/{juan}.md'
        if not os.path.exists(mdpath):
            stats['missing_juan'] += len(fs)
            print(f'!! 卷文件缺失 {wid} {juan}（{len(fs)}图）', file=sys.stderr)
            continue
        md = open(mdpath, encoding='utf-8').read()
        norm, posmap = norm_with_map(md)
        # 尾注 --- 行位置（最后一段的 ---）
        tailpos = None
        for m in re.finditer(r'^---\s*$', md, re.M):
            tailpos = m.start()
        inserts = []   # [raw插入点, [tag,...], mode]  簇式：链式图并入上一簇
        cursor = 0     # norm 串游标
        for f in fs:
            tag = f'{FIGURL}{f["fig"]}'
            hit = None; mode = None
            if f['before']:
                i = norm.find(f['before'], cursor)
                if i < 0:
                    i = norm.find(f['before'])   # 从头再试一次
                if i >= 0:
                    rawend = posmap[i + len(f['before']) - 1] + 1
                    nl = md.find('\n', rawend)
                    ins = nl + 1 if nl >= 0 else len(md)
                    hit = ins; mode = 'before'
                    cursor = i + len(f['before'])
            if hit is None and f['after']:
                j = norm.find(f['after'], cursor)
                if j < 0:
                    j = norm.find(f['after'])
                if j >= 0:
                    rawstart = posmap[j]
                    ls = md.rfind('\n', 0, rawstart)
                    ins = ls + 1 if ls >= 0 else 0
                    hit = ins; mode = 'after'
                    cursor = j
            if hit is None:
                # 链到上一簇（若上一簇就在尾部/链式，直接并入保持顺序）
                if inserts and inserts[-1][2] in ('chain', 'tail'):
                    inserts[-1][1].append(tag)
                    stats['chain'] += 1; stats['figs'] += 1
                    continue
                if tailpos is not None:
                    hit = tailpos; mode = 'tail'
                else:
                    hit = len(md); mode = 'tail'
            inserts.append([hit, [tag], mode])
            stats[mode] = stats.get(mode, 0) + 1
            stats['figs'] += 1
        # 应用：按位置降序；同位置簇按列表序先后落位（降序插入天然保序）
        inserts.sort(key=lambda x: x[0], reverse=True)
        for ins, tags, mode in inserts:
            block = ''.join(f'\n![]({t})\n' for t in tags)
            md = md[:ins] + block + md[ins:]
        open(mdpath, 'w', encoding='utf-8').write(md)

print(f"图: {stats['figs']} | before {stats['before']} / after {stats['after']} / chain {stats['chain']} / tail {stats['tail']} | 缺卷 {stats['missing_juan']}")

# 复验：统计 md 中新增标记数
cnt = 0
for w in fl:
    wid = 'T' + re.match(r'T\d+n(\w+)', w['work']).group(1)
    d = f'{TEXT}{wid}'
    if os.path.isdir(d):
        for fn in os.listdir(d):
            cnt += open(f'{d}/{fn}', encoding='utf-8').read().count('![](data/figures/')
print(f'md 中图片标记总数: {cnt}（目标 345）')
