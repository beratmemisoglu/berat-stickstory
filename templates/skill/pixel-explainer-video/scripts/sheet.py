#!/usr/bin/env python3
"""Contact sheet of rendered stills for visual review.

  python sheet.py <project> <name> [cols=3] [--tile 640] [--keep]

Reads out/<name>_frames/*.png (from `node render.mjs <project> stills --name <name>`), writes
out/<name>_sheet.png with each tile labelled by its timestamp, then deletes the frames (unless --keep).
Open the sheet with your image-reading tool and actually look at every tile.
"""
import glob, os, shutil, sys
from PIL import Image, ImageDraw
P, name = os.path.abspath(sys.argv[1]), sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else (1 if '--tile' in sys.argv and int(sys.argv[sys.argv.index('--tile') + 1]) > 960 else 3)
d = os.path.join(P, 'out', f'{name}_frames')
files = sorted(glob.glob(os.path.join(d, '*.png')))
if not files: sys.exit('no frames in ' + d)
tw = int(sys.argv[sys.argv.index('--tile') + 1]) if '--tile' in sys.argv else 640; th = tw * 9 // 16   # --tile 1280 for detail checks
sheet = Image.new('RGB', (tw * cols, th * ((len(files) + cols - 1) // cols)), 'black')
for i, f in enumerate(files):
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(Image.open(f).convert('RGB').resize((tw, th), Image.LANCZOS), (x, y))
    dr = ImageDraw.Draw(sheet); dr.rectangle([x, y, x + 62, y + 14], fill='black')
    dr.text((x + 3, y + 2), f'{int(os.path.basename(f)[:-4]) / 100:.2f}s', fill='red')
out = os.path.join(P, 'out', f'{name}_sheet.png'); sheet.save(out)
if '--keep' not in sys.argv: shutil.rmtree(d)
print(f'{len(files)} frames -> {out}')
