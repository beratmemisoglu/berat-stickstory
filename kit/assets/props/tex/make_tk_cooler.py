# Textures for tk_cooler (TICKETS): "COLD DRINKS" header, the backlit back wall (rows of drinks behind the 3D front
# rows), shelf price strips, glass clings, the PULL sticker, the vent grille, the soda case print, glints.
# Run: .venv/Scripts/python.exe assets/props/tex/make_tk_cooler.py
import math, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))
F = 'C:/Windows/Fonts/'
BLK, BOLD = F + 'ariblk.ttf', F + 'arialbd.ttf'
SS = 2
INK = '#1d1712'


def font(p, px): return ImageFont.truetype(p, int(px))


def fit(d, txt, p, max_w, px):
    while px > 8:
        f = font(p, px); b = d.textbbox((0, 0), txt, font=f)
        if b[2] - b[0] <= max_w: return f
        px *= 0.94
    return font(p, 8)


def ct(d, xy, txt, f, fill, stroke=0, sfill=INK, anchor='mm'):
    d.text(xy, txt, font=f, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=sfill)


def star(d, cx, cy, r1, r2, n, fill, outline=None, w=0):
    pts = [(cx + (r1 if i % 2 == 0 else r2) * math.sin(math.pi * i / n), cy - (r1 if i % 2 == 0 else r2) * math.cos(math.pi * i / n)) for i in range(2 * n)]
    d.polygon(pts, fill=fill, outline=outline, width=w)


def flake(d, cx, cy, r, fill, w):
    for k in range(6):
        a = math.pi * k / 3
        x1, y1 = cx + r * math.cos(a), cy + r * math.sin(a)
        d.line((cx, cy, x1, y1), fill=fill, width=w)
        for t in (0.55,):
            bx, by = cx + r * t * math.cos(a), cy + r * t * math.sin(a)
            for s in (-1, 1):
                b = a + s * 0.7
                d.line((bx, by, bx + r * 0.3 * math.cos(b), by + r * 0.3 * math.sin(b)), fill=fill, width=w)


def save(im, name, size=None):
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, name)); print('wrote', name, im.size)


def header():
    W, H = 2000 * SS, 260 * SS
    im = Image.new('RGB', (W, H), '#1250b0'); d = ImageDraw.Draw(im, 'RGBA')
    for k in range(0, W, 120 * SS):
        d.polygon([(k, 0), (k + 60 * SS, 0), (k - 40 * SS, H), (k - 100 * SS, H)], fill='#0f469e80')
    d.rectangle((0, H - 30 * SS, W, H), fill='#0b2f70')
    f = font(BLK, 150 * SS)
    ct(d, (W / 2 + 8 * SS, H / 2 - 4 * SS), 'COLD DRINKS', f, INK, 16 * SS, INK)
    ct(d, (W / 2, H / 2 - 12 * SS), 'COLD DRINKS', f, '#ffffff', 12 * SS, '#0b1f50')
    for sx in (170 * SS, W - 170 * SS):
        d.ellipse((sx - 95 * SS, H / 2 - 105 * SS, sx + 95 * SS, H / 2 + 85 * SS), fill='#7fd4ff', outline='#0b1f50', width=8 * SS)
        flake(d, sx, H / 2 - 10 * SS, 70 * SS, '#ffffff', 12 * SS)
    ct(d, (W / 2, H - 15 * SS), 'ICE COLD  -  GRAB & GO  -  ICE COLD', font(BLK, 22 * SS), '#7fd4ff')
    save(im, 'tk_cooler_header.png', (2000, 260))


