# Textures of the PALACE HALL ("The Ancient Jar"), read by film/jar/dress_hall.py and the hall_* props. All original
# graphics drawn with Pillow (bold flat cartoon shapes, dark outlines, warm saturated palace colours):
#  - world-mapped surfaces (no repeats): the stone floor (warm slabs, dark column-line strips with a gold key inlay,
#    a perimeter band), the imperial carpet (red runner with a navy key border, lotus roundels, and the round
#    medallion under the jar: the eight trigrams in gold), the back wall and the side walls (dark wainscot with gold
#    roundels, red lacquer with gold-framed bays, a painted beam band on top).
#  - repeating tiles: ceiling coffer (lotus rosette), painted beam strip (caihua), yellow silk brocade, porcelain wraps.
#  - prints: the plaque over the throne, couplet boards for the columns, calligraphy scrolls, banners, crops of the
#    Flow-made screen / crane scroll pictures (without the photo backgrounds around them).
#   .venv/Scripts/python.exe assets/props/tex/make_hall.py [floor] [carpet] [walls] [tiles] [prints] [windows] [front]   (no args = all)
import math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
DRESS = os.path.join(LAB, 'assets', 'dress')
SONG = 'C:/Windows/Fonts/simsun.ttc'
GOTH = 'C:/Windows/Fonts/YuGothB.ttc'
WHAT = set(sys.argv[1:]) or {'floor', 'carpet', 'walls', 'tiles', 'prints', 'windows', 'front'}

INK = (42, 34, 30)
GOLD = (214, 166, 58)
GOLD_L = (240, 204, 104)
GOLD_D = (138, 96, 30)
RED = (150, 40, 30)
RED_D = (104, 26, 20)
RED_L = (178, 58, 40)
NAVY = (30, 46, 96)
TEAL = (30, 112, 108)
GREEN = (52, 134, 98)
BLUE = (40, 84, 150)
CREAM = (242, 232, 206)


def out(name): return os.path.join(HERE, name)


def font(path, px, index=0): return ImageFont.truetype(path, int(px), index=index)


class Surf:
    """A surface in world metres: u0..u1 left -> right, v0..v1 bottom -> top, ppm pixels per metre."""
    def __init__(self, u0, u1, v0, v1, ppm):
        self.u0, self.u1, self.v0, self.v1, self.ppm = u0, u1, v0, v1, ppm
        self.W, self.H = int(round((u1 - u0) * ppm)), int(round((v1 - v0) * ppm))

    def px(self, u, v): return ((u - self.u0) * self.ppm, (self.v1 - v) * self.ppm)
    def m(self, d): return d * self.ppm
    def box(self, ua, va, ub, vb):
        (x0, y0), (x1, y1) = self.px(ua, vb), self.px(ub, va)
        return (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))


def noise(W, H, cells, seed):
    rng = np.random.default_rng(seed)
    a = rng.random((max(2, int(H / W * cells)), cells))
    im = Image.fromarray((a * 255).astype('uint8')).resize((W, H), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32) / 255.0


def mottle(img, amt, cells, seed, amt2=0.0, cells2=0):
    a = np.asarray(img, dtype=np.float32)
    n = noise(img.width, img.height, cells, seed) - 0.5
    k = 1 + amt * n
    if amt2: k = k + amt2 * (noise(img.width, img.height, cells2, seed + 7) - 0.5)
    a = a * k[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype('uint8'))


def rect(d, b, fill=None, outline=None, width=1):
    d.rectangle([round(x) for x in b], fill=fill, outline=outline, width=max(1, int(round(width))))


def key_band(d, x0, y0, x1, y1, col, bg=None, ink=None):
    """A Greek-key / Chinese meander (huiwen) band filling the box, unit = band height."""
    if bg: d.rectangle([x0, y0, x1, y1], fill=bg)
    h = y1 - y0; u = h; t = max(1, h / 7.0)
    x = x0 + t
    while x + u <= x1:
        # one square spiral unit: a hook shape made of bars
        segs = [(x, y1 - t, x + u - t, y1), (x + u - 2 * t, y0 + t, x + u - t, y1), (x + t * 1.0, y0 + t, x + u - t, y0 + 2 * t),
                (x + t, y0 + t, x + 2 * t, y1 - 2.5 * t), (x + t, y1 - 3.5 * t, x + u - 3.2 * t, y1 - 2.5 * t),
                (x + u - 4.2 * t, y0 + 3 * t, x + u - 3.2 * t, y1 - 2.5 * t)]
        for s in segs: d.rectangle([round(v) for v in s], fill=col)
        x += u
    if ink: d.rectangle([x0, y0, x1, y1], outline=ink, width=max(1, int(t / 2)))


def cloud(d, cx, cy, r, fill, line, w):
    """A ruyi cloud: three lobes and a curl, outlined."""
    lobes = [(-0.9, 0.15, 0.55), (0.0, -0.25, 0.7), (0.9, 0.15, 0.55), (-0.35, 0.35, 0.45), (0.45, 0.35, 0.45)]
    for dx, dy, rr in lobes:
        R = r * rr + w; d.ellipse([cx + dx * r - R, cy + dy * r - R, cx + dx * r + R, cy + dy * r + R], fill=line)
    for dx, dy, rr in lobes:
        R = r * rr; d.ellipse([cx + dx * r - R, cy + dy * r - R, cx + dx * r + R, cy + dy * r + R], fill=fill)
    for dx, dy, rr in lobes[:3]:
        R = r * rr * 0.55; d.arc([cx + dx * r - R, cy + dy * r - R, cx + dx * r + R, cy + dy * r + R], 200, 520, fill=line, width=max(1, int(w * 0.8)))


def rosette(d, cx, cy, r, petals, cols, line, w, rot=0.0):
    """A lotus rosette: rings of pointed petals (cols from outside in), outlined, a round centre."""
    for ring, (rr, colr) in enumerate(zip((1.0, 0.72, 0.46), cols)):
        n = petals
        off = rot + (math.pi / n if ring % 2 else 0)
        for k in range(n):
            a = off + 2 * math.pi * k / n
            pts = []
            for s in range(13):
                t = s / 12
                ang = a + (t - 0.5) * (2 * math.pi / n) * 0.95
                rad = r * rr * (0.35 + 0.65 * math.sin(math.pi * t) ** 0.6)
                pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
            tip = (cx + r * rr * 1.08 * math.cos(a), cy + r * rr * 1.08 * math.sin(a))
            poly = [(cx, cy)] + pts[:7] + [tip] + pts[6:] + [(cx, cy)]
            d.polygon(poly, fill=colr, outline=line)
            d.line(poly, fill=line, width=max(1, int(w)))
    R = r * 0.22; d.ellipse([cx - R - w, cy - R - w, cx + R + w, cy + R + w], fill=line)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=cols[-1] if len(cols) > 3 else GOLD_L)


