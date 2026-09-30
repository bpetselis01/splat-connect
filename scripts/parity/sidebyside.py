"""Stitch parity pairs into readable side-by-side slices.

    python3 scripts/parity/sidebyside.py [screen_id ...]
    python3 scripts/parity/sidebyside.py --dir pairs/app --scale 1 [ids]      # the app
    python3 scripts/parity/sidebyside.py --dir pairs/app --live-suffix ios \
        --out pairs/app-ios --scale 1 [ids]                                   # the iOS picture pass

Reads pairs/<id>.board.png and pairs/<id>.live.png (written by run.js --shots)
and writes pairs/sbs/<id>-<n>.png: board left, live right, each slice covering
SLICE px of page height at half scale. A 70,000px full-page shot is useless as
one image; slices at the same offsets make a divergence point findable.
Live slices stop at MAX_SLICES, because listing pages run to real data volume.
"""
import argparse
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('ids', nargs='*')
ap.add_argument('--dir', default=os.path.join(HERE, 'pairs'))
ap.add_argument('--live-suffix', default='live')
ap.add_argument('--out', default=None)
ap.add_argument('--scale', type=float, default=0.5)
# A 3x simulator screenshot beside a 1x board shot: resize live to the board's width.
ap.add_argument('--match-width', action='store_true')
args = ap.parse_args()
PAIRS = args.dir
OUT = args.out or os.path.join(PAIRS, 'sbs')
SLICE = 1400
SCALE = args.scale
GAP = 16
MAX_SLICES = 8

os.makedirs(OUT, exist_ok=True)
ids = args.ids or sorted(
    {f.split('.')[0] for f in os.listdir(PAIRS) if f.endswith('.board.png')}
)
for sid in ids:
    b_path = os.path.join(PAIRS, f'{sid}.board.png')
    l_path = os.path.join(PAIRS, f'{sid}.{args.live_suffix}.png')
    if not (os.path.exists(b_path) and os.path.exists(l_path)):
        continue
    b, l = Image.open(b_path).convert('RGB'), Image.open(l_path).convert('RGB')
    if args.match_width and l.width != b.width:
        l = l.resize((b.width, round(l.height * b.width / l.width)))
    n = min(MAX_SLICES, -(-max(b.height, l.height) // SLICE))
    w = int(max(b.width, l.width) * SCALE)
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