def backwall():
    """Rows of backlit drinks (the 2nd..nth rows), one band per shelf, pale cool tones."""
    W, H = 640, 1680                         # 1 px per mm of one door section (0.64 x 1.68)
    rnd = random.Random(8)
    im = Image.new('RGB', (W, H), '#eaf6ff'); d = ImageDraw.Draw(im, 'RGBA')
    shelves = [30, 340, 650, 960, 1270]       # shelf tops in mm from the bottom
    pal = ['#e57a6e', '#7cc48a', '#f0b45a', '#7aa8e8', '#c88ae0', '#f08aa8', '#9ad8e0', '#e8d070']
    for z0 in shelves:
        yb = H - z0
        c = rnd.choice(pal)
        kind = rnd.choice(('bottle', 'can', 'bottle', 'tall'))
        hgt = {'bottle': 200, 'can': 120, 'tall': 160}[kind]
        x = 6
        while x < W - 40:
            w = 62 if kind == 'bottle' else 60
            cc = c if rnd.random() < 0.7 else rnd.choice(pal)
            d.rounded_rectangle((x, yb - hgt, x + w - 8, yb), radius=10, fill=cc + 'b0')
            if kind == 'bottle':
                d.rectangle((x + w / 2 - 12, yb - hgt - 30, x + w / 2 + 4, yb - hgt), fill=cc + 'b0')
            d.rectangle((x, yb - hgt * 0.62, x + w - 8, yb - hgt * 0.38), fill='#ffffff60')
            x += w
        d.rectangle((0, yb, W, yb + 14), fill='#b8c4cc')
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    save(im, 'tk_cooler_back.png')


def strip():
    W, H = 1280, 50
    rnd = random.Random(3)
    im = Image.new('RGB', (W, H), '#f2efe6'); d = ImageDraw.Draw(im)
    x = 20
    while x < W - 140:
        t = rnd.choice(('$1.99', '$2.49', '2/$3', '$2.29', '3/$5', '$1.79'))
        d.rectangle((x, 4, x + 120, H - 4), fill='#ffd23a', outline=INK, width=2)
        ct(d, (x + 60, H / 2), t, font(BLK, 30), INK)
        x += rnd.randint(190, 260)
    save(im, 'tk_cooler_strip.png')


