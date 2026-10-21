# -*- coding: utf-8 -*-
"""构建 data/index.json：经目元数据 + 册分组"""
import json, os

ROOT = '/home/z/my-project/mikkyo-app/data'
src = json.load(open(ROOT + '/index_source.json', encoding='utf-8'))

VOLS = {18: '密教部 · 一', 19: '密教部 · 二', 20: '密教部 · 三', 21: '密教部 · 四'}
# 大正藏各册起始经号（据官方目录）
BOUNDS = [(848, 927, 18), (928, 1009, 19), (1010, 1112, 20), (1113, 1420, 21)]
SINGLE = {'T0243': 0, 'T1665': 0, 'T1796': 0}

def vol_of(wid):
    n = int(wid[1:])
    for a, b, v in BOUNDS:
        if a <= n <= b:
            return v
    return SINGLE.get(wid)

out = []
for w in src:
    v = vol_of(w['id'])
    if v is None:
        continue
    out.append({'id': w['id'], 'title': w['title'], 'byline': w.get('byline', ''),
                'juans': w['juans'], 'chars': w.get('chars', 0), 'vol': v})

# 排序：册 → 经号
out.sort(key=lambda x: (x['vol'], int(x['id'][1:])))

vols_meta = {str(v): {'name': VOLS[v], 'works': sum(1 for w in out if w['vol'] == v),
                      'chars': sum(w['chars'] for w in out if w['vol'] == v)}
             for v in VOLS}
vols_meta['0'] = {'name': '单收 · 论疏', 'works': sum(1 for w in out if w['vol'] == 0),
                  'chars': sum(w['chars'] for w in out if w['vol'] == 0)}

json.dump({'vols': vols_meta, 'works': out}, open(ROOT + '/index.json', 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
print(f'index.json: {len(out)} 部')
for k in sorted(vols_meta):
    print(f"  册{k}: {vols_meta[k]['name']} — {vols_meta[k]['works']} 部 {vols_meta[k]['chars']} 字")
