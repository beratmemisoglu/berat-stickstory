# Hanging lantern graphics (lab venv): .venv/Scripts/python.exe assets/props/tex/make_hanging_lantern.py
#   hanging_lantern_fu.png - the gold character "fu" (good fortune) with a darker gold edge on transparent (alpha-clipped
#                            onto the front lobe of the lantern)
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')


def font(size):
    for f in ('msjhbd.ttc', 'msyhbd.ttc', 'simsunb.ttf', 'YuGothB.ttc'):
        p = os.path.join(FONTS, f)
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def fu(path=os.path.join(HERE, 'hanging_lantern_fu.png')):
    W = H = 512
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    f = font(410)
    d.text((W / 2, H / 2 + 6), '\u798f', font=f, fill=(250, 196, 70, 255), anchor='mm', stroke_width=7,
           stroke_fill=(150, 92, 22, 255))
    d.text((W / 2, H / 2 + 6), '\u798f', font=f, fill=(250, 196, 70, 255), anchor='mm')
    im.save(path); print('wrote', path)


if __name__ == '__main__':
    fu()
