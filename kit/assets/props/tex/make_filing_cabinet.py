# Paper labels for the filing cabinet drawers (kanji department names with a colour stripe) + a sticky note.
#   .venv/Scripts/python.exe assets/props/tex/make_filing_cabinet.py
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = 'C:/Windows/Fonts'
JP = ImageFont.truetype(os.path.join(FONTS, 'YuGothB.ttc'), 120)
INK = (42, 38, 34)
PAPER = (242, 239, 230)

# label holder window is 2:1 (0.09 x 0.045 m)
LABELS = [('経理', (217, 103, 91)), ('人事', (111, 159, 209)), ('総務', (127, 179, 122)), ('営業', (227, 178, 74))]
for i, (txt, stripe) in enumerate(LABELS, 1):
    im = Image.new('RGB', (360, 180), PAPER)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 54, 180), fill=stripe)
    bb = d.textbbox((0, 0), txt, font=JP)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text((54 + (306 - w) / 2 - bb[0], (180 - h) / 2 - bb[1]), txt, font=JP, fill=INK)
    im.save(os.path.join(HERE, f'filing_cabinet_label{i}.png'))

# sticky note: yellow square, two scribbled lines and a big circled "!"
im = Image.new('RGB', (256, 256), (247, 214, 92))
d = ImageDraw.Draw(im)
d.rectangle((0, 0, 256, 34), fill=(236, 196, 70))           # the gummed strip, a shade darker
for y, x1 in ((96, 196), (140, 170), (184, 120)):
    pts = [(34 + k * 6, y + (5 if (k // 2) % 2 else -5)) for k in range((x1 - 34) // 6)]
    d.line(pts, fill=(58, 70, 120), width=9, joint='curve')
d.ellipse((168, 150, 232, 214), outline=(200, 60, 50), width=9)
d.line((200, 162, 200, 190), fill=(200, 60, 50), width=10)
d.ellipse((195, 196, 205, 206), fill=(200, 60, 50))
im.save(os.path.join(HERE, 'filing_cabinet_note.png'))
print('ok')
