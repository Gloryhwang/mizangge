# -*- coding: utf-8 -*-
"""个人版构建：把 data/extra/*.json 并入 index/册数据 → 重建 APK v1.1-personal"""
import json, glob, sys

ROOT = '/home/z/my-project/mikkyo-app'
DATA = ROOT + '/web/data'

base = json.load(open(ROOT + '/data/index.json', encoding='utf-8'))
extra_files = sorted(glob.glob(ROOT + '/data/extra/T*.json'))
if not extra_files:
    print('data/extra 下没有个人版数据'); sys.exit(1)

GROUP = {'57': '续部 · 空海', '74': '续部 · 台密 · 最澄', '75': '续部 · 台密 · 安然', '77': '续部 · 空海'}
VOLMAP = {'T2362': '74', 'T2376': '74', 'T2377': '74',
          'T2395a': '75', 'T2395b': '75', 'T2396': '75',
          'T2425': '77', 'T2426': '77', 'T2427': '77', 'T2428': '77',
          'T2429': '77', 'T2430': '77', 'T2431': '77', 'T2203a': '57'}
works = list(base['works'])
vols = dict(base['vols'])

# 公开版册数据（index vol 键 → 文件名）
FILE_OF = {'18': 'vol18', '19': 'vol19', '20': 'vol20', '21': 'vol21', '0': 'vol00'}
buckets = {k: json.load(open(f'{DATA}/{f}.json', encoding='utf-8'))
           for k, f in FILE_OF.items()}

for fp in extra_files:
    entries = json.load(open(fp, encoding='utf-8'))
    if not entries:
        continue
    wid = entries[0]['id']
    volkey = 'e' + VOLMAP.get(wid, wid[1:4])          # e74 / e75 / e77 / e57
    buckets.setdefault(volkey, []).extend(entries)
    first = entries[0]
    works.append({'id': wid, 'title': first['title'], 'byline': first['byline'],
                  'juans': [e['juan'] for e in entries],
                  'chars': sum(len(e['md']) for e in entries), 'vol': volkey})
    vols[volkey] = {'name': GROUP.get(volkey[1:], '续部'),
                    'works': len(buckets[volkey]),
                    'chars': sum(len(e['md']) for e in buckets[volkey])}

order = {'18': 1, '19': 2, '20': 3, '21': 4, '0': 5,
         'e57': 6, 'e74': 7, 'e75': 8, 'e77': 9}
def wsort(w):
    key = str(w['vol'])
    num = int(''.join(c for c in w['id'][1:] if c.isdigit()) or 0)
    return (order.get(key, 9), num)
works.sort(key=wsort)

json.dump({'vols': vols, 'works': works}, open(f'{DATA}/index.json', 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
for k, arr in sorted(buckets.items()):
    fname = FILE_OF.get(k, 'vol' + k)          # e57 → vole57
    arr.sort(key=lambda e: (int(''.join(c for c in e['id'][1:] if c.isdigit()) or 0), e['juan']))
    json.dump(arr, open(f'{DATA}/{fname}.json', 'w', encoding='utf-8'),
              ensure_ascii=False, separators=(',', ':'))
    print(fname, len(arr), '卷')

print('个人版 index：', len(works), '部')
