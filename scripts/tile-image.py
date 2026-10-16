#!/usr/bin/env python3
"""Crops, resizes and WebPs a generated image for the HiFi pack (dev only; uses the system Pillow, not a repo dependency).
Usage: python3 scripts/tile-image.py in.png public/hifi/city/facades/downtown-01.webp --crop x,y,w,h --size 1024 [--mirror]"""
import argparse
from PIL import Image, ImageOps

p = argparse.ArgumentParser()
p.add_argument('src'); p.add_argument('dst')
p.add_argument('--crop', help='x,y,w,h in source pixels')
p.add_argument('--size', type=int, default=1024, help='longest side in pixels')
p.add_argument('--mirror', action='store_true', help='append a mirrored copy (a skyline that loops seamlessly)')
p.add_argument('--quality', type=int, default=86)
a = p.parse_args()
im = Image.open(a.src).convert('RGBA')
if a.crop:
    x, y, w, h = map(int, a.crop.split(','))
    im = im.crop((x, y, x + w, y + h))
if a.mirror:
    both = Image.new('RGBA', (im.width * 2, im.height))
    both.paste(im, (0, 0)); both.paste(ImageOps.mirror(im), (im.width, 0))
    im = both
im.thumbnail((a.size, a.size), Image.LANCZOS)
im.save(a.dst, 'WEBP', quality=a.quality, method=6)
print(a.dst, im.size)
