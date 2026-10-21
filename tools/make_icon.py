# -*- coding: utf-8 -*-
"""生成密藏阁启动图标：朱砂方印 + 白文「密」"""
from PIL import Image, ImageDraw, ImageFont
import os

FONT = '/usr/share/fonts/truetype/lxgw-wenkai/LXGWWenKai-Medium.ttf'
OUT = '/home/z/my-project/mikkyo-app/android/src/res/mipmap'
os.makedirs(OUT, exist_ok=True)

def make(size, path):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = size * 0.06
    r = size * 0.16
    # 朱砂方印（微圆角）
    d.rounded_rectangle([m, m, size - m, size - m], radius=r, fill=(165, 60, 42, 255))
    # 白文「密」
    fsize = int(size * 0.56)
    font = ImageFont.truetype(FONT, fsize)
    bbox = d.textbbox((0, 0), '密', font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), '密',
           font=font, fill=(244, 236, 215, 255))
    im.save(path)
    print(path, size)

for s in (48, 72, 96, 144, 192):
    make(s, f'{OUT}/ic_launcher.png')
print('icons done')
