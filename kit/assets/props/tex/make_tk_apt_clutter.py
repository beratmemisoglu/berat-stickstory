# tk_apt_clutter prints: the pizza box inside (greasy floor with the ghost rings of the eaten slices + crumbs), the
# lid's inside (grease spots + the shop's red stamp), the takeout carton's red pagoda print, can wraps (FIZZ cola,
# LIME soda, VOLT energy drink; logos face the front at u = 0.25 and repeat at the back) and the LUCKY mug wrap.
#   .venv/Scripts/python.exe assets/props/tex/make_tk_apt_clutter.py
import os, random, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FB, FA = 'C:/Windows/Fonts/ariblk.ttf', 'C:/Windows/Fonts/arialbd.ttf'
R = random.Random(5)
KRAFT = (200, 156, 100)


def kraft(n):
    im = Image.new('RGB', (n, n), KRAFT)
    nz = Image.effect_noise((n, n), 18).convert('L')
    im = Image.composite(Image.new('RGB', (n, n), (186, 142, 88)), im, nz.point(lambda v: 90 if v > 140 else 0))
    return im.filter(ImageFilter.GaussianBlur(0.8))


def grease(im, box, a=150):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).ellipse(box, fill=a)
    m = m.filter(ImageFilter.GaussianBlur(10))
    return Image.composite(Image.new('RGB', im.size, (150, 98, 46)), im, m)


def ctext(d, cx, cy, t, f, fill):
    bb = d.textbbox((0, 0), t, font=f); d.text((cx - (bb[2] - bb[0]) / 2 - bb[0], cy - (bb[3] - bb[1]) / 2 - bb[1]), t, font=f, fill=fill)


# ---- pizza box floor: the eaten slices left a greasy ring, crumbs, a basil leaf
N = 512
im = kraft(N)
m = Image.new('L', (N, N), 0)
ImageDraw.Draw(m).ellipse((40, 40, 472, 472), fill=120)
ImageDraw.Draw(m).ellipse((90, 90, 422, 422), fill=40)
m = m.filter(ImageFilter.GaussianBlur(18))
im = Image.composite(Image.new('RGB', (N, N), (160, 104, 50)), im, m)
for b in ((150, 120, 230, 190), (300, 300, 380, 360), (330, 120, 400, 170)):
    im = grease(im, b, 170)
d = ImageDraw.Draw(im)
for _ in range(60):
    x, y = R.randint(70, 440), R.randint(70, 440); r = R.randint(3, 7)
    d.ellipse((x - r, y - r, x + r, y + r), fill=R.choice([(214, 160, 80), (190, 130, 60), (230, 190, 110)]))
d.ellipse((340, 230, 372, 250), fill=(60, 120, 50))
im.save(os.path.join(HERE, 'tk_apt_clutter_pizzain.png'))

# ---- lid inside: grease + red stamp "TONY'S / HOT N' FRESH"
im = kraft(N)
for b in ((80, 300, 200, 400), (300, 360, 400, 440), (360, 80, 440, 150)):
    im = grease(im, b, 150)
d = ImageDraw.Draw(im)
red = (186, 40, 34)
d.ellipse((136, 96, 376, 336), outline=red, width=12)
ctext(d, 256, 180, "TONY'S", ImageFont.truetype(FB, 58), red)
ctext(d, 256, 250, 'PIZZA', ImageFont.truetype(FB, 46), red)
ctext(d, 256, 400, "HOT N' FRESH!", ImageFont.truetype(FB, 40), red)
# (no flip: the open lid's inside faces -Y with the picture upright)
im.save(os.path.join(HERE, 'tk_apt_clutter_lidin.png'))

# ---- takeout carton print (white, red pagoda + THANK YOU)
im = Image.new('RGB', (256, 256), (240, 236, 226))
d = ImageDraw.Draw(im)
red = (200, 40, 36)
cx = 128
for k, (w, y) in enumerate(((150, 70), (120, 112), (92, 150))):
    d.polygon([(cx - w / 2 - 16, y + 12), (cx, y - 18), (cx + w / 2 + 16, y + 12)], fill=red)
    d.rectangle((cx - w / 2 + 14, y + 12, cx + w / 2 - 14, y + 34), fill=red)
    d.rectangle((cx - w / 2 + 30, y + 16, cx + w / 2 - 30, y + 30), fill=(240, 236, 226))
ctext(d, cx, 214, 'THANK YOU', ImageFont.truetype(FB, 30), red)
im.save(os.path.join(HERE, 'tk_apt_clutter_carton.png'))


# ---- can wraps (512 x 300 = once round a 0.033 m can, 0.122 m tall); logos at u = 0.25 (front) and 0.75
def can(fn, bg, stripe, logo, lcol, sub, energy=False):
    W, H = 512, 300
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)
    if energy:
        for k in range(-3, 12):
            x = k * 60
            d.polygon([(x, H), (x + 30, H), (x + 110, 0), (x + 80, 0)], fill=(30, 32, 36))
    else:
        for x in range(W):
            y = H * 0.66 + 18 * math.sin(x / W * 4 * math.pi)
            d.line([(x, y), (x, y + 26)], fill=stripe)
    for u in (0.25, 0.75):
        cx = int(u * W)
        if energy:
            d.polygon([(cx + 10, 40), (cx - 34, 150), (cx - 4, 150), (cx - 20, 250), (cx + 36, 120), (cx + 6, 120), (cx + 26, 40)], fill=stripe)
            ctext(d, cx, 274, logo, ImageFont.truetype(FB, 34), lcol)
        else:
            ctext(d, cx, 110, logo, ImageFont.truetype(FB, 64), lcol)
            ctext(d, cx, 160, sub, ImageFont.truetype(FA, 22), lcol)
    d.rectangle((0, 0, W, 10), fill=(150, 152, 156)); d.rectangle((0, H - 10, W, H), fill=(150, 152, 156))
    im.save(os.path.join(HERE, fn))


can('tk_apt_clutter_cola.png', (192, 30, 34), (245, 240, 232), 'FIZZ', (250, 246, 238), 'CLASSIC COLA')
can('tk_apt_clutter_lime.png', (58, 160, 60), (240, 222, 70), 'LIME', (250, 248, 236), 'LEMON - LIME')
can('tk_apt_clutter_volt.png', (20, 22, 26), (120, 250, 60), 'VOLT', (120, 250, 60), '', energy=True)

# ---- mug wrap (512 x 200 = round a 0.042 m mug, 0.08 m print band): green clover + LUCKY, front at u = 0.25
W, H = 512, 200
im = Image.new('RGB', (W, H), (236, 232, 222))
d = ImageDraw.Draw(im)
for u in (0.25, 0.75):                     # front, and again on the back
    cx, cy = int(u * W), 50
    g = (40, 150, 70)
    d.line([(cx, cy), (cx + 8, cy + 34)], fill=g, width=6)
    for a in range(4):
        t = a * math.pi / 2 + math.pi / 4
        x, y = cx + 15 * math.cos(t), cy + 15 * math.sin(t)
        d.ellipse((x - 16, y - 16, x + 16, y + 16), fill=g)
    ctext(d, cx, 116, 'LUCKY', ImageFont.truetype(FB, 32), (40, 120, 60))
    ctext(d, cx, 158, 'ME!', ImageFont.truetype(FB, 32), (200, 60, 40))
im.save(os.path.join(HERE, 'tk_apt_clutter_mug.png'))
print('tk_apt_clutter textures done')
