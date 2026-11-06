# Seamless surfaces for the OFFICE set dressing (box-projected by film/japan/dress_office.py):
#   off_slats.png   0.6 x 0.6 m of vertical wood slats (wainscot), cut from the Flow wood texture, grain turned upright
#   off_runner.png  1.0 x 1.0 m of the aisle runner carpet: 2 x 2 tiles, fibre speckle, seams (wraps on every edge)
#   off_screen_sheet|mail|slides|cal.png  monitor pictures (16:9) for the desks
#   .venv/Scripts/python.exe assets/props/tex/make_off_surfaces.py
import os, random
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
S = 1024


def slats():
    wood = Image.open(os.path.join(LAB, 'assets', 'tex', 'wood_desk.png')).convert('RGB').resize((S, S)).rotate(90)
    out = Image.new('RGB', (S, S)); d = ImageDraw.Draw(out)
    n = 5; w = S // n
    random.seed(11)
    for i in range(n):
        x0 = i * w
        src = wood.crop(((i * 197) % (S - w), 0, (i * 197) % (S - w) + w, S))
        src = ImageEnhance.Brightness(src).enhance(random.uniform(0.86, 1.06))
        out.paste(src, (x0, 0))
        # rounded slat edges: a light line on the left, a shade on the right, a dark groove between slats
        d.line((x0 + 6, 0, x0 + 6, S), fill=(236, 190, 130), width=4)
        d.rectangle((x0 + w - 26, 0, x0 + w - 12, S), fill=(150, 92, 48))
        d.rectangle((x0 + w - 12, 0, x0 + w, S), fill=(58, 36, 24))
    out.save(os.path.join(HERE, 'off_slats.png')); print('wrote off_slats.png')


def runner():
    """Cornflower-blue carpet tiles with confetti flecks in the set's colours (cream, yellow, coral, light teal, navy)."""
    # 2 x 2 m (2048 px, 4 x 4 tiles of 0.5 m) so the chip layout doesn't visibly repeat every metre
    random.seed(5)
    N = 2048
    im = Image.new('RGB', (N, N)); d = ImageDraw.Draw(im)
    tones = [(86, 118, 184), (79, 110, 175), (83, 114, 180), (91, 123, 189), (84, 116, 182)]
    h = N // 4
    for i in range(4):
        for j in range(4):
            d.rectangle((i * h, j * h, i * h + h, j * h + h), fill=tones[(i * 3 + j * 2) % 5])
    # fine fibre grain, then the coloured flecks (wrapped so the tile repeats seamlessly)
    for _ in range(56000):
        x, y = random.randrange(N), random.randrange(N)
        c = random.choice(((70, 98, 156), (106, 138, 200), (64, 92, 150)))
        d.point((x, y), fill=c); d.point(((x + 1) % N, y), fill=c)
    # terrazzo-like chips: fewer and bigger than fibre noise, so the floor reads designed, not grainy
    import math
    flecks = ((246, 242, 230), (242, 194, 48), (224, 88, 62), (111, 192, 200), (35, 52, 90), (246, 242, 230))
    for _ in range(1100):
        x, y = random.randrange(N), random.randrange(N)
        r = random.choice((5, 6, 7, 9, 10)); c = random.choice(flecks)
        pts = [(x + r * (0.7 + 0.5 * random.random()) * math.cos(a), y + r * (0.7 + 0.5 * random.random()) * math.sin(a))
               for a in [k * 2 * math.pi / 5 + random.random() for k in range(5)]]
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                d.polygon([(px + ox, py + oy) for px, py in pts], fill=c)
    im = im.filter(ImageFilter.GaussianBlur(0.6)); d = ImageDraw.Draw(im)
    # tile seams (on the wrap edges too)
    for v in [k * h for k in range(4)] + [N - 1]:
        d.line((v, 0, v, N), fill=(40, 58, 100), width=9); d.line((0, v, N, v), fill=(40, 58, 100), width=9)
    d.ellipse((1240, 1290, 1380, 1370), outline=(72, 100, 160), width=10)      # one faint scuff per 2 m
    im.save(os.path.join(HERE, 'off_runner.png')); print('wrote off_runner.png')


def medallion():
    """The company logo inlaid in the aisle runner (RGBA, alpha-clipped): navy ring, yellow pinstripes, cream disc,
    the orange sun over teal waves, eight small stars around."""
    import math
    N = 1024; im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    c = N / 2
    d.ellipse((8, 8, N - 8, N - 8), fill=(35, 52, 90, 255))
    d.ellipse((60, 60, N - 60, N - 60), outline=(242, 194, 48, 255), width=12)
    d.ellipse((150, 150, N - 150, N - 150), fill=(246, 240, 224, 255))
    d.ellipse((168, 168, N - 168, N - 168), outline=(242, 194, 48, 255), width=8)
    d.ellipse((c - 150, c - 220, c + 150, c + 80), fill=(232, 129, 47, 255), outline=(42, 38, 34, 255), width=10)
    for k, y in enumerate((c + 40, c + 130)):
        pts = [(c - 300 + i * 10, y + 26 * math.sin(i * 0.2 + k * 1.3)) for i in range(61)]
        d.line(pts, fill=(31, 115, 133, 255), width=46)
    d.rectangle((c - 330, c + 175, c + 330, c + 200), fill=(246, 240, 224, 255))
    for j in range(8):
        a = j * math.pi / 4; sx, sy = c + 410 * math.cos(a), c + 410 * math.sin(a)
        pts = []
        for i in range(10):
            b = -math.pi / 2 + i * math.pi / 5; rr = 30 if i % 2 == 0 else 13
            pts.append((sx + rr * math.cos(b), sy + rr * math.sin(b)))
        d.polygon(pts, fill=(242, 194, 48, 255))
    im.save(os.path.join(HERE, 'off_medallion.png')); print('wrote off_medallion.png')