def trigram(d, cx, cy, ang, bits, L, t, col, line):
    """Three bars (bits: 1 solid, 0 broken) centred at (cx, cy), bars perpendicular to direction ang."""
    ux, uy = math.cos(ang), math.sin(ang)      # radial
    vx, vy = -uy, ux                           # tangential
    for i, b in enumerate(bits):
        off = (i - 1) * t * 1.9
        bx, by = cx + ux * off, cy + uy * off
        parts = [(-L / 2, L / 2)] if b else [(-L / 2, -L * 0.09), (L * 0.09, L / 2)]
        for a0, a1 in parts:
            p = [(bx + vx * a0 - ux * t / 2, by + vy * a0 - uy * t / 2), (bx + vx * a1 - ux * t / 2, by + vy * a1 - uy * t / 2),
                 (bx + vx * a1 + ux * t / 2, by + vy * a1 + uy * t / 2), (bx + vx * a0 + ux * t / 2, by + vy * a0 + uy * t / 2)]
            d.polygon(p, fill=col, outline=line)


def corner_keys(d, b, col, s, w):
    """Gold L-shaped key brackets in the four corners of box b."""
    x0, y0, x1, y1 = b
    for cx, cy, sx, sy in ((x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)):
        pts = [(cx, cy + sy * s), (cx, cy), (cx + sx * s, cy)]
        d.line(pts, fill=col, width=w)
        p2 = [(cx + sx * s * 0.35, cy + sy * s * 0.7), (cx + sx * s * 0.35, cy + sy * s * 0.35), (cx + sx * s * 0.7, cy + sy * s * 0.35)]
        d.line(p2, fill=col, width=w)


# ====================================================================== floor (x -8..8, y -8..8)
def make_floor():
    S = Surf(-8, 8, -8, 8, 256)
    W, H = S.W, S.H
    xs = S.u0 + (np.arange(W) + 0.5) / S.ppm
    ys = S.v1 - (np.arange(H) + 0.5) / S.ppm
    SL = 0.8
    ix = np.floor((xs + 8) / SL).astype(int); iy = np.floor((ys + 8) / SL).astype(int)
    rng = np.random.default_rng(5)
    tint = rng.uniform(0.9, 1.07, (40, 40)); hue = rng.uniform(-0.035, 0.035, (40, 40))
    base = np.array((182, 146, 102), np.float32)
    T = tint[iy][:, ix]; Hh = hue[iy][:, ix]
    a = np.empty((H, W, 3), np.float32)
    a[..., 0] = base[0] * T * (1 + Hh); a[..., 1] = base[1] * T; a[..., 2] = base[2] * T * (1 - Hh)
    n1 = noise(W, H, 40, 1) - 0.5; n2 = noise(W, H, 260, 2) - 0.5
    a *= (1 + 0.10 * n1 + 0.06 * n2)[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    d = ImageDraw.Draw(img, 'RGBA')
    grout = (96, 70, 46)
    # slab joints with a carved look: dark joint, light top-left lip
    for k in range(21):
        x = -8 + k * SL; px, _ = S.px(x, 0)
        d.line([(px, 0), (px, H)], fill=grout, width=4); d.line([(px + 3, 0), (px + 3, H)], fill=(214, 182, 136, 90), width=2)
        y = -8 + k * SL; _, py = S.px(0, y)
        d.line([(0, py), (W, py)], fill=grout, width=4); d.line([(0, py + 3), (W, py + 3)], fill=(214, 182, 136, 90), width=2)
    # sparse chips and a few hairline cracks
    rr = random.Random(3)
    for _ in range(2600):
        x, y = rr.uniform(-8, 8), rr.uniform(-8, 8); px, py = S.px(x, y); r = rr.uniform(1.2, 3.2)
        d.ellipse([px - r, py - r, px + r, py + r], fill=(110, 82, 56, rr.randint(90, 170)))
    for _ in range(14):
        x, y = rr.uniform(-7.5, 7.5), rr.uniform(-7.5, 7.5); px, py = S.px(x, y)
        pts = [(px, py)]; ang = rr.uniform(0, 2 * math.pi)
        for s in range(rr.randint(2, 4)):
            ang += rr.uniform(-0.6, 0.6); px += 22 * math.cos(ang); py += 22 * math.sin(ang); pts.append((px, py))
        d.line(pts, fill=(110, 82, 56, 120), width=2)
    # a soft polished sheen toward each slab's centre and a darker worn rim
    # cabochon inlays at the slab corners: a dark red-brown stone diamond with a gold rim and a gold stud
    for i in range(21):
        for j in range(21):
            x, y = -8 + i * SL, -8 + j * SL
            px, py = S.px(x, y); r = S.m(0.1)
            d.polygon([(px, py - r - 4), (px + r + 4, py), (px, py + r + 4), (px - r - 4, py)], fill=GOLD_D)
            d.polygon([(px, py - r), (px + r, py), (px, py + r), (px - r, py)], fill=(104, 48, 34))
            r2 = S.m(0.022); d.ellipse([px - r2, py - r2, px + r2, py + r2], fill=GOLD, outline=(110, 70, 24), width=2)
    # dark column-line strips (under the column rows x = +-3) with a gold key inlay down the middle
    strip = (112, 58, 40)
    for cx in (-3.0, 3.0):
        b = S.box(cx - 0.3, -8, cx + 0.3, 6.1); rect(d, b, fill=strip)
        for e in (cx - 0.3, cx + 0.3):
            b2 = S.box(e - 0.02, -8, e + 0.02, 6.1); rect(d, b2, fill=GOLD_D)
        # the key inlay: rotate a horizontal band by drawing it vertical (draw on a temp image)
        bw, bh = int(S.m(10.0)), int(S.m(0.28))
        tmp = Image.new('RGB', (bw, bh), strip); td = ImageDraw.Draw(tmp)
        key_band(td, 0, 0, bw - 1, bh - 1, GOLD, None)
        tmp = tmp.rotate(90, expand=True)
        for y0 in (-8.0, 2.0):
            ph = min(bw, int(S.m(min(10.0, 6.1 - y0))))
            crop = tmp.crop((0, tmp.height - ph, tmp.width, tmp.height))
            x0p, y0p = S.px(cx - 0.14, y0 + ph / S.ppm)
            img.paste(crop, (int(x0p), int(y0p)))
    # perimeter band along the walls: dark red stone, gold edge
    for b in (S.box(-6.4, -8, -5.9, 6.1), S.box(5.9, -8, 6.4, 6.1), S.box(-6.4, 5.6, 6.4, 6.1)):
        rect(d, b, fill=(104, 44, 32))
    for b in (S.box(-5.92, -8, -5.88, 5.62), S.box(5.88, -8, 5.92, 5.62), S.box(-5.92, 5.58, 5.92, 5.62)):
        rect(d, b, fill=GOLD_D)
    # cross strips at the column rows in the side aisles
    for cy in (-3.5, -0.5, 2.5):
        for x0, x1 in ((-5.9, -3.3), (3.3, 5.9)):
            rect(d, S.box(x0, cy - 0.2, x1, cy + 0.2), fill=strip)
            rect(d, S.box(x0, cy - 0.015, x1, cy + 0.015), fill=GOLD_D)
    img.save(out('hall_floor.png'), optimize=True)
    print('floor', img.size)


# ====================================================================== carpet (x -2..2, y -8..3.6)
TRIGRAMS = [(1, 1, 1), (0, 1, 1), (1, 0, 1), (0, 0, 1), (1, 1, 0), (0, 1, 0), (1, 0, 0), (0, 0, 0)]
JAR = (0.0, 0.6)


def make_carpet():
    S = Surf(-2.0, 2.0, -8.0, 3.6, 240)
    img = Image.new('RGB', (S.W, S.H), (164, 36, 28))
    img = mottle(img, 0.10, 18, 11, 0.06, 120)
    d = ImageDraw.Draw(img, 'RGBA')
    HW = 1.3
    # field pattern: a thin gold trellis (diamonds), a darker cloud motif in every diamond, a small gold rosette at
    # every crossing
    s = 0.42
    for a in range(-40, 41):
        for sign in (1, -1):
            # lines x - y = a s (sign 1) and x + y = a s (sign -1), clipped to the image
            p0 = S.px(-2.0, sign * (-2.0 - a * s)) if sign == 1 else S.px(-2.0, a * s + 2.0)
            p1 = S.px(2.0, sign * (2.0 - a * s)) if sign == 1 else S.px(2.0, a * s - 2.0)
            d.line([p0, p1], fill=(214, 156, 52, 150), width=3)
    for a in range(-30, 31):
        for b in range(-30, 31):
            x, y = (a + b) * s / 2, (b - a) * s / 2
            if not (-2.0 < x < 2.0 and -8.0 < y < 3.6): continue
            px, py = S.px(x, y)
            rosette(d, px, py, S.m(0.035), 4, (GOLD, (196, 70, 40), GOLD_L), (120, 70, 24), 1)
            cx, cy = S.px(x + s / 2, y)
            cloud(d, cx, cy, S.m(0.065), (128, 26, 22), (108, 20, 16), 2)
    # borders (navy with a gold key band and gold lines)
    for s in (-1, 1):
        xo, xi = s * HW, s * (HW - 0.24)
        b = S.box(min(xo, xi), -8, max(xo, xi), 3.6); rect(d, b, fill=NAVY)
        rect(d, S.box(min(xo, xo - s * 0.025), -8, max(xo, xo - s * 0.025), 3.6), fill=GOLD)
        rect(d, S.box(min(xi, xi + s * 0.02), -8, max(xi, xi + s * 0.02), 3.6), fill=GOLD)
        bw, bh = int(S.m(11.6)), int(S.m(0.13))
        tmp = Image.new('RGB', (bw, bh), NAVY); key_band(ImageDraw.Draw(tmp), 0, 0, bw - 1, bh - 1, GOLD_L)
        tmp = tmp.rotate(90 * s, expand=True)
        x0p, y0p = S.px(s * (HW - 0.12) - 0.065, 3.6)
        img.paste(tmp, (int(x0p), int(y0p)))
    # the far end in front of the dais: a navy band across
    rect(d, S.box(-HW, 3.35, HW, 3.6), fill=NAVY); rect(d, S.box(-HW, 3.33, HW, 3.36), fill=GOLD)
    # roundels down the middle (navy disc, gold ring, lotus) clear of the jar medallion
    for y in (-7.0, -5.2, -3.4, 3.0):
        px, py = S.px(0, y); R = S.m(0.5)
        d.ellipse([px - R, py - R, px + R, py + R], fill=GOLD); R2 = S.m(0.46)
        d.ellipse([px - R2, py - R2, px + R2, py + R2], fill=NAVY)
        rosette(d, px, py, S.m(0.4), 8, (GOLD, (196, 60, 44), GOLD_L), INK, 3)
        for k in range(8):
            a = 2 * math.pi * k / 8 + math.pi / 8
            cloud(d, px + S.m(0.62) * math.cos(a) * 1.0, py + S.m(0.62) * math.sin(a) * 1.0, S.m(0.08), GOLD, GOLD_D, 2) if abs(math.cos(a)) < 0.9 else None
    # the medallion round the jar: gold ring, navy band with the eight trigrams, gold ring, red cloud band
    cx, cy = S.px(*JAR)
    for r, colr in ((2.0, GOLD), (1.965, NAVY), (1.62, GOLD), (1.585, (164, 36, 28)), (1.2, (120, 30, 22))):
        R = S.m(r); d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=colr)
    for k in range(8):
        a = math.radians(90 + 45 * k)        # one trigram straight toward the camera side (-Y = image down)
        rr = S.m(1.79)
        trigram(d, cx + rr * math.cos(a), cy + rr * math.sin(a), a, TRIGRAMS[k], S.m(0.34), S.m(0.055), GOLD_L, GOLD_D)
        a2 = a + math.radians(22.5)
        px, py = cx + S.m(1.79) * math.cos(a2), cy + S.m(1.79) * math.sin(a2); R = S.m(0.045)
        d.ellipse([px - R, py - R, px + R, py + R], fill=(196, 60, 44), outline=GOLD, width=3)
    for k in range(16):
        a = math.radians(11.25 + 22.5 * k); rr = S.m(1.39)
        cloud(d, cx + rr * math.cos(a), cy + rr * math.sin(a), S.m(0.075), GOLD, GOLD_D, 2)
    img.save(out('hall_carpet.png'), optimize=True)
    print('carpet', img.size)


