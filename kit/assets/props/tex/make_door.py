# Door graphics (lab venv): .venv/Scripts/python.exe assets/props/tex/make_door.py
#   (no args)                      -> door_glass.png (wired glass: pale glass, faint wire grid, two shine strokes)
#   sign "<text>" <out.png> [bg] [ink] -> a door sign plate (Arial Black; Yu Gothic Bold when the text has CJK)
# door.py calls the sign form itself (cached by text) when built with sign='...'.
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')


def glass(path=os.path.join(HERE, 'door_glass.png')):
    W, H = 300, 1100
    im = Image.new('RGB', (W, H), '#cbd9d9')
    d = ImageDraw.Draw(im)
    # soft vertical gradient: lighter at the top (light from the ceiling behind)
    for y in range(H):
        k = y / H
        c = tuple(int(a + (b - a) * k) for a, b in zip((186, 206, 208), (140, 165, 172)))
        d.line([(0, y), (W, y)], fill=c)
    # faint wire grid (square mesh, ~7 cells across)
    step = 44
    grid = Image.new('L', (W, H), 0); gd = ImageDraw.Draw(grid)
    for x in range(-step // 2, W + step, step):
        gd.line([(x, 0), (x, H)], fill=70, width=3)
    for y in range(-step // 2, H + step, step):
        gd.line([(0, y), (W, y)], fill=70, width=3)
    im.paste((92, 110, 116), (0, 0), grid)
    # two cartoon shine strokes (diagonal), the cheapest "this is glass" read
    sh = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(sh)
    sd.polygon([(20, 560), (160, 250), (235, 250), (95, 560)], fill=235)
    sd.polygon([(125, 610), (240, 360), (272, 360), (157, 610)], fill=235)
    im.paste((242, 247, 243), (0, 0), sh)
    # inner shadow along the top and hinge-side edges (the glass sits inside its bead)
    shadow = Image.new('L', (W, H), 0); dd = ImageDraw.Draw(shadow)
    dd.rectangle([0, 0, W, 26], fill=110); dd.rectangle([0, 0, 22, H], fill=90)
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    im.paste((120, 138, 142), (0, 0), shadow)
    im.save(path)
    print('wrote', path)


def scuff(path=os.path.join(HERE, 'door_scuff.png')):
    """Two shoe scuffs for the kick plate: dark curved strokes on transparent (alpha-clipped in Blender)."""
    W, H = 512, 128
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.arc([30, 30, 250, 170], 200, 290, fill=(70, 66, 60, 255), width=9)
    d.arc([60, 50, 230, 160], 215, 280, fill=(70, 66, 60, 255), width=6)
    d.arc([300, 20, 500, 150], 195, 260, fill=(70, 66, 60, 255), width=8)
    im.save(path)
    print('wrote', path)


def _has_cjk(s):
    return any(ord(c) >= 0x2E80 for c in s)


def _font(text, size):
    if _has_cjk(text):
        for f in ('YuGothB.ttc', 'meiryob.ttc', 'msgothic.ttc'):
            p = os.path.join(FONTS, f)
            if os.path.exists(p): return ImageFont.truetype(p, size)
    for f in ('ariblk.ttf', 'arialbd.ttf'):
        p = os.path.join(FONTS, f)
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def sign(text, path, bg='#f2efe6', ink='#2a2622'):
    W, H = 680, 220
    im = Image.new('RGB', (W, H), ink)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([12, 12, W - 13, H - 13], radius=18, fill=bg)
    d.rounded_rectangle([24, 24, W - 25, H - 25], radius=12, outline=ink, width=3)
    lines = text.replace('\\n', '\n').split('\n')[:2]
    box_w, box_h = W - 90, (H - 70) / len(lines)
    size = 120
    while size > 14:
        f = _font(text, size)
        ws = [d.textbbox((0, 0), ln, font=f) for ln in lines]
        if max(b[2] - b[0] for b in ws) <= box_w and max(b[3] - b[1] for b in ws) <= box_h * 0.92: break
        size -= 4
    f = _font(text, size)
    y0 = H / 2 - box_h * len(lines) / 2
    for i, ln in enumerate(lines):
        cy = y0 + box_h * (i + 0.5)
        d.text((W / 2, cy), ln, font=f, fill=ink, anchor='mm')
    im.save(path)
    print('wrote', path)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'sign':
        sign(sys.argv[2], sys.argv[3], *(sys.argv[4:6]))
    else:
        glass(); scuff()
