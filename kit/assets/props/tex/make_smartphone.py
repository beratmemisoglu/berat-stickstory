# Pillow textures for assets/props/smartphone.py (all original drawings, no real apps or logos):
#   smartphone_feed.png     default lit screen: a cartoon social feed of the made-up app "pals"; the dark bezel and the
#                           rounded inner corners are drawn in, so the picture fills the rounded screen face exactly
#   smartphone_lock.png     lock screen: big clock + one notification "HR Department: Please report to Room 4B. Bring nothing."
#   smartphone_off.png      screen off: dark glass with two soft reflection streaks
#   smartphone_sticker.png  round die-cut sticker for the back (smiling rice ball), transparent outside
# run: .venv/Scripts/python.exe assets/props/tex/make_smartphone.py
import os, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FD = 'C:/Windows/Fonts/'
S = 2                      # drawn at 2x, downsampled for clean edges
W, H = 800, 1721           # = screen face 0.0695 x 0.1495 m
BEZ = 22                   # bezel width (px) and inner corner radius below

INK = '#2a2622'; PAPER = '#f4f1e8'; GREY = '#8d877d'; LINE = '#ddd6c8'
CORAL = '#e8705a'; RED = '#e0413a'; SKIN = '#f6f3ec'


def font(name, px): return ImageFont.truetype(FD + name, int(px * S))
def P(*v): return [int(round(x * S)) for x in v]


def head(d, cx, cy, r, hair=None, glasses=False, mouth='smile', lw=4):
    """Round white cartoon head: dot eyes, arc smile, optional hair cap / sunglasses."""
    d.ellipse(P(cx - r, cy - r, cx + r, cy + r), fill=SKIN, outline=INK, width=int(lw * S))
    if hair:
        d.chord(P(cx - r, cy - r, cx + r, cy + r), 190, 350, fill=hair, outline=INK, width=int(lw * S))
    ey = cy + r * 0.05; ex = r * 0.34; er = max(2, r * 0.09)
    if glasses:
        for sx in (-1, 1):
            d.rounded_rectangle(P(cx + sx * ex - r * 0.27, ey - r * 0.17, cx + sx * ex + r * 0.27, ey + r * 0.17), radius=int(r * 0.12 * S), fill=INK)
        d.line(P(cx - ex + r * 0.2, ey - r * 0.08, cx + ex - r * 0.2, ey - r * 0.08), fill=INK, width=int(lw * S))
    else:
        for sx in (-1, 1):
            d.ellipse(P(cx + sx * ex - er, ey - er * 1.3, cx + sx * ex + er, ey + er * 1.3), fill=INK)
    my = cy + r * 0.42
    if mouth == 'smile':
        d.arc(P(cx - r * 0.36, my - r * 0.3, cx + r * 0.36, my + r * 0.12), 20, 160, fill=INK, width=int(lw * S))
    elif mouth == 'grin':
        d.chord(P(cx - r * 0.38, my - r * 0.3, cx + r * 0.38, my + r * 0.22), 0, 180, fill=INK)


def heart(d, cx, cy, sz, fill=None, outline=None, lw=5):
    pts = []
    for i in range(64):
        t = 2 * math.pi * i / 64
        x = 16 * math.sin(t) ** 3
        y = -(13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t))
        pts.append((cx + x * sz / 34, cy + y * sz / 34))
    d.polygon([tuple(P(*p)) for p in pts], fill=fill, outline=outline, width=int(lw * S) if outline else 0)


def bezel(img):
    """Dark bezel ring with rounded inner corners (the plane itself has the outer rounding)."""
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle(P(BEZ, BEZ, W - BEZ, H - BEZ), radius=int(58 * S), fill=255)
    dark = Image.new('RGB', img.size, '#1d1b19')
    return Image.composite(img, dark, m)