def clings():
    # ICE COLD round cling
    S = 400 * SS
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse((6 * SS, 6 * SS, S - 6 * SS, S - 6 * SS), fill='#1f7fe0', outline='#ffffff', width=14 * SS)
    flake(d, S / 2, S * 0.36, 70 * SS, '#ffffff', 14 * SS)
    ct(d, (S / 2, S * 0.7), 'ICE COLD', fit(d, 'ICE COLD', BLK, S * 0.72, 70 * SS), '#ffffff', 5 * SS, '#0b2f70')
    save(im, 'tk_cooler_cling0.png', (400, 400))
    # 2 FOR $3 burst
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    star(d, S / 2, S / 2, S * 0.49, S * 0.38, 16, '#e0302a', '#ffffff', 10 * SS)
    ct(d, (S / 2, S * 0.38), '2 FOR', fit(d, '2 FOR', BLK, S * 0.5, 70 * SS), '#ffffff')
    ct(d, (S / 2, S * 0.6), '$3', fit(d, '$3', BLK, S * 0.5, 130 * SS), '#ffd23a', 5 * SS)
    save(im, 'tk_cooler_cling1.png', (400, 400))
    # ENERGY bolt
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((10 * SS, 60 * SS, S - 10 * SS, S - 60 * SS), radius=40 * SS, fill='#15131a', outline='#7dff3a', width=12 * SS)
    d.polygon([(S * 0.36, S * 0.22), (S * 0.56, S * 0.22), (S * 0.48, S * 0.42), (S * 0.62, S * 0.42), (S * 0.36, S * 0.78), (S * 0.43, S * 0.5), (S * 0.3, S * 0.5)], fill='#7dff3a')
    ct(d, (S * 0.72, S * 0.5), 'MAX', fit(d, 'MAX', BLK, S * 0.4, 80 * SS), '#ffffff')
    save(im, 'tk_cooler_cling2.png', (400, 400))
    # PULL sticker
    im = Image.new('RGBA', (240 * SS, 90 * SS), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((4 * SS, 4 * SS, 236 * SS, 86 * SS), radius=16 * SS, fill='#f4efe2', outline=INK, width=5 * SS)
    ct(d, (120 * SS, 46 * SS), 'PULL', font(BLK, 56 * SS), '#c41c2a')
    save(im, 'tk_cooler_pull.png', (240, 90))


def grille():
    W, H = 2000, 130
    im = Image.new('RGB', (W, H), '#2a2d33'); d = ImageDraw.Draw(im)
    for y in range(18, H - 10, 22):
        d.rounded_rectangle((40, y, W - 40, y + 10), radius=5, fill='#0f1013')
    ct(d, (W - 160, H / 2), 'COOL-TECH', font(BLK, 26), '#8a8f98')
    save(im, 'tk_cooler_grille.png')


def case():
    W, H = 500, 250
    im = Image.new('RGB', (W, H), '#c8955a'); d = ImageDraw.Draw(im)
    d.rectangle((0, 70, W, 170), fill='#c41c2a')
    ct(d, (W / 2, 120), 'COLA  24 CANS', font(BLK, 50), '#ffffff', 3, INK)
    ct(d, (W / 2, 205), 'THIS SIDE UP', font(BOLD, 26), '#6a4a2a')
    save(im, 'tk_cooler_case.png')


def glints():
    W, H = 600, 1600
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for x, w in ((140, 16), (178, 6), (430, 10)):
        d.polygon([(x, 120), (x + w, 120), (x + w - 260, 1000), (x - 260, 1000)], fill=(255, 255, 255, 255))
    save(im, 'tk_cooler_glints.png')


def sidepanel():
    """Cabinet side wrap: enamel with a blue wave, bubbles, a big snowflake and ICE COLD up the side."""
    W, H = 400 * SS, 1000 * SS
    rnd = random.Random(6)
    im = Image.new('RGB', (W, H), '#d3cfc5'); d = ImageDraw.Draw(im, 'RGBA')
    pts = [(0, H * 0.52)] + [(x, H * 0.52 + 60 * SS * math.sin(x / W * 2 * math.pi + 0.6)) for x in range(0, W + 1, 8)] + [(W, H), (0, H)]
    d.polygon(pts, fill='#1250b0')
    pts2 = [(0, H * 0.6)] + [(x, H * 0.6 + 50 * SS * math.sin(x / W * 2 * math.pi + 2.0)) for x in range(0, W + 1, 8)] + [(W, H), (0, H)]
    d.polygon(pts2, fill='#0f3f8e')
    for _ in range(30):
        x, y, r = rnd.uniform(20, W - 20), rnd.uniform(H * 0.25, H * 0.95), rnd.uniform(6, 26) * SS
        d.ellipse((x - r, y - r, x + r, y + r), outline='#ffffff', width=4 * SS, fill='#ffffff30')
    d.ellipse((W / 2 - 120 * SS, H * 0.16 - 120 * SS, W / 2 + 120 * SS, H * 0.16 + 120 * SS), fill='#7fd4ff', outline='#0b1f50', width=8 * SS)
    flake(d, W / 2, H * 0.16, 90 * SS, '#ffffff', 16 * SS)
    txt = Image.new('RGBA', (int(H * 0.42), 160 * SS), (0, 0, 0, 0)); td = ImageDraw.Draw(txt)
    f = fit(td, 'ICE COLD', BLK, txt.size[0] - 20 * SS, 140 * SS)
    ct(td, (txt.size[0] / 2, txt.size[1] / 2), 'ICE COLD', f, '#ffffff', 9 * SS, '#0b1f50')
    txt = txt.rotate(90, expand=True)
    im.paste(txt, (int(W / 2 - txt.size[0] / 2), int(H * 0.53)), txt)
    save(im, 'tk_cooler_sidepanel.png', (400, 1000))


def frost():
    """Frost creeping up the bottom corners of a door's glass (alpha cut-out, soft scalloped edge)."""
    W, H = 600, 240
    rnd = random.Random(12)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for k in range(70):
        x = rnd.uniform(-40, W + 40); edge = min(x, W - x)
        top = H - (40 + 160 * max(0.0, 1 - edge / 220)) * rnd.uniform(0.6, 1.0)
        r = rnd.uniform(16, 42)
        d.ellipse((x - r, top - r, x + r, top + r + H), fill=(236, 246, 255, 255))
    d.rectangle((0, H - 30, W, H), fill=(236, 246, 255, 255))
    for k in range(40):   # a few crystals above the frost line
        x, y = rnd.uniform(0, W), rnd.uniform(40, H - 60)
        if min(x, W - x) < 160: flake(d, x, y, rnd.uniform(6, 12), (236, 246, 255, 255), 3)
    save(im, 'tk_cooler_frost.png')


if __name__ == '__main__':
    header(); backwall(); strip(); clings(); grille(); case(); glints(); sidepanel(); frost()
