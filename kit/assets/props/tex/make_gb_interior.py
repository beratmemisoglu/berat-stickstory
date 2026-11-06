# BELL interior prop graphics (lab venv): .venv/Scripts/python.exe assets/props/tex/make_gb_interior.py [what ...]
#   what = dial knit throw quilt rush check labels plate ticking  (no args: all)
# Writes assets/props/tex/gb_<prop>_<what>.png. The gb_* props call this themselves when a PNG is missing.
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')


def F(name, size):
    try: return ImageFont.truetype(os.path.join(FONTS, name), size)
    except Exception: return ImageFont.load_default()


def out(n): return os.path.join(HERE, n)


def noise(im, amt=10, seed=1):
    random.seed(seed)
    px = im.load(); W, H = im.size
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            d = random.randint(-amt, amt)
            for dx in (0, 1):
                for dy in (0, 1):
                    if x + dx < W and y + dy < H:
                        p = px[x + dx, y + dy]
                        px[x + dx, y + dy] = tuple(max(0, min(255, c + d)) for c in p[:3]) + tuple(p[3:])
    return im


# ------------------------------------------------------------ grandfather clock dial (arched painted dial)
def dial():
    W, H = 640, 800
    wood = (58, 33, 20)
    im = Image.new('RGB', (W, H), wood); d = ImageDraw.Draw(im)
    cream = (236, 222, 186)
    cx, cy, R = 320, 500, 300            # chapter ring centre
    ax, ay, AR = 320, 205, 300           # arch: top of the dial is a semicircle of radius 300 from y 205
    # dial plate = square part (y 205..800) + arch above
    d.rectangle([20, 205, 620, 800], fill=cream)
    d.pieslice([20, -95, 620, 505], 180, 360, fill=cream)
    # moon-phase window in the arch: night sky disc segment
    sky = (34, 46, 98)
    d.pieslice([110, 40, 530, 460], 180, 360, fill=sky)
    random.seed(4)
    for i in range(40):
        a = random.uniform(math.pi, 2 * math.pi); r = random.uniform(40, 200)
        x, y = 320 + r * math.cos(a), 250 + r * math.sin(a)
        s = random.choice((3, 4, 6))
        d.polygon([(x, y - s), (x + s * 0.35, y), (x, y + s), (x - s * 0.35, y)], fill=(250, 232, 150))
        d.polygon([(x - s, y), (x, y + s * 0.35), (x + s, y), (x, y - s * 0.35)], fill=(250, 232, 150))
    # the moon with a sleepy face
    mx, my, mr = 320, 150, 72
    d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=(246, 214, 112), outline=(120, 86, 30), width=5)
    d.arc([mx - 44, my - 18, mx - 12, my + 6], 200, 340, fill=(110, 70, 30), width=6)
    d.arc([mx + 12, my - 18, mx + 44, my + 6], 200, 340, fill=(110, 70, 30), width=6)
    d.ellipse([mx - 50, my + 10, mx - 26, my + 30], fill=(236, 150, 110))
    d.ellipse([mx + 26, my + 10, mx + 50, my + 30], fill=(236, 150, 110))
    d.arc([mx - 16, my + 14, mx + 16, my + 40], 20, 160, fill=(110, 70, 30), width=5)
    # the two hemisphere humps (painted globes) hide the lower corners of the window
    for hx in (110, 530):
        d.pieslice([hx - 105, 145, hx + 105, 355], 180, 360, fill=(84, 140, 168), outline=(60, 40, 24), width=5)
        d.arc([hx - 70, 180, hx + 30, 300], 200, 320, fill=(98, 150, 76), width=14)
    d.line([(20, 250), (620, 250)], fill=(150, 110, 50), width=8)
    # spandrel corners: painted roses + leaves
    for (sx, sy) in ((70, 760), (570, 760)):
        for k, (dx, dy) in enumerate(((0, 0), (-28, -18), (26, -20))):
            r = 20 if k == 0 else 13
            d.ellipse([sx + dx - 30, sy + dy - 12, sx + dx - 6, sy + dy + 6], fill=(70, 118, 56))
            d.ellipse([sx + dx - r, sy + dy - r, sx + dx + r, sy + dy + r], fill=(190, 52, 58), outline=(110, 28, 30), width=3)
            d.arc([sx + dx - r * 0.6, sy + dy - r * 0.6, sx + dx + r * 0.6, sy + dy + r * 0.6], 30, 300, fill=(120, 28, 34), width=3)
    # chapter ring
    ink = (40, 30, 24)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(242, 232, 204), outline=ink, width=7)
    d.ellipse([cx - R + 22, cy - R + 22, cx + R - 22, cy + R - 22], outline=ink, width=3)
    d.ellipse([cx - R + 100, cy - R + 100, cx + R - 100, cy + R - 100], outline=ink, width=4)
    for m in range(60):
        a = math.radians(m * 6 - 90)
        r0, r1 = R - 22, R - (6 if m % 5 else 2)
        d.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], fill=ink, width=3 if m % 5 else 6)
    nums = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
    f = F('timesbd.ttf', 64)
    for i, s in enumerate(nums):
        a = math.radians(i * 30 - 90)
        rr = R - 62
        tw = d.textbbox((0, 0), s, font=f)
        t = Image.new('RGBA', (tw[2] - tw[0] + 20, tw[3] - tw[1] + 30), (0, 0, 0, 0))
        ImageDraw.Draw(t).text((10 - tw[0], 10 - tw[1]), s, font=f, fill=ink)
        t = t.rotate(-i * 30, expand=True, resample=Image.BICUBIC)
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        im.paste(t, (int(x - t.size[0] / 2), int(y - t.size[1] / 2)), t)
    # centre: maker's cartouche + a painted bird
    fs = F('georgiab.ttf', 30)
    for s, yy in (('W. HARTLEY', cy + 92), ('1831', cy + 128)):
        b = d.textbbox((0, 0), s, font=fs); d.text((cx - (b[2] - b[0]) / 2, yy - 16), s, font=fs, fill=(120, 40, 36))
    for k in range(8):      # a small painted flower ring round the hand arbor
        a = math.radians(k * 45); x, y = cx + 46 * math.cos(a), cy + 46 * math.sin(a)
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=(190, 52, 58) if k % 2 else (70, 118, 56))
    # outer edge of the plate
    d.arc([20, -95, 620, 505], 180, 360, fill=(150, 110, 50), width=10)
    d.line([(24, 205), (24, 800)], fill=(150, 110, 50), width=10); d.line([(616, 205), (616, 800)], fill=(150, 110, 50), width=10)
    noise(im, 7, 3)
    im.save(out('gb_clock_dial.png')); print('dial')


