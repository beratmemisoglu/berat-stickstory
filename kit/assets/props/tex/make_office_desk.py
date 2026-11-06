# Printed graphics for assets/props/office_desk.py (run with the lab venv):
#   .venv/Scripts/python.exe assets/props/tex/make_office_desk.py
# -> office_desk_screen.png (default monitor desktop), office_desk_screen_off.png (switched off, for screen=...),
#    office_desk_keys.png (keyboard top), office_desk_doc.png (printed page),
#    office_desk_sticky.png (sticky note), office_desk_ring.png (coffee ring, alpha)
import os, math
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = 'C:/Windows/Fonts/'
INK = (42, 38, 34)
PAPER = (242, 239, 230)


def font(name, size):
    return ImageFont.truetype(FONTS + name, size)


def rr(d, box, r, fill, outline=None, width=0):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def screen():
    W, H = 1024, 576
    im = Image.new('RGB', (W, H))
    px = im.load()
    top, bot = (38, 92, 196), (96, 160, 232)
    for y in range(H):
        k = y / (H - 1)
        c = tuple(int(a + (b - a) * k) for a, b in zip(top, bot))
        for x in range(W): px[x, y] = c
    d = ImageDraw.Draw(im)
    # wallpaper: two big soft hills
    d.ellipse((-200, 330, 620, 900), fill=(70, 135, 220))
    d.ellipse((380, 380, 1300, 1000), fill=(58, 118, 208))
    # desktop icons (left column): folder, document, chart
    for i, kind in enumerate(('folder', 'doc', 'chart')):
        x, y = 34, 34 + i * 120
        if kind == 'folder':
            rr(d, (x, y + 10, x + 76, y + 66), 8, (247, 196, 64), INK, 4)
            rr(d, (x, y, x + 34, y + 18), 6, (247, 196, 64), INK, 4)
        elif kind == 'doc':
            rr(d, (x + 10, y, x + 66, y + 70), 6, PAPER, INK, 4)
            for j in range(3): d.rectangle((x + 20, y + 16 + j * 14, x + 56, y + 22 + j * 14), fill=(120, 140, 170))
        else:
            rr(d, (x + 4, y, x + 72, y + 68), 8, (84, 184, 120), INK, 4)
            for j, h in enumerate((20, 34, 48)): d.rectangle((x + 16 + j * 18, y + 58 - h, x + 28 + j * 18, y + 58), fill=PAPER)
        rr(d, (x + 4, y + 80, x + 72, y + 92), 5, (230, 236, 248))
    # main window: a spreadsheet with a chart
    wx0, wy0, wx1, wy1 = 170, 50, 900, 470
    rr(d, (wx0 + 10, wy0 + 12, wx1 + 10, wy1 + 12), 18, (24, 56, 130))            # drop shadow
    rr(d, (wx0, wy0, wx1, wy1), 18, PAPER, INK, 6)
    d.rounded_rectangle((wx0, wy0, wx1, wy0 + 54), 18, fill=(52, 70, 104), outline=INK, width=6, corners=(True, True, False, False))
    for j, c in enumerate(((236, 98, 84), (247, 196, 64), (84, 184, 120))):
        d.ellipse((wx1 - 130 + j * 38, wy0 + 15, wx1 - 106 + j * 38, wy0 + 39), fill=c)
    rr(d, (wx0 + 24, wy0 + 16, wx0 + 230, wy0 + 38), 8, (98, 118, 158))
    # sheet grid (left part)
    gx0, gy0 = wx0 + 26, wy0 + 76
    cw, ch = 70, 40
    for r in range(8):
        for c in range(4):
            box = (gx0 + c * cw, gy0 + r * ch, gx0 + (c + 1) * cw, gy0 + (r + 1) * ch)
            fill = (214, 224, 240) if r == 0 else ((250, 248, 242) if r % 2 else (236, 236, 230))
            d.rectangle(box, fill=fill, outline=(160, 168, 182), width=2)
            if r > 0:
                L = 18 + ((r * 7 + c * 13) % 30)
                d.rectangle((box[0] + 10, box[1] + 15, box[0] + 10 + L, box[1] + 25), fill=(110, 120, 140))
    d.rectangle((gx0 + cw, gy0 + 3 * ch, gx0 + 2 * cw, gy0 + 4 * ch), outline=(52, 120, 220), width=5)   # selected cell
    # bar chart (right part)
    bx0, by1 = wx0 + 340, wy1 - 40
    d.line((bx0, wy0 + 90, bx0, by1, wx1 - 30, by1), fill=INK, width=5)
    for j, h in enumerate((90, 140, 120, 200, 260)):
        c = (236, 98, 84) if j == 4 else (52, 120, 220)
        d.rectangle((bx0 + 26 + j * 72, by1 - h, bx0 + 80 + j * 72, by1), fill=c, outline=INK, width=4)
    # taskbar
    d.rectangle((0, H - 52, W, H), fill=(30, 40, 66))
    d.ellipse((16, H - 44, 52, H - 8), fill=(120, 190, 255))
    for j, c in enumerate(((247, 196, 64), (84, 184, 120), (236, 98, 84))):
        rr(d, (76 + j * 56, H - 42, 116 + j * 56, H - 10), 7, c)
    rr(d, (W - 130, H - 40, W - 18, H - 12), 7, (70, 86, 122))
    d.text((W - 118, H - 41), '9:00', font=font('arialbd.ttf', 24), fill=(236, 240, 248))
    im.save(os.path.join(HERE, 'office_desk_screen.png'))


