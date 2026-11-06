# Textures for tk_counter (TICKETS): front panel laminate with stripe + scuffs, stickers, counter-mat print, POS
# screen, customer pole display, keypad, card reader face, gum rows, jerky / lighter labels, the hand-written
# NO CHECKS note, the receipt strip.   Run: .venv/Scripts/python.exe assets/props/tex/make_tk_counter.py
import math, os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))
F = 'C:/Windows/Fonts/'
BLK, BOLD, HAND, IMPACT = F + 'ariblk.ttf', F + 'arialbd.ttf', F + 'segoeprb.ttf', F + 'impact.ttf'
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


def save(im, name, size=None):
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, name)); print('wrote', name, im.size)


def front():
    W, H = 2200, 855             # 1 px per mm; panel spans z 0.10 .. 0.955
    rnd = random.Random(2)
    im = Image.new('RGB', (W, H), '#8a1d22'); d = ImageDraw.Draw(im, 'RGBA')
    # laminate grain: faint vertical streaks
    for _ in range(900):
        x = rnd.uniform(0, W); w = rnd.uniform(1, 4); a = rnd.randint(10, 28)
        d.rectangle((x, 0, x + w, H), fill=(0, 0, 0, a) if rnd.random() < 0.5 else (255, 210, 200, a // 2))
    # panel grooves every 0.55 m
    for x in range(0, W + 1, 550):
        d.rectangle((x - 3, 0, x + 3, H), fill='#5e1216'); d.rectangle((x + 3, 0, x + 5, H), fill='#a8383c')
    # painted stripe: yellow band + white pinstripe + orange under-band
    y0 = H - 600
    d.rectangle((0, y0, W, y0 + 70), fill='#e3a514')
    d.rectangle((0, y0 + 84, W, y0 + 100), fill='#efe9da')
    d.rectangle((0, y0 + 112, W, y0 + 124), fill='#d4561c')
    # top edge shadow under the counter overhang
    for k in range(40):
        d.rectangle((0, k, W, k + 1), fill=(0, 0, 0, int(90 * (1 - k / 40))))
    # scuffs + shoe marks near the bottom, a few chips
    for _ in range(70):
        x = rnd.uniform(0, W); y = rnd.uniform(H - 170, H - 10); l = rnd.uniform(20, 90)
        d.line((x, y, x + l, y + rnd.uniform(-8, 8)), fill=(30, 20, 18, rnd.randint(50, 120)), width=rnd.randint(2, 5))
    for _ in range(25):
        x = rnd.uniform(0, W); y = rnd.uniform(H - 250, H - 20); l = rnd.uniform(10, 40)
        d.line((x, y, x + l, y + rnd.uniform(-4, 4)), fill=(240, 220, 210, rnd.randint(40, 90)), width=2)
    # a worn patch where knees and bags rub, below the stripe in the middle
    wear = Image.new('L', (W, H), 0); wd = ImageDraw.Draw(wear)
    wd.ellipse((700, 380, 1500, 760), fill=60); wear = wear.filter(ImageFilter.GaussianBlur(60))
    im = Image.composite(Image.new('RGB', (W, H), '#a5423e'), im, wear)
    save(im, 'tk_counter_front.png')


def sticker_camera():
    W, H = 400 * SS, 220 * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((6 * SS, 6 * SS, W - 6 * SS, H - 6 * SS), radius=18 * SS, fill='#ffd23a', outline=INK, width=6 * SS)
    # camera icon
    d.rounded_rectangle((30 * SS, 70 * SS, 130 * SS, 140 * SS), radius=10 * SS, fill=INK)
    d.polygon([(130 * SS, 90 * SS), (165 * SS, 70 * SS), (165 * SS, 140 * SS), (130 * SS, 120 * SS)], fill=INK)
    d.ellipse((60 * SS, 85 * SS, 100 * SS, 125 * SS), fill='#ffd23a')
    ct(d, (285 * SS, 70 * SS), 'SMILE!', fit(d, 'SMILE!', BLK, 200 * SS, 64 * SS), INK)
    ct(d, (285 * SS, 130 * SS), "YOU'RE ON", fit(d, "YOU'RE ON", BLK, 200 * SS, 36 * SS), INK)
    ct(d, (285 * SS, 170 * SS), 'CAMERA', fit(d, 'CAMERA', BLK, 200 * SS, 40 * SS), '#c41c2a')
    save(im, 'tk_counter_camera.png', (400, 220))


def sticker_lottery():
    W, H = 720 * SS, 360 * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((6 * SS, 6 * SS, W - 6 * SS, H - 6 * SS), radius=34 * SS, fill='#f4efe2', outline=INK, width=8 * SS)
    d.rounded_rectangle((26 * SS, 26 * SS, W - 26 * SS, H - 26 * SS), radius=24 * SS, fill='#1a3f9e')
    star(d, 110 * SS, H / 2, 74 * SS, 32 * SS, 5, '#ffd23a', INK, 5 * SS)
    ct(d, (W / 2 + 60 * SS, H / 2 - 62 * SS), 'LOTTERY', fit(d, 'LOTTERY', BLK, 440 * SS, 110 * SS), '#ffd23a', 6 * SS)
    ct(d, (W / 2 + 60 * SS, H / 2 + 62 * SS), 'SOLD HERE', fit(d, 'SOLD HERE', BLK, 440 * SS, 90 * SS), '#ffffff', 6 * SS)
    save(im, 'tk_counter_lottery.png', (720, 360))


def sticker_card():
    W, H = 360 * SS, 300 * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((6 * SS, 6 * SS, W - 6 * SS, H - 6 * SS), radius=20 * SS, fill='#f4efe2', outline=INK, width=6 * SS)
    d.rectangle((20 * SS, 20 * SS, W - 20 * SS, 120 * SS), fill='#c41c2a')
    ct(d, (W / 2, 72 * SS), 'WE CARD', fit(d, 'WE CARD', BLK, W - 60 * SS, 80 * SS), '#ffffff')
    ct(d, (W / 2, 170 * SS), 'UNDER 21?', fit(d, 'UNDER 21?', BLK, W - 60 * SS, 56 * SS), INK)
    ct(d, (W / 2, 235 * SS), 'NO SALE', fit(d, 'NO SALE', BLK, W - 60 * SS, 56 * SS), '#c41c2a')
    save(im, 'tk_counter_card.png', (360, 300))


def mat():
    W, H = 900 * SS, 420 * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((10 * SS, 10 * SS, W - 10 * SS, H - 10 * SS), radius=30 * SS, outline='#e3a514', width=10 * SS)
    ct(d, (W / 2, H / 2 - 40 * SS), 'THANK YOU!', fit(d, 'THANK YOU!', BLK, W - 160 * SS, 120 * SS), '#e3a514')
    ct(d, (W / 2, H / 2 + 70 * SS), 'COME AGAIN', fit(d, 'COME AGAIN', BLK, W - 360 * SS, 60 * SS), '#efe9da')
    for sx in (90 * SS, W - 90 * SS):
        star(d, sx, H / 2 + 70 * SS, 34 * SS, 14 * SS, 5, '#efe9da')
    save(im, 'tk_counter_mat.png', (900, 420))


def pos_screen():
    W, H = 600, 440
    im = Image.new('RGB', (W, H), '#0d2240'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 44), fill='#1f6fd1'); ct(d, (W / 2, 22), 'REGISTER 1   OPEN', font(BLK, 24), '#ffffff')
    rows = [('LOTTERY  $5', '5.00'), ('LOTTERY  $10', '10.00'), ('GAS PUMP 3', '40.00'), ('BEEF JERKY', '0.99')]
    for k, (a, b) in enumerate(rows):
        y = 70 + k * 40
        d.text((24, y), a, font=font(BOLD, 24), fill='#d8e6ff'); d.text((W - 24, y), b, font=font(BOLD, 24), fill='#d8e6ff', anchor='ra')
    d.rectangle((16, 240, W - 16, 300), fill='#12345e')
    d.text((28, 252), 'TOTAL', font=font(BLK, 32), fill='#ffd23a'); d.text((W - 28, 252), '$55.99', font=font(BLK, 32), fill='#ffd23a', anchor='ra')
    for k, (t, c) in enumerate((('CASH', '#2fae52'), ('CARD', '#1f6fd1'), ('LOTTO', '#d42c8a'), ('VOID', '#c41c2a'))):
        x0 = 16 + k * 146
        d.rounded_rectangle((x0, 320, x0 + 134, 420), radius=10, fill=c); ct(d, (x0 + 67, 370), t, font(BLK, 26), '#ffffff')
    save(im, 'tk_counter_pos.png')


def pole():
    W, H = 440, 140
    im = Image.new('RGB', (W, H), '#06160f'); d = ImageDraw.Draw(im)
    halo = Image.new('RGB', (W, H), '#06160f'); hd = ImageDraw.Draw(halo)
    ct(hd, (W / 2, H / 2), 'READY', font(BLK, 76), '#3dff8c'); halo = halo.filter(ImageFilter.GaussianBlur(6))
    d = ImageDraw.Draw(halo); ct(d, (W / 2, H / 2), 'READY', font(BLK, 76), '#c8ffd8')
    for x in range(0, W, 6): d.line((x, 0, x, H), fill='#06160f', width=1)
    save(halo, 'tk_counter_pole.png')


def keypad():
    W, H = 600, 280
    im = Image.new('RGB', (W, H), '#3a3d44'); d = ImageDraw.Draw(im)
    for r in range(4):
        for c in range(10):
            x0, y0 = 14 + c * 58, 14 + r * 66
            col = '#d8d4c8' if c < 7 else ('#c41c2a' if r == 3 else '#2fae52' if r == 2 else '#e3a514')
            d.rounded_rectangle((x0, y0, x0 + 50, y0 + 56), radius=8, fill=col, outline='#1d1712', width=3)
            if c < 7: ct(d, (x0 + 25, y0 + 28), '789456123.00'[(r * 3 + c) % 12], font(BLK, 26), '#3a3d44')
    save(im, 'tk_counter_keypad.png')


def reader():
    W, H = 300, 500
    im = Image.new('RGB', (W, H), '#25272c'); d = ImageDraw.Draw(im)
    d.rounded_rectangle((24, 24, W - 24, 200), radius=12, fill='#0e2a44', outline='#4a4e57', width=4)
    ct(d, (W / 2, 76), 'INSERT', font(BLK, 40), '#7fd4ff'); ct(d, (W / 2, 130), 'OR TAP', font(BLK, 40), '#7fd4ff')
    d.arc((W / 2 - 30, 150, W / 2 + 30, 196), 200, 340, fill='#7fd4ff', width=5)
    for r in range(4):
        for c in range(3):
            x0, y0 = 40 + c * 76, 228 + r * 64
            col = '#c41c2a' if (r == 3 and c == 0) else '#2fae52' if (r == 3 and c == 2) else '#c9c6bd'
            d.rounded_rectangle((x0, y0, x0 + 64, y0 + 52), radius=8, fill=col, outline='#111', width=3)
            ct(d, (x0 + 32, y0 + 26), 'X0O'[c] if r == 3 else str(r * 3 + c + 1), font(BLK, 26), '#25272c')
    save(im, 'tk_counter_reader.png')


def gum(k):
    W, H = 720, 170
    rnd = random.Random(k)
    im = Image.new('RGB', (W, H), '#15131a'); d = ImageDraw.Draw(im)
    names = [('MINT', '#1fa37a'), ('FRUIT', '#e0561b'), ('BUBBLE', '#d42c8a'), ('COOL', '#1b5fc4'), ('SPEAR', '#23883a'), ('CINN', '#c41c35'), ('WHITE', '#5ab0e0')]
    rnd.shuffle(names)
    for i in range(5):
        n, c = names[i]
        x0 = 6 + i * 143
        d.rounded_rectangle((x0, 4, x0 + 135, H - 4), radius=10, fill=c, outline=INK, width=4)
        d.rectangle((x0 + 4, 52, x0 + 131, 96), fill='#f4efe2')
        ct(d, (x0 + 68, 74), n, fit(d, n, BLK, 118, 36), c)
        ct(d, (x0 + 68, 28), 'GUM', font(BLK, 30), '#ffffff')
        d.ellipse((x0 + 50, 110, x0 + 86, 146), fill='#ffffff'); ct(d, (x0 + 68, 128), '15', font(BLK, 18), c)
    save(im, f'tk_counter_gum{k}.png')


def label(name, lines, bg, fg, size=(400, 200)):
    W, H = size[0] * SS, size[1] * SS
    im = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(im)
    d.rectangle((8 * SS, 8 * SS, W - 8 * SS, H - 8 * SS), outline=fg, width=6 * SS)
    n = len(lines)
    for k, (t, px, c) in enumerate(lines):
        ct(d, (W / 2, H * (k + 0.5) / n), t, fit(d, t, BLK, W - 50 * SS, px * SS), c or fg, 4 * SS, INK)
    save(im, name, size)


def nochecks():
    W, H = 420 * SS, 280 * SS
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    pg = Image.new('RGBA', (W - 40 * SS, H - 60 * SS), '#f6f0d8'); pd = ImageDraw.Draw(pg)
    for y in range(40 * SS, pg.size[1], 34 * SS): pd.line((0, y, pg.size[0], y), fill='#a8c4e0', width=2 * SS)
    pd.line((40 * SS, 0, 40 * SS, pg.size[1]), fill='#e09090', width=2 * SS)
    ct(pd, (pg.size[0] / 2 + 10 * SS, pg.size[1] * 0.36), 'NO', font(HAND, 96 * SS), '#1a1a8a')
    ct(pd, (pg.size[0] / 2 + 10 * SS, pg.size[1] * 0.74), 'CHECKS!!', font(HAND, 74 * SS), '#1a1a8a')
    pd.line((60 * SS, pg.size[1] * 0.92, pg.size[0] - 40 * SS, pg.size[1] * 0.9), fill='#1a1a8a', width=5 * SS)
    pg = pg.rotate(-3, expand=True, resample=Image.BICUBIC)
    im.paste(pg, (14 * SS, 26 * SS), pg)
    for x, a in ((30 * SS, -12), (W - 120 * SS, 10)):          # two bits of masking tape
        t = Image.new('RGBA', (100 * SS, 34 * SS), '#e9dcae'); t = t.rotate(a, expand=True, resample=Image.BICUBIC)
        im.paste(t, (x, 4 * SS), t)
    save(im, 'tk_counter_nochecks.png', (420, 280))


def receipt():
    W, H = 160, 300
    rnd = random.Random(4)
    im = Image.new('RGB', (W, H), '#f4f1ea'); d = ImageDraw.Draw(im)
    ct(d, (W / 2, 22), 'GAS & GO', font(BLK, 22), '#3a3530')
    for y in range(52, H - 30, 18):
        w = rnd.uniform(40, 120); d.rectangle((14, y, 14 + w, y + 7), fill='#8f8a80')
        d.rectangle((W - 44, y, W - 14, y + 7), fill='#8f8a80')
    save(im, 'tk_counter_receipt.png')


def bags():
    W, H = 300, 200
    im = Image.new('RGB', (W, H), '#ece9e0'); d = ImageDraw.Draw(im)
    for y in range(0, H, 9): d.line((0, y, W, y), fill='#d6d2c6', width=2)
    ct(d, (W / 2, H / 2 - 18), 'THANK', font(BLK, 46), '#c41c2a'); ct(d, (W / 2, H / 2 + 30), 'YOU', font(BLK, 46), '#c41c2a')
    save(im, 'tk_counter_bags.png')


def safe():
    W, H = 300, 300
    im = Image.new('RGB', (W, H), '#4a4f57'); d = ImageDraw.Draw(im)
    d.rectangle((10, 10, W - 10, H - 10), outline='#2a2d33', width=6)
    d.rounded_rectangle((40, 40, 160, 100), radius=6, fill='#0e2a44'); ct(d, (100, 70), '- - - -', font(BLK, 26), '#3dff8c')
    for r in range(4):
        for c in range(3):
            d.rounded_rectangle((40 + c * 40, 120 + r * 40, 72 + c * 40, 150 + r * 40), radius=4, fill='#c9c6bd')
    d.rectangle((190, 40, W - 40, 90), fill='#2a2d33'); ct(d, ((190 + W - 40) / 2, 65), 'DROP', font(BLK, 24), '#e3a514')
    d.rectangle((190, 110, W - 40, 122), fill='#15161a')
    ct(d, (W / 2 + 70, H - 50), 'CLERK HAS NO', font(BOLD, 15), '#e3a514'); ct(d, (W / 2 + 70, H - 30), 'ACCESS TO SAFE', font(BOLD, 15), '#e3a514')
    save(im, 'tk_counter_safe.png')


if __name__ == '__main__':
    front(); sticker_lottery(); sticker_card(); sticker_camera(); mat(); pos_screen(); pole(); keypad(); reader()
    for k in range(3): gum(k)
    label('tk_counter_jerky.png', [('BEEF JERKY', 56, '#ffffff'), ('2 for $1', 64, '#ffd23a')], '#8e1f1c', '#ffd23a')
    label('tk_counter_lighters.png', [('LIGHTERS', 56, '#ffffff'), ('2 / $3', 64, '#ffd23a')], '#1b5fc4', '#ffd23a')
    label('tk_counter_penny.png', [('TAKE A PENNY', 40, '#1d1712'), ('LEAVE A PENNY', 40, '#c41c2a')], '#f4efe2', '#1d1712', (400, 140))
    nochecks(); receipt(); bags(); safe()