def make_runner():
    """The stair runner up the dais (1.4 m wide, a 1.4 m repeat along the run): the carpet's red trellis field and
    navy key borders."""
    S = Surf(-0.7, 0.7, 0.0, 1.4, 300)
    img = Image.new('RGB', (S.W, S.H), (164, 36, 28)); img = mottle(img, 0.08, 6, 13)
    d = ImageDraw.Draw(img, 'RGBA')
    s = 0.35
    for a in range(-12, 13):
        d.line([S.px(-0.7, -0.7 - a * s), S.px(0.7, 0.7 - a * s)], fill=(214, 156, 52, 150), width=3)
        d.line([S.px(-0.7, a * s + 0.7), S.px(0.7, a * s - 0.7)], fill=(214, 156, 52, 150), width=3)
    for a in range(-8, 9):
        for b in range(-8, 9):
            x, y = (a + b) * s / 2, (b - a) * s / 2
            if -0.75 < x < 0.75 and -0.05 < y < 1.45:
                px, py = S.px(x, y); rosette(d, px, py, S.m(0.03), 4, (GOLD, (196, 70, 40), GOLD_L), (120, 70, 24), 1)
                cx, cy = S.px(x + s / 2, y); cloud(d, cx, cy, S.m(0.055), (128, 26, 22), (108, 20, 16), 2)
    for sx in (-1, 1):
        xo, xi = sx * 0.7, sx * 0.53
        rect(d, S.box(min(xo, xi), 0, max(xo, xi), 1.4), fill=NAVY)
        rect(d, S.box(min(xo, xo - sx * 0.02), 0, max(xo, xo - sx * 0.02), 1.4), fill=GOLD)
        rect(d, S.box(min(xi, xi + sx * 0.015), 0, max(xi, xi + sx * 0.015), 1.4), fill=GOLD)
        bw, bh = int(S.m(1.4)), int(S.m(0.1))
        tmp = Image.new('RGB', (bw, bh), NAVY); key_band(ImageDraw.Draw(tmp), 0, 0, bw - 1, bh - 1, GOLD_L)
        tmp = tmp.rotate(90 * sx, expand=True)
        x0p, y0p = S.px(sx * 0.615 - 0.05, 1.4)
        img.paste(tmp, (int(x0p), int(y0p)))
    img.save(out('hall_runner.png'))


