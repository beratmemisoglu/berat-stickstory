# Bare steel desk graphics (lab venv): .venv/Scripts/python.exe assets/props/tex/make_bare_desk.py
#   bare_desk_tag.png    old asset-tag sticker (number + barcode, a torn corner)
#   bare_desk_dent.png   cartoon dent: a dark and a light arc on transparent (tinted by the body colour in Blender)
#   bare_desk_paper.png  one sheet of paper: dark edge line, faint heading + text lines, an empty signature box
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')
INK = (42, 38, 34)


def font(n, size): return ImageFont.truetype(os.path.join(FONTS, n), size)


def tag():
    W, H = 300, 140
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    body = [(0, 0), (W - 1, 0), (W - 1, H - 34), (W - 34, H - 1), (0, H - 1)]       # torn-off corner
    d.polygon(body, fill=(226, 220, 200, 255), outline=INK)
    d.line(body + [body[0]], fill=INK, width=6)
    d.text((16, 12), 'No. 0427', font=font('ariblk.ttf', 40), fill=INK)
    x = 18
    for i, w in enumerate([4, 2, 6, 2, 3, 5, 2, 4, 2, 6, 3, 2, 5, 2, 4, 3, 2, 6, 2, 4, 3, 5, 2]):
        if i % 2 == 0: d.rectangle([x, 70, x + w * 2, 118], fill=INK)
        x += w * 2 + 3
        if x > W - 60: break
    im.save(os.path.join(HERE, 'bare_desk_tag.png'))


def dent():
    # a dimple lit from the upper left: its upper-left inner wall is in shadow, the lower-right one catches the light
    # (an arc alone read as a smiley mouth on the drawer). Grey values: the material tints them by body colour x 1.3.
    from PIL import ImageChops
    W, H = 256, 128
    box = [28, 14, 228, 114]
    def ell(dx, dy):
        m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).ellipse([box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy], fill=255); return m
    e = ell(0, 0)
    shadow = ImageChops.subtract(e, ell(30, 22))
    light = ImageChops.subtract(ImageChops.subtract(e, ell(-8, -7)), shadow)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    im.paste((176, 176, 176, 255), (0, 0), shadow)
    im.paste((255, 255, 255, 255), (0, 0), light)
    im.save(os.path.join(HERE, 'bare_desk_dent.png'))


def paper():
    W, H = 420, 594
    im = Image.new('RGB', (W, H), (242, 239, 230)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], outline=INK, width=5)
    d.rectangle([40, 44, 250, 70], fill=(150, 146, 138))                        # heading
    d.line([(40, 92), (W - 40, 92)], fill=(150, 146, 138), width=3)
    for i in range(9):
        y = 124 + i * 34
        d.rectangle([40, y, W - 40 - (90 if i % 3 == 2 else 0), y + 9], fill=(196, 192, 182))
    d.rectangle([W - 170, H - 120, W - 40, H - 50], outline=(150, 146, 138), width=3)   # empty signature box
    im.save(os.path.join(HERE, 'bare_desk_paper.png'))


if __name__ == '__main__':
    tag(); dent(); paper(); print('wrote bare_desk_tag/dent/paper.png')
