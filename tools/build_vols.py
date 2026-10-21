# -*- coding: utf-8 -*-
"""将 text/{ID}/{n}.md 聚合为 data/vol{NN}.json（懒加载用）"""
import json, os, re

ROOT = '/home/z/my-project/mikkyo-app/data'
idx = json.load(open(ROOT + '/index.json', encoding='utf-8'))

VOLFILES = {'18': 'vol18', '19': 'vol19', '20': 'vol20', '21': 'vol21', '0': 'vol00'}
buckets = {v: [] for v in VOLFILES.values()}

for w in idx['works']:
    vf = VOLFILES[str(w['vol'])]
    for j in w['juans']:
        fp = f"{ROOT}/text/{w['id']}/{j}.md"
        if os.path.exists(fp) and os.path.getsize(fp) > 50:
            md = open(fp, encoding='utf-8').read()
            buckets[vf].append({'id': w['id'], 'title': w['title'],
                                'byline': w['byline'], 'juan': j, 'md': md})
        else:
            print('缺失:', w['id'], j)

for name, arr in buckets.items():
    arr.sort(key=lambda x: (int(x['id'][1:]), x['juan']))
    p = f'{ROOT}/{name}.json'
    json.dump(arr, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'{name}.json: {len(arr)} 卷, {os.path.getsize(p)//1024} KB')

total = sum(os.path.getsize(f'{ROOT}/{n}.json') for n in buckets)
print(f'合计 {total//1024//1024} MB')