def make_jarbase():
    """The stone base under the jar: pale warm marble, its top (world-mapped, centre (0, 0.6), 2.6 m) carved with a
    ring of sea-wave scallops and a groove; its side plates a band of carved waves between two grooves."""
    S = Surf(-1.3, 1.3, -0.7, 1.9, 400)
    img = Image.new('RGB', (S.W, S.H), (214, 208, 192)); img = mottle(img, 0.08, 10, 21, 0.05, 60)
    d = ImageDraw.Draw(img, 'RGBA')
    cx, cy = S.px(0.0, 0.6)
    groove, carve = (118, 112, 100), (150, 146, 134)
    for r, w in ((1.185, 6), (1.06, 4)):
        R = S.m(r); d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=groove, width=w)
    n = 48
    for k in range(n):          # wave scallops between r 1.07 and 1.17
        a = 2 * math.pi * k / n
        for rr, ww in ((0.1, 5), (0.065, 4), (0.03, 3)):
            px, py = cx + S.m(1.12) * math.cos(a), cy + S.m(1.12) * math.sin(a); R = S.m(rr)
            d.arc([px - R, py - R, px + R, py + R], math.degrees(a) - 90 - 70, math.degrees(a) - 90 + 70 + 180, fill=carve, width=ww)
    # sparse veins
    rr_ = random.Random(5)
    for _ in range(12):
        x, y = rr_.uniform(-1.2, 1.2), rr_.uniform(-0.6, 1.8); px, py = S.px(x, y); pts = [(px, py)]; ang = rr_.uniform(0, 6.3)
        for s in range(5): ang += rr_.uniform(-0.5, 0.5); px += 30 * math.cos(ang); py += 30 * math.sin(ang); pts.append((px, py))
        d.line(pts, fill=(176, 168, 150, 160), width=2)
    img.save(out('hall_jarbase_top.png'))
    W, H = 1024, 128; img = Image.new('RGB', (W, H), (206, 200, 184)); img = mottle(img, 0.06, 8, 22)
    d = ImageDraw.Draw(img, 'RGBA')
    d.rectangle([0, 6, W, 14], fill=groove); d.rectangle([0, H - 14, W, H - 6], fill=groove)
    for k in range(17):
        x = k * W / 16
        for rr, ww in ((44, 7), (30, 6), (16, 5)):
            d.arc([x - rr, H - 18 - rr, x + rr, H - 18 + rr], 180, 360, fill=(60, 110, 120), width=ww)
        d.ellipse([x + W / 32 - 8, 30, x + W / 32 + 8, 46], fill=(60, 110, 120))
    img.save(out('hall_jarbase_side.png'))


# ====================================================================== walls
def wall_painting(S, bays, seed, upper_from=5.4):
    """Lacquer wall: dark wainscot with gold-framed panels + roundels, red lacquer bays with gold double frames and
    corner keys, a painted band (teal/blue with gold-ringed spiral flowers) above the frieze."""
    img = Image.new('RGB', (S.W, S.H), (146, 42, 30))
    a = np.asarray(img, np.float32).copy()
    # vertical brushed lacquer streaks + soft mottling
    st = noise(S.W, 8, int(S.W / 3), seed)[0]
    a *= (1 + 0.05 * (st[None, :] - 0.5))[..., None]
    a *= (1 + 0.10 * (noise(S.W, S.H, 24, seed + 1) - 0.5))[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype('uint8')); d = ImageDraw.Draw(img, 'RGBA')
    # wainscot
    rect(d, S.box(S.u0, 0.0, S.u1, 0.95), fill=(86, 28, 20))
    rect(d, S.box(S.u0, 0.0, S.u1, 0.12), fill=(46, 22, 18))
    pw = 0.9
    u = S.u0 + 0.05
    while u + pw <= S.u1 + 0.01:
        b = S.box(u + 0.06, 0.2, u + pw - 0.06, 0.86)
        rect(d, b, fill=(104, 34, 24), outline=GOLD_D, width=3)
        b2 = (b[0] + 8, b[1] + 8, b[2] - 8, b[3] - 8); rect(d, b2, outline=GOLD, width=2)
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2; R = S.m(0.17)
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=GOLD_D); R2 = S.m(0.15)
        d.ellipse([cx - R2, cy - R2, cx + R2, cy + R2], fill=(120, 38, 26))
        rosette(d, cx, cy, S.m(0.13), 4, (GOLD, (176, 58, 38), GOLD_L), GOLD_D, 2, rot=math.pi / 4)
        u += pw
    rect(d, S.box(S.u0, 0.93, S.u1, 0.97), fill=GOLD)
    # bays: gold double frame + corner keys + a fine diaper of small gold lozenges
    for (ua, ub, va, vb) in bays:
        b = S.box(ua, va, ub, vb)
        rect(d, b, outline=GOLD, width=5)
        b2 = (b[0] + 14, b[1] + 14, b[2] - 14, b[3] - 14); rect(d, b2, outline=GOLD_D, width=3)
        corner_keys(d, (b2[0] + 12, b2[1] + 12, b2[2] - 12, b2[3] - 12), GOLD, S.m(0.22), 4)
        y = b2[1] + S.m(0.35)
        j = 0
        while y < b2[3] - S.m(0.3):
            x = b2[0] + S.m(0.35) + (S.m(0.25) if j % 2 else 0)
            while x < b2[2] - S.m(0.3):
                r = S.m(0.035)
                d.polygon([(x, y - r), (x + r, y), (x, y + r), (x - r, y)], fill=(176, 70, 42, 150))
                x += S.m(0.5)
            y += S.m(0.5); j += 1
    # upper painted band
    rect(d, S.box(S.u0, upper_from, S.u1, 7.0), fill=(120, 30, 22))
    b = S.box(S.u0, upper_from + 0.12, S.u1, upper_from + 0.92); rect(d, b, fill=TEAL)
    rect(d, S.box(S.u0, upper_from + 0.08, S.u1, upper_from + 0.12), fill=GOLD)
    rect(d, S.box(S.u0, upper_from + 0.92, S.u1, upper_from + 0.96), fill=GOLD)
    u = S.u0 + 0.4; k = 0
    while u < S.u1:
        cx, cy = S.px(u, upper_from + 0.52); R = S.m(0.34)
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=GOLD_D); R2 = S.m(0.31)
        d.ellipse([cx - R2, cy - R2, cx + R2, cy + R2], fill=BLUE if k % 2 else GREEN)
        rosette(d, cx, cy, S.m(0.27), 8, ((238, 236, 222), (90, 150, 196) if k % 2 else (110, 186, 140), GOLD_L), INK, 2)
        # chevrons between the flowers
        mx, _ = S.px(u + 0.4, 0)
        top, bot = b[1] + 6, b[3] - 6
        d.polygon([(mx - S.m(0.06), top), (mx + S.m(0.06), (top + bot) / 2), (mx - S.m(0.06), bot), (mx - S.m(0.1), bot),
                   (mx + S.m(0.02), (top + bot) / 2), (mx - S.m(0.1), top)], fill=GOLD)
        u += 0.8; k += 1
    # a row of small gold cloud motifs above the band
    u = S.u0 + 0.2
    while u < S.u1:
        cx, cy = S.px(u, upper_from + 1.3); cloud(d, cx, cy, S.m(0.09), GOLD, GOLD_D, 2); u += 0.6
    return img


