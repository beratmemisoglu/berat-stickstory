# Textures for the outdoor set dressing (film/jar/dress_outdoor.py) and the out_* props. Run with the lab venv:
#   .venv/Scripts/python.exe assets/props/tex/make_out.py [name ...]      (no names = all)
# Ground tiles (seamless, top-down, row 0 = +Y):
#   out_grass.png      4 x 4 m meadow: mottles, grass tufts, clover, wild flowers, pebbles (tint it for night)
#   out_road.png       3.4 m wide x 4 m dirt road (repeats along Y): ruts, pebbles, cobbles, hoof prints, straw
#   out_apron.png      5.6 x 3.3 m flagstone apron in front of the gate (not tiling)
#   out_court.png      6 x 6 m palace courtyard pavers, cracked, chips of glazed tile and lacquer, dust
#   out_hill_ground_<day|night>.png  the hilltop's own ground map (same layout as hilltop_ground_*), more painted detail
# Sky panoramas (360 deg drum, out_sky_drum.py: radius 26 m, z -6..34, u = azimuth from +Y, 50 px per metre):
#   out_sky_<gate_day|gate_night|hill_dusk|hill_night|rubble_dawn>.png
import math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import hilltop as HT   # noqa: E402


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def mix(a, b, k): return tuple(int(round(x + (y - x) * k)) for x, y in zip(rgb(a) if isinstance(a, str) else a, rgb(b) if isinstance(b, str) else b))


def seam_noise(w, h, cells, seed, wrap=True):
    """Smooth value noise in 0..1, seamless when wrap (cells = blobs across the width)."""
    r = np.random.RandomState(seed)
    ch = max(2, int(round(cells * h / w)))
    a = r.rand(ch, cells).astype('f4')
    if wrap: a = np.tile(a, (3, 3))
    im = Image.fromarray((a * 255).astype('uint8'))
    W3, H3 = (w * 3, h * 3) if wrap else (w, h)
    im = im.resize((W3, H3), Image.BICUBIC)
    if wrap: im = im.crop((w, h, 2 * w, 2 * h))
    return np.asarray(im).astype('f4') / 255.0


def lerp_img(c0, c1, k):
    """Per-pixel mix of two colours by k (h x w in 0..1)."""
    a = np.array(rgb(c0), 'f4'); b = np.array(rgb(c1), 'f4')
    return a[None, None, :] * (1 - k[..., None]) + b[None, None, :] * k[..., None]


def to_im(arr): return Image.fromarray(np.clip(arr, 0, 255).astype('uint8'))


class Wrap:
    """Draw calls repeated at +-W / +-H so tiles stay seamless."""
    def __init__(self, im, wx=True, wy=True):
        self.im = im; self.d = ImageDraw.Draw(im, 'RGBA'); self.W, self.H = im.size; self.wx, self.wy = wx, wy

    def offs(self, x, y, m):
        xs = [0] + ([self.W] if self.wx and x < m else []) + ([-self.W] if self.wx and x > self.W - m else [])
        ys = [0] + ([self.H] if self.wy and y < m else []) + ([-self.H] if self.wy and y > self.H - m else [])
        return [(a, b) for a in xs for b in ys]

    def ellipse(self, x, y, rx, ry, **kw):
        for ox, oy in self.offs(x, y, max(rx, ry) + 4):
            self.d.ellipse([x + ox - rx, y + oy - ry, x + ox + rx, y + oy + ry], **kw)

    def polygon(self, pts, **kw):
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        m = max(math.hypot(p[0] - cx, p[1] - cy) for p in pts) + 4
        for ox, oy in self.offs(cx, cy, m):
            self.d.polygon([(p[0] + ox, p[1] + oy) for p in pts], **kw)

    def line(self, pts, **kw):
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        m = max(math.hypot(p[0] - cx, p[1] - cy) for p in pts) + 6
        for ox, oy in self.offs(cx, cy, m):
            self.d.line([(p[0] + ox, p[1] + oy) for p in pts], **kw)


def blob(rnd, x, y, r, n=9, jit=0.25):
    return [(x + math.cos(a) * r * (1 + rnd.uniform(-jit, jit)), y + math.sin(a) * r * (1 + rnd.uniform(-jit, jit)))
            for a in [k / n * 2 * math.pi + rnd.uniform(-0.2, 0.2) for k in range(n)]]


def pebble(w, rnd, x, y, r, body, ink='#3a332c', hi=None):
    pts = blob(rnd, x, y, r, n=7, jit=0.3)
    w.polygon(pts, fill=rgb(ink) + (255,))
    inner = [(x + (px - x) * 0.72, y + (py - y) * 0.72) for px, py in pts]
    w.polygon(inner, fill=rgb(body) + (255,))
    if hi: w.ellipse(x - r * 0.2, y - r * 0.25, r * 0.28, r * 0.18, fill=rgb(hi) + (255,))


def tuft(w, rnd, x, y, L, cols, width=3):
    n = rnd.choice((3, 4, 5))
    for k in range(n):
        a = -math.pi / 2 + (k - (n - 1) / 2) * 0.32 + rnd.uniform(-0.12, 0.12)
        l = L * rnd.uniform(0.7, 1.0)
        w.line([(x, y), (x + math.cos(a) * l * 0.5 + rnd.uniform(-1, 1), y + math.sin(a) * l * 0.5),
                (x + math.cos(a) * l, y + math.sin(a) * l)], fill=rgb(rnd.choice(cols)) + (255,), width=width)


def flower(w, rnd, x, y, r, petal, centre='#e9b53a'):
    for k in range(5):
        a = k / 5 * 2 * math.pi + rnd.uniform(0, 0.3)
        w.ellipse(x + math.cos(a) * r * 0.62, y + math.sin(a) * r * 0.62, r * 0.48, r * 0.48, fill=rgb(petal) + (255,))
    w.ellipse(x, y, r * 0.36, r * 0.36, fill=rgb(centre) + (255,))


def clover(w, rnd, x, y, r, col):
    for k in range(3):
        a = k / 3 * 2 * math.pi + rnd.uniform(0, 2)
        w.ellipse(x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55, r * 0.5, r * 0.5, fill=rgb(col) + (255,))


