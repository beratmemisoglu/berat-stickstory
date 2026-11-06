# Pillow textures for the LAW STAGE (film/japan/dress_stage.py + assets/props/stage_*.py), original drawings:
#   stage_sunburst.png   back-wall drop, 10 x 6.667 m: an art-deco fan of navy rays from behind the plinth (z 0.9 m),
#                        thin gold ray lines, two gold arcs, beads, a soft glow at the centre, darker toward the edges
#   stage_medallion.png  floor inlay around the plinth, 5.6 m across (RGBA): gold collar, burgundy band, a 16-point
#                        compass star in gold + teal, a gold ring, a burgundy band of gold diamonds, an outer gold ring
#   stage_banner.png     court banner, 0.62 x 2.6 m (RGBA, swallowtail cut): red cloth, gold double border, a gold
#                        laurel ring around a big gold kanji (law), a gold bar at the top, three stars
#   stage_meander.png    one repeat of the gold Greek-key band on burgundy round the plinth (0.474 x 0.1 m, 12 repeats)
#   stage_tablet.png     law tablet face (0.62 x 1.15 m): the Labor Contract Act's title, Article 16 (public law text:
#                        an abusive dismissal is void), a small scales mark, gold on navy slate
# run: .venv/Scripts/python.exe assets/props/tex/make_stage.py
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FD = 'C:/Windows/Fonts/'


def hexc(h, a=255):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def mix(a, b, k): return tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(len(a)))


# ------------------------------------------------------------------ back-wall sunburst
def sunburst():
    W, H = 3600, 2400                 # 10 x 6.667 m -> 360 px / m
    ppm = W / 10.0
    cx, cy = W / 2, H - 0.9 * ppm     # fan centre behind the book (z = 0.9 m)
    base = Image.new('RGBA', (W, H), hexc('#121a30'))
    d = ImageDraw.Draw(base)
    n = 44
    dark, light = hexc('#17203d'), hexc('#202d57')
    R = 9.0 * ppm
    for i in range(n):
        a0 = 2 * math.pi * i / n; a1 = 2 * math.pi * (i + 1) / n
        pts = [(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))]
        d.polygon(pts, fill=light if i % 2 else dark)
    # radial darkening toward the edges (the fan glows from the centre)
    vign = Image.new('L', (W, H), 0); vd = ImageDraw.Draw(vign)
    steps = 60
    for s in range(steps, 0, -1):
        r = (s / steps) * 7.5 * ppm
        v = int(255 * (1 - (s / steps)) ** 0.8)
        vd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=v)
    vign = vign.filter(ImageFilter.GaussianBlur(40))
    darkimg = Image.new('RGBA', (W, H), hexc('#0c1124'))
    base = Image.composite(base, darkimg, vign)
    d = ImageDraw.Draw(base)
    # thin gold ray lines, fading with distance (drawn as segments of falling brightness)
    gold = hexc('#b58b3c'); bg = hexc('#141b33')
    for i in range(n):
        a = 2 * math.pi * i / n
        for k in range(24):
            r0 = (1.75 + k * 0.22) * ppm; r1 = r0 + 0.22 * ppm
            f = max(0.0, 1 - k / 24) ** 1.3
            c = mix(bg, gold, 0.25 + 0.75 * f)
            d.line([(cx + r0 * math.cos(a), cy + r0 * math.sin(a)), (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], fill=c, width=5)
    # centre glow disc (behind the book) + two gold arcs + a ring of beads
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    for s in range(30, 0, -1):
        r = (s / 30) * 1.65 * ppm
        gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=hexc('#3a4f96', int(255 * (1 - s / 30) ** 0.6 * 0.9)))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    base = Image.alpha_composite(base, glow)
    d = ImageDraw.Draw(base)
    for r_m, w in ((1.62, 14), (1.72, 6), (4.6, 10), (4.72, 5)):
        r = r_m * ppm
        d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=hexc('#c89a43'), width=w)
    for i in range(64):
        a = 2 * math.pi * (i + 0.5) / 64; r = 1.86 * ppm
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        d.ellipse((x - 9, y - 9, x + 9, y + 9), fill=hexc('#d4a64a'))
    # stepped art-deco chevrons on the outer arc
    for i in range(22):
        a = math.pi + math.pi * (i + 0.5) / 22
        r = 4.66 * ppm; x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        s = 22
        d.polygon([(x - s * math.sin(a) * 0, y - s), (x + s, y), (x, y + s), (x - s, y)], fill=hexc('#d4a64a'))
    base.convert('RGB').save(os.path.join(HERE, 'stage_sunburst.png'))


