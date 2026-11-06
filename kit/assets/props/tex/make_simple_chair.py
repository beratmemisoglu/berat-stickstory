# Simple chair graphics (lab venv): .venv/Scripts/python.exe assets/props/tex/make_simple_chair.py
#   simple_chair_tag.png  the same office's asset-tag sticker as the bare desk (No. 0428, the desk is 0427), torn corner
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')
INK = (42, 38, 34)

W, H = 300, 140
im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
body = [(0, 0), (W - 30, 0), (W - 1, 30), (W - 1, H - 1), (0, H - 1)]        # torn-off corner (top right)
d.polygon(body, fill=(226, 220, 200, 255))
d.line(body + [body[0]], fill=INK, width=6)
d.text((16, 12), 'No. 0428', font=ImageFont.truetype(os.path.join(FONTS, 'ariblk.ttf'), 40), fill=INK)
x = 18
for i, w in enumerate([3, 2, 5, 2, 4, 6, 2, 3, 2, 5, 4, 2, 6, 2, 3, 4, 2, 5, 2, 3, 6]):
    if i % 2 == 0: d.rectangle([x, 70, x + w * 2, 118], fill=INK)
    x += w * 2 + 3
    if x > W - 40: break
im.save(os.path.join(HERE, 'simple_chair_tag.png'))
print('wrote simple_chair_tag.png')
