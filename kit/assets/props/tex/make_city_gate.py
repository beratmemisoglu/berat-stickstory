# City gate graphics (lab venv): .venv/Scripts/python.exe assets/props/tex/make_city_gate.py
#   city_gate_brick.png    - tileable 2 x 2 m of chunky wall bricks (0.5 x 0.25 m, running bond, soft painted edges)
#   city_gate_banner.png   - a tall red war banner: zigzag fringe (alpha), dark border, gold disc with the character
#                            "long" (dragon)
#   city_gate_plaque.png   - the gatehouse name plaque: deep blue board, gold frame, "yong an men" (Gate of Eternal
#                            Peace) top to bottom in gold
#   city_gate_lattice.png  - a gatehouse lattice door panel: red frame, cross-lattice over pale paper
#   city_gate_lattice_lit.png - the same with warm lamp-lit paper (night)
import os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')


def font(size, cjk=True):
    for f in (('msjhbd.ttc', 'msyhbd.ttc') if cjk else ()) + ('ariblk.ttf', 'arialbd.ttf'):
        p = os.path.join(FONTS, f)
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def brick(path=os.path.join(HERE, 'city_gate_brick.png')):
    S = 512; rows, cols = 8, 4
    bh, bw = S // rows, S // cols
    rnd = random.Random(7)
    im = Image.new('RGB', (S, S), (96, 78, 62)); d = ImageDraw.Draw(im)
    base = (146, 116, 88)
    for r in range(rows):
        off = (bw // 2) if r % 2 else 0
        for c in range(-1, cols + 1):
            x0 = c * bw + off; y0 = r * bh
            k = rnd.uniform(-0.07, 0.07) + (0.1 if rnd.random() < 0.08 else 0) - (0.1 if rnd.random() < 0.08 else 0)
            col = tuple(int(v * (1 + k)) for v in base)
            hi = tuple(min(255, int(v * 1.07)) for v in col); lo = tuple(int(v * 0.88) for v in col)
            box = [x0 + 3, y0 + 3, x0 + bw - 3, y0 + bh - 3]
            for dx in (-S, 0, S):           # wrap horizontally so the tile repeats
                b = [box[0] + dx, box[1], box[2] + dx, box[3]]
                d.rounded_rectangle(b, radius=5, fill=col)
                d.line([(b[0] + 5, b[1] + 2), (b[2] - 5, b[1] + 2)], fill=hi, width=3)
                d.line([(b[0] + 5, b[3] - 2), (b[2] - 5, b[3] - 2)], fill=lo, width=3)
            if rnd.random() < 0.12:         # a chipped corner
                cx = x0 + (6 if rnd.random() < 0.5 else bw - 18)
                for dx in (-S, 0, S):
                    d.polygon([(cx + dx, y0 + 4), (cx + 12 + dx, y0 + 4), (cx + dx, y0 + 14)], fill=(100, 82, 66))
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    im.save(path); print('wrote', path)


def banner(path=os.path.join(HERE, 'city_gate_banner.png')):
    W, H = 360, 1080
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    T = 34                                   # fringe teeth size
    red, dark, gold, goldd = (178, 34, 28, 255), (40, 24, 20, 255), (236, 182, 62, 255), (140, 88, 20, 255)
    # zigzag fringe on both long sides and the bottom (dark), body red
    pts = [(T, 0), (W - T, 0)]
    y = 0
    while y < H - T * 2:
        pts += [(W, y + T * 0.5), (W - T, y + T)]; y += T
    x = W - T
    while x > T:
        pts += [(x - T * 0.5, H), (x - T, H - T)]; x -= T
    y = H - T
    while y > 0:
        pts += [(0, y - T * 0.5), (T, y - T)]; y -= T
    d.polygon(pts, fill=dark)
    d.rectangle([T, 0, W - T, H - T], fill=dark)
    d.rectangle([T + 14, 14, W - T - 14, H - T - 14], fill=red)
    d.rectangle([T + 26, 26, W - T - 26, H - T - 26], outline=gold, width=6)
    # gold disc + character
    cx, cy, r = W // 2, 400, 118
    d.ellipse([cx - r - 8, cy - r - 8, cx + r + 8, cy + r + 8], fill=goldd)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=gold)
    d.text((cx, cy + 4), '\u9f8d', font=font(172), fill=dark, anchor='mm')
    # three gold flames under the disc
    for k, (fx, fh) in enumerate(((-70, 120), (0, 160), (70, 120))):
        x0 = cx + fx
        d.polygon([(x0 - 24, 720), (x0, 720 - fh), (x0 + 24, 720)], fill=gold)
        d.polygon([(x0 - 11, 720), (x0, 720 - fh * 0.55), (x0 + 11, 720)], fill=red)
    d.rectangle([T + 40, 728, W - T - 40, 744], fill=gold)
    im.save(path); print('wrote', path)


def plaque(path=os.path.join(HERE, 'city_gate_plaque.png')):
    W, H = 300, 760
    im = Image.new('RGB', (W, H), (140, 88, 20)); d = ImageDraw.Draw(im)
    d.rectangle([10, 10, W - 11, H - 11], fill=(232, 176, 58))
    d.rectangle([34, 34, W - 35, H - 35], fill=(140, 88, 20))
    d.rectangle([42, 42, W - 43, H - 43], fill=(34, 58, 104))
    f = font(170)
    for i, ch in enumerate('\u6c38\u5b89\u9580'):
        d.text((W / 2, 160 + i * 220), ch, font=f, fill=(244, 196, 80), anchor='mm', stroke_width=3, stroke_fill=(150, 96, 24))
    im.save(path); print('wrote', path)


def lattice(path, paper):
    W, H = 400, 800
    frame = (120, 30, 24)
    im = Image.new('RGB', (W, H), frame); d = ImageDraw.Draw(im)
    d.rectangle([28, 28, W - 29, H - 29], fill=paper)
    # cross lattice (diamonds) in the upper 2/3, a solid panel below
    yb = int(H * 0.66)
    step = 56
    for k in range(-H, W + H, step):
        d.line([(k, 28), (k + yb, 28 + yb)], fill=frame, width=11)
        d.line([(k, 28 + yb), (k + yb, 28)], fill=frame, width=11)
    d.rectangle([0, 0, W, 28], fill=frame); d.rectangle([0, 0, 28, H], fill=frame); d.rectangle([W - 28, 0, W, H], fill=frame)
    d.rectangle([0, yb, W, H], fill=frame)
    d.rectangle([52, yb + 40, W - 53, H - 52], fill=(150, 40, 30))
    d.rectangle([52, yb + 40, W - 53, H - 52], outline=(201, 154, 46), width=6)
    d.rectangle([0, yb, W, yb + 16], fill=(201, 154, 46))
    im.save(path); print('wrote', path)


if __name__ == '__main__':
    brick(); banner(); plaque()
    lattice(os.path.join(HERE, 'city_gate_lattice.png'), (226, 214, 186))
    lattice(os.path.join(HERE, 'city_gate_lattice_lit.png'), (255, 206, 120))
