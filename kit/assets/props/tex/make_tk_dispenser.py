# Textures for tk_dispenser (TICKETS): 8 scratch-card faces, the lit "INSTANT TICKETS" header, side branding columns,
# price strips per row, the stand's front band, acrylic glints, the SOLD OUT tag, the ticket back.
# Run: .venv/Scripts/python.exe assets/props/tex/make_tk_dispenser.py
import math, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))
F = 'C:/Windows/Fonts/'
BLK, BOLD = F + 'ariblk.ttf', F + 'arialbd.ttf'
SS = 2   # supersample


def font(path, px): return ImageFont.truetype(path, int(px))


def fit(d, txt, path, max_w, px):
    """Largest font <= px whose text fits max_w."""
    while px > 8:
        f = font(path, px)
        b = d.textbbox((0, 0), txt, font=f)
        if b[2] - b[0] <= max_w: return f
        px *= 0.94
    return font(path, 8)


def ctext(d, xy, txt, f, fill, stroke=0, sfill='#1d1712', anchor='mm'):
    d.text(xy, txt, font=f, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=sfill)


def star(d, cx, cy, r1, r2, n, fill, outline=None, w=0, rot=0):
    pts = []
    for i in range(2 * n):
        a = rot + math.pi * i / n
        r = r1 if i % 2 == 0 else r2
        pts.append((cx + r * math.sin(a), cy - r * math.cos(a)))
    d.polygon(pts, fill=fill, outline=outline, width=w)


def save(im, name, size):
    im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, name))
    print('wrote', name, size)


def shade(hexc, k):
    h = hexc.lstrip('#'); c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    if k >= 0: c = [int(x + (255 - x) * k) for x in c]
    else: c = [int(x * (1 + k)) for x in c]
    return '#%02x%02x%02x' % tuple(c)


GAMES = [  # title, base colour, accent, price, top prize
    ('LUCKY 7s', '#c41c35', '#ffd23a', '$5', '$77,777'),
    ('CASH BLAST', '#1b5fc4', '#3fe0ff', '$10', '$250,000'),
    ('GOLD RUSH', '#c98a0c', '#fff0a0', '$20', '$1,000,000'),
    ('MONEY BAGS', '#23883a', '#c6ff6a', '$2', '$20,000'),
    ('HOT 100s', '#d9481a', '#ffe14a', '$1', '$1,000'),
    ('TRIPLE WIN', '#6a28a8', '#ff7ad9', '$5', '$50,000'),
    ('BIG BUCKS', '#0c8a86', '#a8fff2', '$3', '$30,000'),
    ('STAR CASH', '#c4237e', '#ffd23a', '$10', '$100,000'),
]