def screen_off():
    """A switched-off monitor: near-black glass with a soft diagonal reflection."""
    W, H = 1024, 576
    im = Image.new('RGB', (W, H), (22, 24, 30))
    d = ImageDraw.Draw(im)
    d.polygon([(560, 0), (700, 0), (380, H), (240, H)], fill=(34, 37, 46))
    d.polygon([(740, 0), (790, 0), (470, H), (420, H)], fill=(30, 33, 41))
    im.save(os.path.join(HERE, 'office_desk_screen_off.png'))


def keys():
    W, H = 1024, 320
    im = Image.new('RGB', (W, H), (178, 172, 160))
    d = ImageDraw.Draw(im)
    m = 22
    rows = [14, 14, 13, 12]
    kh = 52
    gap = 10
    y = m
    for r, n in enumerate(rows):
        span = W - 2 * m - r * 30
        kw = (span - (n - 1) * gap) / n
        x = m + r * 15
        for i in range(n):
            rr(d, (x, y, x + kw, y + kh), 9, (242, 239, 230), (120, 114, 104), 3)
            x += kw + gap
        y += kh + gap
    # bottom row: modifiers + spacebar
    x = m
    for w in (90, 90, 90):
        rr(d, (x, y, x + w, y + kh), 9, (242, 239, 230), (120, 114, 104), 3); x += w + gap
    rr(d, (x, y, x + 420, y + kh), 9, (242, 239, 230), (120, 114, 104), 3); x += 420 + gap
    while x + 70 < W - m:
        rr(d, (x, y, x + 70, y + kh), 9, (242, 239, 230), (120, 114, 104), 3); x += 70 + gap
    im.save(os.path.join(HERE, 'office_desk_keys.png'))


def sticky():
    S = 256
    im = Image.new('RGB', (S, S), (247, 212, 74))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, S, 26), fill=(236, 194, 52))     # glue strip, a shade darker
    blue = (40, 62, 140)
    for j in range(3):
        y0 = 70 + j * 52
        pts = [(28 + i * 8, y0 + 6 * math.sin(i * 0.9 + j)) for i in range(0, 24 - j * 5)]
        d.line(pts, fill=blue, width=9, joint='curve')
    d.line((170, 190, 190, 214, 232, 150), fill=(214, 70, 60), width=12, joint='curve')   # a red tick
    im.save(os.path.join(HERE, 'office_desk_sticky.png'))


def ring():
    S = 256
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = (128, 86, 52, 255)
    d.arc((24, 24, 232, 232), 20, 320, fill=c, width=16)
    d.arc((34, 30, 226, 228), 200, 260, fill=c, width=10)
    im.save(os.path.join(HERE, 'office_desk_ring.png'))


def doc():
    im = Image.new('RGB', (420, 594), PAPER)
    d = ImageDraw.Draw(im)
    d.rectangle((34, 36, 300, 74), fill=INK)
    d.rectangle((34, 104, 386, 250), outline=(120, 124, 136), width=5)
    for j in range(1, 4): d.line((34, 104 + j * 36, 386, 104 + j * 36), fill=(120, 124, 136), width=4)
    d.line((180, 104, 180, 250), fill=(120, 124, 136), width=4)
    for j in range(6):
        L = (340, 300, 352, 250, 320, 200)[j]
        d.rectangle((34, 290 + j * 44, 34 + L, 304 + j * 44), fill=(120, 124, 136))
    d.ellipse((300, 470, 384, 554), outline=(214, 70, 60), width=8)       # red hanko-style circle
    d.line((318, 512, 366, 512), fill=(214, 70, 60), width=8)
    im.save(os.path.join(HERE, 'office_desk_doc.png'))


if __name__ == '__main__':
    screen(); screen_off(); keys(); sticky(); ring(); doc()
    print('ok', HERE)