def make_walls():
    S = Surf(-6.4, 6.4, 0.0, 7.0, 160)
    bays = [(-6.3, -2.85, 1.1, 4.95), (2.85, 6.3, 1.1, 4.95)]
    img = wall_painting(S, bays, 21)
    img.save(out('hall_wall_back.png'), optimize=True)
    S2 = Surf(-8.0, 6.1, 0.0, 7.0, 160)
    bays = [(c - 0.47, c + 0.47, 1.25, 4.3) for c in (-4.0, -1.0, 2.0, 5.0)] + [(c - 0.82, c + 0.82, 4.5, 5.05) for c in (-2.5, 0.5, 3.5)]
    img = wall_painting(S2, bays, 31)
    img.save(out('hall_wall_side.png'), optimize=True)
    print('walls')


# ====================================================================== repeating tiles
def make_tiles():
    # ceiling coffer (1 m): red frame, green field, blue ring, gold lotus, cloud corners
    N = 512; img = Image.new('RGB', (N, N), (124, 30, 22)); d = ImageDraw.Draw(img, 'RGBA')
    rect(d, (30, 30, N - 30, N - 30), fill=(40, 120, 96)); rect(d, (30, 30, N - 30, N - 30), outline=GOLD, width=6)
    rect(d, (52, 52, N - 52, N - 52), outline=GOLD_D, width=3)
    c = N / 2
    d.ellipse([c - 170, c - 170, c + 170, c + 170], fill=GOLD_D); d.ellipse([c - 160, c - 160, c + 160, c + 160], fill=BLUE)
    d.ellipse([c - 150, c - 150, c + 150, c + 150], outline=GOLD_L, width=4)
    rosette(d, c, c, 135, 8, (GOLD, (196, 60, 44), GOLD_L), INK, 3)
    for x, y in ((90, 90), (N - 90, 90), (90, N - 90), (N - 90, N - 90)):
        cloud(d, x, y, 26, GOLD, INK, 3)
    img = mottle(img, 0.06, 6, 3)
    img.save(out('hall_coffer.png'))
    # painted beam strip (4 m x 0.5 m): blue / green bands, gold chevrons, end spiral flowers, a red cartouche
    W, H = 2048, 256; img = Image.new('RGB', (W, H), BLUE); d = ImageDraw.Draw(img, 'RGBA')
    seg = W / 4
    for k in range(4):
        x0 = k * seg
        rect(d, (x0, 0, x0 + seg, H), fill=GREEN if k % 2 else BLUE)
    rect(d, (0, 0, W, 18), fill=GOLD); rect(d, (0, H - 18, W, H), fill=GOLD)
    rect(d, (0, 18, W, 26), fill=INK); rect(d, (0, H - 26, W, H - 18), fill=INK)
    # centre cartouche (red with a gold cloud) and spiral flowers + chevrons at both ends of the 4 m repeat
    cx = W / 2
    d.rounded_rectangle([cx - 360, 40, cx + 360, H - 40], radius=60, fill=GOLD, outline=INK, width=4)
    d.rounded_rectangle([cx - 340, 54, cx + 340, H - 54], radius=50, fill=(176, 40, 30), outline=INK, width=3)
    for dx in (-200, 0, 200): cloud(d, cx + dx, H / 2, 40, GOLD, INK, 3)
    for ex in (0, W):
        for k in range(3):
            x = ex + (1 if ex == 0 else -1) * (110 + k * 150)
            d.ellipse([x - 62, H / 2 - 62, x + 62, H / 2 + 62], fill=GOLD, outline=INK, width=4)
            rosette(d, x, H / 2, 54, 8, ((238, 236, 222), (90, 150, 196), GOLD_L), INK, 2)
        for k in range(3):
            x = ex + (1 if ex == 0 else -1) * (560 + k * 40)
            s = 1 if ex == 0 else -1
            d.polygon([(x, 30), (x + s * 34, H / 2), (x, H - 30), (x + s * 16, H - 30), (x + s * 50, H / 2), (x + s * 16, 30)], fill=GOLD, outline=INK)
    img.save(out('hall_beam.png'))
    # yellow silk brocade (seamless 512, 0.5 m): small round cloud medallions in a darker gold on imperial yellow
    N = 512; img = Image.new('RGB', (N, N), (222, 168, 40)); d = ImageDraw.Draw(img, 'RGBA')
    for (x, y) in ((128, 128), (384, 384), (384, 128 - 256), (128, 384), (384, 128)):
        pass
    for j in range(3):
        for i in range(3):
            for (ox, oy) in ((0, 0), (256, 256)):
                x, y = i * 256 + ox - 256, j * 256 + oy - 256
                d.ellipse([x + 128 - 70, y + 128 - 70, x + 128 + 70, y + 128 + 70], outline=(176, 118, 22), width=8)
                cloud(d, x + 128, y + 128, 34, (196, 136, 26), (176, 118, 22), 3)
    img = mottle(img, 0.05, 4, 5)
    img.save(out('hall_brocade.png'))
    # red silk brocade for banners / cushions
    img = Image.new('RGB', (N, N), (168, 32, 30)); d = ImageDraw.Draw(img, 'RGBA')
    for j in range(5):
        for i in range(5):
            x, y = i * 128 + (64 if j % 2 else 0) - 64, j * 128 - 64
            rosette(d, x + 64, y + 64, 26, 4, ((196, 60, 44), (210, 80, 50), (232, 120, 70)), (132, 22, 22), 2)
    img.save(out('hall_brocade_red.png'))
    # porcelain wraps (u = around, v = height; 1024 x 1024)
    porcelain('hall_porcelain_bw', (240, 242, 236), (36, 70, 150), (24, 46, 108))
    porcelain('hall_porcelain_rose', (236, 196, 72), (214, 88, 118), (60, 130, 90))
    porcelain('hall_porcelain_teal', (64, 150, 150), (236, 226, 196), (30, 80, 90))
    print('tiles')


