# Pillow texture for assets/props/photo_frame.py (original drawing):
#   photo_frame_family.png  default photo: a cartoon family of round-headed stick figures (dad, mum, kid, dog) in a
#                           park, an orange date stamp and a soft glass glare. 1200 x 813 = the 0.124 x 0.084 m print;
#                           the outer ~1.6 % hides under the mat, so keep faces away from the edges in your own photos.
#   photo_frame_team.png    second photo: the office team cheering under a WELCOME! banner (day one, happier times)
# run: .venv/Scripts/python.exe assets/props/tex/make_photo_frame.py
import os, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FD = 'C:/Windows/Fonts/'
S = 2
W, H = 1200, 813
INK = '#2a2622'; SKIN = '#f6f3ec'


def P(*v): return [int(round(x * S)) for x in v]
def font(name, px): return ImageFont.truetype(FD + name, int(px * S))


def limb(d, pts, w=12):
    d.line([tuple(P(*p)) for p in pts], fill=INK, width=int(w * S), joint='curve')
    for p in (pts[0], pts[-1]):
        r = w / 2; d.ellipse(P(p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=INK)


def hand(d, x, y, r=15):
    d.ellipse(P(x - r, y - r, x + r, y + r), fill=SKIN, outline=INK, width=5 * S)


def face(d, cx, cy, r, blush=True):
    """Happy face: closed ^ ^ eyes, open smile, blush."""
    for sx in (-1, 1):
        ex = cx + sx * r * 0.36; ey = cy - r * 0.02
        d.arc(P(ex - r * 0.17, ey - r * 0.12, ex + r * 0.17, ey + r * 0.2), 200, 340, fill=INK, width=int(max(4, r * 0.08) * S))
    d.chord(P(cx - r * 0.36, cy + r * 0.12, cx + r * 0.36, cy + r * 0.62), 0, 180, fill=INK)
    d.chord(P(cx - r * 0.2, cy + r * 0.38, cx + r * 0.2, cy + r * 0.6), 0, 180, fill='#e86f5a')
    if blush:
        for sx in (-1, 1):
            bx = cx + sx * r * 0.62; d.ellipse(P(bx - r * 0.14, cy + r * 0.16, bx + r * 0.14, cy + r * 0.32), fill='#f4b0a4')


def head(d, cx, cy, r, hair=None, style='cap'):
    if hair and style == 'bob':     # bob: hair mass behind the head, wider than it
        d.chord(P(cx - r * 1.12, cy - r * 1.08, cx + r * 1.12, cy + r * 1.2), 160, 380, fill=hair, outline=INK, width=6 * S)
        d.rectangle(P(cx - r * 1.12 + 3, cy, cx + r * 1.12 - 3, cy + r * 0.55), fill=hair)
        d.line(P(cx - r * 1.12, cy - 10, cx - r * 1.12, cy + r * 0.55), fill=INK, width=6 * S)
        d.line(P(cx + r * 1.12, cy - 10, cx + r * 1.12, cy + r * 0.55), fill=INK, width=6 * S)
        d.line(P(cx - r * 1.12, cy + r * 0.55, cx + r * 1.12, cy + r * 0.55), fill=INK, width=6 * S)
    d.ellipse(P(cx - r, cy - r, cx + r, cy + r), fill=SKIN, outline=INK, width=6 * S)
    if hair and style == 'cap':
        d.chord(P(cx - r, cy - r, cx + r, cy + r), 185, 355, fill=hair, outline=INK, width=6 * S)
    if hair and style == 'bob':
        d.chord(P(cx - r, cy - r, cx + r, cy + r * 0.6), 180, 360, fill=hair, outline=INK, width=6 * S)
    if style == 'tuft':
        d.chord(P(cx - r, cy - r, cx + r, cy + r), 200, 340, fill=hair, outline=INK, width=6 * S)
        d.ellipse(P(cx + r * 0.1, cy - r * 1.32, cx + r * 0.6, cy - r * 0.82), fill=hair, outline=INK, width=5 * S)
    face(d, cx, cy + r * 0.12, r)


def family():
    im = Image.new('RGB', (W * S, H * S), '#bfe5f4'); d = ImageDraw.Draw(im)
    for k in range(16):
        t = k / 15; c = tuple(int(a + (b - a) * t) for a, b in zip((126, 196, 236), (214, 239, 245)))
        d.rectangle(P(0, k * 30, W, k * 30 + 31), fill=c)
    for (x, y, s_) in ((160, 110, 1.0), (930, 80, 0.8)):
        for dx, dy, r in ((-60, 10, 42), (-10, -14, 54), (50, 8, 44)):
            d.ellipse(P(x + dx * s_ - r * s_, y + dy * s_ - r * s_, x + dx * s_ + r * s_, y + dy * s_ + r * s_), fill='#fbfaf5')
    d.ellipse(P(-200, 400, 700, 900), fill='#7cc36a', outline=INK, width=5 * S)
    d.ellipse(P(500, 420, 1500, 960), fill='#69b85c', outline=INK, width=5 * S)
    d.rectangle(P(0, 600, W, H), fill='#8fd07a')
    for k in range(26):
        x = (k * 157) % 1180 + 10; y = 640 + (k * 61) % 160
        d.line(P(x, y, x - 6, y - 16), fill='#5fae55', width=4 * S); d.line(P(x, y, x + 6, y - 16), fill='#5fae55', width=4 * S)
    # tree
    d.rounded_rectangle(P(150, 300, 196, 640), radius=10 * S, fill='#8a5a36', outline=INK, width=5 * S)
    for dx, dy, r in ((-70, 0, 95), (60, -20, 105), (0, -100, 110), (10, 40, 90)):
        d.ellipse(P(173 + dx - r, 250 + dy - r, 173 + dx + r, 250 + dy + r), fill='#4e9e4a', outline=INK, width=5 * S)
    for dx, dy, r in ((-70, 0, 92), (60, -20, 102), (0, -100, 107), (10, 40, 87)):
        d.ellipse(P(173 + dx - r + 3, 250 + dy - r + 3, 173 + dx + r - 3, 250 + dy + r - 3), fill='#4e9e4a')
    for (x, y) in ((120, 200), (230, 170), (200, 300), (100, 300)):
        d.ellipse(P(x - 12, y - 12, x + 12, y + 12), fill='#e0413a')
    # dad (left), kid (middle), mum (right), dog
    dx_, kx, mx = 420, 590, 770
    limb(d, [(dx_ - 30, 560), (dx_ - 36, 640), (dx_ - 44, 720)], 13); limb(d, [(dx_ + 30, 560), (dx_ + 36, 640), (dx_ + 46, 720)], 13)
    limb(d, [(mx - 28, 590), (mx - 30, 660), (mx - 36, 724)], 13); limb(d, [(mx + 28, 590), (mx + 30, 660), (mx + 38, 724)], 13)
    limb(d, [(kx - 20, 610), (kx - 24, 670), (kx - 30, 726)], 11); limb(d, [(kx + 20, 610), (kx + 24, 670), (kx + 30, 726)], 11)
    for x, y in ((dx_ - 50, 724), (dx_ + 54, 724), (mx - 44, 728), (mx + 46, 728), (kx - 36, 730), (kx + 36, 730)):
        d.ellipse(P(x - 22, y - 10, x + 22, y + 12), fill=INK)
    # arms: dad's left arm waves, right holds the kid; mum holds the kid, her right arm on her hip
    limb(d, [(dx_ - 52, 420), (dx_ - 120, 360), (dx_ - 140, 270)], 12); hand(d, dx_ - 140, 262)
    limb(d, [(dx_ + 52, 430), (dx_ + 100, 500), (kx - 52, 540)], 12)
    limb(d, [(mx - 50, 440), (mx - 100, 510), (kx + 52, 540)], 12)
    limb(d, [(mx + 50, 440), (mx + 104, 500), (mx + 66, 550)], 12)
    limb(d, [(kx - 30, 520), (kx - 52, 540)], 10); limb(d, [(kx + 30, 520), (kx + 52, 540)], 10)
    hand(d, kx - 52, 542, 14); hand(d, kx + 52, 542, 14)
    # bodies
    d.rounded_rectangle(P(dx_ - 62, 380, dx_ + 62, 580), radius=56 * S, fill='#3d6fb3', outline=INK, width=6 * S)
    d.polygon([tuple(P(*p)) for p in ((mx, 386), (mx - 86, 610), (mx + 86, 610))], fill='#e86f5a', outline=INK, width=6 * S)
    d.rounded_rectangle(P(mx - 86, 560, mx + 86, 612), radius=8 * S, fill='#e86f5a', outline=INK, width=6 * S)
    d.polygon([tuple(P(*p)) for p in ((mx - 2, 389), (mx - 80, 600), (mx + 80, 600))], fill='#e86f5a')
    for k in range(5): d.ellipse(P(mx - 50 + k * 25 - 7, 584 - 7, mx - 50 + k * 25 + 7, 584 + 7), fill='#f6f3ec')
    d.rounded_rectangle(P(kx - 44, 500, kx + 44, 625), radius=40 * S, fill='#f2c230', outline=INK, width=6 * S)
    d.line(P(kx - 40, 560, kx + 40, 560), fill='#e0413a', width=8 * S)
    head(d, dx_, 306, 82, hair='#2a2622', style='cap')
    head(d, mx, 318, 76, hair='#7a3b22', style='bob')
    head(d, kx, 440, 60, hair='#3b2d25', style='tuft')
    # dog
    gx, gy = 980, 640
    d.ellipse(P(gx - 70, gy - 20, gx + 70, gy + 90), fill='#c98a4b', outline=INK, width=6 * S)
    d.ellipse(P(gx + 50, gy + 10, gx + 110, gy + 40), fill='#c98a4b', outline=INK, width=6 * S)   # tail
    d.ellipse(P(gx - 64, gy - 132, gx + 64, gy - 10), fill='#c98a4b', outline=INK, width=6 * S)
    for sx in (-1, 1):
        d.ellipse(P(gx + sx * 70 - 26, gy - 120, gx + sx * 70 + 26, gy - 40), fill='#8a5a36', outline=INK, width=6 * S)
    d.ellipse(P(gx - 34, gy - 92, gx - 18, gy - 72), fill=INK); d.ellipse(P(gx + 18, gy - 92, gx + 34, gy - 72), fill=INK)
    d.ellipse(P(gx - 16, gy - 70, gx + 16, gy - 48), fill=INK)
    d.chord(P(gx - 12, gy - 54, gx + 12, gy - 18), 0, 180, fill='#e86f5a', outline=INK, width=4 * S)
    for x in (gx - 40, gx + 40):
        d.ellipse(P(x - 22, gy + 70, x + 22, gy + 96), fill='#c98a4b', outline=INK, width=5 * S)
    # date stamp
    f = font('arialbd.ttf', 40); d.text(P(1000, 742), "'26 5 03", font=f, fill='#ff8a2a')
    # print border shadow + soft vignette
    im = im.resize((W, H), Image.LANCZOS)
    glare = Image.new('L', (W, H), 0); gd = ImageDraw.Draw(glare)
    gd.polygon(((80, 0), (300, 0), (40, H), (-180, H)), fill=46); gd.polygon(((360, 0), (420, 0), (160, H), (100, H)), fill=34)
    im = Image.composite(Image.new('RGB', (W, H), '#ffffff'), im, glare)
    return im


def team():
    """Second photo: the office team on day one under a WELCOME! banner (for the 'happier times' beat)."""
    im = Image.new('RGB', (W * S, H * S), '#e9e2cf'); d = ImageDraw.Draw(im)
    d.rectangle(P(0, 560, W, H), fill='#b9b4aa')                     # floor
    d.rectangle(P(0, 0, W, 560), fill='#dcd8c4')
    for k in range(5): d.rectangle(P(80 + k * 230, 330, 200 + k * 230, 520), fill='#cfd3d6', outline=INK, width=4 * S)   # filing cabinets
    d.polygon([tuple(P(*p)) for p in ((90, 60), (1110, 60), (1080, 180), (120, 180))], fill='#e0413a', outline=INK, width=6 * S)
    f = font('ariblk.ttf', 96); tw = d.textlength('WELCOME!', font=f) / S
    d.text(P(600 - tw / 2, 64), 'WELCOME!', font=f, fill='#f6f3ec')
    for k in range(9): d.polygon([tuple(P(*p)) for p in ((60 + k * 135, 190), (120 + k * 135, 190), (90 + k * 135, 236))], fill=['#f2c230', '#3d6fb3', '#2fb3a3'][k % 3], outline=INK, width=3 * S)
    people = [(250, '#5b6270', '#2a2622', 'cap'), (470, '#3d6fb3', '#2a2622', 'cap'), (700, '#2a2622', '#3b2d25', 'tuft'), (930, '#5b6270', '#7a3b22', 'bob')]
    for x, shirt, hair, st in people:
        limb(d, [(x - 28, 600), (x - 32, 680), (x - 38, 750)], 13); limb(d, [(x + 28, 600), (x + 32, 680), (x + 38, 750)], 13)
        for fx in (x - 44, x + 44): d.ellipse(P(fx - 22, 744, fx + 22, 766), fill=INK)
        limb(d, [(x - 56, 440), (x - 110, 380), (x - 120, 300)], 12); hand(d, x - 120, 292)
        limb(d, [(x + 56, 440), (x + 110, 380), (x + 120, 300)], 12); hand(d, x + 120, 292)
        d.rounded_rectangle(P(x - 64, 400, x + 64, 620), radius=56 * S, fill=shirt, outline=INK, width=6 * S)
        d.polygon([tuple(P(*p)) for p in ((x - 14, 404), (x + 14, 404), (x + 8, 500), (x, 516), (x - 8, 500))], fill='#e0413a', outline=INK, width=3 * S)
        head(d, x, 322, 80, hair=hair, style=st)
    f = font('arialbd.ttf', 40); d.text(P(1000, 742), "'19 4 01", font=f, fill='#ff8a2a')
    im = im.resize((W, H), Image.LANCZOS)
    glare = Image.new('L', (W, H), 0); gd = ImageDraw.Draw(glare)
    gd.polygon(((80, 0), (300, 0), (40, H), (-180, H)), fill=46); gd.polygon(((360, 0), (420, 0), (160, H), (100, H)), fill=34)
    return Image.composite(Image.new('RGB', (W, H), '#ffffff'), im, glare)


if __name__ == '__main__':
    for nm, fn in (('family', family), ('team', team)):
        p = os.path.join(HERE, f'photo_frame_{nm}.png'); im = fn(); im.save(p); print('wrote', p, im.size)