# ------------------------------------------------------------------ floor medallion
def medallion():
    S = 3072; D = 5.6; ppm = S / D; c = S / 2
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    GOLD, GOLD_D = hexc('#c99a3f'), hexc('#7d5a1f')
    BURG, NAVY, TEAL = hexc('#5e1726'), hexc('#18223f'), hexc('#2a7f86')

    def disc(r_m, fill):
        r = r_m * ppm; d.ellipse((c - r, c - r, c + r, c + r), fill=fill)
    disc(2.8, GOLD); disc(2.74, BURG); disc(2.40, GOLD); disc(2.35, NAVY)
    # fine guilloche in the navy field: thin gold rays and two hairline rings (fine line work like the reference's)
    FINE = mix(NAVY, GOLD, 0.55)
    for i in range(96):
        a = 2 * math.pi * (i + 0.5) / 96; r0, r1 = 1.32 * ppm, 2.3 * ppm
        d.line([(c + r0 * math.cos(a), c + r0 * math.sin(a)), (c + r1 * math.cos(a), c + r1 * math.sin(a))], fill=FINE, width=4)
    for r_m in (1.9, 2.22):
        r = r_m * ppm; d.ellipse((c - r, c - r, c + r, c + r), outline=FINE, width=5)
    # band of gold diamonds between 2.40 and 2.74
    for i in range(48):
        a = 2 * math.pi * i / 48; rm = 2.57 * ppm
        x, y = c + rm * math.cos(a), c + rm * math.sin(a)
        ca, sa = math.cos(a), math.sin(a); L, Wd = 0.13 * ppm, 0.07 * ppm
        pts = [(x + ca * L, y + sa * L), (x - sa * Wd, y + ca * Wd), (x - ca * L, y - sa * L), (x + sa * Wd, y - ca * Wd)]
        d.polygon(pts, fill=GOLD, outline=GOLD_D)
        a2 = a + math.pi / 48; x2, y2 = c + rm * math.cos(a2), c + rm * math.sin(a2)
        d.ellipse((x2 - 10, y2 - 10, x2 + 10, y2 + 10), fill=GOLD)
    # 16-point compass star (long gold, short teal), each point split light / dark like a bevel
    for i in range(16):
        a = 2 * math.pi * i / 16 + math.pi / 16
        long_ = i % 2 == 0
        L = (2.25 if long_ else 1.75) * ppm; Wd = (0.34 if long_ else 0.26) * ppm
        tip = (c + L * math.cos(a), c + L * math.sin(a))
        left = (c + Wd * math.cos(a + math.pi / 2), c + Wd * math.sin(a + math.pi / 2))
        right = (c + Wd * math.cos(a - math.pi / 2), c + Wd * math.sin(a - math.pi / 2))
        col1 = GOLD if long_ else TEAL
        col2 = mix(col1, (0, 0, 0, 255), 0.35)
        d.polygon([(c, c), left, tip], fill=col1)
        d.polygon([(c, c), tip, right], fill=col2)
        d.line([left, tip, right], fill=GOLD_D, width=6)
    # thin ring through the star + burgundy band + gold collar under the plinth's edge
    for r_m, w in ((1.45, 10),):
        r = r_m * ppm; d.ellipse((c - r, c - r, c + r, c + r), outline=GOLD, width=w)
    disc(1.28, GOLD); disc(1.23, BURG); disc(1.06, GOLD); disc(0.99, NAVY)
    for i in range(36):
        a = 2 * math.pi * i / 36; r = 1.145 * ppm
        x, y = c + r * math.cos(a), c + r * math.sin(a)
        d.ellipse((x - 14, y - 14, x + 14, y + 14), fill=GOLD)
    im.save(os.path.join(HERE, 'stage_medallion.png'))


