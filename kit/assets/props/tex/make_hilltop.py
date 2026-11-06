# Ground textures for assets/props/hilltop.py (run with the lab venv):
#   .venv/Scripts/python.exe assets/props/tex/make_hilltop.py
# hilltop_ground_<day|night>.png: top-down map of the hill over +-hilltop.E metres (row 0 = +Y): grass with big soft
# mottles and sparse painted blade ticks, the dirt path (ragged edges, a paler worn centre, pebbles), a worn patch on
# the top around the jar spot and in front of the hut door.
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import hilltop as H   # noqa: E402  (plain python at import time)

S = 2048
PAL = {
    'day': dict(grass='#4f8a3c', m1='#5c9a45', m2='#447d36', tick='#3d7432', tick2='#6aa64e', dirt='#a8835a',
                dirt2='#bf9a6c', edge='#8d6c49', peb='#d7c7a8', worn='#9a8456'),
    'night': dict(grass='#2c524a', m1='#33605a', m2='#264840', tick='#223f3a', tick2='#3b6a60', dirt='#6a6466',
                  dirt2='#7a7474', edge='#545058', peb='#9a9aa6', worn='#56585a'),
}


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def px(x, y): return ((x + H.E) / (2 * H.E) * S, (1 - (y + H.E) / (2 * H.E)) * S)


M = S / (2 * H.E)     # pixels per metre


def make(tod):
    P = PAL[tod]; rnd = random.Random(11)
    im = Image.new('RGB', (S, S), rgb(P['grass']))
    # big soft mottles
    mot = Image.new('RGB', (S, S), rgb(P['grass'])); d = ImageDraw.Draw(mot)
    for i in range(90):
        x, y = rnd.uniform(-H.E, H.E), rnd.uniform(-H.E, H.E); r = rnd.uniform(0.4, 1.3) * M
        c = P['m1'] if i % 2 else P['m2']
        cx, cy = px(x, y)
        d.ellipse([cx - r, cy - r * rnd.uniform(0.6, 1.0), cx + r, cy + r * rnd.uniform(0.6, 1.0)], fill=rgb(c))
    im = Image.blend(im, mot.filter(ImageFilter.GaussianBlur(40)), 0.85)
    d = ImageDraw.Draw(im)
    # sparse blade ticks (painted texture, ~8 cm)
    for i in range(2600):
        x, y = rnd.uniform(-H.E, H.E), rnd.uniform(-H.E, H.E)
        cx, cy = px(x, y); a = rnd.uniform(-0.5, 0.5) - math.pi / 2; L = rnd.uniform(8, 15)
        c = P['tick'] if rnd.random() < 0.7 else P['tick2']
        d.line([(cx, cy), (cx + math.cos(a) * L, cy + math.sin(a) * L)], fill=rgb(c), width=3)
    # worn patch on the top: around the jar spot, toward the hut door (hut front at y = HUT.y - 1.0)
    worn = Image.new('L', (S, S), 0); dw = ImageDraw.Draw(worn)
    for (x, y, r) in [(H.JAR[0], H.JAR[1], 1.05), (H.JAR[0] + 0.7, H.JAR[1] + 0.25, 0.75), (0.3, -0.35, 0.6),
                      (H.HUT[0], H.HUT[1] - 1.25, 0.65), (H.HUT[0] - 0.4, H.HUT[1] - 1.0, 0.5)]:
        for k in range(14):
            a = k / 14 * 2 * math.pi; rr = r * rnd.uniform(0.75, 1.05) * M
            cx, cy = px(x + math.cos(a) * r * 0.35, y + math.sin(a) * r * 0.35)
            dw.ellipse([cx - rr * 0.6, cy - rr * 0.6, cx + rr * 0.6, cy + rr * 0.6], fill=255)
    worn = worn.filter(ImageFilter.GaussianBlur(6))
    im.paste(Image.new('RGB', (S, S), rgb(P['worn'])), (0, 0), worn.point(lambda v: int(v * 0.55)))
    # the path: ragged dark edge, dirt body, paler worn centre, pebbles
    pts = H.PATH
    for layer, kw, col in (('edge', 1.0, P['edge']), ('body', 0.86, P['dirt']), ('centre', 0.42, P['dirt2'])):
        mask = Image.new('L', (S, S), 0); dm = ImageDraw.Draw(mask)
        ph = {'edge': 0.0, 'body': 1.7, 'centre': 3.1}[layer]
        for i, (x, y) in enumerate(pts):
            n = 1 + 0.13 * math.sin(i * 0.31 + ph) + 0.07 * math.sin(i * 0.83 + 2 * ph) + 0.025 * math.sin(i * 2.1)
            # the path widens a little where it reaches the top (feet spread out)
            w = H.PW * kw * n * (1 + 0.35 * max(0, i - len(pts) + 12) / 12) * M
            cx, cy = px(x, y)
            dm.ellipse([cx - w, cy - w, cx + w, cy + w], fill=255)
        mask = mask.filter(ImageFilter.GaussianBlur(1.6 if layer != 'centre' else 5))
        im.paste(Image.new('RGB', (S, S), rgb(col)), (0, 0), mask)
    d = ImageDraw.Draw(im)
    for i in range(70):
        j = rnd.randrange(len(pts)); x, y = pts[j]
        a = rnd.uniform(0, 6.28); rr = rnd.uniform(0, H.PW * 0.8)
        cx, cy = px(x + math.cos(a) * rr, y + math.sin(a) * rr); r = rnd.uniform(3, 6)
        d.ellipse([cx - r, cy - r * 0.8, cx + r, cy + r * 0.8], fill=rgb(P['peb']))
    # grass creeping over the path's edges (blade ticks across the border)
    for i in range(500):
        j = rnd.randrange(len(pts) - 1); x, y = pts[j]; x2, y2 = pts[j + 1]
        tx, ty = x2 - x, y2 - y; L = math.hypot(tx, ty) or 1; nx, ny = -ty / L, tx / L
        sd = rnd.choice((-1, 1)); off = H.PW * rnd.uniform(0.8, 1.05) * sd
        cx, cy = px(x + nx * off, y + ny * off); a = rnd.uniform(-0.6, 0.6) - math.pi / 2; Lt = rnd.uniform(9, 16)
        d.line([(cx, cy), (cx + math.cos(a) * Lt, cy + math.sin(a) * Lt)], fill=rgb(P['tick']), width=3)
    out = os.path.join(HERE, f'hilltop_ground_{tod}.png')
    im.save(out); print('wrote', out)


for tod in PAL:
    make(tod)