def card(i):
    title, base, acc, price, top = GAMES[i]
    W, H = 600 * SS, 1000 * SS
    rnd = random.Random(i * 7 + 1)
    im = Image.new('RGB', (W, H), '#f4efe2')
    d = ImageDraw.Draw(im, 'RGBA')
    m = 18 * SS
    # coloured field with a sunburst of darker rays
    d.rounded_rectangle((m, m, W - m, H - m), radius=26 * SS, fill=base)
    cx, cy = W / 2, H * 0.30
    dark = shade(base, -0.28)
    for k in range(24):
        if k % 2: continue
        a0, a1 = 2 * math.pi * k / 24, 2 * math.pi * (k + 1) / 24
        R = 2000 * SS
        d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=dark + '90')
    # re-mask the margin (rays spill over)
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).rounded_rectangle((m, m, W - m, H - m), radius=26 * SS, fill=255)
    paper = Image.new('RGB', (W, H), '#f4efe2'); im = Image.composite(im, paper, mask); d = ImageDraw.Draw(im, 'RGBA')
    # little confetti dots
    for _ in range(40):
        x, y, r = rnd.uniform(m * 2, W - m * 2), rnd.uniform(m * 2, H * 0.55), rnd.uniform(4, 9) * SS
        d.ellipse((x - r, y - r, x + r, y + r), fill=shade(acc, 0.2) + 'c0')
    # top band
    d.rounded_rectangle((m + 26 * SS, m + 26 * SS, W - m - 170 * SS, m + 86 * SS), radius=28 * SS, fill="#1d1712")
    ctext(d, ((W - 144 * SS) / 2, m + 57 * SS), "STATE LOTTERY", font(BLK, 32 * SS), "#ffffff")
    # title, two lines if it has a space, chunky with a dark stroke
    words = title.split(' ')
    lines = [title] if len(words) == 1 else [words[0], ' '.join(words[1:])]
    y = H * 0.215 if len(lines) == 2 else H * 0.29
    for ln in lines:
        f = fit(d, ln, BLK, W - 2 * m - 70 * SS, 150 * SS)
        ctext(d, (W / 2 + 6 * SS, y + 8 * SS), ln, f, '#1d1712', 14 * SS, '#1d1712')
        ctext(d, (W / 2, y), ln, f, '#ffffff' if i % 2 else acc, 12 * SS, '#1d1712')
        y += f.size * 1.0
    # price star burst, upper right, overlapping the corner
    sx, sy = W - m - 82 * SS, m + 84 * SS
    star(d, sx + 6 * SS, sy + 6 * SS, 78 * SS, 58 * SS, 14, '#1d1712')
    star(d, sx, sy, 78 * SS, 58 * SS, 14, acc, '#1d1712', 6 * SS)
    ctext(d, (sx, sy), price, fit(d, price, BLK, 96 * SS, 62 * SS), '#1d1712')
    # WIN UP TO band
    by = H * 0.50
    d.rectangle((m, by, W - m, by + 112 * SS), fill="#1d1712")
    ctext(d, (W / 2, by + 32 * SS), "WIN UP TO", font(BLK, 32 * SS), acc)
    ctext(d, (W / 2, by + 76 * SS), top + "!", fit(d, top + "!", BLK, W - 2 * m - 40 * SS, 48 * SS), "#ffffff")
    # silver scratch area with a latex speckle and a few "coins" printed on it
    sy0, sy1 = H * 0.655, H * 0.885
    x0, x1 = m + 40 * SS, W - m - 40 * SS
    d.rounded_rectangle((x0 + 6 * SS, sy0 + 6 * SS, x1 + 6 * SS, sy1 + 6 * SS), radius=22 * SS, fill='#1d1712')
    d.rounded_rectangle((x0, sy0, x1, sy1), radius=22 * SS, fill='#b9bec6', outline='#1d1712', width=6 * SS)
    for _ in range(900):
        x, y = rnd.uniform(x0 + 10, x1 - 10), rnd.uniform(sy0 + 10, sy1 - 10)
        r = rnd.uniform(1.5, 4) * SS
        d.ellipse((x - r, y - r, x + r, y + r), fill=rnd.choice(('#d9dde2', '#9aa1aa', '#c9ced4')))
    # sheen stripe
    d.polygon([(x0 + 60 * SS, sy0 + 6 * SS), (x0 + 120 * SS, sy0 + 6 * SS), (x0 + 40 * SS, sy1 - 6 * SS), (x0 - 20 * SS + 20 * SS, sy1 - 6 * SS)], fill='#ffffff55')
    for k in range(3):
        for j in range(2):
            cxx = x0 + (x1 - x0) * (0.2 + 0.3 * k); cyy = sy0 + (sy1 - sy0) * (0.3 + 0.42 * j)
            d.ellipse((cxx - 40 * SS, cyy - 40 * SS, cxx + 40 * SS, cyy + 40 * SS), fill='#a6acb5', outline='#7d848d', width=4 * SS)
            ctext(d, (cxx, cyy), '$', font(BLK, 44 * SS), '#7d848d')
    ctext(d, (W / 2, sy0 - 26 * SS), 'SCRATCH HERE', font(BLK, 30 * SS), '#ffffff', 5 * SS)
    # barcode strip at the bottom
    by0 = H - m - 70 * SS
    d.rectangle((m + 60 * SS, by0, W - m - 60 * SS, by0 + 50 * SS), fill='#f4efe2')
    x = m + 72 * SS
    while x < W - m - 72 * SS:
        w = rnd.choice((2, 3, 5, 7)) * SS
        d.rectangle((x, by0 + 6 * SS, x + w, by0 + 44 * SS), fill='#1d1712'); x += w + rnd.choice((3, 4, 6)) * SS
    # perforation dashes along the top and bottom edge (strips are joined there)
    for yy in (4 * SS, H - 6 * SS):
        for x in range(0, W, 26 * SS):
            d.rectangle((x + 4 * SS, yy - 3 * SS, x + 16 * SS, yy + 3 * SS), fill='#8a8172')
    save(im, f'tk_dispenser_card{i}.png', (600, 1000))