# ---------------------------------------------------------------- ground tiles
def grass():
    S = 1024; M = S / 4.0; rnd = random.Random(3)
    k = seam_noise(S, S, 4, 1) * 0.6 + seam_noise(S, S, 11, 2) * 0.4
    arr = lerp_img('#4b7f36', '#6aa04a', np.clip((k - 0.25) * 1.8, 0, 1))
    im = to_im(arr); w = Wrap(im)
    # darker damp patches / lighter dry patches (soft-edged blobs)
    for i in range(18):
        x, y = rnd.uniform(0, S), rnd.uniform(0, S)
        w.polygon(blob(rnd, x, y, rnd.uniform(0.25, 0.6) * M, 12, 0.3), fill=rgb(rnd.choice(('#437533', '#78ab52'))) + (70,))
    im = im.filter(ImageFilter.GaussianBlur(1.2)); w = Wrap(im)
    for i in range(46):     # clover patches
        cx, cy = rnd.uniform(0, S), rnd.uniform(0, S)
        for j in range(rnd.randint(5, 11)):
            clover(w, rnd, cx + rnd.gauss(0, 0.12 * M), cy + rnd.gauss(0, 0.12 * M), rnd.uniform(0.018, 0.026) * M,
                   rnd.choice(('#79b257', '#6ea84e')))
    for i in range(1500):    # grass tufts: dark and light strokes
        x, y = rnd.uniform(0, S), rnd.uniform(0, S)
        tuft(w, rnd, x, y, rnd.uniform(0.05, 0.1) * M, ('#36672a', '#3c712f', '#3c712f', '#8cc05c'), width=3)
    for i in range(70):      # wild flowers in small groups
        cx, cy = rnd.uniform(0, S), rnd.uniform(0, S); col = rnd.choice(('#f2efe6', '#f2c84b', '#ef8fb0', '#a7b2f2', '#f2efe6'))
        for j in range(rnd.randint(2, 5)):
            flower(w, rnd, cx + rnd.gauss(0, 0.07 * M), cy + rnd.gauss(0, 0.07 * M), rnd.uniform(0.022, 0.03) * M, col)
    for i in range(40):
        pebble(w, rnd, rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(0.015, 0.03) * M, rnd.choice(('#a9a391', '#bdb6a2')), hi='#ddd6c4')
    im.save(os.path.join(HERE, 'out_grass.png'))


