# Textures for assets/props/ceiling_light.py (lab venv):
#   .venv/Scripts/python.exe assets/props/tex/make_ceiling_light.py
# ceiling_light_diffuser.png      lit prismatic diffuser (1.13 x 0.53 m): cool white, two brighter tube bands, a soft
#                                 darker rim where the recess shades it, a faint prism grid, one dead fly (of course)
# ceiling_light_diffuser_off.png  the same diffuser switched off (pale grey, no bands)
import math, os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1130, 530


def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def mix(a, b, k): return tuple(round(x + (y - x) * k) for x, y in zip(a, b))


def panel(centre, edge, bands):
    im = Image.new('RGB', (W, H))
    px = im.load(); c, e = rgb(centre), rgb(edge)
    for y in range(H):
        for x in range(W):
            # distance to the nearest edge, in pixels: darker within ~60 px of the frame
            d = min(x, W - 1 - x, y, H - 1 - y)
            k = max(0.0, 1.0 - d / 70.0) ** 1.6
            px[x, y] = mix(c, e, k)
    if bands:
        lay = Image.new('L', (W, H), 0); d = ImageDraw.Draw(lay)
        for fy in (0.31, 0.69):
            y = H * fy
            d.rounded_rectangle([60, y - 22, W - 60, y + 22], radius=22, fill=255)
        lay = lay.filter(ImageFilter.GaussianBlur(26))
        white = Image.new('RGB', (W, H), rgb('#ffffff'))
        im = Image.composite(white, im, lay.point(lambda v: int(v * 0.95)))
    # faint prism grid
    d = ImageDraw.Draw(im)
    for y in range(8, H, 14):
        for x in range(8, W, 14):
            p = im.getpixel((x, y))
            d.point([(x, y), (x + 1, y)], fill=mix(p, (120, 140, 150), 0.12))
    return im


def fly(im, x, y):
    d = ImageDraw.Draw(im)
    d.ellipse([x - 5, y - 3, x + 5, y + 3], fill=rgb('#4a4744'))
    d.ellipse([x - 9, y - 8, x - 1, y - 2], fill=rgb('#8b8a86'))
    d.ellipse([x + 1, y - 8, x + 9, y - 2], fill=rgb('#8b8a86'))


def main():
    on = panel('#e9f2f7', '#b9ccd8', True)
    fly(on, 930, 420)
    on.save(os.path.join(HERE, 'ceiling_light_diffuser.png'))
    off = panel('#dfe2df', '#c3c8c6', False)
    fly(off, 930, 420)
    off.save(os.path.join(HERE, 'ceiling_light_diffuser_off.png'))
    print('ok')


if __name__ == '__main__':
    main()
