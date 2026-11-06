# Textures for assets/props/gb_iron_fence.py (run with the lab venv; the prop runs it itself when a PNG is missing):
#   .venv/Scripts/python.exe assets/props/tex/make_gb_iron_fence.py iron <out.png> <iron_hex>
#   .venv/Scripts/python.exe assets/props/tex/make_gb_iron_fence.py stone <out.png> <stone_hex>
# iron: seamless painted wrought iron, dark green-black with soft mottles, sparse rust blooms + short rust drips.
# stone: seamless weathered curb stone, grey with speckles, darker stains and a few moss-green patches.
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter

S = 256


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)


def wrap_ellipse(d, x, y, rx, ry, fill):
    for ox in (-S, 0, S):
        for oy in (-S, 0, S):
            d.ellipse([x + ox - rx, y + oy - ry, x + ox + rx, y + oy + ry], fill=fill)


def iron(out, base):
    rnd = random.Random(3); b = rgb(base)
    im = Image.new('RGB', (S, S), b); d = ImageDraw.Draw(im)
    for i in range(40):
        wrap_ellipse(d, rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(10, 30), rnd.uniform(10, 30),
                     shade(b, rnd.choice((0.9, 0.95, 1.06, 1.1))))
    im = im.filter(ImageFilter.GaussianBlur(8)); d = ImageDraw.Draw(im)
    # a little rust: three small muted blooms with drips (v1 had nine bright ones per tile: read as orange polka dots)
    rust = [rgb('#553222'), rgb('#62391f'), rgb('#4a2e22')]
    for i in range(3):
        x, y = rnd.uniform(0, S), rnd.uniform(0, S)
        for k in range(4):
            wrap_ellipse(d, x + rnd.uniform(-6, 6), y + rnd.uniform(-4, 4), rnd.uniform(2, 4), rnd.uniform(2, 3.5), rnd.choice(rust))
        L = rnd.uniform(14, 34)   # a drip below the bloom
        for ox in (-S, 0, S):
            for oy in (-S, 0, S):
                d.line([(x + ox, y + oy), (x + ox + rnd.uniform(-2, 2), y + oy + L)], fill=rust[2], width=2)
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    im.save(out); print('wrote', out)


def stone(out, base):
    rnd = random.Random(5); b = rgb(base)
    im = Image.new('RGB', (S, S), b); d = ImageDraw.Draw(im)
    for i in range(50):
        wrap_ellipse(d, rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(10, 34), rnd.uniform(8, 24),
                     shade(b, rnd.choice((0.82, 0.9, 1.1, 1.16))))
    for i in range(7):
        wrap_ellipse(d, rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(8, 18), rnd.uniform(5, 10), rgb(rnd.choice(('#4f6040', '#5a6b46'))))
    im = im.filter(ImageFilter.GaussianBlur(6)); d = ImageDraw.Draw(im)
    for i in range(500):
        wrap_ellipse(d, rnd.uniform(0, S), rnd.uniform(0, S), 1.0, 1.0, shade(b, rnd.choice((0.6, 0.7, 1.3))))
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    im.save(out); print('wrote', out)


if __name__ == '__main__':
    kind, out = sys.argv[1], sys.argv[2]
    hx = sys.argv[3] if len(sys.argv) > 3 else None
    if kind == 'iron': iron(out, hx or '#26302c')
    else: stone(out, hx or '#6f6b64')
