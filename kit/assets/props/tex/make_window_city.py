# Textures for assets/props/window_city.py (run with the lab venv):
#   .venv/Scripts/python.exe assets/props/tex/make_window_city.py
# window_city_sky_<time>.png    one sky-bowl facet (1.36 x 11 m): the vertical gradient from window_city.SKY (+ stars)
# window_city_sky_<time>_c.png  the centre facet: the same + the setting sun (dusk) / crescent moon (night)
# window_city_grille.png        the air-con grille along the sill
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import window_city as W   # noqa: E402  (plain python at import time: no bpy needed)

FW, FH = 260, 2200                 # facet image size (~5 mm per pixel)
FACET_W = 1.36


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def row_z(r): return W.Z_HI - (r + 0.5) / FH * (W.Z_HI - W.Z_LO)


def z_row(z): return (W.Z_HI - z) / (W.Z_HI - W.Z_LO) * FH


def gradient(time):
    im = Image.new('RGB', (FW, FH))
    d = ImageDraw.Draw(im)
    for r in range(FH):
        d.line([(0, r), (FW, r)], fill=rgb(W.sky_color(time, row_z(r))))
    return im


def blend(im, cx, cy, rad, color, peak, power=2.0):
    """Soft radial glow added over the image (peak = max mix)."""
    px = im.load(); c = rgb(color)
    for y in range(max(0, int(cy - rad)), min(FH, int(cy + rad) + 1)):
        for x in range(max(0, int(cx - rad)), min(FW, int(cx + rad) + 1)):
            d = math.hypot(x - cx, y - cy) / rad
            if d >= 1: continue
            k = peak * (1 - d) ** power
            p = px[x, y]
            px[x, y] = tuple(round(p[i] + (c[i] - p[i]) * k) for i in range(3))


def stars(im, seed, zmin, n, color, big=3):
    rnd = random.Random(seed)
    d = ImageDraw.Draw(im)
    top = 6
    for i in range(n):
        x = rnd.uniform(10, FW - 10); y = rnd.uniform(top, z_row(zmin))
        r = rnd.choice((2.5, 3, 3.5, 4.5))
        a = max(0.35, min(1.0, 1.0 - y / z_row(zmin) * 0.6))
        p = im.getpixel((int(x), int(y))); c = rgb(color)
        cc = tuple(round(p[j] + (c[j] - p[j]) * a) for j in range(3))
        d.ellipse([x - r, y - r, x + r, y + r], fill=cc)
    for i in range(big):   # a few 4-point sparkles
        x = rnd.uniform(30, FW - 30); y = rnd.uniform(top + 40, z_row(zmin + 1.5))
        L, w = 16, 3
        d.polygon([(x, y - L), (x + w, y), (x, y + L), (x - w, y)], fill=rgb(color))
        d.polygon([(x - L, y), (x, y - w), (x + L, y), (x, y + w)], fill=rgb(color))


def main():
    for time in ('day', 'dusk', 'night'):
        im = gradient(time)
        if time == 'dusk': stars(im, 11, 4.2, 6, '#ffe9c9', big=0)
        if time == 'night': stars(im, 12, 1.0, 34, '#fff4d8', big=2)
        im.save(os.path.join(HERE, f'window_city_sky_{time}.png'))
        c = im.copy()
        cx = FW / 2
        if time == 'dusk':        # big low sun with a warm halo (fades out well inside the facet)
            cy = z_row(0.5); pr = 1 / 0.005
            blend(c, cx, cy, 0.62 * pr, '#ffe6a8', 0.75, 1.6)
            d = ImageDraw.Draw(c); r = 0.3 * pr
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rgb('#fff0c0'))
        if time == 'night':       # crescent moon
            cy = z_row(2.0); pr = 1 / 0.005
            blend(c, cx, cy, 0.58 * pr, '#c9c4ff', 0.35, 1.8)
            r = 0.22 * pr
            mask = Image.new('L', (FW, FH), 0); md = ImageDraw.Draw(mask)
            md.ellipse([cx - r, cy - r, cx + r, cy + r], fill=255)
            ox, oy = r * 0.42, -r * 0.22
            md.ellipse([cx - r + ox, cy - r + oy, cx + r + ox, cy + r + oy], fill=0)
            mask = mask.filter(ImageFilter.GaussianBlur(0.8))
            c.paste(Image.new('RGB', (FW, FH), rgb('#fff1c2')), (0, 0), mask)
        c.save(os.path.join(HERE, f'window_city_sky_{time}_c.png'))
    # grille: 0.62 x 0.075 m plate, light frame, dark slots
    g = Image.new('RGB', (1240, 150), rgb('#c9cac6'))
    d = ImageDraw.Draw(g)
    d.rectangle([0, 0, 1239, 149], outline=rgb('#8f918e'), width=8)
    n = 34; x0, x1 = 40, 1200
    for i in range(n):
        x = x0 + (x1 - x0) * i / (n - 1)
        d.rounded_rectangle([x - 9, 30, x + 9, 120], radius=8, fill=rgb('#4a4d52'))
    g.save(os.path.join(HERE, 'window_city_grille.png'))
    print('ok')


if __name__ == '__main__':
    main()