def road():
    W, H = 1024, 1205; M = W / 3.4; rnd = random.Random(5)
    k = seam_noise(W, H, 5, 4) * 0.6 + seam_noise(W, H, 14, 5) * 0.4
    arr = lerp_img('#9a7c55', '#b6966a', np.clip((k - 0.2) * 1.6, 0, 1))
    xs = (np.arange(W) - W / 2) / M          # metres across
    # cart-wheel ruts at +-0.55 m: darker, with a pale hump between them
    rut = np.exp(-((np.abs(xs) - 0.55) / 0.13) ** 2)
    hump = np.exp(-(xs / 0.25) ** 2)
    arr = arr * (1 - 0.2 * rut[None, :, None]) + np.array(rgb('#c4a678'), 'f4')[None, None, :] * 0.0
    arr = arr * (1 + 0.07 * hump[None, :, None])
    # the verges: grass creeping in over the outer 18 cm
    edge = np.clip((np.abs(xs) - 1.42) / 0.2, 0, 1)
    g = seam_noise(W, H, 30, 6)
    gm = np.clip(edge[None, :] * 1.6 - 0.35 + (g - 0.5) * 0.9, 0, 1)
    arr = arr * (1 - gm[..., None]) + np.array(rgb('#5d9343'), 'f4')[None, None, :] * gm[..., None]
    im = to_im(arr); w = Wrap(im, wx=False, wy=True)
    for s in (-1, 1):    # fine groove lines along the ruts
        for j in range(5):
            x0 = W / 2 + s * 0.55 * M + (j - 2) * 0.045 * M
            pts = [(x0 + 3 * math.sin(yy / 90.0 + j + s), yy) for yy in range(-20, H + 40, 40)]
            w.d.line(pts, fill=rgb('#7a6044') + (150,), width=2)
    for i in range(110):   # hoof prints + footprints
        x, y = W / 2 + rnd.gauss(0, 0.35 * M), rnd.uniform(0, H); r = 0.035 * M
        w.d.arc([x - r, y - r, x + r, y + r], 200, 340, fill=rgb('#7d6446') + (220,), width=4)
    for i in range(60):    # straw bits
        x, y = rnd.uniform(0.15, 0.85) * W, rnd.uniform(0, H); a = rnd.uniform(0, math.pi); L = rnd.uniform(0.04, 0.09) * M
        w.line([(x, y), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=rgb('#e0c27a') + (255,), width=2)
    for i in range(340):   # pebbles
        x, y = rnd.uniform(0.04, 0.96) * W, rnd.uniform(0, H)
        pebble(w, rnd, x, y, rnd.uniform(0.012, 0.03) * M, rnd.choice(('#a89a82', '#bfb29b', '#8e8574', '#c9bca2')), hi='#e2d8c2')
    for i in range(26):    # bigger half-buried cobbles
        x, y = rnd.uniform(0.1, 0.9) * W, rnd.uniform(0, H)
        pebble(w, rnd, x, y, rnd.uniform(0.045, 0.07) * M, rnd.choice(('#9d968a', '#b0a896')), hi='#d6cfbf')
    for i in range(10):    # dry cracks near the edges
        x, y = W / 2 + rnd.choice((-1, 1)) * rnd.uniform(0.9, 1.25) * M, rnd.uniform(0, H)
        pts = [(x, y)]
        for j in range(5):
            x += rnd.uniform(-0.06, 0.06) * M; y += rnd.uniform(0.03, 0.08) * M; pts.append((x, y))
        w.line(pts, fill=rgb('#6e5639') + (200,), width=2)
    for i in range(240):   # grass tufts on the verges
        s = rnd.choice((-1, 1)); x = W / 2 + s * rnd.uniform(1.42, 1.7) * M; y = rnd.uniform(0, H)
        tuft(w, rnd, x, y, rnd.uniform(0.06, 0.11) * M, ('#3a6e2d', '#467d34', '#82b85a'), width=3)
    im.save(os.path.join(HERE, 'out_road.png'))


def apron():
    W, H = 1680, 990; M = 300.0; rnd = random.Random(8)
    im = Image.new('RGB', (W, H), rgb('#5a5144')); d = ImageDraw.Draw(im, 'RGBA')
    pal = ('#b4aa96', '#a89e8a', '#bfb5a1', '#9f9581', '#aea48f', '#c4b9a3')
    g = 0.022 * M; row_h = 0.55 * M
    y = 0.0
    while y < H:
        x = -rnd.uniform(0, 0.5) * M
        while x < W:
            L = rnd.uniform(0.6, 1.2) * M
            x0, y0, x1, y1 = x + g / 2, y + g / 2, x + L - g / 2, y + row_h - g / 2
            c = rgb(rnd.choice(pal)); ch = rnd.uniform(0.015, 0.05) * M
            pts = [(x0 + ch, y0), (x1 - rnd.uniform(0, ch), y0), (x1, y0 + ch), (x1, y1 - rnd.uniform(0, ch)), (x1 - ch, y1),
                   (x0 + rnd.uniform(0, ch), y1), (x0, y1 - ch), (x0, y0 + rnd.uniform(0, ch))]
            d.polygon(pts, fill=c)
            # a lighter worn top face, darker lower edge (chunky toy slabs)
            d.line([(x0 + ch, y1 - 2), (x1 - ch, y1 - 2)], fill=mix(c, '#5a5144', 0.45) + (255,), width=4)
            d.line([(x0 + ch, y0 + 2), (x1 - ch, y0 + 2)], fill=mix(c, '#f2efe6', 0.3) + (255,), width=3)
            if rnd.random() < 0.3:      # a crack
                cx, cy = rnd.uniform(x0, x1), y0; pts = [(cx, cy)]
                for j in range(4):
                    cx += rnd.uniform(-0.08, 0.08) * M; cy += (y1 - y0) / 4; pts.append((cx, cy))
                d.line(pts, fill=(70, 62, 52, 230), width=3)
            for j in range(rnd.randint(0, 3)):  # chips / dark flecks
                fx, fy = rnd.uniform(x0, x1), rnd.uniform(y0, y1)
                d.ellipse([fx - 3, fy - 2, fx + 3, fy + 2], fill=mix(c, '#5a5144', 0.5) + (255,))
            x += L
        y += row_h
    # moss in some joints + a worn cart track down the middle
    for i in range(160):
        x, y = rnd.uniform(0, W), round(rnd.uniform(0, H) / row_h) * row_h + rnd.uniform(-3, 3)
        d.ellipse([x - 6, y - 4, x + 6, y + 4], fill=rgb(rnd.choice(('#5f8a3e', '#6f9a48'))) + (220,))
    wear = Image.new('L', (W, H), 0); dw = ImageDraw.Draw(wear)
    dw.rectangle([W / 2 - 0.9 * M, 0, W / 2 + 0.9 * M, H], fill=60)
    wear = wear.filter(ImageFilter.GaussianBlur(60))
    im.paste(Image.new('RGB', (W, H), rgb('#d6ccb6')), (0, 0), wear)
    im.save(os.path.join(HERE, 'out_apron.png'))


def court():
    S = 2048; M = S / 6.0; rnd = random.Random(12)
    im = Image.new('RGB', (S, S), rgb('#2c241c')); w = Wrap(im)
    pal = ('#a79a84', '#b3a68f', '#9b8e78', '#bfb29a', '#ab9c82', '#c2b39a')
    g = 0.026 * M; pw, ph = 1.0 * M, 0.6 * M
    for r in range(10):
        off = 0.5 * M if r % 2 else 0.0
        for c in range(-1, 7):
            x0, y0 = c * pw + off + g / 2, r * ph + g / 2; x1, y1 = x0 + pw - g, y0 + ph - g
            col = rgb(rnd.choice(pal))
            sunk = rnd.random() < 0.06
            if sunk: col = mix(col, '#4a4034', 0.35)
            ch = 0.03 * M
            pts = [(x0 + ch, y0), (x1 - ch, y0), (x1, y0 + ch), (x1, y1 - ch), (x1 - ch, y1), (x0 + ch, y1), (x0, y1 - ch), (x0, y0 + ch)]
            w.polygon(pts, fill=col + (255,))
            w.line([(x0 + ch, y1 - 3), (x1 - ch, y1 - 3)], fill=mix(col, '#4a4034', 0.5) + (255,), width=5)
            w.line([(x0 + ch, y0 + 3), (x1 - ch, y0 + 3)], fill=mix(col, '#f2efe6', 0.28) + (255,), width=4)
            for j in range(rnd.randint(1, 3) if rnd.random() < 0.55 else 0):   # cracks (the quake)
                cx, cy = rnd.uniform(x0, x1), rnd.choice((y0, y1)); pts2 = [(cx, cy)]
                n = rnd.randint(3, 6)
                for k in range(n):
                    cx += rnd.uniform(-0.12, 0.12) * M; cy += (y1 - y0) / n * (1 if pts2[0][1] == y0 else -1); pts2.append((cx, cy))
                w.line(pts2, fill=(52, 44, 36, 255), width=4)
                if rnd.random() < 0.5:
                    bx, by = pts2[len(pts2) // 2]
                    w.line([(bx, by), (bx + rnd.uniform(-0.15, 0.15) * M, by + rnd.uniform(-0.1, 0.1) * M)], fill=(52, 44, 36, 255), width=3)
    # dust drifts (pale) and darker scorch / damp patches
    dust = Image.fromarray((np.clip((seam_noise(S, S, 6, 13) - 0.55) * 3.0, 0, 1) * 150).astype('uint8'))
    im.paste(Image.new('RGB', (S, S), rgb('#d9cbb0')), (0, 0), dust)
    w = Wrap(im)
    for i in range(420):    # debris chips: stone, terracotta, glazed yellow tile, red lacquer, wood splinters
        x, y = rnd.uniform(0, S), rnd.uniform(0, S)
        kind = rnd.random()
        if kind < 0.35: pebble(w, rnd, x, y, rnd.uniform(0.012, 0.03) * M, rnd.choice(('#9a8f7c', '#b4a891')), hi='#ddd2bc')
        elif kind < 0.55: pebble(w, rnd, x, y, rnd.uniform(0.015, 0.03) * M, '#d9a32e', ink='#5a3a14', hi='#f6d77a')
        elif kind < 0.72: pebble(w, rnd, x, y, rnd.uniform(0.012, 0.026) * M, '#a9472e', ink='#4a1c12')
        elif kind < 0.85: pebble(w, rnd, x, y, rnd.uniform(0.01, 0.022) * M, '#9a2a1e', ink='#3a120c', hi='#c85040')
        else:
            a = rnd.uniform(0, math.pi); L = rnd.uniform(0.04, 0.09) * M
            w.line([(x, y), (x + math.cos(a) * L, y + math.sin(a) * L)], fill=rgb('#e2c48c') + (255,), width=4)
    for i in range(40):     # weeds in the joints
        x, y = rnd.uniform(0, S), round(rnd.uniform(0, S) / ph) * ph
        tuft(w, rnd, x, y, rnd.uniform(0.05, 0.08) * M, ('#5d8a3a', '#6f9e48'), width=3)
    im.save(os.path.join(HERE, 'out_court.png'))


def hill_ground(tod):
    src = Image.open(os.path.join(HERE, f'hilltop_ground_{tod}.png')).convert('RGB'); S = src.size[0]
    M = S / (2 * HT.E); rnd = random.Random(21 if tod == 'day' else 22)
    P = dict(day=dict(t1='#356a2c', t2='#3d7631', t3='#80b65a', cl='#6aa64e', fl=('#f2efe6', '#f2c84b', '#ef8fb0', '#a7b2f2'),
                      peb=('#b3a890', '#c6bba2'), hi='#e2d8c2', ink='#3a332c'),
             night=dict(t1='#1f403b', t2='#24483f', t3='#4a7c70', cl='#33665c', fl=('#c8d0ee', '#d8c98a', '#d39ac0', '#9fb0f0'),
                        peb=('#7d8090', '#8e90a0'), hi='#b8bccc', ink='#252632'))[tod]
    w = Wrap(src, wx=False, wy=False)

    def px(x, y): return ((x + HT.E) * M, (HT.E - y) * M)

    def free(x, y, m=0.08):
        return HT.path_dist(x, y)[0] > HT.PW + m and math.hypot(x, y) < HT.RE

    for i in range(70):   # clover patches
        x, y = rnd.uniform(-HT.E, HT.E), rnd.uniform(-HT.E, HT.E)
        if not free(x, y, 0.2): continue
        cx, cy = px(x, y)
        for j in range(rnd.randint(5, 10)):
            clover(w, rnd, cx + rnd.gauss(0, 0.12 * M), cy + rnd.gauss(0, 0.12 * M), rnd.uniform(0.02, 0.03) * M, P['cl'])
    for i in range(5200):   # grass tufts
        x, y = rnd.uniform(-HT.E, HT.E), rnd.uniform(-HT.E, HT.E)
        if not free(x, y): continue
        cx, cy = px(x, y)
        tuft(w, rnd, cx, cy, rnd.uniform(0.07, 0.12) * M, (P['t1'], P['t2'], P['t2'], P['t3']), width=3)
    for i in range(110):   # flowers in little groups
        x, y = rnd.uniform(-HT.E, HT.E), rnd.uniform(-HT.E, HT.E)
        if not free(x, y, 0.15): continue
        cx, cy = px(x, y); col = rnd.choice(P['fl'])
        for j in range(rnd.randint(2, 5)):
            flower(w, rnd, cx + rnd.gauss(0, 0.07 * M), cy + rnd.gauss(0, 0.07 * M), rnd.uniform(0.025, 0.035) * M, col)
    # pebbles along both edges of the path
    for i, (x, y) in enumerate(HT.PATH):
        if i + 1 >= len(HT.PATH): break
        nx, ny = HT.PATH[i + 1][0] - x, HT.PATH[i + 1][1] - y; L = math.hypot(nx, ny) or 1
        for s in (-1, 1):
            if rnd.random() < 0.75:
                ex, ey = x - ny / L * s * (HT.PW + rnd.uniform(-0.04, 0.06)), y + nx / L * s * (HT.PW + rnd.uniform(-0.04, 0.06))
                cx, cy = px(ex, ey)
                pebble(w, rnd, cx, cy, rnd.uniform(0.025, 0.05) * M, rnd.choice(P['peb']), ink=P['ink'], hi=P['hi'])
    if tod == 'night':   # a step brighter and bluer than the prop's own night map (it read as a dark green lump) - grass
        # only: boosting the grey path too turned it into a glowing lavender band
        a = np.asarray(src).astype('f4')
        sat = np.clip((a.max(axis=2) - a.min(axis=2)) / np.maximum(a.max(axis=2), 1) * 2.2, 0, 1)[..., None]
        boost = 1 + (np.array([1.22, 1.38, 1.62], 'f4')[None, None, :] - 1) * sat
        src = to_im(a * boost)
    src.save(os.path.join(HERE, f'out_hill_ground_{tod}.png'))


# ---------------------------------------------------------------- sky panoramas
SW, SH = 8192, 2000
Z0, Z1, SR = -6.0, 34.0, 26.0
PPM = SH / (Z1 - Z0)                 # 50 px per metre (both ways at the drum radius)


def sx(az): return (az + 180.0) / 360.0 * SW


def sy(z): return (Z1 - z) * PPM


def vgrad(stops):
    zs = Z1 - (np.arange(SH) + 0.5) / PPM
    out = np.zeros((SH, 3), 'f4')
    st = sorted(stops)
    for c in range(3):
        out[:, c] = np.interp(zs, [s[0] for s in st], [rgb(s[1])[c] for s in st])
    return np.repeat(out[:, None, :], SW, axis=1)


def glow(arr, az, z, r_m, col, k=1.0):
    """Additive soft glow (gaussian in metres, wraps in azimuth)."""
    cx, cy = sx(az), sy(z); s = r_m * PPM; m = int(3.5 * s)
    y0, y1 = max(0, int(cy - m)), min(SH, int(cy + m))
    cols = np.arange(int(cx - m), int(cx + m)) % SW
    ys = np.arange(y0, y1)[:, None]; xs = np.arange(int(cx - m), int(cx + m))[None, :]
    g = np.clip(np.exp(-((xs - cx) ** 2 + (ys - cy) ** 2) / (2 * s * s)) * k, 0, 1)[..., None].astype('f4')
    sub = arr[y0:y1][:, cols]
    arr[y0:y1, cols] = sub + (np.array(rgb(col), 'f4')[None, None, :] - sub) * g
    return arr


def profile(seed, base, amp, n_peaks, width_deg, rough=0.25, karst=True):
    """Mountain top line (z per column, seamless): rounded karst peaks + a rolling base."""
    r = random.Random(seed)
    az = (np.arange(SW) + 0.5) / SW * 360.0 - 180.0
    z = np.full(SW, base, 'f4')
    for k, ph in ((2, r.uniform(0, 6.3)), (3, r.uniform(0, 6.3)), (7, r.uniform(0, 6.3))):
        z += amp * rough * 0.4 * np.sin(np.radians(az) * k + ph)
    for i in range(n_peaks):
        c = r.uniform(-180, 180); h = amp * r.uniform(0.45, 1.0); wd = width_deg * r.uniform(0.6, 1.3)
        d = np.abs(((az - c + 180) % 360) - 180) / wd
        shape = np.where(d < 1, np.clip(1 - d ** 2, 0, 1) ** (0.6 if karst else 1.2), 0)
        z = np.maximum(z, base + h * shape)
    return z


def mountains(arr, prof, top, bottom, zb):
    """Fill below the profile with a top -> bottom (mist) gradient down to zb."""
    zs = Z1 - (np.arange(SH) + 0.5) / PPM
    for x in range(0, SW):
        zt = prof[x]
        rows = np.where((zs <= zt))[0]
        if not len(rows): continue
        k = np.clip((zt - zs[rows]) / max(0.5, zt - zb), 0, 1)[:, None]
        arr[rows, x, :] = np.array(rgb(top), 'f4') * (1 - k) + np.array(rgb(bottom), 'f4') * k
    return arr


def mountains_fast(arr, prof, top, bottom, zb):
    zs = (Z1 - (np.arange(SH) + 0.5) / PPM)[:, None]
    zt = prof[None, :]
    mask = zs <= zt
    k = np.clip((zt - zs) / np.maximum(0.5, zt - zb), 0, 1)[..., None]
    col = np.array(rgb(top), 'f4')[None, None, :] * (1 - k) + np.array(rgb(bottom), 'f4')[None, None, :] * k
    arr[mask] = col[mask]
    return arr


def cloud(d, rnd, az, z, w_m, h_m, body, shade, light, ink=None):
    """Cartoon cloud: flat rounded base + 3-5 puffs; a shaded underside, a lit top, an optional thin rim line."""
    cx, cy = sx(az), sy(z); W, H = w_m * PPM, h_m * PPM
    puffs = [(cx + (k - 0.5 * (n - 1)) * W / n * 0.9 + rnd.uniform(-0.1, 0.1) * W / n, rnd.uniform(0.35, 0.75) * H)
             for n in [rnd.randint(3, 5)] for k in range(n)]

    def shape(dd, col, dy=0.0, grow=0.0):
        dd.rounded_rectangle([cx - W / 2 - grow, cy - H * 0.35 - grow + dy, cx + W / 2 + grow, cy + grow + dy], radius=H * 0.35 + grow, fill=col)
        for px_, r in puffs:
            dd.ellipse([px_ - r - grow, cy - H * 0.2 - r - grow + dy, px_ + r + grow, cy - H * 0.2 + r + grow + dy], fill=col)
    if ink: shape(d, rgb(ink) + (255,), grow=3)
    shape(d, rgb(shade) + (255,))
    shape(d, rgb(body) + (255,), dy=-H * 0.12)
    for px_, r in puffs[: max(1, len(puffs) - 2)]:
        d.ellipse([px_ - r * 0.55, cy - H * 0.2 - r * 0.8 - H * 0.12, px_ + r * 0.2, cy - H * 0.2 - r * 0.25 - H * 0.12], fill=rgb(light) + (255,))


def streak(d, az, z, w_m, h_m, col, alpha=255):
    cx, cy = sx(az), sy(z); W, H = w_m * PPM, h_m * PPM
    d.rounded_rectangle([cx - W / 2, cy - H / 2, cx + W / 2, cy + H / 2], radius=H / 2, fill=rgb(col) + (alpha,))


def stars(d, rnd, n, zmin, avoid=None, col='#fff4d2', sparkles=20):
    for i in range(n):
        for _ in range(20):
            az = rnd.uniform(-180, 180); z = zmin + (Z1 - zmin) * (1 - rnd.random() ** 1.6)
            if not avoid or math.hypot(((az - avoid[0] + 180) % 360) - 180, (z - avoid[1]) * 2.2) > avoid[2]: break
        x, y = sx(az), sy(z); r = rnd.choice((1.6, 2.0, 2.4, 3.0, 3.6))
        a = int(140 + 115 * rnd.random())
        d.ellipse([x - r, y - r, x + r, y + r], fill=rgb(col) + (a,))
    for i in range(sparkles):
        for _ in range(20):
            az = rnd.uniform(-180, 180); z = rnd.uniform(zmin + 4, Z1 - 3)
            if not avoid or math.hypot(((az - avoid[0] + 180) % 360) - 180, (z - avoid[1]) * 2.2) > avoid[2] + 3: break
        x, y = sx(az), sy(z); s = rnd.uniform(9, 16)
        pts = []
        for k in range(8):
            a = k * math.pi / 4; rr = s if k % 2 == 0 else s * 0.22
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
        d.polygon(pts, fill=rgb('#fff8e0') + (255,))


def moon(arr, az, z, r_m, col='#fbe9f2', halo='#ff9fd6', crater='#ecd2e2'):
    arr = glow(arr, az, z, r_m * 2.4, halo, 0.55)
    arr = glow(arr, az, z, r_m * 1.25, '#ffc8ea', 0.5)
    im = to_im(arr); d = ImageDraw.Draw(im, 'RGBA')
    cx, cy, R = sx(az), sy(z), r_m * PPM
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=rgb(col))
    rnd = random.Random(2)
    for (u, v, rr) in ((-0.42, -0.3, 0.26), (0.35, 0.22, 0.2), (0.12, -0.55, 0.13), (-0.15, 0.5, 0.17), (0.55, -0.18, 0.1)):
        d.ellipse([cx + u * R - rr * R, cy + v * R - rr * R, cx + u * R + rr * R, cy + v * R + rr * R], fill=rgb(crater) + (200,))
    d.ellipse([cx - R * 0.78, cy - R * 0.85, cx - R * 0.1, cy - R * 0.45], fill=(255, 255, 255, 60))
    return np.asarray(im).astype('f4')


def sun(arr, az, z, r_m, col='#fff3c8', halo='#ffcf80'):
    arr = glow(arr, az, z, r_m * 5.0, halo, 0.6)
    arr = glow(arr, az, z, r_m * 2.0, '#ffe8b0', 0.7)
    im = to_im(arr); d = ImageDraw.Draw(im, 'RGBA'); cx, cy, R = sx(az), sy(z), r_m * PPM
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=rgb(col))
    return np.asarray(im).astype('f4')


