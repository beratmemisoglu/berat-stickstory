# PNG maker for assets/props/gb_house.py (runs in the lab venv, Pillow).
#   python make_gb_house.py <key>   -> tex/gb_house_<kind>_<key>.png for every kind
# All tiles are near-neutral (light) so the prop tints them with its kw colours; all wrap seamlessly.
import os, random, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
KEY = sys.argv[1] if len(sys.argv) > 1 else 'dev'


def save(im, kind):
    im.save(os.path.join(HERE, f'gb_house_{kind}_{KEY}.png'))


def clap():
    """Clapboard tile = 2 m x 2 m: 12 boards (0.167 m), lip shadow under each board, grain, worn paint."""
    S = 1024; im = Image.new('RGB', (S, S), (236, 236, 236)); d = ImageDraw.Draw(im); r = random.Random(4)
    bh = S // 12
    for b in range(12):
        y0 = b * bh
        for y in range(bh):
            k = y / bh
            v = int(250 - 26 * k)                # lighter at the top of a board, darker toward its lip
            d.line([(0, y0 + y), (S, y0 + y)], fill=(v, v, v))
        d.rectangle([0, y0 + bh - 7, S, y0 + bh - 1], fill=(120, 116, 112))     # lip shadow
        d.line([(0, y0 + bh - 8), (S, y0 + bh - 8)], fill=(205, 205, 205), width=1)
        for _ in range(26):                      # grain streaks
            x = r.randrange(S); ln = r.randrange(60, 260); yy = y0 + r.randrange(4, bh - 12); c = r.randrange(212, 232)
            for dx in (0, -S):
                d.line([(x + dx, yy), (x + dx + ln, yy + r.choice((0, 1)))], fill=(c, c, c), width=1)
        for _ in range(2):                       # board butt joints
            x = r.randrange(S)
            d.line([(x, y0 + 2), (x, y0 + bh - 8)], fill=(150, 146, 142), width=3)
    for _ in range(30):                          # worn paint: peeled streaks along the board lips show grey wood
        b = r.randrange(12); x = r.randrange(S); w = r.randrange(40, 160); y = b * bh + bh - 9 - r.randrange(0, 10)
        h = r.randrange(3, 7)
        for dx in (0, -S, S):
            d.rounded_rectangle([x + dx, y, x + dx + w, y + h], radius=2, fill=(196, 190, 182))
            if r.random() < 0.5:
                d.rounded_rectangle([x + dx + w // 4, y - h, x + dx + w // 2, y], radius=2, fill=(204, 198, 190))
    dirt = Image.new('L', (S, S), 0); dd = ImageDraw.Draw(dirt)
    for _ in range(18):
        x, y = r.randrange(S), r.randrange(S); w = r.randrange(80, 260)
        dd.ellipse([x, y, x + w, y + w // 2], fill=r.randrange(20, 45))
    dirt = dirt.filter(ImageFilter.GaussianBlur(30))
    im = Image.composite(Image.new('RGB', (S, S), (150, 140, 130)), im, dirt)
    save(im, 'clap')


def shingle():
    """Shingle tile = 1 m x 1 m (UV): 6 rows, staggered random widths, gaps, lower-edge shadow."""
    S = 1024; im = Image.new('RGB', (S, S), (60, 56, 54)); d = ImageDraw.Draw(im); r = random.Random(7)
    rh = S // 6
    for row in range(6):
        y0 = row * rh; x = r.randrange(0, 90)
        while x < S + 200:
            w = r.randrange(110, 230); v = r.randrange(186, 236)
            col = (v, int(v * 0.97), int(v * 0.95))
            for dx in (0, -S):
                d.rectangle([x + dx + 4, y0, x + dx + w - 4, y0 + rh - 4], fill=col)
                d.rectangle([x + dx + 4, y0 + rh - 22, x + dx + w - 4, y0 + rh - 4], fill=(int(v * 0.66),) * 3)
                for _ in range(3):
                    gx = x + dx + r.randrange(10, max(11, w - 10))
                    d.line([(gx, y0 + 6), (gx, y0 + rh - 26)], fill=(int(v * 0.86),) * 3, width=2)
                if r.random() < 0.18:   # a moss / weather stain
                    d.ellipse([x + dx + 10, y0 + rh - 60, x + dx + 60, y0 + rh - 20], fill=(int(v * 0.72), int(v * 0.78), int(v * 0.68)))
            x += w
    save(im, 'shingle')


def lattice():
    """Porch skirt lattice tile = 1 m: light diagonal slats on a dark void."""
    S = 512; im = Image.new('RGB', (S, S), (22, 20, 24)); d = ImageDraw.Draw(im)
    step = S // 4
    for i in range(-4, 9):
        for dx in (0,):
            d.line([(i * step, 0), (i * step + S, S)], fill=(225, 220, 210), width=26)
    for i in range(-4, 9):
        d.line([(i * step + S, 0), (i * step, S)], fill=(205, 200, 190), width=26)
    save(im, 'lattice')


def wallpaper():
    """Room wallpaper tile = 1 m: warm cream with rose stripes + small sprigs, a darker wainscot band at the bottom."""
    S = 512; im = Image.new('RGB', (S, S), (238, 214, 172)); d = ImageDraw.Draw(im); r = random.Random(2)
    for x in range(0, S, 64):
        d.rectangle([x, 0, x + 14, S], fill=(196, 120, 98))
        d.rectangle([x + 30, 0, x + 33, S], fill=(214, 168, 120))
    for y in range(20, S, 64):
        for x in range(46, S, 64):
            d.ellipse([x - 6, y - 6, x + 6, y + 6], fill=(170, 82, 70))
            d.ellipse([x - 9, y + 4, x - 1, y + 10], fill=(110, 130, 80))
    save(im, 'wallpaper')


def louver():
    """Shutter louvers (box projection, 0.5 m tile): slats with a dark gap under each."""
    S = 256; im = Image.new('RGB', (S, S), (230, 230, 230)); d = ImageDraw.Draw(im)
    n = 8; h = S // n
    for i in range(n):
        y0 = i * h
        for y in range(h):
            v = int(246 - 60 * (y / h) ** 1.5)
            d.line([(0, y0 + y), (S, y0 + y)], fill=(v, v, v))
        d.rectangle([0, y0 + h - 6, S, y0 + h - 1], fill=(70, 68, 66))
    save(im, 'louver')


def stone():
    """Fieldstone foundation (box projection, 1 m tile)."""
    S = 512; im = Image.new('RGB', (S, S), (70, 66, 64)); d = ImageDraw.Draw(im); r = random.Random(9)
    y = 0
    while y < S:
        h = r.randrange(70, 120); x = r.randrange(-60, 0)
        while x < S:
            w = r.randrange(90, 170); v = r.randrange(150, 205)
            box = [x + 5, y + 5, x + w - 5, min(S, y + h) - 5]
            d.rounded_rectangle(box, radius=18, fill=(v, v - 4, v - 10))
            d.rounded_rectangle([box[0] + 6, box[1] + 4, box[2] - 8, box[1] + 18], radius=8, fill=(min(255, v + 18),) * 3)
            x += w
        y += h
    im = im.resize((S, S)); save(im, 'stone')


for f in (clap, shingle, lattice, wallpaper, louver, stone):
    f()
print('ok', KEY)