def feed():
    im = Image.new('RGB', (W * S, H * S), PAPER); d = ImageDraw.Draw(im)
    # status bar
    d.text(P(64, 36), '10:24', font=font('arialbd.ttf', 34), fill=INK)
    d.ellipse(P(383, 40, 417, 74), fill='#1d1b19')                       # punch-hole camera
    for i in range(4):                                                    # signal bars
        d.rounded_rectangle(P(574 + i * 14, 66 - 8 - i * 7, 584 + i * 14, 70), radius=2 * S, fill=INK)
    d.rounded_rectangle(P(650, 42, 722, 72), radius=8 * S, outline=INK, width=4 * S)   # battery
    d.rounded_rectangle(P(656, 48, 700, 66), radius=4 * S, fill='#3aa65a')
    d.rectangle(P(723, 51, 729, 63), fill=INK)
    # app header
    d.ellipse(P(52, 108, 128, 184), fill=CORAL, outline=INK, width=4 * S)
    d.arc(P(70, 128, 110, 164), 20, 160, fill=SKIN, width=7 * S)
    d.ellipse(P(76, 128, 86, 140), fill=SKIN); d.ellipse(P(94, 128, 104, 140), fill=SKIN)
    d.text(P(144, 104), 'pals', font=font('ariblk.ttf', 66), fill=INK)
    heart(d, 640, 146, 52, outline=INK, lw=5)
    d.polygon([tuple(P(*p)) for p in ((700, 150), (756, 122), (734, 178), (722, 156))], outline=INK, width=5 * S)
    d.line(P(22, 212, 778, 212), fill=LINE, width=3 * S)
    # stories
    ring = ['#f2a33a', CORAL, '#b65bd6', '#3aa6d8']
    names = ['you', 'kenji', 'yumi', 'taro']
    hairs = ['#3b2d25', '#2a2622', '#7a3b22', '#d9a441']
    bgs = ['#cfe3ef', '#fbe2a8', '#f6c9c0', '#cde8c6']
    for i in range(4):
        cx, cy, r = 112 + i * 192, 302, 68
        d.ellipse(P(cx - r, cy - r, cx + r, cy + r), fill=ring[i])
        d.ellipse(P(cx - r + 9, cy - r + 9, cx + r - 9, cy + r - 9), fill=bgs[i], outline=PAPER, width=5 * S)
        head(d, cx, cy + 8, 40, hair=hairs[i], lw=4)
        f = font('arialbd.ttf', 27); tw = d.textlength(names[i], font=f) / S
        d.text(P(cx - tw / 2, cy + r + 10), names[i], font=f, fill=INK)
    d.ellipse(P(150, 334, 186, 370), fill='#3a8fe0', outline=PAPER, width=4 * S)
    d.line(P(168, 342, 168, 362), fill=SKIN, width=5 * S); d.line(P(158, 352, 178, 352), fill=SKIN, width=5 * S)
    d.line(P(22, 428, 778, 428), fill=LINE, width=3 * S)
    # post 1 header
    d.ellipse(P(46, 446, 116, 516), fill='#fbe2a8', outline=CORAL, width=5 * S)
    head(d, 81, 484, 26, hair='#2a2622', lw=3)
    d.text(P(132, 446), 'kenji_t', font=font('ariblk.ttf', 34), fill=INK)
    d.text(P(132, 488), '2h  -  beach day', font=font('arial.ttf', 25), fill=GREY)
    for k in range(3): d.ellipse(P(704 + k * 18, 476, 714 + k * 18, 486), fill=INK)
    # post 1 picture: beach
    x0, y0, x1, y1 = 22, 534, 778, 1186
    pic = Image.new('RGB', tuple(P(x1 - x0, y1 - y0)), '#8fd0f0'); pd = ImageDraw.Draw(pic)
    pw, ph = x1 - x0, y1 - y0
    for k in range(12):                                                  # sky bands, lighter toward the sea
        c = tuple(int(a + (b - a) * k / 11) for a, b in zip((112, 196, 240), (196, 232, 246)))
        pd.rectangle(P(0, k * 32, pw, k * 32 + 33), fill=c)
    pd.ellipse(P(560, 50, 690, 180), fill='#ffd34d', outline=INK, width=5 * S)
    for k in range(10):
        a = math.radians(k * 36)
        pd.line(P(625 + 82 * math.cos(a), 115 + 82 * math.sin(a), 625 + 104 * math.cos(a), 115 + 104 * math.sin(a)), fill='#f2a33a', width=8 * S)
    pd.ellipse(P(60, 90, 200, 140), fill='#fbfaf5'); pd.ellipse(P(110, 66, 230, 132), fill='#fbfaf5'); pd.ellipse(P(170, 92, 290, 142), fill='#fbfaf5')
    pd.rectangle(P(0, 384, pw, 486), fill='#2f8fd1')
    for k in range(6):
        pd.arc(P(30 + k * 120, 410, 110 + k * 120, 450), 200, 340, fill='#bfe6f7', width=5 * S)
    pd.rectangle(P(0, 486, pw, ph), fill='#f3d38b')
    pd.line(P(0, 486, pw, 486), fill=INK, width=4 * S)
    for k in range(14): pd.ellipse(P(40 + (k * 97) % 700, 520 + (k * 53) % 110, 48 + (k * 97) % 700, 528 + (k * 53) % 110), fill='#d9b46a')
    # beach umbrella
    pd.line(P(150, 250, 190, 600), fill=INK, width=9 * S)
    pd.pieslice(P(20, 170, 300, 400), 180, 360, fill=RED, outline=INK, width=5 * S)
    for a0 in (205, 255, 305):
        pd.pieslice(P(20, 170, 300, 400), a0, a0 + 25, fill=SKIN)
    pd.arc(P(20, 170, 300, 400), 180, 360, fill=INK, width=5 * S); pd.line(P(20, 285, 300, 285), fill=INK, width=5 * S)
    # the friend: round head, sunglasses, arms up, flowered shirt
    cx = 430
    pd.line(P(cx - 34, 520, cx - 52, 610), fill=INK, width=10 * S); pd.line(P(cx + 34, 520, cx + 52, 610), fill=INK, width=10 * S)
    pd.line(P(cx - 60, 350, cx - 140, 230), fill=INK, width=10 * S); pd.line(P(cx + 60, 350, cx + 140, 230), fill=INK, width=10 * S)
    pd.ellipse(P(cx - 162, 196, cx - 120, 238), fill=SKIN, outline=INK, width=5 * S); pd.ellipse(P(cx + 120, 196, cx + 162, 238), fill=SKIN, outline=INK, width=5 * S)
    pd.rounded_rectangle(P(cx - 78, 320, cx + 78, 540), radius=60 * S, fill='#2fb3a3', outline=INK, width=6 * S)
    for (fx, fy) in ((-40, 370), (30, 360), (-10, 440), (44, 470), (-48, 492)):
        pd.ellipse(P(cx + fx - 14, fy - 14, cx + fx + 14, fy + 14), fill='#ffd34d'); pd.ellipse(P(cx + fx - 5, fy - 5, cx + fx + 5, fy + 5), fill=RED)
    head(pd, cx, 240, 100, hair='#2a2622', glasses=True, mouth='grin', lw=6)
    im.paste(pic, P(x0, y0))
    d.line(P(22, y0, 778, y0), fill=INK, width=3 * S); d.line(P(22, y1, 778, y1), fill=INK, width=3 * S)
    # actions
    heart(d, 78, 1236, 58, fill=RED, outline=INK, lw=4)
    d.text(P(118, 1214), '1,204', font=font('ariblk.ttf', 32), fill=INK)
    d.rounded_rectangle(P(262, 1212, 318, 1258), radius=22 * S, outline=INK, width=5 * S)
    d.polygon([tuple(P(*p)) for p in ((272, 1252), (266, 1272), (290, 1256))], fill=INK)
    d.text(P(330, 1214), '88', font=font('ariblk.ttf', 32), fill=INK)
    d.polygon([tuple(P(*p)) for p in ((712, 1208), (750, 1208), (750, 1266), (731, 1248), (712, 1266))], outline=INK, width=5 * S)
    d.text(P(46, 1290), 'kenji_t', font=font('ariblk.ttf', 31), fill=INK)
    d.text(P(194, 1292), 'best. day. ever!!', font=font('arial.ttf', 31), fill=INK)
    d.text(P(46, 1340), 'View all 88 comments', font=font('arial.ttf', 25), fill=GREY)
    d.line(P(22, 1392, 778, 1392), fill=LINE, width=3 * S)
    # post 2 (cut off by the nav bar): a bowl of noodles
    d.ellipse(P(46, 1410, 116, 1480), fill='#f6c9c0', outline='#b65bd6', width=5 * S)
    head(d, 81, 1448, 26, hair='#7a3b22', lw=3)
    d.text(P(132, 1410), 'yumi.eats', font=font('ariblk.ttf', 34), fill=INK)
    d.text(P(132, 1452), '5h', font=font('arial.ttf', 25), fill=GREY)
    d.rectangle(P(22, 1498, 778, 1600), fill='#f2a33a')
    d.ellipse(P(170, 1530, 630, 1760), fill='#f6f3ec', outline=INK, width=6 * S)
    d.ellipse(P(200, 1548, 600, 1740), fill='#e7b24f')
    for k in range(5): d.arc(P(230 + k * 30, 1570, 470 + k * 30, 1720), 200, 330, fill='#fbe2a8', width=7 * S)
    d.ellipse(P(400, 1556, 470, 1606), fill=SKIN, outline=INK, width=4 * S); d.ellipse(P(420, 1570, 450, 1596), fill='#f2a33a')
    # bottom nav bar
    d.rectangle(P(22, 1600, 778, 1700), fill=PAPER); d.line(P(22, 1600, 778, 1600), fill=LINE, width=3 * S)
    xs = [100, 250, 400, 550, 700]
    d.polygon([tuple(P(*p)) for p in ((xs[0] - 26, 1640), (xs[0], 1616), (xs[0] + 26, 1640), (xs[0] + 26, 1668), (xs[0] - 26, 1668))], fill=INK)
    d.ellipse(P(xs[1] - 20, 1620, xs[1] + 16, 1656), outline=INK, width=5 * S); d.line(P(xs[1] + 10, 1650, xs[1] + 24, 1666), fill=INK, width=6 * S)
    d.rounded_rectangle(P(xs[2] - 26, 1616, xs[2] + 26, 1668), radius=12 * S, outline=INK, width=5 * S)
    d.line(P(xs[2], 1628, xs[2], 1656), fill=INK, width=5 * S); d.line(P(xs[2] - 14, 1642, xs[2] + 14, 1642), fill=INK, width=5 * S)
    heart(d, xs[3], 1644, 50, outline=INK, lw=5)
    d.ellipse(P(xs[4] - 24, 1618, xs[4] + 24, 1666), fill='#cfe3ef', outline=INK, width=4 * S)
    d.rounded_rectangle(P(310, 1680, 490, 1690), radius=5 * S, fill=INK)
    return bezel(im).resize((W, H), Image.LANCZOS)