def birds(d, rnd, az, z, n, spread_m, col, size=0.35):
    for i in range(n):
        x, y = sx(az + rnd.uniform(-1, 1) * spread_m / SR * 57.3), sy(z + rnd.uniform(-0.5, 0.5) * spread_m * 0.5)
        s = size * PPM * rnd.uniform(0.7, 1.2); wv = rnd.uniform(-0.2, 0.2) * s
        d.line([(x - s, y - s * 0.35 + wv), (x - s * 0.45, y - s * 0.45), (x, y), (x + s * 0.45, y - s * 0.45), (x + s, y - s * 0.35 - wv)],
               fill=rgb(col) + (255,), width=5, joint='curve')


def pagoda_far(d, az, z, h_m, col, lit=None):
    """A flat far silhouette of a pagoda (painted on the horizon)."""
    cx, by = sx(az), sy(z); u = PPM
    tiers = 5; w0 = h_m * 0.42
    y = by
    for t in range(tiers):
        w = w0 * (1 - t * 0.13); th = h_m / (tiers + 1.5)
        d.rectangle([cx - w * 0.28 * u, y - th * 0.7 * u, cx + w * 0.28 * u, y], fill=rgb(col))
        if lit: d.rectangle([cx - w * 0.06 * u, y - th * 0.55 * u, cx + w * 0.06 * u, y - th * 0.2 * u], fill=rgb(lit))
        y -= th * 0.7 * u
        d.polygon([(cx - w * 0.55 * u, y + th * 0.12 * u), (cx - w * 0.4 * u, y - th * 0.18 * u), (cx + w * 0.4 * u, y - th * 0.18 * u),
                   (cx + w * 0.55 * u, y + th * 0.12 * u), (cx, y - th * 0.05 * u)], fill=rgb(col))
        y -= th * 0.18 * u
    d.rectangle([cx - 0.04 * h_m * u, y - h_m * 0.18 * u, cx + 0.04 * h_m * u, y], fill=rgb(col))