def porcelain(name, ground, paint, deep):
    N = 1024; img = Image.new('RGB', (N, N), ground); d = ImageDraw.Draw(img, 'RGBA')
    # bands from the top (neck) down: wave band, ruyi collar, big lotus scroll body, lotus-petal foot band
    def band(y0, y1, w=6):
        d.line([(0, y0), (N, y0)], fill=deep, width=w); d.line([(0, y1), (N, y1)], fill=deep, width=w)
    band(40, 150)
    for k in range(12):          # waves
        x = k * N / 12
        d.arc([x, 60, x + N / 12, 150], 180, 360, fill=paint, width=8); d.arc([x + 20, 90, x + N / 12 - 20, 150], 180, 360, fill=paint, width=6)
    band(170, 300)
    for k in range(8):           # cloud collar points
        x = k * N / 8 + N / 16
        d.polygon([(x - 60, 176), (x + 60, 176), (x + 30, 230), (x, 292), (x - 30, 230)], fill=paint, outline=deep)
        d.ellipse([x - 14, 200, x + 14, 228], fill=ground)
    band(320, 820)
    for k in range(4):           # lotus scroll: big flowers on a winding stem
        x = k * N / 4 + N / 8
        y = 570 + (60 if k % 2 else -60)
        d.arc([x - 180, 430, x + 80, 710], 0, 180 if k % 2 else -180, fill=deep, width=8)
        for a in range(0, 360, 60):
            lx, ly = x + 110 * math.cos(math.radians(a)), y + 90 * math.sin(math.radians(a))
            d.ellipse([lx - 30, ly - 14, lx + 30, ly + 14], fill=deep)
        rosette(d, x, y, 78, 8, (paint, ground, paint), deep, 3)
    band(840, 990)
    for k in range(16):          # foot petals
        x = k * N / 16 + N / 32
        d.polygon([(x - 26, 985), (x, 852), (x + 26, 985)], fill=paint, outline=deep)
    img.save(out(name + '.png'))


# ====================================================================== prints
def glyph_column(text, W, H, fnt_path, px, col, stroke=0, stroke_col=None, gap=1.0):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = font(fnt_path, px)
    n = len(text); step = px * gap
    y0 = H / 2 - step * (n - 1) / 2
    for i, ch in enumerate(text):
        d.text((W / 2, y0 + i * step), ch, font=f, fill=col, anchor='mm', stroke_width=stroke, stroke_fill=stroke_col or col)
    return im


def plaque(text, name, ground=NAVY):
    """A gilded plaque: four big gold characters on a coloured ground in a carved cloud frame (1600 x 520)."""
    W, H = 1600, 520; img = Image.new('RGB', (W, H), GOLD); d = ImageDraw.Draw(img, 'RGBA')
    rect(d, (0, 0, W - 1, H - 1), outline=INK, width=8)
    for k in range(14):
        x = 60 + k * (W - 120) / 13
        cloud(d, x, 34, 22, GOLD_L, GOLD_D, 3); cloud(d, x, H - 34, 22, GOLD_L, GOLD_D, 3)
    for k in range(4):
        y = 90 + k * (H - 180) / 3
        cloud(d, 34, y, 20, GOLD_L, GOLD_D, 3); cloud(d, W - 34, y, 20, GOLD_L, GOLD_D, 3)
    rect(d, (70, 70, W - 70, H - 70), fill=INK); rect(d, (80, 80, W - 80, H - 80), fill=ground)
    rect(d, (96, 96, W - 96, H - 96), outline=GOLD_D, width=4)
    f = font(SONG, 300)
    for i, ch in enumerate(text):
        x = 280 + i * 347
        d.text((x + 6, H / 2 + 8), ch, font=f, fill=GOLD_D, anchor='mm', stroke_width=10, stroke_fill=GOLD_D)
        d.text((x, H / 2), ch, font=f, fill=GOLD_L, anchor='mm', stroke_width=9, stroke_fill=GOLD)
    img.save(out(name + '.png'))


def couplet(nm, txt, ground=(34, 28, 26)):
    W, H = 300, 1800; img = Image.new('RGB', (W, H), ground); d = ImageDraw.Draw(img, 'RGBA')
    rect(d, (0, 0, W - 1, H - 1), outline=GOLD, width=14); rect(d, (26, 26, W - 27, H - 27), outline=GOLD_D, width=4)
    cloud(d, W / 2, 90, 44, GOLD, GOLD_D, 4); cloud(d, W / 2, H - 90, 44, GOLD, GOLD_D, 4)
    g = glyph_column(txt, W, H - 300, SONG, 230, GOLD_L, stroke=8, stroke_col=GOLD)
    img.paste(g, (0, 150), g)
    img = mottle(img, 0.06, 6, sum(map(ord, nm)) % 100)
    img.save(out(f'hall_couplet_{nm}.png'))