def screens():
    """Monitor pictures (16:9) so the ten desks don't all show the same chart."""
    from PIL import ImageFont
    jp = lambda s: ImageFont.truetype('C:/Windows/Fonts/YuGothB.ttc', s, index=0)
    W, H = 640, 360
    # spreadsheet
    im = Image.new('RGB', (W, H), (246, 248, 250)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 34), fill=(33, 115, 70)); d.text((12, 4), '売上 2026.xlsx', font=jp(22), fill=(255, 255, 255))
    for r in range(11):
        for c in range(8):
            x, y = 10 + c * 78, 44 + r * 28
            fill = (216, 236, 222) if r == 0 else ((255, 236, 170) if (r * 3 + c) % 11 == 0 else None)
            d.rectangle((x, y, x + 78, y + 28), outline=(190, 198, 206), fill=fill)
            if r and c: d.line((x + 10, y + 14, x + 10 + (r * 7 + c * 13) % 50, y + 14), fill=(90, 100, 110), width=4)
    im.save(os.path.join(HERE, 'off_screen_sheet.png'))
    # mail inbox
    im = Image.new('RGB', (W, H), (250, 250, 252)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 150, H), fill=(40, 62, 110)); d.rectangle((0, 0, W, 34), fill=(58, 99, 196))
    d.text((12, 4), '受信トレイ  (48)', font=jp(22), fill=(255, 255, 255))
    for k, t in enumerate(('受信', '送信', '下書き', 'ゴミ箱')):
        d.text((16, 52 + k * 36), t, font=jp(20), fill=(220, 228, 240))
    for r in range(8):
        y = 44 + r * 39
        d.ellipse((164, y + 6, 190, y + 32), fill=[(224, 88, 62), (79, 154, 106), (224, 166, 58), (125, 90, 184)][r % 4])
        d.line((202, y + 12, 202 + 140 + (r * 37) % 120, y + 12), fill=(40, 40, 50), width=6)
        d.line((202, y + 27, 202 + 260 + (r * 53) % 140, y + 27), fill=(150, 150, 160), width=4)
        d.line((150, y + 38, W, y + 38), fill=(220, 222, 228))
    im.save(os.path.join(HERE, 'off_screen_mail.png'))
    # slides
    im = Image.new('RGB', (W, H), (60, 64, 72)); d = ImageDraw.Draw(im)
    d.rectangle((120, 20, 620, 300), fill=(252, 250, 244)); d.rectangle((120, 20, 620, 70), fill=(208, 48, 42))
    d.text((140, 30), '第3四半期 報告', font=jp(28), fill=(255, 255, 255))
    d.pieslice((150, 90, 330, 270), 0, 250, fill=(58, 99, 196)); d.pieslice((150, 90, 330, 270), 250, 330, fill=(242, 194, 48)); d.pieslice((150, 90, 330, 270), 330, 360, fill=(79, 154, 106))
    for k in range(4): d.line((370, 120 + k * 40, 370 + 200 - k * 30, 120 + k * 40), fill=(80, 80, 90), width=8)
    for k in range(4): d.rectangle((14, 20 + k * 80, 104, 80 + k * 80), fill=(232, 228, 218), outline=(208, 48, 42) if k == 2 else None, width=4)
    im.save(os.path.join(HERE, 'off_screen_slides.png'))
    # calendar week
    im = Image.new('RGB', (W, H), (252, 252, 252)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 34), fill=(31, 115, 133)); d.text((12, 4), '予定表  10月 第4週', font=jp(22), fill=(255, 255, 255))
    for c in range(5):
        x = 60 + c * 114
        d.text((x + 40, 40), '月火水木金'[c], font=jp(20), fill=(60, 60, 70))
        d.line((x, 70, x, H), fill=(214, 218, 224))
        for k in range(3):
            y = 80 + ((c * 2 + k * 3) % 7) * 38
            d.rounded_rectangle((x + 6, y, x + 108, y + 32 + 20 * (k % 2)), 6, fill=[(255, 214, 160), (190, 226, 242), (255, 205, 215), (200, 238, 196)][(c + k) % 4])
    for r in range(8): d.line((60, 70 + r * 38, W, 70 + r * 38), fill=(232, 234, 238))
    im.save(os.path.join(HERE, 'off_screen_cal.png'))
    print('wrote off_screen_*.png')


if __name__ == '__main__':
    slats(); runner(); medallion(); screens()