def save_sky(arr, name):
    to_im(arr).save(os.path.join(HERE, f'out_sky_{name}.png'))


def sky_night(name, moon_az, moon_z, extra=None):
    arr = vgrad([(34, '#101646'), (24, '#1d2470'), (15, '#3a3196'), (8, '#6a3fae'), (3.5, '#b356b2'), (1.0, '#e07fbc'),
                 (-0.5, '#c46aa8'), (-6, '#2a2058')])
    rnd = random.Random(7)
    arr = glow(arr, moon_az, moon_z - 6, 22, '#9a5ac0', 0.35)
    im = to_im(arr); d = ImageDraw.Draw(im, 'RGBA')
    stars(d, rnd, 1400, 6.0, avoid=(moon_az, moon_z, 9), sparkles=28)
    arr = np.asarray(im).astype('f4')
    arr = moon(arr, moon_az, moon_z, 3.6)
    im = to_im(arr); d = ImageDraw.Draw(im, 'RGBA')
    for i in range(14):     # pink streak clouds, a few across the moon (the reference's dusky streaks)
        az = moon_az + rnd.uniform(-40, 40) if i < 5 else rnd.uniform(-180, 180)
        streak(d, az, rnd.uniform(9, 22), rnd.uniform(6, 16), rnd.uniform(0.35, 0.7), rnd.choice(('#c76fc0', '#e08ad0', '#9a5cc4')), 200)
    arr = np.asarray(im).astype('f4')
    far = profile(31, 0.4, 9.0, 34, 5.5)
    arr = mountains_fast(arr, far, '#5b3f98', '#b065b4', 0.0)
    mid = profile(32, 0.2, 5.5, 40, 4.0)
    arr = mountains_fast(arr, mid, '#3c2d7a', '#7a4aa0', 0.0)
    near = profile(33, 0.0, 2.6, 30, 7.0, karst=False)
    arr = mountains_fast(arr, near, '#2a2466', '#4a3486', -0.5)
    im = to_im(arr); d = ImageDraw.Draw(im, 'RGBA')
    for i in range(10):    # mist bands in front of the ranges
        streak(d, rnd.uniform(-180, 180), rnd.uniform(0.6, 2.4), rnd.uniform(10, 30), rnd.uniform(0.5, 0.9), '#c67cc4', 90)
    if extra: extra(d, rnd)
    save_sky(np.asarray(im).astype('f4'), name)