def make_prints():
    # the plaque over the screen: 天下太平 in gold on navy, a gilded carved frame (1600 x 520)
    W, H = 1600, 520; img = Image.new('RGB', (W, H), GOLD); d = ImageDraw.Draw(img, 'RGBA')
    rect(d, (0, 0, W - 1, H - 1), outline=INK, width=8)
    for k in range(14):     # carved cloud scrolls round the frame
        x = 60 + k * (W - 120) / 13
        cloud(d, x, 34, 22, GOLD_L, GOLD_D, 3); cloud(d, x, H - 34, 22, GOLD_L, GOLD_D, 3)
    for k in range(4):
        y = 90 + k * (H - 180) / 3
        cloud(d, 34, y, 20, GOLD_L, GOLD_D, 3); cloud(d, W - 34, y, 20, GOLD_L, GOLD_D, 3)
    rect(d, (70, 70, W - 70, H - 70), fill=INK)
    rect(d, (80, 80, W - 80, H - 80), fill=NAVY)
    rect(d, (96, 96, W - 96, H - 96), outline=GOLD_D, width=4)
    f = font(SONG, 300)
    for i, ch in enumerate('天下太平'):
        x = 280 + i * 347
        d.text((x + 6, H / 2 + 8), ch, font=f, fill=GOLD_D, anchor='mm', stroke_width=10, stroke_fill=GOLD_D)
        d.text((x, H / 2), ch, font=f, fill=GOLD_L, anchor='mm', stroke_width=9, stroke_fill=GOLD)
    img.save(out('hall_plaque.png'))
    # couplet boards (gold on black lacquer, cloud caps), 300 x 1800
    # (the pair nearest the throne on deep teal: a cool accent in the red-and-gold end of the hall)
    for nm, txt in (('c0', '風調雨順'), ('c1', '國泰民安'), ('c2', '山河永固'), ('c3', '日月同輝'), ('c4', '福壽康寧'), ('c5', '吉祥如意')):
        couplet(nm, txt, ground=(26, 64, 70) if nm in ('c0', 'c1') else (34, 28, 26))
    # calligraphy scrolls: one big character each (地 / 動 / 靜), cream paper with gold flecks, blue brocade mount,
    # a red seal (580 x 1700)
    for nm, ch, seal in (('s0', '地', 'ab'), ('s1', '動', 'ba'), ('s2', '靜', 'aa')):
        W, H = 580, 1700; img = Image.new('RGB', (W, H), (36, 52, 92)); d = ImageDraw.Draw(img, 'RGBA')
        rr = random.Random(hash(nm) % 1000)
        for _ in range(500):      # brocade mount: small paler roundels
            x, y = rr.uniform(0, W), rr.uniform(0, H); r = rr.uniform(4, 9)
            d.ellipse([x - r, y - r, x + r, y + r], outline=(66, 86, 132), width=2)
        rect(d, (0, 0, W, 210), fill=(28, 40, 72)); rect(d, (0, H - 160, W, H), fill=(28, 40, 72))
        rect(d, (0, 205, W, 212), fill=GOLD_D); rect(d, (0, H - 166, W, H - 159), fill=GOLD_D)
        pb = (64, 270, W - 64, H - 230)
        rect(d, pb, fill=(240, 228, 196)); rect(d, pb, outline=GOLD_D, width=5)
        for _ in range(260):
            x, y = rr.uniform(pb[0], pb[2]), rr.uniform(pb[1], pb[3]); r = rr.uniform(1.5, 4)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(206, 168, 80, 200))
        # a vertical "tian" strip pair at the top (the classic two hanging bands)
        for x in (W * 0.36, W * 0.64): rect(d, (x - 12, 0, x + 12, 205), fill=(196, 160, 90))
        g = Image.new('RGBA', (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(g)
        f = font(SONG, 400)
        gd.text((W / 2, (pb[1] + pb[3]) / 2 - 80), ch, font=f, fill=INK, anchor='mm', stroke_width=16, stroke_fill=INK)
        g = g.filter(ImageFilter.GaussianBlur(1.2))
        img.paste(g, (0, 0), g)
        f2 = font(SONG, 46)       # a smaller signature column
        for i, c2 in enumerate('乙丑年作'):
            d.text((pb[2] - 50, pb[3] - 330 + i * 52), c2, font=f2, fill=INK, anchor='mm', stroke_width=1, stroke_fill=INK)
        sx, sy = pb[2] - 50, pb[3] - 90
        rect(d, (sx - 34, sy - 34, sx + 34, sy + 34), fill=(196, 40, 32))
        for i in range(2):
            for j in range(2):
                bx, by = sx - 26 + i * 28, sy - 26 + j * 28
                if seal[(i + j) % 2] == 'a': rect(d, (bx + 4, by + 4, bx + 20, by + 8), fill=(250, 230, 220)); rect(d, (bx + 10, by + 4, bx + 14, by + 22), fill=(250, 230, 220))
                else: rect(d, (bx + 4, by + 4, bx + 8, by + 22), fill=(250, 230, 220)); rect(d, (bx + 4, by + 16, bx + 20, by + 20), fill=(250, 230, 220))
        img.save(out(f'hall_scroll_{nm}.png'))
    # banners: imperial yellow silk, red border, a big red character in a white roundel, tassel band (400 x 1600)
    for nm, ch, bg, fg in (('b0', '龍', (226, 172, 40), (178, 36, 30)), ('b1', '福', (178, 36, 30), (240, 200, 90))):
        W, H = 400, 1600; img = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(img, 'RGBA')
        edge = (178, 36, 30) if nm == 'b0' else (226, 172, 40)
        rect(d, (0, 0, W - 1, H - 1), outline=edge, width=34); rect(d, (40, 40, W - 41, H - 41), outline=GOLD_D, width=5)
        for k in range(9):
            cloud(d, W / 2, 230 + k * 150, 52, tuple(int(c * 0.86) for c in bg), tuple(int(c * 0.78) for c in bg), 3) if k not in (3, 4, 5) else None
        cy = 740; R = 150
        d.ellipse([W / 2 - R - 10, cy - R - 10, W / 2 + R + 10, cy + R + 10], fill=GOLD_D)
        d.ellipse([W / 2 - R, cy - R, W / 2 + R, cy + R], fill=CREAM)
        d.text((W / 2, cy), ch, font=font(SONG, 230), fill=fg, anchor='mm', stroke_width=8, stroke_fill=fg)
        # swallow-tail bottom edge is cut by the mesh; draw the fringe line
        rect(d, (0, H - 70, W, H - 40), fill=GOLD)
        img = mottle(img, 0.07, 5, 9)
        img.save(out(f'hall_banner_{nm}.png'))
    # crops of the Flow pictures without their photo surroundings
    sc = Image.open(os.path.join(DRESS, 'jar_screen.png')).convert('RGB')
    sc.crop((74, 78, 1302, 694)).save(out('hall_screen_crop.png'))
    sr = Image.open(os.path.join(DRESS, 'jar_scroll1.png')).convert('RGB')
    sr.crop((200, 138, 570, 1274)).save(out('hall_crane_crop.png'))
    print('prints')


# ====================================================================== windows: lattice infill + the view outside
def make_lattice(wm=1.8, hm=3.3, cols=5, rows=9, name='hall_lattice'):
    """'Step-brocade' lattice for the 1.8 x 3.3 m window openings (and, smaller, the door leaves): an outer frame, a
    grid of cells each holding a smaller centred frame tied to the cell edges by alternating short bars, gold dots at
    the knots. RGBA (alpha 0 = open)."""
    ppm = 300
    W, H = int(wm * ppm), int(hm * ppm)
    img = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    wood = (92, 28, 20, 255); hi = (150, 62, 40, 255)
    t = int(0.028 * ppm)
    def bar(x0, y0, x1, y1):
        d.rectangle([x0, y0, x1, y1], fill=wood)
        if x1 - x0 > y1 - y0: d.line([(x0, y0), (x1, y0)], fill=hi, width=2)
        else: d.line([(x0, y0), (x0, y1)], fill=hi, width=2)
    # outer frame
    B = int(0.05 * ppm)
    for b in ((0, 0, W, B), (0, H - B, W, H), (0, 0, B, H), (W - B, 0, W, H)): bar(*b)
    cw, ch = (W - 2 * B) / cols, (H - 2 * B) / rows
    for j in range(rows):
        for i in range(cols):
            x0, y0 = B + i * cw, B + j * ch; x1, y1 = x0 + cw, y0 + ch
            # cell edges
            bar(x0 - t / 2, y0 - t / 2, x1 + t / 2, y0 + t / 2); bar(x0 - t / 2, y0 - t / 2, x0 + t / 2, y1 + t / 2)
            # inner frame
            ix0, iy0, ix1, iy1 = x0 + cw * 0.27, y0 + ch * 0.27, x1 - cw * 0.27, y1 - ch * 0.27
            bar(ix0, iy0 - t / 2, ix1, iy0 + t / 2); bar(ix0, iy1 - t / 2, ix1, iy1 + t / 2)
            bar(ix0 - t / 2, iy0, ix0 + t / 2, iy1); bar(ix1 - t / 2, iy0, ix1 + t / 2, iy1)
            # ties: alternate horizontal / vertical pairs (the step pattern)
            if (i + j) % 2 == 0:
                cy = (iy0 + iy1) / 2
                bar(x0, cy - t / 2, ix0, cy + t / 2); bar(ix1, cy - t / 2, x1, cy + t / 2)
            else:
                cx = (ix0 + ix1) / 2
                bar(cx - t / 2, y0, cx + t / 2, iy0); bar(cx - t / 2, iy1, cx + t / 2, y1)
    bar(W - B - t / 2, B, W - B + t / 2, H - B); bar(B, H - B - t / 2, W - B, H - B + t / 2)
    for j in range(rows + 1):
        for i in range(cols + 1):
            x, y = B + i * cw, B + j * ch; r = t * 0.75
            d.ellipse([x - r, y - r, x + r, y + r], fill=(214, 166, 58, 255))
    img.save(out(name + '.png'))


def make_front():
    """The entrance wall: its painting (wainscot, red lacquer, painted band; no bay frames: the doors take the bays),
    the door-leaf lattice, the leaf panels (skirt + waist: gold-framed red panels with a roundel), couplets for the
    door piers, the plaque over the middle doors."""
    S = Surf(-6.4, 6.4, 0.0, 7.0, 160)
    wall_painting(S, [], 41).save(out('hall_wall_front.png'), optimize=True)
    make_lattice(0.68, 2.4, 2, 7, 'hall_lattice_door')
    for nm, (wm, hm) in (('skirt', (0.68, 0.7)), ('waist', (0.68, 0.5))):
        ppm = 400; W, H = int(wm * ppm), int(hm * ppm)
        img = Image.new('RGB', (W, H), (110, 28, 20)); img = mottle(img, 0.08, 4, 7); d = ImageDraw.Draw(img, 'RGBA')
        rect(d, (10, 10, W - 11, H - 11), outline=GOLD_D, width=6); rect(d, (26, 26, W - 27, H - 27), fill=(138, 36, 26), outline=GOLD, width=4)
        cx, cy = W / 2, H / 2; R = min(W, H) * 0.3
        d.ellipse([cx - R - 6, cy - R - 6, cx + R + 6, cy + R + 6], fill=GOLD_D)
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(120, 30, 22))
        rosette(d, cx, cy, R * 0.85, 8 if nm == 'skirt' else 4, (GOLD, (196, 60, 44), GOLD_L), INK, 2)
        corner_keys(d, (40, 40, W - 40, H - 40), GOLD, 26, 4)
        img.save(out(f'hall_door_{nm}.png'))
    plaque('萬壽無疆', 'hall_plaque_front', ground=(24, 70, 74))
    for nm, txt in (('c6', '春和景明'), ('c7', '物阜民豐')):
        couplet(nm, txt, ground=(26, 64, 70))
    print('front')


def make_outside():
    """The view through the side windows (x -8..6.1 as u, z -1..9 as v): a bright sky with cartoon clouds, a white
    marble terrace balustrade, a courtyard with pines and, beyond, golden roofs of more palace halls."""
    S = Surf(-8.0, 6.5, -1.0, 9.0, 200)
    img = Image.new('RGB', (S.W, S.H), (150, 200, 236)); d = ImageDraw.Draw(img, 'RGBA')
    for k in range(S.H):     # sky gradient: pale at the horizon
        v = k / S.H
        c = (int(118 + 100 * v), int(176 + 60 * v), int(232 + 14 * v))
        d.line([(0, k), (S.W, k)], fill=c)
    rr = random.Random(9)
    for _ in range(9):
        cx, cz = rr.uniform(-8, 6.5), rr.uniform(5.5, 8.5); px, py = S.px(cx, cz)
        for k in range(6):
            r = S.m(rr.uniform(0.35, 0.7)); ox = S.m(rr.uniform(-0.9, 0.9)); oy = S.m(rr.uniform(-0.15, 0.2))
            d.ellipse([px + ox - r, py + oy - r * 0.7, px + ox + r, py + oy + r * 0.7], fill=(250, 250, 246))
    # distant halls: red walls, golden roofs with upturned eaves, a ridge with end ornaments
    def hall(cx, base, w, h, roof):
        x0, x1 = cx - w / 2, cx + w / 2
        rect(d, S.box(x0, base, x1, base + h), fill=(176, 52, 40))
        for k in range(int(w / 0.5)):
            rect(d, S.box(x0 + 0.1 + k * 0.5, base + 0.15, x0 + 0.3 + k * 0.5, base + h - 0.2), fill=(120, 30, 24))
        ey = base + h; ov = 0.5
        p = [S.px(x0 - ov, ey + 0.15), S.px(x0 - ov - 0.2, ey + 0.4), S.px(x0 + w * 0.15, ey + roof), S.px(x1 - w * 0.15, ey + roof),
             S.px(x1 + ov + 0.2, ey + 0.4), S.px(x1 + ov, ey + 0.15)]
        d.polygon(p, fill=(226, 172, 44), outline=(150, 100, 24))
        for k in range(1, 12):
            a = S.px(x0 - ov + (w + 2 * ov) * k / 12, ey + 0.2); b = S.px(x0 + w * 0.15 + (w * 0.7) * k / 12, ey + roof)
            d.line([a, b], fill=(190, 136, 30), width=3)
        rect(d, S.box(x0 + w * 0.12, ey + roof - 0.05, x1 - w * 0.12, ey + roof + 0.12), fill=(200, 140, 30))
        for xx in (x0 + w * 0.12, x1 - w * 0.12):
            q = S.px(xx, ey + roof + 0.1); r = S.m(0.12); d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=(160, 100, 24))
    hall(-5.5, 2.0, 4.2, 1.6, 1.3); hall(-0.5, 2.3, 3.0, 1.2, 1.0); hall(3.8, 1.9, 4.6, 1.7, 1.4)
    # pines in the courtyard
    for x in (-7.2, -3.1, -1.6, 1.6, 2.4, 5.9):
        bx, by = S.px(x, 0.6)
        rect(d, (bx - 8, S.px(0, 2.4)[1], bx + 8, by), fill=(96, 60, 36))
        for k, (dz, r) in enumerate(((2.2, 0.75), (2.9, 0.62), (3.5, 0.45))):
            q = S.px(x, dz); R = S.m(r)
            d.ellipse([q[0] - R, q[1] - R * 0.55, q[0] + R, q[1] + R * 0.55], fill=(46, 110, 70) if k % 2 else (58, 128, 80), outline=(30, 74, 48), width=3)
    # the terrace: pale paving and a white marble balustrade with posts and round caps
    rect(d, S.box(S.u0, -1.0, S.u1, 0.9), fill=(216, 206, 186))
    rect(d, S.box(S.u0, 0.9, S.u1, 1.0), fill=(170, 160, 140))
    rect(d, S.box(S.u0, 1.0, S.u1, 1.12), fill=(242, 240, 232)); rect(d, S.box(S.u0, 1.7, S.u1, 1.82), fill=(242, 240, 232))
    u = S.u0 + 0.2
    while u < S.u1:
        rect(d, S.box(u - 0.07, 1.0, u + 0.07, 2.0), fill=(244, 242, 236), outline=(160, 154, 140), width=2)
        q = S.px(u, 2.05); r = S.m(0.09); d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=(244, 242, 236), outline=(160, 154, 140), width=2)
        for k in range(1, 4):
            x = u + 0.2 * k; rect(d, S.box(x - 0.035, 1.12, x + 0.035, 1.7), fill=(232, 228, 218))
        u += 0.8
    img.save(out('hall_outside.png'))


if __name__ == '__main__':
    if 'front' in WHAT: make_front()
    if 'windows' in WHAT or len(sys.argv) == 1:
        make_lattice(); make_outside(); print('windows')
    if 'floor' in WHAT: make_floor()
    if 'carpet' in WHAT: make_carpet(); make_runner(); make_jarbase()
    if 'walls' in WHAT: make_walls()
    if 'tiles' in WHAT: make_tiles()
    if 'prints' in WHAT: make_prints()
