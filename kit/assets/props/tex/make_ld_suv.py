# Printed graphics for assets/props/ld_suv.py (run in the lab venv: .venv/Scripts/python.exe assets/props/tex/make_ld_suv.py)
#   ld_suv_plate.png   "LUCKY 7" licence plate (white, blue top band, dark blue letters, "LAND OF LUCK" line)
#   ld_suv_lens.png    round headlight lens with slats (alpha outside the circle)
#   ld_suv_glass.png   windshield: faint tint (alpha ~0.12) + soft white diagonal glint stripes
#   ld_suv_ticket.png  scratch ticket tucked under the tackle box's seatbelt
#   ld_suv_tree.png    pine-tree air freshener (inked cut-out)
#   ld_suv_mud.png     mud splatter strip for the lower sills (alpha-clipped)
#   ld_suv_dent.png    a dent as two shading crescents (dark top, lit bottom), body red
import os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
F_BLK = 'C:/Windows/Fonts/ariblk.ttf'
F_BLD = 'C:/Windows/Fonts/arialbd.ttf'
INK = (38, 30, 36, 255)


def out(n): return os.path.join(HERE, f'ld_suv_{n}.png')


def fit(d, text, path, size, maxw):
    while size > 8:
        f = ImageFont.truetype(path, size)
        if d.textlength(text, font=f) <= maxw: return f
        size -= 2
    return ImageFont.truetype(path, size)


def plate():
    W, H = 800, 400
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, W - 1, H - 1), 40, fill='#2a2a3c')
    d.rounded_rectangle((14, 14, W - 15, H - 15), 30, fill='#f4f2ec')
    d.rounded_rectangle((14, 14, W - 15, 104), 30, fill='#2f5fc4'); d.rectangle((14, 64, W - 15, 104), fill='#2f5fc4')
    for x in (150, W - 150):            # bolts in the blue band
        d.ellipse((x - 13, 46, x + 13, 72), fill='#d9d6de', outline='#1d2f7a', width=3)
    f = fit(d, 'LUCKY 7', F_BLK, 200, 690)
    d.text((W / 2, 220), 'LUCKY 7', font=f, fill='#1d2f7a', anchor='mm')
    f2 = fit(d, 'LAND OF LUCK', F_BLD, 46, 420)
    d.text((W / 2, 336), 'LAND OF LUCK', font=f2, fill='#b8322c', anchor='mm')
    im.save(out('plate'))


def lens():
    S = 256
    base = Image.new('RGBA', (S, S), (201, 197, 216, 255)); d = ImageDraw.Draw(base)
    for k in range(6):
        y = 46 + k * 33
        d.line((20, y, S - 20, y), fill=(168, 162, 188, 255), width=7)
    d.line((S / 2, 20, S / 2, S - 20), fill=(180, 174, 198, 255), width=5)
    d.arc((26, 26, S - 26, S - 26), 196, 256, fill=(246, 244, 250, 255), width=16)
    d.ellipse((6, 6, S - 7, S - 7), outline=(150, 144, 170, 255), width=8)
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse((4, 4, S - 5, S - 5), fill=255)
    base.putalpha(mask)
    base.save(out('lens'))


def glass():
    W, H = 1024, 448
    s = Image.new('L', (W, H), 0); d = ImageDraw.Draw(s)
    sl = 0.42 * H   # "\" lean: the bottom of a stripe sits right of its top

    def band(x0, w, a):
        d.polygon([(x0, 0), (x0 + w, 0), (x0 + w + sl, H), (x0 + sl, H)], fill=a)
    band(250, 120, 140); band(410, 34, 120); band(700, 64, 100)
    d.rectangle((0, 8, W, 20), fill=120)                 # a glint along the top edge
    s = s.filter(ImageFilter.GaussianBlur(14))
    fade = Image.linear_gradient('L').resize((W, H))     # stronger at the top, fading down
    fade = fade.point(lambda v: int(255 - 0.75 * v))
    s = ImageChops.multiply(s, fade)
    tint = Image.new('RGBA', (W, H), (232, 230, 246, 0))
    white = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    im = Image.composite(white, tint, s.point(lambda v: min(255, v * 2)))
    alpha = s.point(lambda v: max(30, v))
    im.putalpha(alpha)
    im.save(out('glass'))


