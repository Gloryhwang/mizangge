# -*- coding: utf-8 -*-
"""密藏阁数据抓取：deerpark API → 密教部全 + 3 单部 markdown"""
import json, os, time, urllib.request, sys

ROOT = '/home/z/my-project/mikkyo-app/data'
os.makedirs(ROOT + '/text', exist_ok=True)

works = json.load(open(ROOT + '/allworks.json'))
in_scope = []
for w in works:
    wid = w['id']
    if wid.startswith('T') and wid[1:].isdigit():
        n = int(wid[1:])
        if 848 <= n <= 1420 or wid in ('T0243', 'T1665', 'T1796'):
            in_scope.append(w)

total_juans = sum(len(w['juans']) for w in in_scope)
print(f'范围内经目 {len(in_scope)} 部，总卷数 {total_juans}', flush=True)
json.dump(in_scope, open(ROOT + '/index_source.json', 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)

ok = fail = skip = 0
t0 = time.time()
for i, w in enumerate(in_scope):
    wid = w['id']
    wdir = f'{ROOT}/text/{wid}'
    os.makedirs(wdir, exist_ok=True)
    for j in w['juans']:
        fp = f'{wdir}/{j}.md'
        if os.path.exists(fp) and os.path.getsize(fp) > 100:
            skip += 1
            continue
        url = f'https://deerpark.app/api/v1/text/{wid}/{j}'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'mikkyo-reader-builder/1.0 (personal offline reader; contact via github)'})
            body = urllib.request.urlopen(req, timeout=30).read().decode('utf-8')
            open(fp, 'w', encoding='utf-8').write(body)
            ok += 1
        except Exception as e:
            fail += 1
            print(f'FAIL {wid}/{j}: {e}', flush=True)
        time.sleep(0.25)  # ≈4 req/s
    if (i + 1) % 40 == 0:
        el = time.time() - t0
        print(f'[{i+1}/{len(in_scope)}] ok={ok} skip={skip} fail={fail} {el:.0f}s', flush=True)

print(f'DONE ok={ok} skip={skip} fail={fail} 用时 {time.time()-t0:.0f}s', flush=True)