def sky_warm(name, sun_az, sun_z, top, stops, cloud_cols, mt, extra=None, n_clouds=18, sun_r=2.2, view=None, n_view=7):
    arr = vgrad(stops)
    arr = sun(arr, sun_az, sun_z, sun_r)
    rnd = random.Random(9)
    im = to_im(arr); d = ImageDraw.Draw(im, 'RGBA')
    for i in range(10):
        streak(d, rnd.uniform(-180, 180), rnd.uniform(6, 20), rnd.uniform(8, 20), rnd.uniform(0.3, 0.6), cloud_cols[3], 170)
    for i in range(n_clouds + (n_view if view else 0)):
        inview = view and i >= n_clouds
        az = rnd.uniform(*view) if inview else rnd.uniform(-180, 180); z = rnd.uniform(9, 19) if inview else rnd.uniform(8, 25); wm = rnd.uniform(4, 9)
        cloud(d, rnd, az, z, wm, wm * rnd.uniform(0.28, 0.4), *cloud_cols[:3], ink=cloud_cols[4] if len(cloud_cols) > 4 else None)
    arr = np.asarray(im).astype('f4')
    for k, (seed, base, amp, n, wd, ctop, cbot, karst) in enumerate(mt):
        arr = mountains_fast(arr, profile(seed, base, amp, n, wd, karst=karst), ctop, cbot, 0.0)
    im = to_im(arr); d = ImageDraw.Draw(im, 'RGBA')
    for i in range(10):
        streak(d, rnd.uniform(-180, 180), rnd.uniform(0.5, 2.2), rnd.uniform(10, 30), rnd.uniform(0.5, 0.9), mt[-1][6], 110)
    if extra: extra(d, rnd)
    save_sky(np.asarray(im).astype('f4'), name)


def skies(which):
    if 'hill_night' in which:
        sky_night('hill_night', -28.7, 7.0)
    if 'gate_night' in which:
        def hut_hill(d, rnd):   # the inventor's hill down the road (-Y): a mound with a tiny hut and its lit window
            for az in (178.0,):
                cx, by = sx(az), sy(0.0)
                d.ellipse([cx - 7.5 * PPM, by - 3.2 * PPM, cx + 7.5 * PPM, by + 3.2 * PPM], fill=rgb('#2a2466'))
                hx, hy = cx + 1.2 * PPM, by - 3.1 * PPM
                d.rectangle([hx - 0.5 * PPM, hy - 0.55 * PPM, hx + 0.5 * PPM, hy + 0.1 * PPM], fill=rgb('#2a2466'))
                d.polygon([(hx - 0.75 * PPM, hy - 0.5 * PPM), (hx, hy - 1.05 * PPM), (hx + 0.75 * PPM, hy - 0.5 * PPM)], fill=rgb('#2a2466'))
                d.rectangle([hx + 0.15 * PPM, hy - 0.35 * PPM, hx + 0.32 * PPM, hy - 0.15 * PPM], fill=rgb('#ffc46a'))
                tx = cx - 2.4 * PPM
                for r, yy in ((0.9, 3.9), (1.2, 3.4), (0.8, 4.4)):
                    d.ellipse([tx - r * PPM, by - yy * PPM - r * 0.4 * PPM, tx + r * PPM, by - yy * PPM + r * 0.4 * PPM], fill=rgb('#2a2466'))
                d.line([(tx, by - 2.9 * PPM), (tx + 0.2 * PPM, by - 4.2 * PPM)], fill=rgb('#2a2466'), width=10)
        sky_night('gate_night', 162.0, 12.5, extra=hut_hill)
    if 'hill_dusk' in which:
        def dusk_extra(d, rnd):
            birds(d, rnd, 20.0, 9.0, 7, 5.0, '#4a2f5a')
            birds(d, rnd, -28.0, 12.5, 9, 6.0, '#4a2f5a')
            birds(d, rnd, -60.0, 12.0, 5, 4.0, '#5a3a6a')
            for az, h in ((-34.0, 6.5), (-46.0, 4.8)):
                pagoda_far(d, az, 0.8, h, '#8a5a90')
        sky_warm('hill_dusk', 31.0, 4.0, None,
                 [(34, '#5560b4'), (24, '#8a72c4'), (15, '#d184b4'), (8, '#f39aa0'), (3.5, '#ffb37a'), (1.0, '#ffd394'), (-6, '#9a6a80')],
                 ('#f6b0b8', '#d07aa8', '#ffe0b0', '#f0a0c0', '#9a5a8a'),
                 [(41, 0.4, 8.5, 30, 5.5, '#b77aa8', '#f2aaa4', True), (42, 0.2, 5.0, 36, 4.2, '#8f5f9c', '#d68aa0', True),
                  (43, 0.0, 2.4, 28, 7.0, '#6a4a88', '#a46a94', False)], extra=dusk_extra, sun_r=2.4, view=(-62, 2))
    if 'rubble_dawn' in which:
        def dawn_extra(d, rnd):
            birds(d, rnd, -10.0, 11.0, 9, 7.0, '#4a3550')
            for az in (-62.0, -15.0, 38.0, 70.0):     # far smoke columns from the stricken city
                x0, y0 = sx(az), sy(1.5)
                for k in range(9):
                    r = (0.7 + 0.35 * k) * PPM; yy = y0 - k * 1.3 * PPM; xx = x0 + k * k * 0.06 * PPM
                    d.ellipse([xx - r, yy - r * 0.8, xx + r, yy + r * 0.8], fill=rgb('#8a7088') + (150 - k * 12,))
        sky_warm('rubble_dawn', -27.0, 6.5, None,
                 [(34, '#6f7ccb'), (24, '#a48cc8'), (15, '#e29cb4'), (8, '#f7aba0'), (3.5, '#ffc58c'), (1.0, '#ffe0aa'), (-6, '#a88078')],
                 ('#fbc0bc', '#e08ea8', '#fff0c8', '#f4b0c0', '#a86a8a'),
                 [(51, 0.4, 8.0, 30, 5.5, '#c08aac', '#f6b8aa', True), (52, 0.2, 4.6, 36, 4.2, '#9a6aa0', '#e09aa4', True),
                  (53, 0.0, 2.2, 28, 7.0, '#7a5690', '#b07a98', False)], extra=dawn_extra, view=(-30, 30))
    if 'gate_day' in which:
        def day_extra(d, rnd):
            birds(d, rnd, 25.0, 14.0, 6, 5.0, '#3a4a6a')
            birds(d, rnd, -40.0, 17.0, 4, 3.0, '#3a4a6a')
        sky_warm('gate_day', -140.0, 30.0, None,
                 [(34, '#3f7fd0'), (22, '#62a0e2'), (12, '#94c2ee'), (5, '#c4e0f4'), (1.0, '#e6f2f2'), (-6, '#9ab08a')],
                 ('#fbfbf4', '#c4d2ea', '#ffffff', '#e8f2fa', '#7d94b8'),
                 [(61, 0.4, 8.5, 30, 5.5, '#8eaed0', '#d2e4ee', True), (62, 0.2, 5.0, 36, 4.2, '#6f9aa8', '#b4d0d2', True),
                  (63, 0.0, 2.4, 28, 7.0, '#5d8a6e', '#94b89a', False)], extra=day_extra, n_clouds=24, sun_r=0.01, view=(-30, 30))


