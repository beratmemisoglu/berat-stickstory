# Cardboard box prints: a marker scrawl "私物" (personal belongings) for the front, a hand-hold slot for the sides and
# a "this way up" double arrow.
#   .venv/Scripts/python.exe assets/props/tex/make_cardboard_box.py
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
INK = (38, 34, 32, 255)
S = 2

# marker scrawl, 16:9 (0.16 x 0.09 m), slightly crooked, with an underline swoosh
im = Image.new('RGBA', (640 * S, 360 * S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
f = ImageFont.truetype('C:/Windows/Fonts/YuGothB.ttc', 230 * S)
t = Image.new('RGBA', im.size, (0, 0, 0, 0))
td = ImageDraw.Draw(t)
bb = td.textbbox((0, 0), '私物', font=f)
td.text(((640 * S - (bb[2] - bb[0])) / 2 - bb[0], 18 * S - bb[1]), '私物', font=f, fill=INK)
t = t.rotate(4, resample=Image.BICUBIC, center=(320 * S, 160 * S))
im.alpha_composite(t)
d.line([(70 * S, 318 * S), (220 * S, 306 * S), (420 * S, 300 * S), (580 * S, 288 * S)], fill=INK, width=16 * S, joint='curve')
im.resize((640, 360), Image.LANCZOS).save(os.path.join(HERE, 'cardboard_box_marker.png'))

# hand-hold slot, 3:1 (0.096 x 0.032 m): dark stadium, the pushed-in tab a lighter crescent along its top
im = Image.new('RGBA', (300 * S, 100 * S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((4 * S, 4 * S, 296 * S, 96 * S), radius=46 * S, fill=(52, 36, 24, 255))
d.rounded_rectangle((26 * S, 12 * S, 274 * S, 40 * S), radius=14 * S, fill=(150, 104, 60, 255))
im.resize((300, 100), Image.LANCZOS).save(os.path.join(HERE, 'cardboard_box_hole.png'))

# this-way-up arrows over a bar, square (0.06 m), printed dark red
RED = (150, 52, 40, 255)
im = Image.new('RGBA', (256 * S, 256 * S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
for cx in (80, 176):
    d.rectangle(((cx - 13) * S, 92 * S, (cx + 13) * S, 196 * S), fill=RED)
    d.polygon([((cx - 46) * S, 104 * S), (cx * S, 36 * S), ((cx + 46) * S, 104 * S)], fill=RED)
d.rectangle((26 * S, 212 * S, 230 * S, 232 * S), fill=RED)
im.resize((256, 256), Image.LANCZOS).save(os.path.join(HERE, 'cardboard_box_arrows.png'))
print('ok')