def back():
    W, H = 600 * SS, 1000 * SS
    im = Image.new('RGB', (W, H), '#ece5d2'); d = ImageDraw.Draw(im)
    rnd = random.Random(5)
    d.rectangle((40 * SS, 60 * SS, W - 40 * SS, 150 * SS), fill='#2a2622')
    ctext(d, (W / 2, 105 * SS), 'HOW TO PLAY', font(BLK, 46 * SS), '#ece5d2')
    y = 200 * SS
    while y < H - 120 * SS:
        x = 50 * SS
        while x < W - 60 * SS:
            w = rnd.uniform(20, 90) * SS
            d.rectangle((x, y, min(x + w, W - 50 * SS), y + 9 * SS), fill='#a39a86'); x += w + 12 * SS
        y += 30 * SS
    for yy in (4 * SS, H - 6 * SS):
        for x in range(0, W, 26 * SS):
            d.rectangle((x + 4 * SS, yy - 3 * SS, x + 16 * SS, yy + 3 * SS), fill='#8a8172')
    save(im, 'tk_dispenser_back.png', (300, 500))


def header():
    W, H = 2000 * SS, 170 * SS
    im = Image.new('RGB', (W, H), '#101a4a'); d = ImageDraw.Draw(im, 'RGBA')
    # glowing letters: a soft halo then the bright face
    halo = Image.new('RGB', (W, H), '#101a4a'); hd = ImageDraw.Draw(halo)
    f = font(BLK, 118 * SS)
    ctext(hd, (W / 2, H / 2 + 4 * SS), 'INSTANT TICKETS', f, '#ff3fa8', 16 * SS, '#ff3fa8')
    halo = halo.filter(ImageFilter.GaussianBlur(14 * SS))
    im = halo; d = ImageDraw.Draw(im, 'RGBA')
    ctext(d, (W / 2, H / 2 + 4 * SS), 'INSTANT TICKETS', f, '#fff6d8', 7 * SS, '#ff4fb0')
    for sx in (150 * SS, W - 150 * SS):
        star(d, sx, H / 2, 58 * SS, 24 * SS, 5, '#ffe14a', '#fff6d8', 3 * SS)
    save(im, 'tk_dispenser_header.png', (2000, 170))


def side():
    W, H = 180 * SS, 940 * SS
    im = Image.new('RGB', (W, H), '#b3122f'); d = ImageDraw.Draw(im, 'RGBA')
    for k in range(0, H, 60 * SS):
        d.polygon([(0, k), (W, k - 40 * SS), (W, k - 10 * SS), (0, k + 30 * SS)], fill='#98102890')
    rnd = random.Random(3)
    # vertical words, rotated
    txt = Image.new('RGBA', (H, W), (0, 0, 0, 0)); td = ImageDraw.Draw(txt)
    f = fit(td, 'SCRATCH & WIN', BLK, H - 320 * SS, 104 * SS)
    ctext(td, (H / 2 + 5 * SS, W / 2 + 5 * SS), 'SCRATCH & WIN', f, '#1d1712', 10 * SS, '#1d1712')
    ctext(td, (H / 2, W / 2), 'SCRATCH & WIN', f, '#ffd23a', 9 * SS, '#1d1712')
    txt = txt.rotate(90, expand=True)
    im.paste(txt, (0, 0), txt)
    d = ImageDraw.Draw(im, 'RGBA')
    for y in (60 * SS, H - 60 * SS):
        star(d, W / 2, y, 48 * SS, 20 * SS, 5, '#ffffff', '#1d1712', 4 * SS)
    save(im, 'tk_dispenser_side.png', (180, 940))


def prices(row):
    W, H = 1440 * SS, 72 * SS
    im = Image.new('RGB', (W, H), '#1d1712'); d = ImageDraw.Draw(im, 'RGBA')
    for b in range(4):
        i = row * 4 + b
        title, base, acc, price, top = GAMES[i]
        x0 = b * W / 4 + 22 * SS; x1 = (b + 1) * W / 4 - 22 * SS
        d.rounded_rectangle((x0, 8 * SS, x1, H - 8 * SS), radius=12 * SS, fill='#f2efe6')
        d.ellipse((x0 + 6 * SS, 12 * SS, x0 + 6 * SS + (H - 24 * SS), H - 12 * SS), fill=base, outline='#1d1712', width=3 * SS)
        ctext(d, (x0 + 6 * SS + (H - 24 * SS) / 2, H / 2), price, fit(d, price, BLK, H - 34 * SS, 30 * SS), '#ffffff')
        ctext(d, ((x0 + H) + (x1 - x0 - H) / 2, H / 2), f'#{14 + i * 3:02d}{(i * 37) % 90 + 10:02d}', font(BLK, 34 * SS), '#1d1712')
    save(im, f'tk_dispenser_prices{row}.png', (1440, 72))


