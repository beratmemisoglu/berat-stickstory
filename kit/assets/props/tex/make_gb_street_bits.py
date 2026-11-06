# Street dressing graphics for gb_street_bits / gb_street_lamp (lab venv):
#   .venv/Scripts/python.exe assets/props/tex/make_gb_street_bits.py            -> the fixed textures (staves, boards, water,
#                                                                                 lamp panes on/off)
#   ... sign "<text>" <out.png> [bg] [ink]                                       -> a painted shop sign board
#   ... stencil "<text>" <out.png> [ink]                                         -> stencilled crate lettering (RGBA, alpha clip)
# The props call the text forms themselves (cached by a hash of the content).
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')


def _font(name, size):
    for f in (name, 'georgiab.ttf', 'ariblk.ttf', 'arialbd.ttf'):
        p = os.path.join(FONTS, f)
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def _hex(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _grain(d, x0, y0, x1, y1, base, rnd, vertical=True, n=14, dark=0.82):
    """Painted wood grain strokes inside a board."""
    for _ in range(n):
        k = rnd.uniform(dark, 0.95)
        c = tuple(int(v * k) for v in base)
        if vertical:
            x = rnd.uniform(x0 + 4, x1 - 4); w = rnd.uniform(0.6, 1.0)
            pts = [(x + 3 * math.sin(t / 37.0 + x), y0 + t) for t in range(0, int(y1 - y0), 8)]
        else:
            y = rnd.uniform(y0 + 4, y1 - 4)
            pts = [(x0 + t, y + 3 * math.sin(t / 41.0 + y)) for t in range(0, int(x1 - x0), 8)]
        if len(pts) > 1: d.line(pts, fill=c, width=rnd.choice((2, 3, 3, 4)))
    # a knot or two
    for _ in range(rnd.choice((0, 1, 1, 2))):
        cx, cy = rnd.uniform(x0 + 15, x1 - 15), rnd.uniform(y0 + 15, y1 - 15)
        r = rnd.uniform(5, 9)
        c = tuple(int(v * 0.62) for v in base)
        d.ellipse([cx - r * 1.6, cy - r, cx + r * 1.6, cy + r], outline=c, width=3)


def staves(path):
    """Barrel staves: vertical boards with dark seams, grain, a little wear (tiles horizontally)."""
    W, H = 512, 512
    rnd = random.Random(3)
    im = Image.new('RGB', (W, H), '#6a4129'); d = ImageDraw.Draw(im)
    n = 6; sw = W / n
    for i in range(n):
        base = _hex('#7a4b2c'); k = rnd.uniform(0.88, 1.08); base = tuple(min(255, int(v * k)) for v in base)
        x0, x1 = i * sw, (i + 1) * sw
        d.rectangle([x0, 0, x1, H], fill=base)
        _grain(d, x0, 0, x1, H, base, rnd, True, 9)
        d.line([(x0 + 3, 0), (x0 + 3, H)], fill=tuple(min(255, int(v * 1.12)) for v in base), width=3)   # lit bevel
        d.line([(x0, 0), (x0, H)], fill='#2e1d14', width=5)                                             # seam
    im = im.filter(ImageFilter.GaussianBlur(0.6)); im.save(path); print('wrote', path)


def boards(path, color='#8a6440', seed=5):
    """Horizontal planks (crates, troughs, benches): grain, seams, nail heads at the ends."""
    W, H = 512, 512
    rnd = random.Random(seed)
    im = Image.new('RGB', (W, H), color); d = ImageDraw.Draw(im)
    n = 4; bh = H / n
    for i in range(n):
        base = _hex(color); k = rnd.uniform(0.86, 1.08); base = tuple(min(255, int(v * k)) for v in base)
        y0, y1 = i * bh, (i + 1) * bh
        d.rectangle([0, y0, W, y1], fill=base)
        _grain(d, 0, y0, W, y1, base, rnd, False, 7)
        d.line([(0, y0 + 3), (W, y0 + 3)], fill=tuple(min(255, int(v * 1.12)) for v in base), width=3)
        d.line([(0, y0), (W, y0)], fill='#2e1d14', width=5)
        for x in (18, W - 18):
            d.ellipse([x - 5, y0 + bh / 2 - 5, x + 5, y0 + bh / 2 + 5], fill='#3a3330')
    im = im.filter(ImageFilter.GaussianBlur(0.6)); im.save(path); print('wrote', path)


def water(path):
    """Trough water at night: deep teal with pale ripple arcs and a moon glint."""
    W, H = 512, 256
    im = Image.new('RGB', (W, H), '#1f4a55'); d = ImageDraw.Draw(im)
    for y in range(H):
        k = y / H
        c = tuple(int(a + (b - a) * k) for a, b in zip((44, 98, 110), (24, 62, 74)))
        d.line([(0, y), (W, y)], fill=c)
    rnd = random.Random(7)
    for _ in range(18):
        x, y = rnd.uniform(0, W), rnd.uniform(10, H - 10); w = rnd.uniform(30, 90)
        d.arc([x - w, y - 6, x + w, y + 6], 200, 340, fill='#7fb9bf', width=3)
    d.ellipse([W * 0.62, H * 0.25, W * 0.62 + 70, H * 0.25 + 26], fill='#cfe9e4')
    im = im.filter(ImageFilter.GaussianBlur(1.0)); im.save(path); print('wrote', path)


def pane(path, lit=True):
    """Gas lamp glass pane: lit = warm amber glow with a bright flame + mantle in the middle; unlit = dark glass + shine."""
    W, H = 256, 384
    if lit:
        im = Image.new('RGB', (W, H), '#c86a1e')
        glow = Image.new('L', (W, H), 0); g = ImageDraw.Draw(glow)
        for r in range(170, 0, -6):
            g.ellipse([W / 2 - r, H * 0.55 - r * 1.15, W / 2 + r, H * 0.55 + r * 1.15], fill=int(255 * (1 - r / 170) ** 0.8))
        glow = glow.filter(ImageFilter.GaussianBlur(14))
        im.paste((255, 196, 96), (0, 0), glow)
        d = ImageDraw.Draw(im)
        # flame: a teardrop, pale core
        cx, cy = W / 2, H * 0.6
        d.polygon([(cx, cy - 120), (cx + 34, cy - 20), (cx + 30, cy + 20), (cx, cy + 40), (cx - 30, cy + 20), (cx - 34, cy - 20)],
                  fill=(255, 226, 150))
        d.polygon([(cx, cy - 80), (cx + 18, cy - 10), (cx, cy + 26), (cx - 18, cy - 10)], fill=(255, 250, 220))
        # burner below the flame
        d.rectangle([cx - 22, cy + 44, cx + 22, cy + 70], fill=(70, 40, 24))
        d.rectangle([cx - 8, cy + 70, cx + 8, H], fill=(70, 40, 24))
        im = im.filter(ImageFilter.GaussianBlur(1.2))
    else:
        im = Image.new('RGB', (W, H), '#2a3440'); d = ImageDraw.Draw(im)
        for y in range(H):
            k = y / H
            c = tuple(int(a + (b - a) * k) for a, b in zip((58, 70, 84), (30, 36, 46)))
            d.line([(0, y), (W, y)], fill=c)
        d.rectangle([W / 2 - 22, H * 0.6 + 44, W / 2 + 22, H * 0.6 + 70], fill=(22, 20, 22))
        d.rectangle([W / 2 - 8, H * 0.6 + 70, W / 2 + 8, H], fill=(22, 20, 22))
    sh = Image.new('L', (W, H), 0); s = ImageDraw.Draw(sh)
    s.polygon([(30, 190), (110, 40), (140, 40), (60, 190)], fill=150 if lit else 200)
    s.polygon([(70, 230), (150, 80), (166, 80), (86, 230)], fill=120 if lit else 170)
    im.paste((255, 246, 222) if lit else (150, 170, 186), (0, 0), sh)
    im.save(path); print('wrote', path)


def sign(text, path, bg='#2f4a3a', ink='#e8d9a8'):
    """Painted shop sign: a dark painted board, a gold double border, serif lettering with a drop shadow, worn spots."""
    lines = text.replace('\\n', '\n').split('\n')
    if len(lines) == 1 and len(text) > 15:      # long names go on two lines (bigger letters at phone size)
        if ' - ' in text: lines = [p.strip() for p in text.split(' - ', 1)]
        elif ' ' in text:
            sp = [i for i, c in enumerate(text) if c == ' ']; i = min(sp, key=lambda i: abs(i - len(text) / 2))
            lines = [text[:i], text[i + 1:]]
    W, H = 1400, 520
    rnd = random.Random(sum(map(ord, text)))
    im = Image.new('RGB', (W, H), bg); d = ImageDraw.Draw(im)
    b = _hex(bg)
    for i in range(5):    # faint horizontal planks under the paint
        y = i * H / 5
        d.line([(0, y), (W, y)], fill=tuple(int(v * 0.72) for v in b), width=4)
        for _ in range(5):
            yy = rnd.uniform(y + 8, y + H / 5 - 8)
            d.line([(0, yy), (W, yy + rnd.uniform(-6, 6))], fill=tuple(int(v * 0.9) for v in b), width=2)
    inkc = _hex(ink)
    d.rectangle([22, 22, W - 22, H - 22], outline=inkc, width=12)
    d.rectangle([50, 50, W - 50, H - 50], outline=inkc, width=4)
    for (x, y) in ((50, 50), (W - 50, 50), (50, H - 50), (W - 50, H - 50)):
        d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=inkc)
    # fit the text
    size = 260 if len(lines) == 1 else 160
    while size > 40:
        f = _font('georgiab.ttf', size)
        ws = [d.textbbox((0, 0), ln, font=f) for ln in lines]
        tw = max(bb[2] - bb[0] for bb in ws); th = sum(bb[3] - bb[1] for bb in ws) + (len(lines) - 1) * size * 0.25
        if tw < W - 190 and th < H - 170: break
        size -= 8
    y = (H - th) / 2
    for ln, bb in zip(lines, ws):
        x = (W - (bb[2] - bb[0])) / 2 - bb[0]
        d.text((x + 7, y - bb[1] + 7), ln, font=f, fill=tuple(int(v * 0.35) for v in b))
        d.text((x, y - bb[1]), ln, font=f, fill=inkc)
        y += (bb[3] - bb[1]) + size * 0.25
    # worn paint: a few chips showing the raw wood
    for _ in range(10):   # chips only along the edges (in the middle they read as spots)
        side = rnd.choice('tblr')
        cx = rnd.uniform(0, W) if side in 'tb' else (rnd.uniform(0, 30) if side == 'l' else rnd.uniform(W - 30, W))
        cy = rnd.uniform(0, H) if side in 'lr' else (rnd.uniform(0, 30) if side == 't' else rnd.uniform(H - 30, H))
        r = rnd.uniform(5, 14)
        d.polygon([(cx - r * 1.8, cy), (cx - r * 0.3, cy - r), (cx + r * 1.5, cy - r * 0.4), (cx + r * 0.6, cy + r)], fill='#7d5a3a')
    im = im.filter(ImageFilter.GaussianBlur(0.8)); im.save(path); print('wrote', path)


