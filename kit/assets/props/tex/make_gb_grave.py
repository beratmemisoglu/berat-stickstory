# Grave Bell props graphics (lab venv): .venv/Scripts/python.exe assets/props/tex/make_gb_grave.py <cmd> [args]
#   (owner: prop builder GRAVE; used by gb_bell_post, gb_coffin, gb_headstone, gb_grave_mound, gb_bill)
#   static                      -> gb_bell_post_wood_v/h, gb_bell_post_plaque (RING IF ALIVE), gb_coffin_wood, gb_coffin_cut,
#                                  gb_coffin_satin, gb_headstone_stone, gb_headstone_moss, gb_headstone_scroll, gb_bill_0..5
#   engrave <out.png> <l1|l2|..>  -> carved letters on transparent (alpha) 600x600, for headstone decals
#   painted <out.png> <l1|l2|..>  -> crude white-painted letters on transparent 600x300 (wooden cross marker)
# The gb_*.py props call these themselves (cached by content).
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')


def font(name, size):
    for n in (name, 'georgiab.ttf', 'arialbd.ttf'):
        p = os.path.join(FONTS, n)
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def noise(W, H, scale, seed, amp=1.0):
    """Soft value noise (L image 0..255) by upscaling random small images."""
    rnd = random.Random(seed)
    small = Image.new('L', (max(2, W // scale), max(2, H // scale)))
    small.putdata([rnd.randint(0, 255) for _ in range(small.size[0] * small.size[1])])
    return small.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))


def tint(base_rgb, n, k):
    """Multiply-ish mottling: base * (1 - k + 2k * n/255)."""
    W, H = n.size
    r, g, b = base_rgb
    im = Image.new('RGB', (W, H))
    px = []
    for v in n.getdata():
        f = 1 - k + 2 * k * v / 255
        px.append((min(255, int(r * f)), min(255, int(g * f)), min(255, int(b * f))))
    im.putdata(px)
    return im


def wood(path, base, dark, light, vertical=True, seed=1, W=512, H=512, paint=None, streaks=90, knots=2):
    rnd = random.Random(seed)
    im = tint(base, noise(W, H, 24, seed), 0.10)
    d = ImageDraw.Draw(im)
    # grain: long wavy lines along the board (drawn vertical, rotated at the end for horizontal)
    for i in range(streaks):
        x0 = rnd.uniform(0, W); ph = rnd.uniform(0, 6.3); amp = rnd.uniform(2, 9); fr = rnd.uniform(0.004, 0.012)
        c = dark if rnd.random() < 0.7 else light
        w = rnd.choice((1, 1, 2, 2, 3))
        pts = [(x0 + amp * math.sin(ph + y * fr) + 3 * math.sin(y * 0.05 + i), y) for y in range(-10, H + 10, 8)]
        d.line(pts, fill=c, width=w)
    # knots: dark ellipses with grain swirling around
    for k in range(knots):
        kx, ky = rnd.uniform(60, W - 60), rnd.uniform(60, H - 60)
        for r in range(22, 4, -3):
            d.ellipse([kx - r * 0.6, ky - r, kx + r * 0.6, ky + r], outline=dark, width=2)
        d.ellipse([kx - 5, ky - 8, kx + 5, ky + 8], fill=tuple(int(c * 0.6) for c in dark))
    # cracks / checks
    for k in range(5):
        x = rnd.uniform(0, W); y = rnd.uniform(0, H); L = rnd.uniform(40, 140)
        d.line([(x, y), (x + rnd.uniform(-3, 3), y + L)], fill=tuple(int(c * 0.55) for c in dark), width=2)
    if paint:   # worn paint remnants: ragged patches, mostly scraped off
        m = noise(W, H, 18, seed + 7)
        streak = noise(W // 8, H, 6, seed + 3).resize((W, H), Image.BICUBIC)     # paint survives in vertical streaks
        m = ImageChops.multiply(m, streak)
        m = m.point(lambda v: 255 if v > 150 else 0).filter(ImageFilter.GaussianBlur(1.0)).point(lambda v: 255 if v > 120 else 0)
        pim = tint(paint, noise(W, H, 10, seed + 9), 0.12)
        im.paste(pim, (0, 0), m)
        # chipped edges of the paint: a darker rim
        edge = m.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
        im.paste(tuple(int(c * 0.7) for c in paint), (0, 0), edge)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    if not vertical: im = im.rotate(90, expand=True)
    im.save(path)


def cut_wood(path):
    """Raw end grain / fresh saw cut: pale wood with rings."""
    W = H = 256
    im = tint((196, 150, 98), noise(W, H, 16, 3), 0.08); d = ImageDraw.Draw(im)
    for r in range(10, 400, 14):
        d.ellipse([W / 2 - r, -r * 0.4 - 80, W / 2 + r, r * 0.4 - 80 + 2 * r * 0.4], outline=(160, 112, 66), width=2)
    for i in range(400):
        x, y = random.uniform(0, W), random.uniform(0, H)
        d.line([(x, y), (x + random.uniform(4, 12), y)], fill=(150, 106, 62), width=1)
    im.save(path)


def satin(path):
    """Quilted cream satin, diamond tufts with buttons; tiles every 512 px (4 x 4 diamonds)."""
    W = H = 512; P = 128
    base = (212, 196, 160)
    im = Image.new('RGB', (W, H), base)
    sh = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(sh)
    # each diamond cell: centre bright, seams dark (draw a radial falloff per cell, tiled with wrap)
    cell = Image.new('L', (P, P), 0); cd = ImageDraw.Draw(cell)
    for r in range(P // 2, 0, -2):
        v = int(255 * (1 - (r / (P / 2)) ** 1.6))
        cd.polygon([(P / 2, P / 2 - r), (P / 2 + r, P / 2), (P / 2, P / 2 + r), (P / 2 - r, P / 2)], fill=v)
    for gx in range(-1, W // P + 1):
        for gy in range(-1, H // P + 1):
            for ox, oy in ((0, 0), (P // 2, P // 2)):
                sh.paste(cell, (gx * P + ox, gy * P + oy), cell)
    lit = (246, 234, 202); dk = (128, 104, 70)
    a = Image.new('RGB', (W, H), dk); b = Image.new('RGB', (W, H), lit)
    im = Image.composite(b, a, sh.filter(ImageFilter.GaussianBlur(3)))
    d = ImageDraw.Draw(im)
    # seams (diagonal lines through the buttons)
    for k in range(-W, 2 * W, P):
        d.line([(k, 0), (k + H, H)], fill=(160, 138, 100), width=3)
        d.line([(k, H), (k + H, 0)], fill=(160, 138, 100), width=3)
    # satin sheen strokes inside cells (diagonal soft lights)
    sheen = Image.new('L', (W, H), 0); s2 = ImageDraw.Draw(sheen)
    for gx in range(0, W, P // 2):
        for gy in range(0, H, P // 2):
            if (gx // (P // 2) + gy // (P // 2)) % 2: continue
            s2.line([(gx - 14, gy + P // 2 - 30), (gx + 14, gy + P // 2 - 50)], fill=120, width=6)
    im.paste((250, 242, 222), (0, 0), sheen.filter(ImageFilter.GaussianBlur(4)))
    # buttons at the seam crossings
    for gx in range(0, W + 1, P // 2):
        for gy in range(0, H + 1, P // 2):
            if (gx // (P // 2) + gy // (P // 2)) % 2: continue
            x, y = gx, gy + P // 2 if False else gy
            for xx in (x, x - W, x + W):
                d.ellipse([xx - 9, y - 9, xx + 9, y + 9], fill=(126, 104, 70))
                d.ellipse([xx - 7, y - 7, xx + 7, y + 7], fill=(196, 176, 136))
                d.ellipse([xx - 4, y - 5, xx + 1, y - 1], fill=(238, 228, 204))
    im.save(path)


def stone(path, seed=5):
    W = H = 512
    rnd = random.Random(seed)
    base = (98, 100, 120)
    im = tint(base, noise(W, H, 30, seed), 0.12)
    n2 = noise(W, H, 6, seed + 1)
    im = Image.blend(im, tint(base, n2, 0.16), 0.5)
    d = ImageDraw.Draw(im)
    # speckles
    for i in range(1600):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H); r = rnd.uniform(0.6, 2.0)
        c = (78, 80, 104) if rnd.random() < 0.6 else (150, 152, 172)
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
    # lichen dots (pale yellow-green)
    for i in range(14):
        cx, cy = rnd.uniform(0, W), rnd.uniform(0, H)
        for j in range(12):
            x, y = cx + rnd.gauss(0, 10), cy + rnd.gauss(0, 8); r = rnd.uniform(1.5, 4.5)
            d.ellipse([x - r, y - r, x + r, y + r], fill=(150, 162, 96) if rnd.random() < 0.6 else (118, 136, 74))
    # cracks: dark jagged polylines with a light lip below
    for k in range(4):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H); a = rnd.uniform(0, 6.3)
        pts = [(x, y)]
        for s in range(rnd.randint(5, 10)):
            a += rnd.uniform(-0.7, 0.7); x += 14 * math.cos(a); y += 14 * math.sin(a); pts.append((x, y))
        d.line([(p[0] + 1.5, p[1] + 1.5) for p in pts], fill=(160, 162, 182), width=2)
        d.line(pts, fill=(44, 44, 62), width=3)
    # chips: light faceted spots with a dark top edge
    for k in range(6):
        x, y = rnd.uniform(20, W - 20), rnd.uniform(20, H - 20); r = rnd.uniform(6, 14)
        pts = [(x + r * math.cos(t) * rnd.uniform(0.6, 1.1), y + r * math.sin(t) * rnd.uniform(0.6, 1.1)) for t in [i * 1.05 for i in range(6)]]
        d.polygon(pts, fill=(138, 140, 162)); d.line(pts[3:] + pts[:1], fill=(60, 60, 82), width=2)
    im.filter(ImageFilter.GaussianBlur(0.5)).save(path)


def moss(path, seed=11):
    """Moss patch on alpha: a band growing from the bottom with a ragged top + some islands."""
    W, H = 512, 256
    rnd = random.Random(seed)
    a = Image.new('L', (W, H), 0); ad = ImageDraw.Draw(a)
    for i in range(260):
        x = rnd.uniform(0, W); top = H * (0.35 + 0.45 * (0.5 + 0.5 * math.sin(x * 0.02 + 1.3)) * rnd.uniform(0.4, 1.0))
        y = rnd.uniform(top, H); r = rnd.uniform(6, 20)
        ad.ellipse([x - r, y - r, x + r, y + r], fill=255)
    for i in range(10):
        x, y = rnd.uniform(0, W), rnd.uniform(H * 0.1, H * 0.5); r = rnd.uniform(5, 12)
        ad.ellipse([x - r, y - r, x + r, y + r], fill=255)
    a = a.filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v > 120 else 0)
    im = tint((66, 104, 40), noise(W, H, 8, seed), 0.22)
    d = ImageDraw.Draw(im)
    for i in range(900):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H); r = rnd.uniform(1, 3)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(112, 150, 58) if rnd.random() < 0.5 else (40, 70, 30))
    # dark rim so the patch sits on the stone
    rim = a.filter(ImageFilter.FIND_EDGES).filter(ImageFilter.MaxFilter(3))
    im.paste((34, 52, 26), (0, 0), rim)
    im.putalpha(a)
    im.save(path)


def scroll(path):
    """Carved volute spiral (for the scroll-top headstone's roll ends), alpha."""
    S = 256
    a = Image.new('L', (S, S), 0); im = Image.new('RGB', (S, S), (56, 56, 78))
    d = ImageDraw.Draw(a); d2 = ImageDraw.Draw(im)
    pts = []
    for i in range(400):
        t = i / 400 * 3 * 2 * math.pi; r = 8 + t * 5.4
        pts.append((S / 2 + r * math.cos(t), S / 2 + r * math.sin(t)))
    d.line(pts, fill=255, width=14)
    d2.line([(p[0] + 3, p[1] + 3) for p in pts], fill=(150, 152, 176), width=6)
    d2.line(pts, fill=(48, 48, 70), width=8)
    im.putalpha(a)
    im.save(path)


def plaque(path):
    """Weathered board with hand-painted RING IF / ALIVE (two lines, off-white paint, a few drips)."""
    W, H = 640, 400
    tmp = os.path.join(HERE, f'_gb_grave_tmp_wood_{os.getpid()}.png')     # per process: two props may run static at once
    wood(tmp, (96, 70, 50), (62, 44, 30), (128, 98, 70), vertical=False, seed=21, W=H, H=W, streaks=60)
    im = Image.open(tmp).convert('RGB').resize((W, H)); os.remove(tmp)
    d = ImageDraw.Draw(im)
    paint = (232, 222, 196)
    rnd = random.Random(4)
    for line, y, sz in (('RING IF', 40, 150), ('ALIVE', 205, 160)):
        f = font('segoeprb.ttf', sz)
        w = d.textlength(line, font=f); x = (W - w) / 2
        for ch in line:
            cw = d.textlength(ch, font=f)
            lay = Image.new('L', (int(cw) + 60, sz + 80), 0)
            ImageDraw.Draw(lay).text((30, 20), ch, font=f, fill=255)
            lay = lay.rotate(rnd.uniform(-7, 7), resample=Image.BICUBIC)
            yy = int(y + rnd.uniform(-6, 6))
            im.paste(paint, (int(x) - 30, yy - 20), lay)
            # a drip under some letters
            if ch.strip() and rnd.random() < 0.35:
                dx = int(x + cw * rnd.uniform(0.3, 0.7)); y0 = yy + int(sz * 0.95); L = rnd.randint(14, 40)
                d.line([(dx, y0), (dx, y0 + L)], fill=paint, width=6); d.ellipse([dx - 5, y0 + L - 4, dx + 5, y0 + L + 6], fill=paint)
            x += cw
    # worn spots in the paint (wood shows through)
    m = noise(W, H, 12, 8).point(lambda v: 255 if v > 190 else 0)
    base = Image.open(path) if False else None
    im2 = im.copy()
    wood(tmp, (96, 70, 50), (62, 44, 30), (128, 98, 70), vertical=False, seed=21, W=H, H=W, streaks=60)
    wim = Image.open(tmp).convert('RGB').resize((W, H)); os.remove(tmp)
    im2.paste(wim, (0, 0), m)
    # dark worn edge
    e = Image.new('L', (W, H), 0); ed = ImageDraw.Draw(e)
    for k in range(14): ed.rectangle([k, k, W - 1 - k, H - 1 - k], outline=int(90 * (1 - k / 14)))
    im2.paste((40, 28, 18), (0, 0), e)
    im2.save(path)


BILLS = [
    ('I.O.U.', '$40', 'FORTY DOLLARS', 'PAST DUE'),
    ('FINAL NOTICE', '$25.50', 'H. BRIGGS - PAY AT ONCE', 'OVERDUE'),
    ('PAY UP BRIGGS!', '$18', 'OR ELSE', 'UNPAID'),
    ('OWED:', '12 DOLLARS', 'DRY GOODS & SUNDRIES', 'PAST DUE'),
    ('DEBT', 'FEED & SEED', 'BALANCE  $33', 'OVERDUE'),
    ('RENT DUE', '$9 / MONTH', 'THREE MONTHS BEHIND', 'UNPAID'),
]


def bill(path, kind):
    W, H = 420, 560
    rnd = random.Random(100 + kind)
    paper = (214, 200, 164)
    im = tint(paper, noise(W, H, 20, 30 + kind), 0.07)
    d = ImageDraw.Draw(im)
    for i in range(500):   # fibres
        x, y = rnd.uniform(0, W), rnd.uniform(0, H)
        d.line([(x, y), (x + rnd.uniform(-6, 6), y + rnd.uniform(-6, 6))], fill=(196, 180, 142), width=1)
    ink = (40, 32, 28)
    d.rectangle([14, 14, W - 15, H - 15], outline=ink, width=5)
    d.rectangle([24, 24, W - 25, H - 25], outline=ink, width=2)
    head, amt, sub, stamp = BILLS[kind % len(BILLS)]
    def fit(txt, fname, size, maxw):
        f = font(fname, size)
        while d.textlength(txt, font=f) > maxw and size > 10:
            size -= 4; f = font(fname, size)
        return f
    hand = kind == 2
    f1 = fit(head, 'segoeprb.ttf' if hand else ('impact.ttf' if kind in (1, 5) else 'georgiab.ttf'), 120, W - 80)
    w = d.textlength(head, font=f1); d.text(((W - w) / 2, 42), head, font=f1, fill=ink)
    d.line([(50, 190), (W - 50, 190)], fill=ink, width=4)
    f2 = fit(amt, 'georgiab.ttf', 100, W - 90)
    w = d.textlength(amt, font=f2); d.text(((W - w) / 2, 205), amt, font=f2, fill=(120, 24, 20) if kind in (0, 2) else ink)
    f3 = fit(sub, 'georgiab.ttf', 30, W - 90)
    w = d.textlength(sub, font=f3); d.text(((W - w) / 2, 330), sub, font=f3, fill=ink)
    for i in range(4):   # small print lines
        y = 385 + i * 20; x1 = rnd.uniform(W - 140, W - 60)
        d.line([(60, y), (x1, y)], fill=(110, 96, 78), width=5)
    # signature scrawl
    fs = font('Inkfree.ttf', 44)
    d.text((W - 230, H - 105), 'H. Briggs' if kind != 2 else 'J. Crane', font=fs, fill=(36, 40, 80))
    d.line([(W - 240, H - 50), (W - 50, H - 54)], fill=ink, width=2)
    # red stamp, rotated
    fst = font('impact.ttf', 64)
    sw = int(d.textlength(stamp, font=fst)) + 40
    st = Image.new('L', (sw, 110), 0); sd = ImageDraw.Draw(st)
    sd.rectangle([4, 4, sw - 5, 105], outline=255, width=7); sd.text((20, 14), stamp, font=fst, fill=255)
    holes = noise(sw, 110, 5, 50 + kind).point(lambda v: 0 if v > 170 else 255)
    st = ImageChops.multiply(st, holes).rotate(rnd.uniform(14, 24) * rnd.choice((-1, 1)), expand=True, resample=Image.BICUBIC)
    sx, sy = int(rnd.uniform(30, W - st.size[0] - 30)), int(rnd.uniform(H - 260, H - 160 - st.size[1] // 3))
    im.paste((176, 34, 30), (sx, sy), st)
    # a coffee ring / stain on some
    if kind % 2 == 0:
        cx, cy, r = rnd.uniform(80, W - 80), rnd.uniform(80, H - 80), 55
        ring = Image.new('L', (W, H), 0); ImageDraw.Draw(ring).ellipse([cx - r, cy - r, cx + r, cy + r], outline=70, width=6)
        im.paste((150, 110, 62), (0, 0), ring.filter(ImageFilter.GaussianBlur(1.5)))
    # aged edges
    e = Image.new('L', (W, H), 0); ed = ImageDraw.Draw(e)
    for k in range(18): ed.rectangle([k, k, W - 1 - k, H - 1 - k], outline=int(80 * (1 - k / 18)))
    im.paste((150, 120, 76), (0, 0), e)
    im.save(path)


def text_decal(path, lines, mode, size=None):
    """mode 'engrave': carved letters (dark with a lit lower lip) on alpha, 600x600; 'painted': crude white paint, 600x300.
    size 'WxH' overrides the canvas."""
    W, H = (600, 600) if mode == 'engrave' else (600, 300)
    if size: W, H = [int(v) for v in size.lower().split('x')]
    rgb = Image.new('RGB', (W, H), (0, 0, 0)); a = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(rgb); da = ImageDraw.Draw(a)
    n = max(1, len(lines))
    fname = 'georgiab.ttf' if mode == 'engrave' else 'segoeprb.ttf'
    gap = 14
    sizes = []
    for i, ln in enumerate(lines):
        s = int((H - 60) / n * (1.0 if i < 2 or mode != 'engrave' else 0.8)) - gap
        s = min(s, 120 if mode == 'engrave' else 130)
        f = font(fname, s)
        while d.textlength(ln, font=f) > W - 50 and s > 12:
            s -= 3; f = font(fname, s)
        sizes.append((s, f))
    total = sum(s for s, _ in sizes) + gap * (n - 1)
    y = (H - total) / 2 - 8
    rnd = random.Random(len(''.join(lines)))
    for ln, (s, f) in zip(lines, sizes):
        w = d.textlength(ln, font=f); x = (W - w) / 2
        if mode == 'engrave':
            d.text((x + 3, y + 3), ln, font=f, fill=(170, 172, 196)); da.text((x + 3, y + 3), ln, font=f, fill=255)
            d.text((x, y), ln, font=f, fill=(34, 34, 52)); da.text((x, y), ln, font=f, fill=255)
        else:
            lay = Image.new('L', (W, s + 40), 0); ImageDraw.Draw(lay).text((x, 10), ln, font=f, fill=255)
            lay = lay.rotate(rnd.uniform(-3, 3), resample=Image.BICUBIC)
            rgb.paste((226, 218, 194), (0, int(y) - 10), lay); a.paste(255, (0, int(y) - 10), lay)
        y += s + gap
    if mode == 'engrave':   # a small carved rule under the text
        d.line([(W / 2 - 90, H - 40), (W / 2 + 90, H - 40)], fill=(34, 34, 52), width=5); da.line([(W / 2 - 90, H - 40), (W / 2 + 90, H - 40)], fill=255, width=7)
    rgb.putalpha(a.point(lambda v: 255 if v > 100 else 0))
    rgb.save(path)


def dirt(path, seed=41):
    """Fresh grave dirt: brown-violet blotches, crumbs, pebbles, a few root threads (tiles roughly)."""
    W = H = 512; rnd = random.Random(seed)
    base = (78, 54, 52)
    im = tint(base, noise(W, H, 40, seed), 0.16)
    im = Image.blend(im, tint(base, noise(W, H, 8, seed + 1), 0.2), 0.5)
    d = ImageDraw.Draw(im)
    for i in range(700):   # crumbs: dark below, lit on top
        x, y = rnd.uniform(0, W), rnd.uniform(0, H); r = rnd.uniform(2, 7)
        d.ellipse([x - r, y - r * 0.7 + 2, x + r, y + r * 0.7 + 2], fill=(44, 30, 32))
        d.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], fill=(102, 74, 68) if rnd.random() < 0.6 else (88, 62, 58))
    for i in range(40):    # pebbles
        x, y = rnd.uniform(0, W), rnd.uniform(0, H); r = rnd.uniform(3, 6)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(112, 108, 124)); d.ellipse([x - r * 0.5, y - r * 0.7, x + r * 0.2, y - r * 0.1], fill=(150, 146, 160))
    for i in range(10):    # root threads
        x, y = rnd.uniform(0, W), rnd.uniform(0, H); a = rnd.uniform(0, 6.3); pts = [(x, y)]
        for s in range(8): a += rnd.uniform(-0.6, 0.6); x += 7 * math.cos(a); y += 7 * math.sin(a); pts.append((x, y))
        d.line(pts, fill=(140, 112, 84), width=2)
    im.filter(ImageFilter.GaussianBlur(0.6)).save(path)


def grass(path, seed=43):
    """Short night grass seen from above / the side: dense blade strokes in three greens over a dark base."""
    W = H = 512; rnd = random.Random(seed)
    im = tint((44, 66, 34), noise(W, H, 36, seed), 0.18); d = ImageDraw.Draw(im)
    cols = [(32, 50, 26), (62, 92, 42), (78, 110, 50), (50, 76, 36)]
    for i in range(5200):
        x, y = rnd.uniform(-10, W + 10), rnd.uniform(-10, H + 10); L = rnd.uniform(8, 18); a = math.radians(rnd.uniform(-120, -60))
        d.line([(x, y), (x + L * math.cos(a), y + L * math.sin(a))], fill=rnd.choice(cols), width=rnd.choice((2, 2, 3)))
    for i in range(30):    # dirt peeking through
        x, y = rnd.uniform(0, W), rnd.uniform(0, H); r = rnd.uniform(4, 10)
        d.ellipse([x - r, y - r * 0.6, x + r, y + r * 0.6], fill=(70, 52, 44))
    im.save(path)


def static():
    P = lambda n: os.path.join(HERE, n)
    wood(P('gb_bell_post_wood_v.png'), (106, 84, 64), (58, 44, 32), (142, 118, 92), vertical=True, seed=1, paint=(96, 112, 100), streaks=120)
    wood(P('gb_bell_post_wood_h.png'), (106, 84, 64), (58, 44, 32), (142, 118, 92), vertical=False, seed=2, paint=(96, 112, 100), streaks=120)
    wood(P('gb_coffin_wood.png'), (110, 66, 38), (72, 42, 22), (128, 82, 50), vertical=False, seed=3, streaks=90, knots=1)
    wood(P('gb_coffin_wood_v.png'), (110, 66, 38), (72, 42, 22), (128, 82, 50), vertical=True, seed=4, streaks=90, knots=1)   # lids / tops (box projection maps Z faces turned)
    cut_wood(P('gb_coffin_cut.png'))
    satin(P('gb_coffin_satin.png'))
    stone(P('gb_headstone_stone.png'))
    moss(P('gb_headstone_moss.png'))
    scroll(P('gb_headstone_scroll.png'))
    plaque(P('gb_bell_post_plaque.png'))
    for k in range(6): bill(P(f'gb_bill_{k}.png'), k)
    dirt(P('gb_grave_mound_dirt.png'))
    grass(P('gb_grave_mound_grass.png'))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'static'
    if cmd == 'static': static()
    elif cmd in ('engrave', 'painted'):
        text_decal(sys.argv[2], [s for s in sys.argv[3].split('|')], cmd, sys.argv[4] if len(sys.argv) > 4 else None)
    elif cmd == 'one':   # one static texture by name, e.g. one satin
        globals()[sys.argv[2]](os.path.join(HERE, f'gb_{sys.argv[2]}.png'))
    print('ok')