# ------------------------------------------------------------ knitted cushion (stripes of V stitches)
def knit():
    W = H = 512
    im = Image.new('RGB', (W, H), (160, 52, 42)); d = ImageDraw.Draw(im)
    bands = [(160, 52, 42), (160, 52, 42), (200, 146, 44), (230, 214, 178), (200, 146, 44), (60, 98, 120), (60, 98, 120)]
    cw, ch = 16, 16
    for row in range(H // ch):
        c = bands[(row // 3) % len(bands)]
        dk = tuple(int(v * 0.68) for v in c)
        for colm in range(W // cw):
            x, y = colm * cw, row * ch
            d.rectangle([x, y, x + cw, y + ch], fill=dk)
            d.polygon([(x + 1, y), (x + cw / 2, y + ch * 0.55), (x + cw / 2 - 1, y + ch), (x + 1, y + ch * 0.45)], fill=c)
            d.polygon([(x + cw - 1, y), (x + cw / 2, y + ch * 0.55), (x + cw / 2 + 1, y + ch), (x + cw - 1, y + ch * 0.45)], fill=tuple(min(255, int(v * 1.08)) for v in c))
    noise(im, 6, 5)
    im.save(out('gb_rocking_chair_knit.png')); print('knit')


# ------------------------------------------------------------ crocheted throw (granny squares)
def throw():
    W = H = 512
    im = Image.new('RGB', (W, H), (52, 40, 34)); d = ImageDraw.Draw(im)
    pal = [(196, 72, 70), (214, 160, 52), (58, 132, 128), (226, 212, 180), (126, 78, 130), (98, 140, 64)]
    n = 4; s = W // n
    random.seed(7)
    for j in range(n):
        for i in range(n):
            x, y = i * s, j * s
            rings = random.sample(pal, 4)
            for k, c in enumerate(rings):
                m = 6 + k * 14
                d.rectangle([x + m, y + m, x + s - m, y + s - m], fill=c)
            # little crochet holes on each ring
            for k in range(4):
                m = 13 + k * 14
                for t in range(0, s - 2 * m, 14):
                    for (px, py) in ((x + m + t, y + m), (x + m + t, y + s - m), (x + m, y + m + t), (x + s - m, y + m + t)):
                        d.ellipse([px - 2, py - 2, px + 2, py + 2], fill=(52, 40, 34))
    noise(im, 6, 8)
    im.save(out('gb_rocking_chair_throw.png')); print('throw')


# ------------------------------------------------------------ patchwork quilt
def quilt():
    W = H = 1024
    n = 8; s = W // n
    im = Image.new('RGB', (W, H), (230, 214, 180)); d = ImageDraw.Draw(im)
    pal = [(184, 62, 46), (206, 150, 40), (44, 128, 124), (44, 70, 122), (92, 136, 56), (194, 92, 118), (230, 214, 180), (126, 70, 120)]
    random.seed(11)
    for j in range(n):
        for i in range(n):
            x, y = i * s, j * s
            c = pal[(i * 3 + j * 5 + random.randint(0, 2)) % len(pal)]
            c2 = (238, 228, 204) if c != (230, 214, 180) else (184, 62, 46)
            d.rectangle([x, y, x + s, y + s], fill=c)
            kind = (i + 2 * j) % 5
            if kind == 0:     # polka dots
                for yy in range(y + 12, y + s, 26):
                    for xx in range(x + 12 + (13 if (yy // 26) % 2 else 0), x + s, 26):
                        d.ellipse([xx - 5, yy - 5, xx + 5, yy + 5], fill=c2)
            elif kind == 1:   # stripes
                for xx in range(x, x + s, 22): d.rectangle([xx, y, xx + 8, y + s], fill=c2)
            elif kind == 2:   # gingham
                for xx in range(x, x + s, 32): d.rectangle([xx, y, xx + 14, y + s], fill=tuple((a + b) // 2 for a, b in zip(c, c2)))
                for yy in range(y, y + s, 32): d.rectangle([x, yy, x + s, yy + 14], fill=tuple((a + b) // 2 for a, b in zip(c, c2)))
            elif kind == 3:   # star
                cx, cy = x + s / 2, y + s / 2
                pts = []
                for k in range(10):
                    a = math.radians(k * 36 - 90); r = 44 if k % 2 == 0 else 18
                    pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
                d.polygon(pts, fill=c2)
            else:             # little flowers
                for (fx, fy) in ((x + 32, y + 32), (x + 96, y + 40), (x + 60, y + 96)):
                    for k in range(5):
                        a = math.radians(k * 72)
                        d.ellipse([fx + 9 * math.cos(a) - 7, fy + 9 * math.sin(a) - 7, fx + 9 * math.cos(a) + 7, fy + 9 * math.sin(a) + 7], fill=c2)
                    d.ellipse([fx - 5, fy - 5, fx + 5, fy + 5], fill=(206, 150, 40))
    # seams + dashed stitches
    for k in range(n + 1):
        d.line([(k * s, 0), (k * s, H)], fill=(70, 46, 36), width=5); d.line([(0, k * s), (W, k * s)], fill=(70, 46, 36), width=5)
        for t in range(0, W, 16):
            d.line([(k * s + 8, t), (k * s + 8, t + 8)], fill=(246, 236, 210), width=2)
            d.line([(t, k * s + 8), (t + 8, k * s + 8)], fill=(246, 236, 210), width=2)
    noise(im, 8, 12)
    im.save(out('gb_bed_quilt.png')); print('quilt')


def ticking():
    W = H = 256
    im = Image.new('RGB', (W, H), (228, 218, 196)); d = ImageDraw.Draw(im)
    for x in range(0, W, 32):
        d.rectangle([x, 0, x + 8, H], fill=(58, 84, 128)); d.rectangle([x + 14, 0, x + 16, H], fill=(58, 84, 128))
    noise(im, 6, 2)
    im.save(out('gb_bed_ticking.png')); print('ticking')


# ------------------------------------------------------------ rush seat (woven corner to centre)
def rush():
    W = H = 512
    im = Image.new('RGB', (W, H), (176, 136, 62)); d = ImageDraw.Draw(im)
    c = W / 2
    light, dark = (190, 150, 70), (112, 82, 34)
    for k in range(0, int(c), 14):
        # four trapezoid sectors: strands parallel to each edge
        for side in range(4):
            if side == 0: a, b = (k, k), (W - k, k)
            elif side == 1: a, b = (W - k, k), (W - k, H - k)
            elif side == 2: a, b = (W - k, H - k), (k, H - k)
            else: a, b = (k, H - k), (k, k)
            col = light if (k // 14) % 2 else (168, 128, 56)
            d.line([a, b], fill=col, width=10)
            d.line([a, b], fill=dark, width=2)
    d.line([(0, 0), (W, H)], fill=(84, 60, 26), width=6); d.line([(W, 0), (0, H)], fill=(84, 60, 26), width=6)
    noise(im, 8, 9)
    im.save(out('gb_chair_rush.png')); print('rush')


# ------------------------------------------------------------ red-white checked cloth (tile)
def check():
    W = H = 256
    im = Image.new('RGB', (W, H), (238, 230, 214)); d = ImageDraw.Draw(im)
    red, half = (176, 40, 36), (210, 128, 118)
    s = 32
    for x in range(0, W, 2 * s): d.rectangle([x, 0, x + s - 1, H], fill=half)
    for y in range(0, H, 2 * s): d.rectangle([0, y, W, y + s - 1], fill=half)
    for x in range(0, W, 2 * s):
        for y in range(0, H, 2 * s): d.rectangle([x, y, x + s - 1, y + s - 1], fill=red)
    noise(im, 6, 4)
    im.save(out('gb_table_check.png')); print('check')


# ------------------------------------------------------------ hutch jar labels + blue-white plate
def labels():
    f = F('georgiab.ttf', 64)
    for word in ('FLOUR', 'SUGAR', 'BEANS'):
        im = Image.new('RGB', (360, 220), (236, 224, 190)); d = ImageDraw.Draw(im)
        d.rectangle([8, 8, 351, 211], outline=(120, 40, 36), width=6)
        d.rectangle([20, 20, 339, 199], outline=(120, 40, 36), width=2)
        b = d.textbbox((0, 0), word, font=f)
        d.text((180 - (b[2] - b[0]) / 2 - b[0], 110 - (b[3] - b[1]) / 2 - b[1]), word, font=f, fill=(40, 30, 24))
        for x in (40, 320): d.ellipse([x - 8, 102, x + 8, 118], fill=(120, 40, 36))
        noise(im, 6, 6)
        im.save(out(f'gb_hutch_{word.lower()}.png'))
    print('labels')


def plate():
    S = 512
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    blue, white = (36, 62, 140, 255), (236, 232, 220, 255)
    d.ellipse([4, 4, S - 4, S - 4], fill=white, outline=(30, 40, 80, 255), width=6)
    d.ellipse([22, 22, S - 22, S - 22], outline=blue, width=34)
    for k in range(16):    # scalloped rim pattern
        a = math.radians(k * 22.5); x, y = S / 2 + 200 * math.cos(a), S / 2 + 200 * math.sin(a)
        d.ellipse([x - 16, y - 16, x + 16, y + 16], fill=white, outline=blue, width=5)
    d.ellipse([130, 130, S - 130, S - 130], outline=blue, width=6)
    # willow-ish centre: a little house + tree + birds
    d.rectangle([200, 260, 290, 320], fill=blue); d.polygon([(190, 262), (245, 220), (300, 262)], fill=blue)
    d.ellipse([290, 180, 360, 250], fill=blue); d.rectangle([318, 240, 330, 320], fill=blue)
    d.line([(160, 330), (360, 330)], fill=blue, width=6)
    for bx in (200, 230):
        d.arc([bx, 180, bx + 22, 196], 200, 340, fill=blue, width=4)
    im.save(out('gb_hutch_plate.png')); print('plate')


def glass():
    """Clock-door glass: transparent (alpha-clipped) with two cartoon shine strokes."""
    W, H = 270, 665
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(30, 250), (120, 70), (150, 70), (60, 250)], fill=(178, 196, 196, 255))
    d.polygon([(85, 285), (170, 115), (184, 115), (99, 285)], fill=(178, 196, 196, 255))
    d.polygon([(150, 600), (225, 450), (238, 450), (163, 600)], fill=(150, 170, 172, 255))
    im.save(out('gb_clock_glass.png')); print('glass')


ALL = {'glass': glass, 'dial': dial, 'knit': knit, 'throw': throw, 'quilt': quilt, 'rush': rush, 'check': check, 'labels': labels,
       'plate': plate, 'ticking': ticking}

if __name__ == '__main__':
    for w in (sys.argv[1:] or list(ALL)): ALL[w]()