# ------------------------------------------------------------------ court banner
def banner():
    W, H = 620, 2600                   # 0.62 x 2.6 m at 1000 px / m
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    RED, RED_D, GOLD, GOLD_D = hexc('#8f1d28'), hexc('#5e1019'), hexc('#d6a845'), hexc('#7d5a1f')
    tail = 300
    body = [(0, 0), (W, 0), (W, H - tail), (W / 2, H), (0, H - tail)]
    d.polygon(body, fill=RED)
    # vertical velvet sheen stripes
    for x in range(0, W, 62):
        d.rectangle((x + 20, 0, x + 34, H), fill=hexc('#98232f'))
    d.polygon(body, outline=None)
    # mask the stripes to the swallowtail shape
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).polygon(body, fill=255)
    im.putalpha(mask); d = ImageDraw.Draw(im)
    # gold double border following the cut
    def inset(k):
        return [(k, k), (W - k, k), (W - k, H - tail - k * 0.4), (W / 2, H - k * 1.6), (k, H - tail - k * 0.4)]
    d.line(inset(26) + [inset(26)[0]], fill=GOLD, width=16)
    d.line(inset(52) + [inset(52)[0]], fill=GOLD, width=6)
    d.rectangle((0, 0, W, 110), fill=GOLD); d.rectangle((0, 104, W, 116), fill=GOLD_D)
    # laurel ring + kanji
    cx, cy, R = W / 2, 900, 240
    d.ellipse((cx - R, cy - R, cx + R, cy + R), outline=GOLD, width=12)
    for side in (-1, 1):
        for k in range(9):
            a = math.radians(110 + k * 17) if side < 0 else math.radians(70 - k * 17)
            x, y = cx + (R + 34) * math.cos(a), cy + (R + 34) * math.sin(a)
            ang = a + (math.pi / 2 if side > 0 else -math.pi / 2)
            L, Wd = 38, 15
            pts = [(x + L * math.cos(ang), y + L * math.sin(ang)), (x + Wd * math.cos(ang + 1.57), y + Wd * math.sin(ang + 1.57)),
                   (x - L * math.cos(ang), y - L * math.sin(ang)), (x + Wd * math.cos(ang - 1.57), y + Wd * math.sin(ang - 1.57))]
            d.polygon(pts, fill=GOLD)
    try: f = ImageFont.truetype(FD + 'YuGothB.ttc', 330, index=0)
    except Exception: f = ImageFont.truetype(FD + 'msgothic.ttc', 330)
    d.text((cx + 6, cy + 8), '\u6cd5', font=f, fill=RED_D, anchor='mm')
    d.text((cx, cy), '\u6cd5', font=f, fill=GOLD, anchor='mm')
    # three gold stars under it and a fringe of gold lines at the point
    for k, y in enumerate((1360, 1500, 1640)):
        r = 36
        pts = []
        for j in range(10):
            a = -math.pi / 2 + j * math.pi / 5; rr = r if j % 2 == 0 else r * 0.45
            pts.append((cx + rr * math.cos(a), y + rr * math.sin(a)))
        d.polygon(pts, fill=GOLD)
    im.save(os.path.join(HERE, 'stage_banner.png'))


