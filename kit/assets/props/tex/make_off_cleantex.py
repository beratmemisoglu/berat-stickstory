# The Flow-made ceiling and carpet textures each have one stained tile; repeated every 2-2.4 m the stain becomes a
# visible grid of spots. Copy a clean tile of the same tone over it (4 x 4 tiles per texture).
#   .venv/Scripts/python.exe assets/props/tex/make_off_cleantex.py  -> off_ceiling_clean.png, off_carpet_clean.png
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))


def fix(src, out, bad, good):
    im = Image.open(os.path.join(LAB, 'assets', 'tex', src)).convert('RGB')
    t = im.width // 4
    tile = im.crop((good[0] * t, good[1] * t, good[0] * t + t, good[1] * t + t))
    im.paste(tile, (bad[0] * t, bad[1] * t))
    im.save(os.path.join(HERE, out)); print('wrote', out)


if __name__ == '__main__':
    fix('ceiling_tiles.png', 'off_ceiling_clean.png', (1, 1), (2, 2))
    fix('carpet_tiles.png', 'off_carpet_clean.png', (2, 1), (0, 1))
