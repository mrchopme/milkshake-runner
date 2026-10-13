#!/usr/bin/env python3
"""A placeholder skyline for the HiFi horizon ring until Task 24's generated ones: a 3072x1316 RGBA PNG, transparent sky,
a seeded row of generic grey-blue towers (no landmark) with a haze toward the bottom.
Run: python3 scripts/placeholder-skyline.py  (needs Pillow; writes public/hifi/city/sky/placeholder.png)"""
import random
from pathlib import Path
from PIL import Image, ImageDraw

W, H = 3072, 1316
OUT = Path(__file__).resolve().parent.parent / 'public/hifi/city/sky/placeholder.png'
random.seed(13)

img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
for shade, lo, hi in [((120, 136, 160), 0.30, 0.50), ((92, 108, 134), 0.15, 0.40)]:  # back row (taller, paler), front row; tiers add at most 120 px, so the tallest stays under 60%
    x = random.randint(-60, 0)
    while x < W:
        w, top = random.randint(50, 150), H - int(H * random.uniform(lo, hi))
        c = tuple(v + random.randint(-8, 8) for v in shade) + (255,)
        draw.rectangle([x, top, x + w, H], fill=c)
        if random.random() < 0.3:  # a stepped top: one or two narrower tiers
            l, r = x, x + w
            for _ in range(random.randint(1, 2)):
                l, r, rise = l + w // 6, r - w // 6, random.randint(20, 60)
                draw.rectangle([l, top - rise, r, top], fill=c)
                top -= rise
        x += w + random.randint(0, 40)

# Haze: blend toward a pale blue-grey toward the bottom, keeping the alpha.
haze = Image.new('RGBA', (W, H), (190, 205, 222, 0))
mask = Image.linear_gradient('L').resize((W, H)).point(lambda v: int(v * 0.6))  # 0 at the top, 60% at the bottom
img = Image.composite(Image.merge('RGBA', (*haze.split()[:3], img.split()[3])), img, mask)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.quantize(64).save(OUT, optimize=True)  # a palette PNG keeps it small; the transparent sky survives as a palette entry
print(OUT, OUT.stat().st_size, 'bytes')
