# Pillow textures for assets/props/law_book.py (original drawings, transparent where the red cloth shows through):
#   law_book_cover.png  front cover print: gold double border with corner diamonds, "LABOR / LAW", a scales-of-justice
#                       emblem built from simple shapes, "EMPLOYMENT CODE" + "VOL. II"; 1120 x 1552 = 0.28 x 0.388 m
#   law_book_spine.png  spine print: black title label with gold "LABOR LAW" reading top to bottom, small emblem and
#                       volume number; 280 x 1536 = 0.07 x 0.384 m
#   law_book_pages.png  page-edge stripes for the fore edge and top of the page block (opaque)
# run: .venv/Scripts/python.exe assets/props/tex/make_law_book.py [--title "LABOR LAW"] [--sub "EMPLOYMENT CODE"]
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FD = 'C:/Windows/Fonts/'
S = 2
GOLD = '#e8bd52'; GOLD_D = '#8a5e17'; SHADOW = '#4a1216'; LABEL = '#2a2622'


def font(name, px): return ImageFont.truetype(FD + name, int(px * S))


def scales(d, cx, cy, s, P, lw=1.0):
    """Scales of justice from simple shapes, centred on (cx, cy), about 2*s wide; dark outline under gold fill."""
    def shape(off, fill, grow):
        g = grow
        o = off
        # post + base
        d.rounded_rectangle(P(cx - 0.05 * s - g + o, cy - 0.62 * s - g + o, cx + 0.05 * s + g + o, cy + 0.62 * s + g + o), radius=int(0.03 * s * S), fill=fill)
        d.rounded_rectangle(P(cx - 0.42 * s - g + o, cy + 0.58 * s - g + o, cx + 0.42 * s + g + o, cy + 0.72 * s + g + o), radius=int(0.05 * s * S), fill=fill)
        d.polygon([tuple(P(*p)) for p in ((cx - 0.2 * s - g + o, cy + 0.6 * s + o), (cx + 0.2 * s + g + o, cy + 0.6 * s + o), (cx + 0.07 * s + g + o, cy + 0.36 * s - g + o), (cx - 0.07 * s - g + o, cy + 0.36 * s - g + o))], fill=fill)
        # beam + finial
        d.rounded_rectangle(P(cx - 0.86 * s - g + o, cy - 0.56 * s - g + o, cx + 0.86 * s + g + o, cy - 0.47 * s + g + o), radius=int(0.04 * s * S), fill=fill)
        d.ellipse(P(cx - 0.11 * s - g + o, cy - 0.8 * s - g + o, cx + 0.11 * s + g + o, cy - 0.58 * s + g + o), fill=fill)
        for sx in (-1, 1):
            px_ = cx + sx * 0.78 * s
            d.ellipse(P(px_ - 0.07 * s - g + o, cy - 0.58 * s - g + o, px_ + 0.07 * s + g + o, cy - 0.44 * s + g + o), fill=fill)
            # chains
            for k in (-1, 1):
                d.line(P(px_ + o, cy - 0.5 * s + o, px_ + k * 0.3 * s + o, cy + 0.02 * s + o), fill=fill, width=int((0.035 * s + 2 * g) * S))
            # pan
            d.chord(P(px_ - 0.36 * s - g + o, cy - 0.16 * s - g + o, px_ + 0.36 * s + g + o, cy + 0.2 * s + g + o), 0, 180, fill=fill)
    shape(5, SHADOW, 0)          # debossed shadow
    shape(0, GOLD_D, 4 * lw)     # dark gold rim
    shape(0, GOLD, 0)


def gold_text(d, xy, text, f, P, anchor='mm'):
    x, y = xy
    d.text(tuple(P(x + 5, y + 5)), text, font=f, fill=SHADOW, anchor=anchor)
    d.text(tuple(P(x, y)), text, font=f, fill=GOLD, anchor=anchor, stroke_width=int(4 * S), stroke_fill=GOLD_D)


