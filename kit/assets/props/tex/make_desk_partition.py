# Pinned papers for assets/props/desk_partition.py (run with the lab venv):
#   .venv/Scripts/python.exe assets/props/tex/make_desk_partition.py
# -> desk_partition_chart.png (goal chart), desk_partition_cal.png (month calendar), desk_partition_memo.png
#    (memo with a red hanko stamp); all 600x800 (A4-ish), bold flat shapes that read at phone size;
#    desk_partition_note_yellow/pink.png (sticky notes), desk_partition_photo.png (polaroid of a cartoon cat).
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = 'C:/Windows/Fonts/'
INK = (42, 38, 34)
PAPER = (242, 239, 230)
RED = (214, 70, 60)
BLUE = (52, 104, 196)


def font(name, size, index=0):
    return ImageFont.truetype(FONTS + name, size, index=index)


def page():
    im = Image.new('RGB', (600, 800), PAPER)
    return im, ImageDraw.Draw(im)


def chart():
    im, d = page()
    d.rectangle((0, 0, 600, 150), fill=BLUE)
    d.text((300, 78), '目標', font=font('YuGothB.ttc', 104), fill=PAPER, anchor='mm')
    x0, y1 = 70, 700
    d.line((x0, 210, x0, y1, 550, y1), fill=INK, width=12)
    for j, h in enumerate((140, 210, 180, 300, 400)):
        c = RED if j == 4 else BLUE
        d.rectangle((x0 + 30 + j * 92, y1 - h, x0 + 100 + j * 92, y1 - 6), fill=c, outline=INK, width=8)
    # trend arrow
    pts = [(110, 520), (230, 450), (320, 480), (470, 290)]
    d.line(pts, fill=INK, width=18, joint='curve')
    d.polygon([(500, 250), (430, 280), (488, 330)], fill=INK)
    im.save(os.path.join(HERE, 'desk_partition_chart.png'))


def calendar():
    im, d = page()
    d.rectangle((0, 0, 600, 190), fill=RED)
    d.text((300, 96), '10', font=font('ariblk.ttf', 140), fill=PAPER, anchor='mm')
    cols, rows = 7, 5
    gx0, gy0, cw, ch = 30, 230, 77, 105
    for r in range(rows):
        for c in range(cols):
            box = (gx0 + c * cw, gy0 + r * ch, gx0 + (c + 1) * cw, gy0 + (r + 1) * ch)
            d.rectangle(box, outline=(150, 146, 136), width=4)
            if c in (0, 6): d.rectangle((box[0] + 4, box[1] + 4, box[2] - 4, box[3] - 4), fill=(236, 214, 206))
    # a few days crossed out, one circled
    for r, c in ((0, 1), (0, 2), (0, 3), (0, 4), (1, 1), (1, 2)):
        x, y = gx0 + c * cw, gy0 + r * ch
        d.line((x + 14, y + 16, x + cw - 14, y + ch - 16), fill=INK, width=9)
        d.line((x + cw - 14, y + 16, x + 14, y + ch - 16), fill=INK, width=9)
    x, y = gx0 + 3 * cw, gy0 + 1 * ch
    d.ellipse((x - 6, y - 4, x + cw + 6, y + ch + 4), outline=RED, width=12)
    im.save(os.path.join(HERE, 'desk_partition_cal.png'))


def memo():
    im, d = page()
    d.rectangle((50, 60, 420, 110), fill=INK)
    for j in range(7):
        y = 180 + j * 70
        L = (480, 420, 500, 360, 460, 300, 400)[j]
        d.ellipse((52, y - 2, 74, y + 20), fill=BLUE)
        d.rectangle((96, y, 96 + L - 60, y + 18), fill=(120, 124, 136))
    # red hanko stamp, bottom right
    d.ellipse((380, 600, 540, 760), outline=RED, width=14)
    d.text((460, 680), '済', font=font('YuGothB.ttc', 96), fill=RED, anchor='mm')
    im.save(os.path.join(HERE, 'desk_partition_memo.png'))


def notes():
    for nm, bg, strip in (('yellow', (247, 212, 74), (236, 194, 52)), ('pink', (242, 150, 170), (228, 128, 150))):
        S = 256
        im = Image.new('RGB', (S, S), bg)
        d = ImageDraw.Draw(im)
        d.rectangle((0, 0, S, 26), fill=strip)
        if nm == 'yellow':
            d.text((128, 140), '!', font=font('ariblk.ttf', 170), fill=RED, anchor='mm')
        else:
            for j in range(3):
                d.line((34, 80 + j * 50, 222 - j * 40, 80 + j * 50), fill=(60, 40, 90), width=12)
        im.save(os.path.join(HERE, f'desk_partition_note_{nm}.png'))


def photo():
    """A polaroid of a cartoon cat (an original doodle)."""
    im = Image.new('RGB', (300, 360), PAPER)
    d = ImageDraw.Draw(im)
    d.rectangle((22, 22, 278, 278), fill=(140, 196, 222))
    d.rectangle((22, 210, 278, 278), fill=(120, 176, 110))
    o = (232, 150, 76)
    d.polygon([(92, 120), (106, 60), (140, 104)], fill=o, outline=INK, width=6)
    d.polygon([(208, 120), (194, 60), (160, 104)], fill=o, outline=INK, width=6)
    d.ellipse((80, 90, 220, 220), fill=o, outline=INK, width=7)
    for x in (122, 178): d.ellipse((x - 10, 140, x + 10, 164), fill=INK)
    d.polygon([(142, 172), (158, 172), (150, 182)], fill=(214, 90, 110))
    d.line((150, 182, 150, 192), fill=INK, width=4)
    d.arc((128, 182, 150, 202), 0, 180, fill=INK, width=4); d.arc((150, 182, 172, 202), 0, 180, fill=INK, width=4)
    for s in (-1, 1):
        for k in (-1, 1):
            d.line((150 + s * 40, 184 + k * 5, 150 + s * 86, 178 + k * 12), fill=INK, width=4)
    im.save(os.path.join(HERE, 'desk_partition_photo.png'))


if __name__ == '__main__':
    chart(); calendar(); memo(); notes(); photo()
    print('ok', HERE)