def off():
    im = Image.new('RGB', (W * S, H * S), '#23272e'); d = ImageDraw.Draw(im)
    for k in range(40):
        c = int(30 + k * 0.5); d.rectangle(P(0, k * H / 40, W, (k + 1) * H / 40 + 1), fill=(c, c + 4, c + 10))
    for off_, wd in ((0, 120), (190, 50)):
        d.polygon([tuple(P(*p)) for p in ((420 + off_, 0), (420 + off_ + wd, 0), (-200 + off_ + wd, H), (-200 + off_, H))], fill='#3a414c')
    return bezel(im).resize((W, H), Image.LANCZOS)


def lock():
    """Second screen: lock screen with a big clock and one notification from HR (story beat: 'report to room 4B')."""
    im = Image.new('RGB', (W * S, H * S), '#2b3f6b'); d = ImageDraw.Draw(im)
    for k in range(30):                                                   # dusk gradient wallpaper
        t = k / 29; c = tuple(int(a + (b - a) * t) for a, b in zip((52, 70, 122), (240, 150, 112)))
        d.rectangle(P(0, k * 58, W, k * 58 + 60), fill=c)
    d.ellipse(P(470, 1040, 690, 1260), fill='#ffd34d')
    d.polygon([tuple(P(*p)) for p in ((-40, 1721), (400, 1080), (520, 1180), (840, 1721))], fill='#3d4f7a', outline=INK, width=5 * S)
    d.polygon([tuple(P(*p)) for p in ((330, 1182), (400, 1080), (470, 1145), (430, 1170), (395, 1150), (365, 1190))], fill='#f6f3ec')
    d.text(P(64, 36), '10:24', font=font('arialbd.ttf', 34), fill='#f6f3ec')
    d.ellipse(P(383, 40, 417, 74), fill='#1d1b19')
    f = font('arialbd.ttf', 50); t = 'Friday, October 23'; tw = d.textlength(t, font=f) / S
    d.text(P(400 - tw / 2, 170), t, font=f, fill='#f6f3ec')
    f = font('ariblk.ttf', 230); t = '10:24'; tw = d.textlength(t, font=f) / S
    d.text(P(400 - tw / 2, 220), t, font=f, fill='#f6f3ec')
    d.rounded_rectangle(P(48, 620, 752, 860), radius=40 * S, fill='#f4f1e8', outline=INK, width=4 * S)
    d.rounded_rectangle(P(76, 650, 156, 730), radius=18 * S, fill='#5b6270')
    d.rectangle(P(98, 672, 134, 712), outline='#f6f3ec', width=5 * S); d.line(P(104, 684, 128, 684), fill='#f6f3ec', width=4 * S)
    d.line(P(104, 696, 128, 696), fill='#f6f3ec', width=4 * S)
    d.text(P(176, 652), 'HR Department', font=font('ariblk.ttf', 36), fill=INK)
    d.text(P(600, 660), 'now', font=font('arial.ttf', 28), fill=GREY)
    d.text(P(176, 702), 'Please report to', font=font('arial.ttf', 36), fill=INK)
    d.text(P(176, 748), 'Room 4B. Bring', font=font('arial.ttf', 36), fill=INK)
    d.text(P(176, 794), 'nothing.', font=font('arialbd.ttf', 36), fill=INK)
    d.rounded_rectangle(P(310, 1680, 490, 1690), radius=5 * S, fill='#f6f3ec')
    return bezel(im).resize((W, H), Image.LANCZOS)


