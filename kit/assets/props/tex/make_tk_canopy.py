# Textures for tk_canopy (TICKETS, exterior at dusk): the "GAS & GO" fascia (front/back + sides), the price sign
# (brand + 3 LED price rows), pump faces (brand header, screen, grade buttons), the pump door decal.
# Run: .venv/Scripts/python.exe assets/props/tex/make_tk_canopy.py
import math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))
F = 'C:/Windows/Fonts/'
BLK, BOLD = F + 'ariblk.ttf', F + 'arialbd.ttf'
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


def glowtext(im, xy, txt, f, core, halo, blur, stroke=0):
    lay = Image.new('RGB', im.size, (0, 0, 0)); ld = ImageDraw.Draw(lay)
    ct(ld, xy, txt, f, halo, stroke + 6, halo)
    lay = lay.filter(ImageFilter.GaussianBlur(blur))
    im = Image.composite(lay, im, lay.convert('L').point(lambda v: min(255, v * 2)))
    d = ImageDraw.Draw(im); ct(d, xy, txt, f, core, stroke, halo)
    return im


def save(im, name): im.save(os.path.join(OUT, name)); print('wrote', name, im.size)


def fascia():
    W, H = 3040, 200          # 7.6 x 0.5 m
    im = Image.new('RGB', (W, H), '#e8e4da'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 34), fill='#c41c2a'); d.rectangle((0, H - 46, W, H), fill='#c41c2a')
    d.rectangle((0, 34, W, 44), fill='#1250b0')
    # logo box in the middle
    d.rounded_rectangle((W / 2 - 520, 22, W / 2 + 520, H - 18), radius=30, fill='#c41c2a', outline=INK, width=8)
    im = glowtext(im, (W / 2, H / 2 + 2), 'GAS & GO', font(BLK, 120), '#fff6d8', '#ffd23a', 10, 2)
    d = ImageDraw.Draw(im)
    for sx in (W * 0.16, W * 0.84):
        d.ellipse((sx - 60, H / 2 - 56, sx + 60, H / 2 + 64), fill='#ffd23a', outline=INK, width=6)
        ct(d, (sx, H / 2 + 4), 'G', font(BLK, 80), '#c41c2a')
    save(im, 'tk_canopy_fascia.png')


def fascia_side():
    W, H = 1760, 200          # 4.4 x 0.5 m
    im = Image.new('RGB', (W, H), '#e8e4da'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 34), fill='#c41c2a'); d.rectangle((0, H - 46, W, H), fill='#c41c2a')
    d.rectangle((0, 34, W, 44), fill='#1250b0')
    ct(d, (W / 2, H / 2 + 2), 'OPEN 24 HOURS', font(BLK, 86), '#1250b0', 4, '#e8e4da')
    save(im, 'tk_canopy_side.png')


def price_sign():
    W, H = 800, 1100
    im = Image.new('RGB', (W, H), '#15131a'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 300), fill='#c41c2a'); d.rectangle((0, 296, W, 312), fill='#ffd23a')
    im = glowtext(im, (W / 2, 120), 'GAS & GO', fit(d, 'GAS & GO', BLK, W - 80, 150), '#fff6d8', '#ffd23a', 10, 2)
    d = ImageDraw.Draw(im)
    ct(d, (W / 2, 240), 'OPEN 24 HRS', font(BLK, 54), '#ffd23a')
    rows = [('REGULAR', '3.49', '#ff6a1c'), ('PLUS', '3.79', '#ff6a1c'), ('DIESEL', '3.99', '#3dff8c')]
    for k, (lab, p, c) in enumerate(rows):
        y0 = 340 + k * 250
        d.rectangle((24, y0, W - 24, y0 + 226), fill='#08070a', outline='#3a3a44', width=6)
        ct(d, (W / 2, y0 + 30), lab, font(BLK, 40), '#e8e4da')
        im = glowtext(im, (W / 2 - 30, y0 + 136), p, font(BLK, 150), '#ffe0c8' if c != '#3dff8c' else '#d8ffe6', c, 9)
        d = ImageDraw.Draw(im)
        im = glowtext(im, (W - 90, y0 + 92), '9', font(BLK, 64), '#ffe0c8' if c != '#3dff8c' else '#d8ffe6', c, 6)
        d = ImageDraw.Draw(im)
        for x in range(30, W - 30, 7): d.line((x, y0 + 64, x, y0 + 218), fill='#08070a', width=1)   # LED grid
    save(im, 'tk_canopy_price.png')


def pump_head():
    W, H = 800, 280
    im = Image.new('RGB', (W, H), '#c41c2a'); d = ImageDraw.Draw(im)
    d.rectangle((0, H - 30, W, H), fill='#ffd23a')
    im = glowtext(im, (W / 2, H / 2 - 8), 'GAS & GO', fit(d, 'GAS & GO', BLK, W - 80, 140), '#fff6d8', '#ffd23a', 8, 2)
    save(im, 'tk_canopy_pumphead.png')


def pump_screen():
    W, H = 400, 300
    im = Image.new('RGB', (W, H), '#0a1d33'); d = ImageDraw.Draw(im)
    d.rectangle((10, 10, W - 10, 140), fill='#0e2a44'); ct(d, (W / 2, 50), '$ 40.00', font(BLK, 56), '#7fd4ff')
    ct(d, (W / 2, 112), '11.46 GAL', font(BLK, 40), '#7fd4ff')
    for k, (t, c) in enumerate((('87', '#2fae52'), ('89', '#1f7fe0'), ('93', '#d42c8a'))):
        x0 = 20 + k * 126
        d.rounded_rectangle((x0, 170, x0 + 110, 280), radius=10, fill=c, outline='#ffffff', width=4)
        ct(d, (x0 + 55, 225), t, font(BLK, 50), '#ffffff')
    save(im, 'tk_canopy_pumpscreen.png')


def pump_door():
    W, H = 600, 700
    im = Image.new('RGB', (W, H), '#e2ded4'); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 90), fill='#1250b0'); ct(d, (W / 2, 45), 'PAY AT PUMP', font(BLK, 50), '#ffffff')
    d.rounded_rectangle((60, 140, W - 60, 300), radius=16, fill='#2a2d33'); ct(d, (W / 2, 220), 'INSERT CARD', font(BLK, 40), '#7fd4ff')
    for r in range(3):
        for c in range(4):
            d.rounded_rectangle((90 + c * 110, 340 + r * 90, 170 + c * 110, 410 + r * 90), radius=10, fill='#c9c6bd', outline=INK, width=3)
    d.rectangle((0, H - 80, W, H), fill='#c41c2a'); ct(d, (W / 2, H - 40), 'NO SMOKING', font(BLK, 44), '#ffffff')
    save(im, 'tk_canopy_pumpdoor.png')


if __name__ == '__main__':
    fascia(); fascia_side(); price_sign(); pump_head(); pump_screen(); pump_door()
