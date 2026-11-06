# tk_floor_lamp shade fabric, wrapped once round the drum (u = angle, 0.25 = the front; v = height, 0 = bottom):
# warm cream linen with vertical slubs, a brighter band at bulb height, darker near the rims, a stitched hem near
# each edge, the glued seam at the back and a little brown scorch mark near the top front-left.
#   .venv/Scripts/python.exe assets/props/tex/make_tk_floor_lamp.py
import os, random
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
R = random.Random(3)
Wd, Ht = 1280, 256
base = (236, 206, 150)
im = Image.new('RGB', (Wd, Ht), base)
px = im.load()
for y in range(Ht):
    v = 1 - y / (Ht - 1)                                   # 0 bottom .. 1 top
    band = max(0.0, 1 - abs(v - 0.42) / 0.42)              # bulb height glow
    edge = min(1.0, min(v, 1 - v) / 0.12)                  # darker toward the rims
    k = 0.86 + 0.14 * band
    k *= 0.9 + 0.1 * edge
    for x in range(Wd):
        n = R.randint(-4, 4)
        px[x, y] = tuple(max(0, min(255, int(c * k) + n)) for c in base)
# vertical linen slubs
d = ImageDraw.Draw(im)
for _ in range(260):
    x = R.randint(0, Wd - 1); y0 = R.randint(0, Ht - 40); ln = R.randint(20, 90)
    c = R.choice([(214, 182, 128), (246, 222, 172)])
    d.line([(x, y0), (x, y0 + ln)], fill=c, width=1)
im = im.filter(ImageFilter.GaussianBlur(0.7))
d = ImageDraw.Draw(im)
# stitched hems
for yy in (16, Ht - 17):
    for x in range(0, Wd, 14):
        d.line([(x, yy), (x + 8, yy)], fill=(176, 132, 84), width=2)
# glued seam at the back (u = 0.75)
sx = int(0.75 * Wd)
d.rectangle((sx - 3, 0, sx + 3, Ht), fill=(212, 178, 122))
d.line([(sx + 3, 0), (sx + 3, Ht)], fill=(190, 150, 100), width=1)
# scorch mark near the top, front-left (u ~ 0.19)
sc = Image.new('L', (Wd, Ht), 0)
ImageDraw.Draw(sc).ellipse((int(0.18 * Wd), 26, int(0.18 * Wd) + 46, 66), fill=255)
sc = sc.filter(ImageFilter.GaussianBlur(9))
im = Image.composite(Image.new('RGB', (Wd, Ht), (128, 96, 64)), im, sc.point(lambda a: int(a * 0.42)))
im.save(os.path.join(HERE, 'tk_floor_lamp_shade.png'))
print('tk_floor_lamp texture done')