def sticker():
    n = 256; im = Image.new('RGBA', (n * S, n * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    def Q(*v): return [int(round(x * S)) for x in v]
    d.ellipse(Q(4, 4, 252, 252), fill='#f4f1e8', outline=INK, width=5 * S)
    d.ellipse(Q(20, 20, 236, 236), fill='#f6b8b0')
    tri = [(128, 52), (206, 182), (50, 182)]
    d.polygon([tuple(Q(*p)) for p in tri], fill='#fbfaf5', outline=INK, width=6 * S)
    d.rounded_rectangle(Q(96, 140, 160, 186), radius=6 * S, fill='#2f4a3a')
    d.ellipse(Q(102, 108, 114, 122), fill=INK); d.ellipse(Q(142, 108, 154, 122), fill=INK)
    d.arc(Q(112, 112, 144, 136), 20, 160, fill=INK, width=4 * S)
    d.ellipse(Q(88, 122, 104, 132), fill='#f08a80'); d.ellipse(Q(152, 122, 168, 132), fill='#f08a80')
    return im.resize((n, n), Image.LANCZOS)


if __name__ == '__main__':
    for nm, im in (('feed', feed()), ('lock', lock()), ('off', off()), ('sticker', sticker())):
        p = os.path.join(HERE, f'smartphone_{nm}.png'); im.save(p); print('wrote', p, im.size)