# ---------------------------------------------------------------- printed cloth / paper / signs (CJK: Yu Gothic Bold)
CJK = 'C:/Windows/Fonts/YuGothB.ttc'


def _font(px): return ImageFont.truetype(CJK, px)


def banners():
    """out_banner_<i>.png: tall vertical cloth banners with a swallowtail foot (alpha), a border, an emblem disc and two
    big characters. out_flag_<i>.png: small triangular pennants with a scalloped edge."""
    specs = [('#b8291b', '#e8b53a', '平安'), ('#2a4f86', '#e8d6a0', '福壽'), ('#e0a830', '#8a1e16', '永樂'), ('#2b6a5c', '#f0dca0', '太平')]
    for i, (cloth, ink, text) in enumerate(specs):
        W, H = 320, 1280
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        notch = 150
        d.polygon([(0, 0), (W, 0), (W, H), (W // 2, H - notch), (0, H)], fill=rgb(cloth) + (255,))
        b = 18
        d.line([(b, b), (W - b, b), (W - b, H - b - 20), (W // 2, H - notch - b + 10), (b, H - b - 20), (b, b)], fill=rgb(ink) + (255,), width=10)
        d.ellipse([W / 2 - 110, 120, W / 2 + 110, 340], fill=rgb(ink) + (255,))
        d.ellipse([W / 2 - 92, 138, W / 2 + 92, 322], fill=rgb(cloth) + (255,))
        f = _font(170)
        for k, ch in enumerate(text):
            cy = 230 if k == 0 else 560
            d.text((W / 2, cy), ch, font=f, fill=rgb(ink) + (255,), anchor='mm')
        for k in range(6):   # a band of small diamonds lower down
            y = 760 + k * 50
            d.polygon([(W / 2, y - 18), (W / 2 + 18, y), (W / 2, y + 18), (W / 2 - 18, y)], fill=rgb(ink) + (255,))
        im.save(os.path.join(HERE, f'out_banner_{i}.png'))
    for i, (cloth, ink) in enumerate((('#b8291b', '#e8b53a'), ('#e0a830', '#8a1e16'), ('#2a4f86', '#e8d6a0'))):
        W, H = 512, 320
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        pts = [(0, 0), (W, H / 2), (0, H)]
        d.polygon(pts, fill=rgb(ink) + (255,))
        for k in range(9):     # scalloped (flame) edge
            t = (k + 0.5) / 9
            x, y = t * W, t * H / 2
            d.ellipse([x - 22, y - 22, x + 22, y + 22], fill=rgb(ink) + (255,))
            d.ellipse([x - 22, H - y - 22, x + 22, H - y + 22], fill=rgb(ink) + (255,))
        d.polygon([(14, 26), (W - 70, H / 2), (14, H - 26)], fill=rgb(cloth) + (255,))
        d.ellipse([60, H / 2 - 50, 160, H / 2 + 50], fill=rgb(ink) + (255,))
        im.save(os.path.join(HERE, f'out_flag_{i}.png'))


def signs():
    """Shop signs (vertical boards), the edict notice papers and the milestone face."""
    for i, (board, ink, text) in enumerate((('#2a2622', '#e8b53a', '茶'), ('#7a2a1c', '#f0dca0', '米'), ('#2b4a6a', '#f0dca0', '酒'),
                                             ('#5a3a24', '#f2e6c8', '藥'))):
        W, H = 256, 512
        im = Image.new('RGB', (W, H), rgb(board)); d = ImageDraw.Draw(im)
        d.rectangle([12, 12, W - 13, H - 13], outline=rgb(ink), width=8)
        d.text((W / 2, H / 2), text, font=_font(200), fill=rgb(ink), anchor='mm')
        im.save(os.path.join(HERE, f'out_sign_{i}.png'))
    rnd = random.Random(4)
    pool = '天下太平城門守衛告示民安國泰米價今日市集禁止夜行通行令月年東西南北人馬車船'
    for i in range(4):
        W, H = 300, 400
        paper = ('#efe6cf', '#f2dcc0', '#e6dcc4', '#f0e2b8')[i]
        im = Image.new('RGB', (W, H), rgb(paper)); d = ImageDraw.Draw(im)
        if i == 0:
            d.rectangle([0, 0, W, 70], fill=rgb('#b8291b'))
            d.text((W / 2, 36), '告示', font=_font(52), fill=rgb('#f2efe6'), anchor='mm')
        f = _font(30)
        for col in range(6):
            x = W - 40 - col * 44
            for row in range(8 if i else 7):
                y = (100 if i == 0 else 40) + row * 38
                if rnd.random() < 0.9: d.text((x, y), rnd.choice(pool), font=f, fill=rgb('#2a2622'), anchor='mm')
        if i == 0:
            d.ellipse([30, H - 90, 100, H - 20], outline=rgb('#b8291b'), width=7)
            d.text((65, H - 55), '印', font=_font(34), fill=rgb('#b8291b'), anchor='mm')
        if i == 2:     # a wanted-style poster: a face sketch
            d.rectangle([40, 40, W - 40, 220], fill=rgb('#e0d4b8'))
            d.ellipse([105, 70, 195, 170], outline=rgb('#2a2622'), width=5)
            d.line([(130, 110), (140, 110)], fill=rgb('#2a2622'), width=5); d.line([(160, 110), (170, 110)], fill=rgb('#2a2622'), width=5)
            d.arc([130, 120, 170, 150], 20, 160, fill=rgb('#2a2622'), width=4)
        im.save(os.path.join(HERE, f'out_paper_{i}.png'))
    W, H = 256, 640
    im = Image.new('RGB', (W, H), rgb('#a9a595')); d = ImageDraw.Draw(im)
    for k, ch in enumerate('京城五里'):
        d.text((W / 2, 110 + k * 135), ch, font=_font(118), fill=rgb('#4a463e'), anchor='mm')
    im.save(os.path.join(HERE, 'out_milestone.png'))


def stucco():
    """out_stucco.png: 4 x 4 m of red palace-wall stucco for box projection (v = z / 4 m from the ground): a dark damp
    band over the stone base, two framed panels per 4 m with lighter centres, a painted gold-green frieze near the
    top, chips where the bare brick shows, cracks, rain streaks."""
    S = 1024; M = S / 4.0; rnd = random.Random(31)
    k = seam_noise(S, S, 6, 31)
    arr = lerp_img('#b0402e', '#d05440', np.clip((k - 0.2) * 1.4, 0, 1))
    im = to_im(arr); d = ImageDraw.Draw(im, 'RGBA')

    def Y(z): return (4.0 - z) * M

    d.rectangle([0, Y(0.95), S, Y(0.0)], fill=rgb('#6a1e18') + (200,))
    for i in range(2):
        x0, x1 = (0.25 + 2.0 * i) * M, (1.75 + 2.0 * i) * M
        d.rectangle([x0, Y(3.55), x1, Y(1.15)], outline=rgb('#5a1712'), width=int(0.05 * M))
        d.rectangle([x0 + 0.1 * M, Y(3.45), x1 - 0.1 * M, Y(1.25)], fill=rgb('#b8463a') + (110,))
        d.rectangle([x0 + 0.12 * M, Y(3.43), x1 - 0.12 * M, Y(1.27)], outline=rgb('#d0a23a'), width=int(0.018 * M))
    d.rectangle([0, Y(3.95), S, Y(3.7)], fill=rgb('#2b6a5c'))
    for i in range(16):
        x = (i + 0.5) * S / 16
        d.ellipse([x - 0.08 * M, Y(3.9), x + 0.08 * M, Y(3.75)], fill=rgb('#d0a23a'))
    for i in range(9):    # chips: bare brick showing through
        x, z = rnd.uniform(0, 4), rnd.uniform(1.0, 3.5); w, h = rnd.uniform(0.2, 0.45), rnd.uniform(0.15, 0.3)
        pts = blob(rnd, x * M, Y(z), w * M, 8, 0.35)
        d.polygon(pts, fill=rgb('#8a6a58'))
        for j in range(3):
            yy = Y(z) - h * M * 0.4 + j * h * M * 0.35
            d.line([(x * M - w * M * 0.6, yy), (x * M + w * M * 0.6, yy)], fill=rgb('#5a4034'), width=3)
    for i in range(14):   # cracks
        x, z = rnd.uniform(0, 4) * M, Y(rnd.uniform(1.2, 3.8)); pts = [(x, z)]
        for j in range(rnd.randint(3, 6)):
            x += rnd.uniform(-0.12, 0.12) * M; z += rnd.uniform(0.06, 0.16) * M; pts.append((x, z))
        d.line(pts, fill=(52, 20, 16, 255), width=4)
    for i in range(30):   # rain streaks
        x = rnd.uniform(0, S); z0 = Y(rnd.uniform(3.0, 3.7))
        d.line([(x, z0), (x + rnd.uniform(-4, 4), z0 + rnd.uniform(0.4, 1.2) * M)], fill=(80, 24, 18, 90), width=rnd.choice((3, 5)))
    im.save(os.path.join(HERE, 'out_stucco.png'))


def rooftile():
    """out_rooftile.png: 1 x 1 m of barrel-tile roof in neutral greys for box projection with a tint (the roof colour):
    four tile rolls across (lit crest, a highlight, dark gaps), faint course lines."""
    S = 512; M = S / 1.0
    a = np.full((S, S), 0.82, 'f4')
    x = (np.arange(S) + 0.5) / M % 0.25 / 0.25        # 0..1 across one roll
    prof = np.where(x < 0.68, 0.78 + 0.32 * np.sin(np.pi * x / 0.68), 0.36)
    a = a * 0 + prof[None, :]
    hl = np.exp(-((x - 0.24) / 0.06) ** 2) * 0.22
    a = a + hl[None, :]
    for k in range(3):
        y0 = int((k + 0.5) / 3 * S); a[y0:y0 + 3, :] *= 0.78
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype('uint8')).convert('RGB')
    img.save(os.path.join(HERE, 'out_rooftile.png'))


ALL = ['grass', 'road', 'apron', 'court', 'hill_day', 'hill_night', 'gate_day', 'gate_night', 'hill_dusk', 'hill_night_sky', 'rubble_dawn',
       'banners', 'signs', 'stucco', 'rooftile']

if __name__ == '__main__':
    which = sys.argv[1:] or ALL
    if 'grass' in which: grass()
    if 'road' in which: road()
    if 'apron' in which: apron()
    if 'court' in which: court()
    if 'hill_day' in which: hill_ground('day')
    if 'hill_night' in which: hill_ground('night')
    sk = [n for n in ('gate_day', 'gate_night', 'hill_dusk', 'rubble_dawn') if n in which] + (['hill_night'] if 'hill_night_sky' in which else [])
    if sk: skies(sk)
    if 'banners' in which: banners()
    if 'signs' in which: signs()
    if 'stucco' in which: stucco()
    if 'rooftile' in which: rooftile()
    print('make_out done', which)
