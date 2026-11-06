# tk_couch prints: neutral (white-based) fabric maps that the couch multiplies by its colour (seat L = his worn spot,
# seat R = a coffee ring, back = the greasy head-rest patch), a hand-cut plaid patch over a tear (alpha), the crocheted
# granny-square throw, and a scratch card wedged between the cushions.
#   .venv/Scripts/python.exe assets/props/tex/make_tk_couch.py
import os, random, math
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FB = 'C:/Windows/Fonts/ariblk.ttf'
FA = 'C:/Windows/Fonts/arialbd.ttf'
R = random.Random(7)


def weave(n):
    """White fabric with a fine woven texture and soft mottling (multiplied by the couch colour)."""
    im = Image.new('L', (n, n), 246)
    px = im.load()
    for y in range(n):
        for x in range(n):
            v = 246 + (5 if ((x // 2 + y // 2) % 2) else -4) + R.randint(-3, 3)
            px[x, y] = max(0, min(255, v))
    mot = Image.effect_noise((n // 8, n // 8), 40).resize((n, n), Image.BICUBIC)
    im = Image.blend(im, Image.eval(mot, lambda v: 236 + (v - 128) // 14), 0.35)
    return im.convert('RGB')


def blob(im, box, shade, blur):
    """Darken an elliptical area (multiply) with soft edges."""
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).ellipse(box, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    dark = Image.new('RGB', im.size, shade)
    from PIL import ImageChops
    mul = ImageChops.multiply(im, dark)
    return Image.composite(mul, im, m)


N = 512
# seat L (UV from the top: image bottom = cushion front): his spot, worn darker + shiny edges
s = weave(N)
s = blob(s, (110, 230, 400, 470), (222, 216, 208), 40)
s = blob(s, (170, 290, 340, 430), (226, 220, 212), 18)
s.save(os.path.join(HERE, 'tk_couch_seatL.png'))
# seat R: lighter wear + a coffee ring + a little cigarette-burn-like dark fleck
s = weave(N)
s = blob(s, (140, 260, 380, 460), (230, 225, 218), 36)
from PIL import ImageChops
ring = Image.new('L', (N, N), 0)
d = ImageDraw.Draw(ring)
d.ellipse((318, 330, 402, 408), outline=255, width=7)
d.arc((312, 326, 408, 414), 200, 330, fill=200, width=4)
ring = ring.filter(ImageFilter.GaussianBlur(1.4))
s = Image.composite(ImageChops.multiply(s, Image.new('RGB', (N, N), (150, 112, 78))), s, ring)
s = blob(s, (150, 150, 168, 164), (110, 90, 70), 2)
s.save(os.path.join(HERE, 'tk_couch_seatR.png'))
# back cushions (UV from the front: image top = cushion top): greasy head-rest patch near the top
s = weave(N)
s = blob(s, (120, 40, 392, 230), (224, 218, 210), 38)
s.save(os.path.join(HERE, 'tk_couch_back.png'))

# patch over a tear: hand-cut plaid square with big white stitches (alpha cut-out)
P = 256
pl = Image.new('RGB', (P, P), (40, 58, 110))
d = ImageDraw.Draw(pl)
for k in range(-2, 6):
    x = 18 + k * 56
    d.rectangle((x, 0, x + 22, P), fill=(170, 44, 38))
    d.rectangle((0, x, P, x + 22), fill=(150, 40, 36))
    d.rectangle((x + 34, 0, x + 37, P), fill=(232, 190, 70))
    d.rectangle((0, x + 34, P, x + 37), fill=(232, 190, 70))
pl = pl.convert('RGBA')
mask = Image.new('L', (P, P), 0)
poly = [(14, 22), (120, 10), (238, 18), (246, 130), (236, 240), (130, 246), (20, 236), (10, 120)]
ImageDraw.Draw(mask).polygon(poly, fill=255)
pl.putalpha(mask)
d = ImageDraw.Draw(pl)
d.line(poly + [poly[0]], fill=(25, 22, 30, 255), width=5)
# stitches: short white dashes across the edge, inset
for (a, b) in zip(poly, poly[1:] + poly[:1]):
    for i in range(1, 6):
        t = i / 6
        x = a[0] + (b[0] - a[0]) * t; y = a[1] + (b[1] - a[1]) * t
        cx, cy = 128, 128
        vx, vy = cx - x, cy - y; L = math.hypot(vx, vy); vx, vy = vx / L, vy / L
        d.line([(x + vx * 6, y + vy * 6), (x + vx * 26, y + vy * 26)], fill=(244, 238, 220, 255), width=6)
pl.save(os.path.join(HERE, 'tk_couch_patch.png'))

# crocheted throw: granny squares (7 along the drape x 5 across), joined with cream, holes as dots
SQ = 100
cols, rows = 7, 5
pal = [(40, 140, 134), (196, 62, 46), (120, 58, 112), (226, 160, 60), (226, 120, 140), (64, 104, 170), (238, 226, 196)]
bl = Image.new('RGB', (cols * SQ, rows * SQ), (236, 226, 198))
d = ImageDraw.Draw(bl)
for j in range(rows):
    for i in range(cols):
        x0, y0 = i * SQ, j * SQ
        cs = R.sample(pal[:6], 3)
        d.rectangle((x0 + 4, y0 + 4, x0 + SQ - 5, y0 + SQ - 5), fill=(236, 226, 198))
        for k, c in enumerate(cs):
            m = 10 + k * 13
            d.rectangle((x0 + m, y0 + m, x0 + SQ - m - 1, y0 + SQ - m - 1), fill=c)
        d.ellipse((x0 + 44, y0 + 44, x0 + 56, y0 + 56), fill=(58, 44, 40))
        # crochet holes: dark dots on each round, corner chains
        for k in range(3):
            m = 10 + k * 13 + 6
            for q in range(4):
                t = (q + 0.5) / 4
                for (px_, py_) in ((x0 + m + (SQ - 2 * m) * t, y0 + m), (x0 + m + (SQ - 2 * m) * t, y0 + SQ - m),
                                   (x0 + m, y0 + m + (SQ - 2 * m) * t), (x0 + SQ - m, y0 + m + (SQ - 2 * m) * t)):
                    d.ellipse((px_ - 2.5, py_ - 2.5, px_ + 2.5, py_ + 2.5), fill=(70, 52, 46))
        d.rectangle((x0 + 2, y0 + 2, x0 + SQ - 3, y0 + SQ - 3), outline=(150, 132, 104), width=2)
bl = bl.filter(ImageFilter.GaussianBlur(0.6))
bl.save(os.path.join(HERE, 'tk_couch_throw.png'))

# scratch card wedged between the cushions (2:3), half scratched
C = Image.new('RGB', (200, 300), (230, 60, 50))
d = ImageDraw.Draw(C)
d.rectangle((0, 0, 199, 299), outline=(40, 30, 30), width=6)
d.rectangle((10, 10, 189, 86), fill=(250, 210, 60))
f = ImageFont.truetype(FB, 44)
bb = d.textbbox((0, 0), 'LUCKY', font=f); d.text((100 - (bb[2] - bb[0]) / 2 - bb[0], 16 - bb[1]), 'LUCKY', font=f, fill=(170, 30, 30))
f2 = ImageFont.truetype(FB, 30)
bb = d.textbbox((0, 0), '7s', font=f2); d.text((100 - (bb[2] - bb[0]) / 2 - bb[0], 60 - bb[1]), '7s', font=f2, fill=(170, 30, 30))
for j in range(3):
    for i in range(3):
        x0, y0 = 18 + i * 58, 100 + j * 58
        scratched = R.random() < 0.55
        d.rounded_rectangle((x0, y0, x0 + 48, y0 + 48), radius=8, fill=(246, 240, 228) if scratched else (176, 180, 188))
        if scratched:
            f3 = ImageFont.truetype(FB, 30)
            t = R.choice(['7', '$', '3', '7'])
            bb = d.textbbox((0, 0), t, font=f3); d.text((x0 + 24 - (bb[2] - bb[0]) / 2 - bb[0], y0 + 24 - (bb[3] - bb[1]) / 2 - bb[1]), t, font=f3, fill=(40, 40, 120))
        else:
            for _ in range(5):
                a = R.randint(x0 + 4, x0 + 44); b = R.randint(y0 + 4, y0 + 44)
                d.line([(a, b), (a + 6, b + 2)], fill=(206, 210, 216), width=2)
C.save(os.path.join(HERE, 'tk_couch_card.png'))
print('tk_couch textures done')