def meander():
    """One repeat of a gold Greek-key band on burgundy (wrapped 12 times round the plinth): 960 x 200 = 0.474 x 0.1 m."""
    W, H = 960, 200
    im = Image.new('RGB', (W, H), hexc('#5e1726')[:3]); d = ImageDraw.Draw(im)
    G = hexc('#d6a845')[:3]
    d.rectangle((0, 0, W, 16), fill=G); d.rectangle((0, H - 16, W, H), fill=G)
    g = 26; y0 = 40; lw = 13
    for u in range(2):
        x0 = u * 480 + 40
        P = [(0, 4), (0, 0), (4, 0), (4, 4), (1, 4), (1, 1), (3, 1), (3, 3), (2, 3)]
        pts = [(x0 + px * g * 1.25, y0 + py * g) for px, py in P]
        d.line(pts, fill=G, width=lw, joint='curve')
        d.line([(x0 + 0 * g, y0 + 4 * g), (x0 - 40, y0 + 4 * g)], fill=G, width=lw)
        d.line([(x0 + 4 * g * 1.25, y0 + 4 * g), (x0 + 480 - 40, y0 + 4 * g)], fill=G, width=lw)
        cx = x0 + 330; cy = y0 + 2 * g
        d.polygon([(cx, cy - 40), (cx + 40, cy), (cx, cy + 40), (cx - 40, cy)], fill=G)
    im.save(os.path.join(HERE, 'stage_meander.png'))


ART16 = ('解雇は、客観的に合理的な理由を欠き、社会'
         '通念上相当であると認められない場合は、そ'
         'の権利を濫用したものとして、無効とする。')


def tablet():
    """Law tablet face, 0.62 x 1.15 m (1240 x 2300): navy slate, gold double border, the Labor Contract Act's title,
    Article 16 (dismissal without objectively reasonable grounds is an abuse of right and void) in gold lines."""
    W, H = 1240, 2300
    im = Image.new('RGB', (W, H), hexc('#1b2342')[:3]); d = ImageDraw.Draw(im)
    G, GD = hexc('#d9ab48')[:3], hexc('#8a6424')[:3]
    d.rectangle((24, 24, W - 24, H - 24), outline=G, width=22); d.rectangle((70, 70, W - 70, H - 70), outline=G, width=8)
    fb = lambda px: ImageFont.truetype(FD + 'YuGothB.ttc', px, index=0)
    d.text((W / 2, 250), '労働契約法', font=fb(150), fill=G, anchor='mm')
    d.rectangle((180, 360, W - 180, 372), fill=G)
    d.text((W / 2 + 5, 535), '第十六条', font=fb(210), fill=GD, anchor='mm')
    d.text((W / 2, 530), '第十六条', font=fb(210), fill=G, anchor='mm')
    f = fb(88); per = 11; y = 760
    for i in range(0, len(ART16), per):
        d.text((150, y), ART16[i:i + per], font=f, fill=G); y += 128
    # small scales mark + three rules at the foot
    cx, cy = W / 2, H - 330
    d.rectangle((cx - 8, cy - 120, cx + 8, cy + 90), fill=G); d.rectangle((cx - 150, cy - 110, cx + 150, cy - 94), fill=G)
    for s in (-1, 1):
        d.line([(cx + s * 140, cy - 100), (cx + s * 190, cy), (cx + s * 90, cy), (cx + s * 140, cy - 100)], fill=G, width=8)
        d.chord((cx + s * 140 - 60, cy - 40, cx + s * 140 + 60, cy + 40), 0, 180, fill=G)
    d.rectangle((cx - 90, cy + 90, cx + 90, cy + 110), fill=G)
    for k in range(3): d.rectangle((200, H - 190 + k * 34, W - 200, H - 178 + k * 34), fill=GD if k else G)
    im.save(os.path.join(HERE, 'stage_tablet.png'))


if __name__ == '__main__':
    random.seed(7)
    sunburst(); medallion(); banner(); meander(); tablet()
    print('stage textures written')
