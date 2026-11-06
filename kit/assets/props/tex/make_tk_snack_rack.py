# Textures for tk_snack_rack (TICKETS): chips-bag faces, candy-box faces, cookie-pack faces, candy peg bags, the
# shelf price strip, the pegboard and the "SNACKS" header card.
# Run: .venv/Scripts/python.exe assets/props/tex/make_tk_snack_rack.py
import math, os, random
from PIL import Image, ImageDraw, ImageFont

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


def save(im, name, size=None):
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, name)); print('wrote', name, im.size)


CHIPS = [('CRUNCHOS', '#d42c2a', '#ffd23a', 'CLASSIC'), ('SPICY TWIST', '#e0561b', '#2a2622', 'FLAMIN HOT'), ('BBQ BLAST', '#6e2a16', '#ffb03a', 'SMOKY'),
         ('CHEEZ PUFFS', '#f08a1c', '#1b5fc4', 'CHEESY'), ('SOUR CREAM', '#2f8a4a', '#f4efe2', '& ONION'), ('SALT & VINE', '#1b5fc4', '#f4efe2', 'ZESTY')]
CANDY = [('CHOCO BAR', '#6e3a1c', '#ffd23a'), ('GUMMY BEARS', '#d42c8a', '#ffffff'), ('SOUR STRIPS', '#2fae52', '#ffd23a'), ('PEANUT CUPS', '#e0561b', '#ffd23a')]
COOKIE = [('CHOC CHIP', '#1b4fa8', '#f4efe2'), ('OATMEAL', '#b8661a', '#f4efe2'), ('DOUBLE STUF', '#15131a', '#3fa0ff')]


def chips(i):
    t, base, acc, fl = CHIPS[i]
    W, H = 400 * SS, 560 * SS
    im = Image.new('RGB', (W, H), base); d = ImageDraw.Draw(im, 'RGBA')
    # crimped top and bottom seals
    for y0 in (0, H - 40 * SS):
        d.rectangle((0, y0, W, y0 + 40 * SS), fill='#00000030')
        for x in range(0, W, 16 * SS): d.line((x, y0, x, y0 + 40 * SS), fill='#ffffff40', width=3 * SS)
    # sunburst behind the chip pile
    cx, cy = W / 2, H * 0.62
    for k in range(0, 20, 2):
        a0, a1 = 2 * math.pi * k / 20, 2 * math.pi * (k + 1) / 20
        d.polygon([(cx, cy), (cx + 600 * SS * math.cos(a0), cy + 600 * SS * math.sin(a0)), (cx + 600 * SS * math.cos(a1), cy + 600 * SS * math.sin(a1))], fill='#ffffff22')
    for k, (dx, dy, r) in enumerate(((-70, 30, 70), (60, 10, 78), (0, 70, 84), (-20, -30, 60))):
        x, y = cx + dx * SS, cy + dy * SS
        d.ellipse((x - r * SS, y - r * 0.72 * SS, x + r * SS, y + r * 0.72 * SS), fill='#f0c040', outline=INK, width=5 * SS)
        d.arc((x - r * 0.6 * SS, y - r * 0.3 * SS, x + r * 0.5 * SS, y + r * 0.4 * SS), 200, 320, fill='#c8901a', width=4 * SS)
    words = t.split(' ')
    y = H * 0.17
    for w in words:
        f = fit(d, w, BLK, W - 50 * SS, 110 * SS)
        ct(d, (W / 2 + 5 * SS, y + 5 * SS), w, f, INK, 10 * SS, INK)
        ct(d, (W / 2, y), w, f, acc, 9 * SS, INK)
        y += f.size * 1.05
    d.rounded_rectangle((60 * SS, H * 0.84, W - 60 * SS, H * 0.84 + 56 * SS), radius=26 * SS, fill=INK)
    ct(d, (W / 2, H * 0.84 + 28 * SS), fl, fit(d, fl, BLK, W - 160 * SS, 36 * SS), '#ffffff')
    save(im, f'tk_snack_rack_chips{i}.png', (400, 560))


