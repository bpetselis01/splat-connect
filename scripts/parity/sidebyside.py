"""Stitch parity pairs into readable side-by-side slices.

    python3 scripts/parity/sidebyside.py [screen_id ...]

Reads pairs/<id>.board.png and pairs/<id>.live.png (written by run.js --shots)
and writes pairs/sbs/<id>-<n>.png: board left, live right, each slice covering
SLICE px of page height at half scale. A 70,000px full-page shot is useless as
one image; slices at the same offsets make a divergence point findable.
Live slices stop at MAX_SLICES, because listing pages run to real data volume.
"""
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PAIRS = os.path.join(HERE, 'pairs')
OUT = os.path.join(PAIRS, 'sbs')
SLICE = 1400
SCALE = 0.5
GAP = 16
MAX_SLICES = 8

os.makedirs(OUT, exist_ok=True)
ids = sys.argv[1:] or sorted(
    {f.split('.')[0] for f in os.listdir(PAIRS) if f.endswith('.board.png')}
)
for sid in ids:
    b_path = os.path.join(PAIRS, f'{sid}.board.png')
    l_path = os.path.join(PAIRS, f'{sid}.live.png')
    if not (os.path.exists(b_path) and os.path.exists(l_path)):
        continue
    b, l = Image.open(b_path).convert('RGB'), Image.open(l_path).convert('RGB')
    n = min(MAX_SLICES, -(-max(b.height, l.height) // SLICE))
    w = int(1440 * SCALE)
    for i in range(n):
        top = i * SLICE
        canvas = Image.new('RGB', (w * 2 + GAP, int(SLICE * SCALE) + 20), (255, 0, 255))
        for j, img in enumerate((b, l)):
            if top < img.height:
                crop = img.crop((0, top, img.width, min(top + SLICE, img.height)))
                crop = crop.resize((int(crop.width * SCALE), int(crop.height * SCALE)))
                canvas.paste(crop, (j * (w + GAP), 20))
        d = ImageDraw.Draw(canvas)
        d.text((4, 4), f'{sid} BOARD  y={top}', fill=(0, 0, 0))
        d.text((w + GAP + 4, 4), f'LIVE  y={top}', fill=(0, 0, 0))
        canvas.save(os.path.join(OUT, f'{sid}-{i}.png'))
    print(sid, n)