def stencil(text, path, ink='#2a201a'):
    """Crate stencil: Arial Black letters with stencil bridges + overspray speckle, on transparent."""
    lines = text.replace('\\n', '\n').split('\n')
    W, H = 1024, 512
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    m = Image.new('L', (W, H), 0); md = ImageDraw.Draw(m)
    size = 230 if len(lines) == 1 else 150
    while size > 30:
        f = _font('ariblk.ttf', size)
        ws = [md.textbbox((0, 0), ln, font=f) for ln in lines]
        tw = max(bb[2] - bb[0] for bb in ws); th = sum(bb[3] - bb[1] for bb in ws) + (len(lines) - 1) * 30
        if tw < W - 80 and th < H - 80: break
        size -= 8
    y = (H - th) / 2
    for ln, bb in zip(lines, ws):
        x = (W - (bb[2] - bb[0])) / 2 - bb[0]
        md.text((x, y - bb[1]), ln, font=f, fill=255)
        hgt = bb[3] - bb[1]
        # stencil bridges: two horizontal gaps through every line
        for k in (0.36, 0.64):
            md.rectangle([0, y + hgt * k - 5, W, y + hgt * k + 5], fill=0)
        y += hgt + 30
    rnd = random.Random(len(text))
    m = m.filter(ImageFilter.GaussianBlur(1.2))
    m = m.point(lambda v: 255 if v > 110 else 0)
    c = _hex(ink)
    im.paste(c + (255,), (0, 0), m)
    for _ in range(260):   # overspray
        x, y = rnd.uniform(40, W - 40), rnd.uniform(40, H - 40)
        if m.getpixel((int(x), int(y))) == 0 and rnd.random() < 0.3:
            r = rnd.uniform(1.5, 3.5); d.ellipse([x - r, y - r, x + r, y + r], fill=c + (255,))
    im.save(path); print('wrote', path)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'sign':
        sign(a[1], a[2], *(a[3:5]))
    elif a and a[0] == 'stencil':
        stencil(a[1], a[2], *(a[3:4]))
    else:
        staves(os.path.join(HERE, 'gb_street_bits_staves.png'))
        boards(os.path.join(HERE, 'gb_street_bits_boards.png'))
        boards(os.path.join(HERE, 'gb_street_bits_boards_grey.png'), '#7d7466', seed=9)
        water(os.path.join(HERE, 'gb_street_bits_water.png'))
        pane(os.path.join(HERE, 'gb_street_bits_pane_on.png'), True)
        pane(os.path.join(HERE, 'gb_street_bits_pane_off.png'), False)
