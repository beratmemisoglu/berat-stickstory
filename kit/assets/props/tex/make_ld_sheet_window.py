# Polka-dot bedspread for ld_sheet_window: pale blue, a grid of white dots (offset rows), a soft darker hem.
# Run in the lab venv: .venv/Scripts/python.exe assets/props/tex/make_ld_sheet_window.py
import os
from PIL import Image, ImageDraw

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 1000, 1100                       # the sheet is 1.0 x 1.1 m
img = Image.new('RGB', (W, H), (128, 152, 206))
d = ImageDraw.Draw(img)
# a hem band all round (darker)
d.rectangle([0, 0, W - 1, H - 1], outline=(104, 126, 182), width=16)
step = 112
for j, y in enumerate(range(50, H, step)):
    off = 0 if j % 2 == 0 else step // 2
    for x in range(off + 50 - (step // 2 if off else 0), W, step):
        if x < 30 or x > W - 30 or y < 30 or y > H - 30: continue
        r = 13
        d.ellipse([x - r, y - r, x + r, y + r], fill=(236, 240, 250))
img.save(os.path.join(OUT, 'ld_sheet_window_dots.png'))
print('wrote ld_sheet_window_dots.png')
