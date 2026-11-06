# Lid print for ld_pizza_box: cream cardboard, "HOT PIZZA" (red, bold), "THANK YOU!" (dark, smaller), a red grease ring
# with a soft grey shadow, dark flap / crease lines near the edges.
# Run in the lab venv: .venv/Scripts/python.exe assets/props/tex/make_ld_pizza_box.py
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))
S = 1024
BG = (214, 200, 170)                    # cardboard cream (matches the box material #d6c8aa)
img = Image.new('RGB', (S, S), BG)
d = ImageDraw.Draw(img)
F = 'C:/Windows/Fonts/'
big = ImageFont.truetype(F + 'ariblk.ttf', 132)
small = ImageFont.truetype(F + 'arialbd.ttf', 64)
# crease lines (lid flap) near the edges
for k, w in ((40, 6), (70, 3)):
    d.rectangle([k, k, S - 1 - k, S - 1 - k], outline=(120, 104, 84), width=w)


def centred(text, font, y, fill):
    b = d.textbbox((0, 0), text, font=font)
    d.text(((S - (b[2] - b[0])) / 2 - b[0], y), text, font=font, fill=fill)


centred('HOT PIZZA', big, 250, (196, 34, 38))
centred('THANK YOU!', small, 440, (58, 44, 36))
# grease ring: soft grey shadow offset right, then the red ring
sh = Image.new('L', (S, S), 0); ds = ImageDraw.Draw(sh)
cx, cy, r = 512 + 46, 700, 92
ds.ellipse([cx - r + 58, cy - r + 14, cx + r + 58, cy + r + 14], fill=150)
sh = sh.filter(ImageFilter.GaussianBlur(12))
img = Image.composite(Image.new('RGB', (S, S), (150, 138, 118)), img, sh)
d = ImageDraw.Draw(img)
d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(200, 40, 40), width=16)
img.save(os.path.join(OUT, 'ld_pizza_box_lid.png'))
print('wrote ld_pizza_box_lid.png')