def candy(i):
    t, base, acc = CANDY[i]
    W, H = 300 * SS, 400 * SS
    im = Image.new('RGB', (W, H), base); d = ImageDraw.Draw(im, 'RGBA')
    d.rectangle((0, H * 0.62, W, H * 0.76), fill=acc)
    d.rectangle((0, H * 0.04, W, H * 0.1), fill='#ffffff60')
    words = t.split(' ')
    y = H * 0.28
    for w in words:
        f = fit(d, w, BLK, W - 30 * SS, 80 * SS)
        ct(d, (W / 2, y), w, f, '#ffffff', 7 * SS, INK)
        y += f.size * 1.05
    for k in range(3):
        x = W * (0.25 + 0.25 * k)
        d.ellipse((x - 26 * SS, H * 0.86 - 26 * SS, x + 26 * SS, H * 0.86 + 26 * SS), fill=acc, outline=INK, width=4 * SS)
    save(im, f'tk_snack_rack_candy{i}.png', (300, 400))


def cookie(i):
    t, base, acc = COOKIE[i]
    W, H = 560 * SS, 240 * SS
    im = Image.new('RGB', (W, H), base); d = ImageDraw.Draw(im, 'RGBA')
    for k in range(3):
        x, y = W * 0.68 + k * 46 * SS, H * 0.55
        d.ellipse((x - 70 * SS, y - 70 * SS, x + 70 * SS, y + 70 * SS), fill='#c8862e' if i != 2 else '#2a2026', outline=INK, width=5 * SS)
        for j in range(5):
            a = j * 1.3 + k
            d.ellipse((x + 40 * SS * math.cos(a) - 9 * SS, y + 40 * SS * math.sin(a) - 9 * SS, x + 40 * SS * math.cos(a) + 9 * SS, y + 40 * SS * math.sin(a) + 9 * SS), fill='#4a2a14' if i != 2 else '#f4efe2')
    ct(d, (W * 0.3 + 4 * SS, H * 0.42 + 4 * SS), t, fit(d, t, BLK, W * 0.52, 70 * SS), INK, 8 * SS, INK)
    ct(d, (W * 0.3, H * 0.42), t, fit(d, t, BLK, W * 0.52, 70 * SS), acc, 7 * SS, INK)
    ct(d, (W * 0.3, H * 0.75), 'COOKIES', font(BLK, 40 * SS), '#ffd23a', 4 * SS)
    save(im, f'tk_snack_rack_cookie{i}.png', (560, 240))


