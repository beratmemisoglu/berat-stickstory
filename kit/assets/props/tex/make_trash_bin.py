# Trash bin sticker: a rounded label "燃える ゴミ" (burnable trash) with a flame icon, cut into vertical slices that
# wrap around the bin's conical wall (one PNG per slice, alpha outside the rounded shape).
#   .venv/Scripts/python.exe assets/props/tex/make_trash_bin.py
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
N = 6                                   # slices (must match trash_bin.py STRIPS)
W, H = 600, 480                         # 0.10 x 0.08 m on the bin
JP = ImageFont.truetype('C:/Windows/Fonts/YuGothB.ttc', 112)
JP2 = ImageFont.truetype('C:/Windows/Fonts/YuGothB.ttc', 96)
im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle((4, 4, W - 4, H - 4), radius=70, fill=(242, 239, 230, 255))
d.rounded_rectangle((26, 26, W - 26, H - 26), radius=54, fill=(222, 92, 62, 255))
# flame icon (left): outer teardrop + inner lighter flame
d.polygon([(130, 100), (180, 200), (200, 280), (130, 300), (60, 280), (80, 200)], fill=(250, 214, 96, 255))
d.ellipse((62, 236, 198, 372), fill=(250, 214, 96, 255))
d.polygon([(130, 226), (156, 286), (130, 300), (104, 286)], fill=(242, 239, 230, 255))
d.ellipse((100, 270, 160, 344), fill=(242, 239, 230, 255))
for txt, font, y in (('燃える', JP, 84), ('ゴミ', JP, 262)):
    bb = d.textbbox((0, 0), txt, font=font)
    x = 230 + (W - 60 - 230 - (bb[2] - bb[0])) / 2 - bb[0]
    d.text((x, y - bb[1]), txt, font=font, fill=(242, 239, 230, 255))
for i in range(N):
    im.crop((i * W // N, 0, (i + 1) * W // N, H)).save(os.path.join(HERE, f'trash_bin_sticker{i}.png'))
im.save(os.path.join(HERE, 'trash_bin_sticker_full.png'))
print('ok')