def ticket():
    W, H = 240, 360
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W - 1, H - 1), fill='#2a2230')
    d.rectangle((7, 7, W - 8, H - 8), fill='#f7d64a')
    d.rectangle((7, 7, W - 8, 92), fill='#2a5ccc')
    d.text((W / 2, 50), 'BIG', font=fit(d, 'BIG', F_BLK, 64, 200), fill='#f7f3ea', anchor='mm')
    d.text((W / 2, 130), 'CASH', font=fit(d, 'CASH', F_BLK, 80, 210), fill='#d6302b', anchor='mm')
    for i, (cx, cy) in enumerate(((62, 210), (120, 210), (178, 210))):
        d.ellipse((cx - 25, cy - 25, cx + 25, cy + 25), fill='#b8b7c6' if i != 1 else '#fff6d8', outline='#2a2230', width=3)
    d.text((120, 211), '7', font=ImageFont.truetype(F_BLK, 40), fill='#d6302b', anchor='mm')
    d.text((W / 2, 268), '$ $ $', font=ImageFont.truetype(F_BLK, 34), fill='#1f7a3e', anchor='mm')
    for k in range(18):                                   # barcode
        x = 40 + k * 9
        d.rectangle((x, 300, x + (3 if k % 3 else 5), 336), fill='#2a2230')
    im.save(out('ticket'))


def tree():
    W, H = 256, 384
    shape = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(shape)
    tiers = [(70, 150, 58), (130, 230, 82), (200, 320, 104)]   # (top y, bottom y, half width)
    cx = W / 2
    for ty, by, hw in tiers:
        d.polygon([(cx, ty - 40), (cx + hw, by), (cx - hw, by)], fill=(62, 160, 74, 255))
        d.polygon([(cx, ty - 40), (cx, by), (cx - hw, by)], fill=(84, 186, 92, 255))
    d.rectangle((cx - 16, 318, cx + 16, 356), fill=(120, 82, 46, 255))
    d.ellipse((cx - 9, 24, cx + 9, 42), fill=(0, 0, 0, 0))
    a = shape.getchannel('A')
    ink = Image.new('RGBA', (W, H), INK); ink.putalpha(a.filter(ImageFilter.MaxFilter(13)))
    ink.alpha_composite(shape)
    hole = Image.new('L', (W, H), 255); ImageDraw.Draw(hole).ellipse((cx - 7, 26, cx + 7, 40), fill=0)
    ink.putalpha(ImageChops.multiply(ink.getchannel('A'), hole))
    ink.save(out('tree'))


def mud():
    W, H = 1024, 160
    rnd = random.Random(7)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cols = [(94, 66, 42, 255), (110, 80, 52, 255)]
    pts = [(0, H)]
    x = 0
    while x <= W:
        pts.append((x, H - rnd.randint(28, 62))); x += rnd.randint(18, 46)
    pts += [(W, H)]
    d.polygon(pts, fill=cols[0])
    for _ in range(90):
        x = rnd.uniform(0, W); y = H - abs(rnd.gauss(0, 55)) - 30; r = rnd.uniform(3, 11) * (1 if y > 60 else 0.6)
        d.ellipse((x - r, y - r, x + r, y + r), fill=cols[rnd.randint(0, 1)])
    im.save(out('mud'))


def dent():
    W, H = 256, 160
    E = (28, 24, W - 28, H - 24)
    def ell(dy):
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).ellipse((E[0], E[1] + dy, E[2], E[3] + dy), fill=255); return m
    base = ell(0)
    darkm = ImageChops.subtract(base, ell(22))      # top crescent (in shade)
    litm = ImageChops.subtract(base, ell(-18))      # bottom crescent (catches the light)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    im.paste(Image.new('RGBA', (W, H), (150, 24, 30, 255)), (0, 0), darkm)
    im.paste(Image.new('RGBA', (W, H), (226, 84, 80, 255)), (0, 0), litm)
    im.save(out('dent'))


if __name__ == '__main__':
    plate(); lens(); glass(); ticket(); tree(); mud(); dent()
    print('ld_suv textures written to', HERE)
