# Textures for assets/props/rubble_pile.py (run with the lab venv):
#   .venv/Scripts/python.exe assets/props/tex/make_rubble_pile.py
# rubble_pile_plaque.png: the fallen palace name board - deep blue field, a gold inner border, two big abstract gold
# "glyphs" (original brush-stroke shapes, not real characters), a dark crack running across it, chipped corner paint.
import math, os, random
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1024, 512
BLUE, BLUE2, GOLD, GOLD2, CRACK = (38, 58, 104), (30, 46, 86), (222, 170, 64), (184, 132, 44), (24, 20, 26)


def stroke(d, pts, w, col):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        d.line([(x0, y0), (x1, y1)], fill=col, width=w)
    for x, y in pts:
        d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=col)


def glyph(d, cx, cy, s, kind):
    """Abstract, chunky brush-stroke glyph (original shapes) centred at cx, cy, size s."""
    g = GOLD
    if kind == 0:
        stroke(d, [(cx - 0.42 * s, cy - 0.32 * s), (cx + 0.42 * s, cy - 0.36 * s)], int(0.13 * s), g)
        stroke(d, [(cx, cy - 0.5 * s), (cx - 0.04 * s, cy + 0.5 * s)], int(0.13 * s), g)
        stroke(d, [(cx - 0.34 * s, cy + 0.02 * s), (cx - 0.12 * s, cy + 0.3 * s)], int(0.11 * s), g)
        stroke(d, [(cx + 0.36 * s, cy - 0.02 * s), (cx + 0.12 * s, cy + 0.32 * s)], int(0.11 * s), g)
        stroke(d, [(cx - 0.4 * s, cy + 0.46 * s), (cx + 0.44 * s, cy + 0.42 * s)], int(0.12 * s), g)
    else:
        stroke(d, [(cx - 0.36 * s, cy - 0.46 * s), (cx - 0.36 * s, cy + 0.46 * s)], int(0.12 * s), g)
        stroke(d, [(cx - 0.36 * s, cy - 0.44 * s), (cx + 0.38 * s, cy - 0.44 * s), (cx + 0.36 * s, cy + 0.46 * s)], int(0.12 * s), g)
        stroke(d, [(cx - 0.2 * s, cy - 0.06 * s), (cx + 0.2 * s, cy - 0.08 * s)], int(0.1 * s), g)
        stroke(d, [(cx - 0.18 * s, cy + 0.2 * s), (cx + 0.22 * s, cy + 0.18 * s)], int(0.1 * s), g)
        stroke(d, [(cx + 0.02 * s, cy - 0.3 * s), (cx + 0.0 * s, cy + 0.34 * s)], int(0.1 * s), g)


def plaque():
    rnd = random.Random(8)
    im = Image.new('RGB', (W, H), BLUE); d = ImageDraw.Draw(im)
    for i in range(60):    # faint paint mottling
        x, y, r = rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(20, 70)
        d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=BLUE2)
    im = im.filter(ImageFilter.GaussianBlur(14)); d = ImageDraw.Draw(im)
    m = 34
    d.rounded_rectangle([m, m, W - m, H - m], radius=18, outline=GOLD, width=14)
    d.rounded_rectangle([m + 26, m + 26, W - m - 26, H - m - 26], radius=10, outline=GOLD2, width=5)
    glyph(d, W * 0.31, H * 0.5, 300, 0)
    glyph(d, W * 0.69, H * 0.5, 300, 1)
    # crack: a jagged dark line from the top edge down across the right glyph, a short branch
    pts = [(W * 0.58, 0)]
    x, y = pts[0]
    while y < H:
        y += rnd.uniform(28, 52); x += rnd.uniform(-26, 30); pts.append((x, min(H, y)))
    stroke(d, pts, 9, CRACK)
    b = pts[4]
    stroke(d, [b, (b[0] + 60, b[1] + 30), (b[0] + 110, b[1] + 22)], 6, CRACK)
    # chipped paint at a corner (bare wood showing)
    d.polygon([(0, H), (0, H - 70), (40, H - 52), (66, H - 18), (96, H)], fill=(150, 108, 66))
    out = os.path.join(HERE, 'rubble_pile_plaque.png'); im.save(out); print('wrote', out)


plaque()