def base_band():
    W, H = 1800 * SS, 160 * SS
    im = Image.new('RGB', (W, H), '#1a2f7a'); d = ImageDraw.Draw(im, 'RGBA')
    d.rectangle((0, 0, W, 14 * SS), fill='#ffd23a'); d.rectangle((0, H - 14 * SS, W, H), fill='#ffd23a')
    f = font(BLK, 84 * SS)
    ctext(d, (W / 2 + 5 * SS, H / 2 + 5 * SS), 'PLAY HERE!  WIN TODAY!', f, '#0b1440', 8 * SS, '#0b1440')
    ctext(d, (W / 2, H / 2), 'PLAY HERE!  WIN TODAY!', f, '#ffffff', 7 * SS, '#0b1440')
    for sx in (110 * SS, W - 110 * SS):
        star(d, sx, H / 2, 52 * SS, 22 * SS, 5, '#ffd23a', '#0b1440', 4 * SS)
    save(im, 'tk_dispenser_band.png', (1800, 160))


def glints():
    W, H = 800, 520
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for x, w in ((200, 9), (226, 4), (640, 6)):
        d.polygon([(x, 0), (x + w, 0), (x + w - 160, H), (x - 160, H)], fill=(255, 255, 255, 255))
    save(im, 'tk_dispenser_glints.png', (800, 520))


def soldout():
    W, H = 420 * SS, 200 * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((6 * SS, 6 * SS, W - 6 * SS, H - 6 * SS), radius=22 * SS, fill='#d21f2f', outline='#1d1712', width=8 * SS)
    d.rounded_rectangle((22 * SS, 22 * SS, W - 22 * SS, H - 22 * SS), radius=14 * SS, outline='#ffffff', width=5 * SS)
    ctext(d, (W / 2, H / 2 + 2 * SS), 'SOLD OUT', fit(d, 'SOLD OUT', BLK, W - 70 * SS, 90 * SS), '#ffffff')
    d.ellipse((W / 2 - 10 * SS, 26 * SS, W / 2 + 10 * SS, 46 * SS), fill='#1d1712')
    save(im, 'tk_dispenser_soldout.png', (420, 200))


def backpanel():
    """The printed inside back of the bins: navy with soft stars, '$' and a diagonal sheen (seen in empty bins)."""
    W, H = 1440, 860
    im = Image.new('RGB', (W, H), '#1a2a6a'); d = ImageDraw.Draw(im, 'RGBA')
    rnd = random.Random(11)
    for k in range(-H, W, 90):
        d.polygon([(k, H), (k + 40, H), (k + 40 + H * 0.6, 0), (k + H * 0.6, 0)], fill='#22348055')
    fd = font(BLK, 44)
    for y in range(40, H, 110):
        for x in range(40 + (y // 110 % 2) * 90, W, 180):
            if rnd.random() < 0.5: star(d, x, y, 22, 9, 5, '#2d44a0')
            else: ctext(d, (x, y), '$', fd, '#2d44a0')
    im.save(os.path.join(OUT, 'tk_dispenser_backpanel.png')); print('wrote tk_dispenser_backpanel.png')


def sticker21():
    W, H = 240 * SS, 170 * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((4 * SS, 4 * SS, W - 4 * SS, H - 4 * SS), radius=16 * SS, fill='#f4efe2', outline='#1d1712', width=5 * SS)
    d.ellipse((14 * SS, 22 * SS, 104 * SS, 112 * SS), fill='#d21f2f', outline='#1d1712', width=4 * SS)
    ctext(d, (59 * SS, 67 * SS), '21+', font(BLK, 38 * SS), '#ffffff')
    ctext(d, (172 * SS, 50 * SS), 'PLAY', font(BLK, 34 * SS), '#1a3f9e')
    ctext(d, (172 * SS, 92 * SS), 'SMART', font(BLK, 30 * SS), '#1a3f9e')
    ctext(d, (W / 2, 142 * SS), '1-800-GAMBLER', fit(d, '1-800-GAMBLER', BOLD, W - 30 * SS, 26 * SS), '#1d1712')
    save(im, 'tk_dispenser_21.png', (240, 170))


if __name__ == '__main__':
    for i in range(8): card(i)
    back(); header(); side(); prices(0); prices(1); base_band(); glints(); soldout(); backpanel(); sticker21()