def cover(title, sub):
    W, H = 1120, 1552
    def P(*v): return [int(round(x * S)) for x in v]
    im = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for inset, wd in ((44, 16), (82, 6)):
        d.rectangle(P(inset + 5, inset + 5, W - inset + 5, H - inset + 5), outline=SHADOW, width=wd * S)
        d.rectangle(P(inset, inset, W - inset, H - inset), outline=GOLD, width=wd * S)
    for (x, y) in ((63, 63), (W - 63, 63), (63, H - 63), (W - 63, H - 63)):
        dm = [(x, y - 30), (x + 30, y), (x, y + 30), (x - 30, y)]
        d.polygon([tuple(P(*p)) for p in dm], fill=GOLD, outline=GOLD_D, width=3 * S)
    words = title.split()
    big = font('ariblk.ttf', 230)
    if len(words) >= 2:
        gold_text(d, (W / 2, 330), words[0], big, P); gold_text(d, (W / 2, 560), ' '.join(words[1:]), big, P)
    else:
        gold_text(d, (W / 2, 440), title, big, P)
    d.line(P(260, 712, W - 260, 712), fill=GOLD, width=6 * S)
    scales(d, W / 2, 1010, 270, P)
    gold_text(d, (W / 2, 1300), sub, font('arialbd.ttf', 64), P)
    gold_text(d, (W / 2, 1400), 'VOL. II', font('ariblk.ttf', 58), P)
    return im.resize((W, H), Image.LANCZOS)


def spine(title):
    W, H = 280, 1536
    def P(*v): return [int(round(x * S)) for x in v]
    im = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    # label panel between the raised bands (the bands are geometry in law_book.py: two above the label framing the
    # volume number, two below framing the small emblem)
    y0, y1 = 300, 1150
    d.rounded_rectangle(P(26, y0, W - 26, y1), radius=10 * S, fill=LABEL, outline=GOLD, width=6 * S)
    d.rectangle(P(44, y0 + 18, W - 44, y1 - 18), outline=GOLD, width=3 * S)
    # vertical title, top to bottom: draw horizontally on a strip, rotate -90
    f = font('ariblk.ttf', 150)
    tw = int(d.textlength(title, font=f) / S) + 40
    strip = Image.new('RGBA', (tw * S, 200 * S), (0, 0, 0, 0)); sd = ImageDraw.Draw(strip)
    sd.text((tw * S // 2, 100 * S), title, font=f, fill=GOLD, anchor='mm', stroke_width=3 * S, stroke_fill=GOLD_D)
    strip = strip.rotate(-90, expand=True)
    avail = (y1 - y0 - 70)
    sc = min(1.0, avail / tw, (W - 110) / 200)
    strip = strip.resize((int(strip.width * sc), int(strip.height * sc)), Image.LANCZOS)
    im.alpha_composite(strip, (int(W * S / 2 - strip.width / 2), int((y0 + y1) * S / 2 - strip.height / 2)))
    # small emblem + volume number below the bands
    scales(d, W / 2, 1290, 70, P, lw=0.5)
    vf = font('ariblk.ttf', 64)
    d.text(tuple(P(W / 2, 170)), 'II', font=vf, fill=GOLD, anchor='mm', stroke_width=3 * S, stroke_fill=GOLD_D)
    return im.resize((W, H), Image.LANCZOS)


def pages():
    W, H = 256, 512
    im = Image.new('RGB', (W, H), '#e8dcbd'); d = ImageDraw.Draw(im)
    import random
    rnd = random.Random(7); x = 0
    while x < W:
        x += rnd.choice((6, 8, 10, 12))
        d.line((x, 0, x, H), fill=rnd.choice(('#c9b78f', '#d4c39d', '#bba77c')), width=rnd.choice((2, 2, 3)))
    return im


if __name__ == '__main__':
    a = sys.argv[1:]
    title = a[a.index('--title') + 1] if '--title' in a else 'LABOR LAW'
    sub = a[a.index('--sub') + 1] if '--sub' in a else 'EMPLOYMENT CODE'
    for nm, im in (('cover', cover(title, sub)), ('spine', spine(title)), ('pages', pages())):
        p = os.path.join(HERE, f'law_book_{nm}.png'); im.save(p); print('wrote', p, im.size)
