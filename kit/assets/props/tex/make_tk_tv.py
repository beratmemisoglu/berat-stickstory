# tk_tv prints: the default screen picture (a late-night talk show: bright blue / teal studio, a night-city backdrop
# with a big moon, the host's silhouette behind a curved desk with a mug, a guest couch, a LIVE bug and a lower third,
# CRT scanlines + vignette + a soft glow), the brand badge under the screen, and the console's front label.
#   .venv/Scripts/python.exe assets/props/tex/make_tk_tv.py
import os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
FB, FA = 'C:/Windows/Fonts/ariblk.ttf', 'C:/Windows/Fonts/arialbd.ttf'
R = random.Random(11)
S = 2
W, H = 640 * S, 480 * S
im = Image.new('RGB', (W, H), (20, 60, 140))
d = ImageDraw.Draw(im)
# studio backdrop: vertical gradient deep blue -> teal
for y in range(H):
    k = y / H
    c = (int(18 + 20 * k), int(70 + 90 * k), int(150 + 40 * k))
    d.line([(0, y), (W, y)], fill=c)
# big moon + night skyline backdrop
d.ellipse((90 * S, 40 * S, 210 * S, 160 * S), fill=(236, 240, 255))
d.ellipse((110 * S, 70 * S, 136 * S, 92 * S), fill=(210, 218, 240))
d.ellipse((160 * S, 110 * S, 176 * S, 124 * S), fill=(214, 222, 242))
x = 0
while x < W:
    bw = R.randint(34, 70) * S; bh = R.randint(90, 210) * S
    top = int(H * 0.62) - bh
    d.rectangle((x, top, x + bw, int(H * 0.62)), fill=(26, 52, 110))
    for wy in range(top + 10 * S, int(H * 0.62) - 8 * S, 16 * S):
        for wx in range(x + 6 * S, x + bw - 8 * S, 12 * S):
            if R.random() < 0.45:
                d.rectangle((wx, wy, wx + 5 * S, wy + 7 * S), fill=(255, 214, 110))
    x += bw + R.randint(2, 10) * S
# stage floor (glossy teal) + light streaks
d.rectangle((0, int(H * 0.62), W, H), fill=(18, 120, 140))
for k in range(7):
    x0 = k * 110 * S - 40 * S
    d.polygon([(x0, int(H * 0.62)), (x0 + 60 * S, int(H * 0.62)), (x0 + 140 * S, H), (x0 + 40 * S, H)], fill=(30, 150, 168))
# guest couch (left) and host desk (right of centre)
d.rounded_rectangle((40 * S, 260 * S, 230 * S, 330 * S), radius=24 * S, fill=(214, 60, 74))
d.rounded_rectangle((52 * S, 232 * S, 218 * S, 282 * S), radius=20 * S, fill=(236, 84, 92))
# host silhouette (head + shoulders) behind the desk
hx = 420 * S
d.ellipse((hx - 46 * S, 150 * S, hx + 46 * S, 246 * S), fill=(14, 22, 48))
d.rounded_rectangle((hx - 92 * S, 236 * S, hx + 92 * S, 360 * S), radius=50 * S, fill=(14, 22, 48))
d.polygon([(hx - 14 * S, 238 * S), (hx + 14 * S, 238 * S), (hx, 290 * S)], fill=(230, 60, 60))   # a red tie
d.chord((300 * S, 270 * S, 560 * S, 470 * S), 180, 360, fill=(245, 245, 250))
d.rectangle((300 * S, 368 * S, 560 * S, 400 * S), fill=(245, 245, 250))
d.rectangle((300 * S, 352 * S, 560 * S, 364 * S), fill=(40, 190, 200))
d.rounded_rectangle((500 * S, 316 * S, 528 * S, 352 * S), radius=5 * S, fill=(250, 200, 60))
d.arc((520 * S, 324 * S, 540 * S, 344 * S), 270, 90, fill=(250, 200, 60), width=5 * S)
# LIVE bug + lower third
d.rounded_rectangle((520 * S, 24 * S, 612 * S, 62 * S), radius=8 * S, fill=(226, 40, 40))
f = ImageFont.truetype(FB, 26 * S)
d.text((532 * S, 26 * S), 'LIVE', font=f, fill=(255, 255, 255))
d.rectangle((0, 404 * S, W, 452 * S), fill=(250, 200, 50))
d.rectangle((0, 452 * S, W, 470 * S), fill=(200, 40, 50))
f = ImageFont.truetype(FB, 34 * S)
d.text((24 * S, 406 * S), 'LATE NIGHT LIVE', font=f, fill=(30, 30, 70))
f = ImageFont.truetype(FA, 13 * S)
d.text((24 * S, 454 * S), "TONIGHT: CAN YOU REALLY BEAT THE SCRATCH CARDS?", font=f, fill=(255, 255, 255))
# glow, scanlines, vignette, dark border
glow = im.filter(ImageFilter.GaussianBlur(10 * S))
im = ImageChops.screen(im, Image.blend(Image.new('RGB', im.size, 0), glow, 0.35))
sl = Image.new('L', im.size, 255)
dl = ImageDraw.Draw(sl)
for y in range(0, H, 3 * S): dl.line([(0, y), (W, y)], fill=222, width=S)
im = ImageChops.multiply(im, Image.merge('RGB', (sl, sl, sl)))
vg = Image.new('L', im.size, 0)
ImageDraw.Draw(vg).rounded_rectangle((26 * S, 20 * S, W - 26 * S, H - 20 * S), radius=90 * S, fill=255)
vg = vg.filter(ImageFilter.GaussianBlur(40 * S))
im = Image.composite(im, Image.new('RGB', im.size, (6, 10, 18)), vg)
im = im.resize((640, 480), Image.LANCZOS)
im.save(os.path.join(HERE, 'tk_tv_show.png'))

# brand badge (silver on charcoal) 5:1
b = Image.new('RGB', (500, 100), (52, 50, 48))
d = ImageDraw.Draw(b)
d.rounded_rectangle((4, 4, 495, 95), radius=18, outline=(150, 150, 150), width=4)
f = ImageFont.truetype(FB, 62)
bb = d.textbbox((0, 0), 'ZENOVA', font=f)
d.text((250 - (bb[2] - bb[0]) / 2 - bb[0], 50 - (bb[3] - bb[1]) / 2 - bb[1]), 'ZENOVA', font=f, fill=(214, 214, 210))
b.save(os.path.join(HERE, 'tk_tv_badge.png'))
# switched-off glass: dark green-grey CRT with a soft centre sheen and the classic two-bar cartoon glint
g = Image.new('RGB', (640, 480), (30, 40, 40))
sh = Image.new('L', g.size, 0)
ImageDraw.Draw(sh).ellipse((120, 80, 520, 400), fill=255)
sh = sh.filter(ImageFilter.GaussianBlur(70))
g = Image.composite(Image.new('RGB', g.size, (52, 66, 64)), g, sh)
d = ImageDraw.Draw(g)
d.polygon([(70, 190), (190, 60), (236, 60), (116, 190)], fill=(150, 170, 168))
d.polygon([(140, 200), (264, 66), (286, 66), (162, 200)], fill=(120, 140, 138))
vg = Image.new('L', g.size, 0)
ImageDraw.Draw(vg).rounded_rectangle((18, 14, 622, 466), radius=70, fill=255)
vg = vg.filter(ImageFilter.GaussianBlur(24))
g = Image.composite(g, Image.new('RGB', g.size, (14, 18, 18)), vg)
g.save(os.path.join(HERE, 'tk_tv_off.png'))
print('tk_tv textures done')
