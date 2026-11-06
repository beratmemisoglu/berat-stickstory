# Bark texture for assets/props/gb_dead_tree.py (run with the lab venv; the prop runs it itself when the PNG is missing):
#   .venv/Scripts/python.exe assets/props/tex/make_gb_dead_tree.py <out.png> <base_hex>
# A seamless (both ways) painted bark tile: dark grey-brown base with soft mottles, long wavy vertical fissures (dark),
# lighter ridge strokes beside them and a few pale lichen-grey flecks. V (image rows) runs along the branch.
import math, random, sys
from PIL import Image, ImageDraw, ImageFilter

S = 512


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def shade(c, k): return tuple(max(0, min(255, int(v * k))) for v in c)


def main(out, base):
    rnd = random.Random(7)
    b = rgb(base)
    im = Image.new('RGB', (S, S), b)
    d = ImageDraw.Draw(im)
    # soft mottles (drawn wrapped so the tile is seamless)
    for i in range(70):
        x, y = rnd.uniform(0, S), rnd.uniform(0, S); r = rnd.uniform(20, 70)
        c = shade(b, rnd.choice((0.86, 0.92, 1.08, 1.14)))
        for ox in (-S, 0, S):
            for oy in (-S, 0, S):
                d.ellipse([x + ox - r * 0.6, y + oy - r, x + ox + r * 0.6, y + oy + r], fill=c)
    im = im.filter(ImageFilter.GaussianBlur(14))
    d = ImageDraw.Draw(im)
    # ridges (lighter) and fissures (dark): wavy vertical strokes that wrap top-bottom
    cols = 11
    for i in range(cols):
        x0 = (i + rnd.uniform(-0.25, 0.25)) * S / cols
        ph, amp, fr = rnd.uniform(0, 6.28), rnd.uniform(4, 10), rnd.choice((1, 2))
        pts = [(x0 + amp * math.sin(2 * math.pi * fr * y / S + ph), y) for y in range(0, S + 8, 8)]
        # broken into irregular runs of varying width (one continuous line per column read as planks)
        k = 0
        while k < len(pts) - 1:
            run = rnd.randint(4, 14); seg = pts[k:k + run + 1]
            w = rnd.choice((3, 5, 6, 8)); jx = rnd.uniform(-4, 4)
            for ox in (-S, 0, S):
                d.line([(x + ox + jx + w + 2, y) for x, y in seg], fill=shade(b, 1.25), width=max(2, w - 2))
                d.line([(x + ox + jx, y) for x, y in seg], fill=shade(b, 0.42), width=w)
            k += run + rnd.choice((0, 0, 1, 2))
        # short cross cracks off the fissure
        for k in range(rnd.randint(1, 3)):
            y = rnd.uniform(0, S); x = x0 + amp * math.sin(2 * math.pi * fr * y / S + ph)
            L = rnd.uniform(10, 22) * rnd.choice((-1, 1))
            for ox in (-S, 0, S):
                d.line([(x + ox, y), (x + ox + L, y + rnd.uniform(-6, 6))], fill=shade(b, 0.55), width=3)
    # lichen flecks
    for i in range(40):
        x, y = rnd.uniform(0, S), rnd.uniform(0, S); r = rnd.uniform(2, 5)
        c = rgb(rnd.choice(('#7d7d6c', '#6f7362', '#8a8576')))
        for ox in (-S, 0, S):
            for oy in (-S, 0, S):
                d.ellipse([x + ox - r, y + oy - r * 0.7, x + ox + r, y + oy + r * 0.7], fill=c)
    im = im.filter(ImageFilter.GaussianBlur(0.8))
    im.save(out)
    print('wrote', out)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '#4d4239')
