#!/usr/bin/env python3
"""Renders the Map tab's pin icons from the app's own Ionicons font.

White glyphs on transparent, 48 px (16 pt at @3x), one per layer in
packages/mobile/lib/map-filters.ts KINDS. Re-run after changing an icon there:
    python3 scripts/map-icons.py
"""
import json, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VENDOR = os.path.join(ROOT, 'packages/mobile/node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons')
OUT = os.path.join(ROOT, 'packages/mobile/assets/map')
ICONS = {'toy': 'cube-outline', 'printer': 'print-outline', 'event': 'calendar-outline', 'dropoff': 'refresh-outline', 'org': 'business-outline'}
SIZE = 48

glyphs = json.load(open(os.path.join(VENDOR, 'glyphmaps/Ionicons.json')))
font = ImageFont.truetype(os.path.join(VENDOR, 'Fonts/Ionicons.ttf'), 40)
for kind, name in ICONS.items():
    img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.text((SIZE / 2, SIZE / 2), chr(glyphs[name]), font=font, fill=(255, 255, 255, 255), anchor='mm')
    img.save(os.path.join(OUT, f'{kind}@3x.png'))
    print('wrote', f'{kind}@3x.png')