def pegbag(i):
    cols = [('#d42c8a', 'SOUR WORMS'), ('#1b5fc4', 'BLUE RASPBERRY'), ('#2fae52', 'APPLE RINGS')]
    base, t = cols[i]
    W, H = 260 * SS, 360 * SS
    im = Image.new('RGB', (W, H), base); d = ImageDraw.Draw(im, 'RGBA')
    d.rectangle((0, 0, W, 60 * SS), fill='#f4efe2'); d.ellipse((W / 2 - 18 * SS, 16 * SS, W / 2 + 18 * SS, 44 * SS), fill='#555')
    d.ellipse((40 * SS, 150 * SS, W - 40 * SS, H - 40 * SS), fill='#ffffff40', outline='#ffffff', width=5 * SS)
    words = t.split(' ')
    y = 110 * SS
    for w in words:
        f = fit(d, w, BLK, W - 30 * SS, 56 * SS)
        ct(d, (W / 2, y), w, f, '#ffd23a', 6 * SS, INK); y += f.size * 1.05
    for k in range(6):
        x, yy = 70 * SS + (k % 3) * 60 * SS, 240 * SS + (k // 3) * 50 * SS
        d.ellipse((x - 18 * SS, yy - 14 * SS, x + 18 * SS, yy + 14 * SS), fill=('#ffd23a', '#ff5a5a', '#7dff3a')[k % 3], outline=INK, width=3 * SS)
    save(im, f'tk_snack_rack_pegbag{i}.png', (260, 360))


def strip():
    W, H = 1160, 36
    rnd = random.Random(9)
    im = Image.new('RGB', (W, H), '#f2efe6'); d = ImageDraw.Draw(im)
    x = 14
    while x < W - 110:
        t = rnd.choice(('$1.99', '2/$4', '$3.49', '99c', '$4.29', '2/$3'))
        d.rectangle((x, 3, x + 96, H - 3), fill='#ffd23a' if rnd.random() < 0.7 else '#ff5a4a', outline=INK, width=2)
        ct(d, (x + 48, H / 2), t, font(BLK, 22), INK)
        x += rnd.randint(130, 200)
    save(im, 'tk_snack_rack_strip.png')


def pegboard():
    W, H = 1140, 1250
    im = Image.new('RGB', (W, H), '#c9c4b8'); d = ImageDraw.Draw(im)
    for y in range(12, H, 25):
        for x in range(12, W, 25):
            d.ellipse((x - 4, y - 4, x + 4, y + 4), fill='#5e5a52')
    save(im, 'tk_snack_rack_peg.png')


def header():
    W, H = 700 * SS, 180 * SS
    im = Image.new('RGB', (W, H), '#c41c2a'); d = ImageDraw.Draw(im, 'RGBA')
    d.rectangle((0, 0, W, 18 * SS), fill='#ffd23a'); d.rectangle((0, H - 18 * SS, W, H), fill='#ffd23a')
    ct(d, (W / 2 + 6 * SS, H / 2 + 6 * SS), 'SNACKS', font(BLK, 120 * SS), INK, 10 * SS, INK)
    ct(d, (W / 2, H / 2), 'SNACKS', font(BLK, 120 * SS), '#ffffff', 9 * SS, INK)
    for sx in (70 * SS, W - 70 * SS):
        d.ellipse((sx - 44 * SS, H / 2 - 32 * SS, sx + 44 * SS, H / 2 + 32 * SS), fill='#f0c040', outline=INK, width=5 * SS)
    save(im, 'tk_snack_rack_header.png', (700, 180))


def endcap():
    """Upright end panel: slotted grey metal with a taped-on promo poster."""
    W, H = 560 * SS, 1300 * SS
    im = Image.new('RGB', (W, H), '#7f8690'); d = ImageDraw.Draw(im, 'RGBA')
    for x in (40 * SS, W - 52 * SS):
        for y in range(40 * SS, H - 40 * SS, 50 * SS):
            d.rounded_rectangle((x, y, x + 12 * SS, y + 30 * SS), radius=5 * SS, fill='#3e434a')
    px0, py0, px1, py1 = 90 * SS, 180 * SS, W - 90 * SS, 820 * SS
    d.rectangle((px0 + 8 * SS, py0 + 8 * SS, px1 + 8 * SS, py1 + 8 * SS), fill='#00000050')
    d.rectangle((px0, py0, px1, py1), fill='#ffd23a', outline=INK, width=6 * SS)
    d.rectangle((px0, py0, px1, py0 + 150 * SS), fill='#c41c2a')
    ct(d, (W / 2, py0 + 75 * SS), 'BIG BAG', fit(d, 'BIG BAG', BLK, px1 - px0 - 40 * SS, 90 * SS), '#ffffff', 6 * SS)
    ct(d, (W / 2, py0 + 260 * SS), 'SALE!', fit(d, 'SALE!', BLK, px1 - px0 - 40 * SS, 120 * SS), '#c41c2a', 7 * SS)
    ct(d, (W / 2, py0 + 470 * SS), '2/$6', fit(d, '2/$6', BLK, px1 - px0 - 40 * SS, 170 * SS), INK)
    for x, a in ((px0 - 20 * SS, 18), (px1 - 70 * SS, -16)):
        t = Image.new('RGBA', (100 * SS, 30 * SS), '#e9dcae'); t = t.rotate(a, expand=True, resample=Image.BICUBIC)
        im.paste(t, (int(x), int(py0 - 25 * SS)), t)
    d = ImageDraw.Draw(im, 'RGBA')
    for _ in range(40):
        x, y = random.uniform(0, W), random.uniform(H * 0.75, H); l = random.uniform(20, 60) * SS
        d.line((x, y, x + l, y + random.uniform(-6, 6) * SS), fill=(30, 30, 30, 70), width=3 * SS)
    save(im, 'tk_snack_rack_endcap.png', (560, 1300))


if __name__ == '__main__':
    random.seed(4); endcap()
    for i in range(6): chips(i)
    for i in range(4): candy(i)
    for i in range(3): cookie(i)
    for i in range(3): pegbag(i)
    strip(); pegboard(); header()
