# Graphics for the BELL film's hand props (lab venv): .venv/Scripts/python.exe assets/props/tex/make_gb_handprops.py [what ...]
#   what: tickets | tag | floral | lace | wglass | all (default)
#   gb_suitcase_ticket_a/_b.png  stagecoach tickets "OVERLAND STAGE CO. - ONE WAY - 2 PASSENGERS" (stub on the left)
#   gb_suitcase_tag.png          manila luggage tag "GOING WEST"
#   gb_teacup_floral.png         porcelain wrap for the cup + saucer lathes (rows: v 0..0.75 outside, 0.75..1 inside)
#   gb_window_lace.png           lace curtain, RGBA (alpha 0 = holes, clipped)
#   gb_window_glass.png          RGBA shine strokes only (clear glass, alpha clipped)
# The props run this themselves (no window) when a PNG is missing or older than this script.
import math, os, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')


def font(names, size):
    for n in names:
        p = os.path.join(FONTS, n)
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def ctext(d, xy, s, f, fill, anchor='mm'):
    d.text(xy, s, font=f, fill=fill, anchor=anchor)


def fit(d, s, names, size, maxw):
    while size > 10:
        f = font(names, size)
        if d.textlength(s, font=f) <= maxw: return f
        size -= 2
    return font(names, size)


def aged(im, seed, strength=0.18):
    """Darker edges + a few soft stains (old paper)."""
    W, H = im.size
    rnd = random.Random(seed)
    vig = Image.new('L', (W, H), 0); vd = ImageDraw.Draw(vig)
    for i in range(24):
        k = i / 24
        vd.rectangle([int(k * W * 0.08), int(k * H * 0.1), W - 1 - int(k * W * 0.08), H - 1 - int(k * H * 0.1)], outline=int(255 * (1 - k) * strength))
    vig = vig.filter(ImageFilter.GaussianBlur(W / 40))
    im.paste((92, 62, 30), (0, 0), vig)
    st = Image.new('L', (W, H), 0); sd = ImageDraw.Draw(st)
    for _ in range(3):
        x, y, r = rnd.uniform(0, W), rnd.uniform(0, H), rnd.uniform(W * 0.04, W * 0.1)
        sd.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], fill=28)
    st = st.filter(ImageFilter.GaussianBlur(W / 60))
    im.paste((120, 80, 40), (0, 0), st)
    return im


def ticket(path, number, seed):
    W, H = 900, 420
    paper, ink, red = (233, 218, 178), (38, 30, 26), (150, 36, 28)
    im = Image.new('RGB', (W, H), paper); d = ImageDraw.Draw(im)
    d.rectangle([10, 10, W - 11, H - 11], outline=red, width=10)
    d.rectangle([28, 28, W - 29, H - 29], outline=ink, width=4)
    stub = 210
    for y in range(36, H - 36, 22): d.line([(stub, y), (stub, y + 11)], fill=ink, width=5)   # perforation
    # stub: number + a tiny stagecoach
    ctext(d, (stub / 2 + 14, 80), 'No.', font(['georgiab.ttf', 'timesbd.ttf'], 44), ink)
    ctext(d, (stub / 2 + 14, 134), number, font(['ariblk.ttf'], 50), red)
    cx, cy = stub / 2 + 14, 270
    d.rounded_rectangle([cx - 62, cy - 48, cx + 50, cy + 18], 10, fill=ink)           # coach body
    d.rectangle([cx - 44, cy - 36, cx - 12, cy - 6], fill=paper); d.rectangle([cx, cy - 36, cx + 32, cy - 6], fill=paper)
    d.rectangle([cx - 70, cy - 58, cx + 58, cy - 48], fill=ink)                         # roof rail
    for wx, wr in ((cx - 40, 30), (cx + 34, 24)):
        d.ellipse([wx - wr, cy + 34 - wr, wx + wr, cy + 34 + wr], outline=ink, width=8)
        d.line([(wx - wr, cy + 34), (wx + wr, cy + 34)], fill=ink, width=4); d.line([(wx, cy + 34 - wr), (wx, cy + 34 + wr)], fill=ink, width=4)
    ctext(d, (stub / 2 + 14, 360), 'STUB', font(['arialbd.ttf'], 30), ink)
    # main: company, red band ONE WAY, passengers
    x0, x1 = stub + 22, W - 40
    mid = (x0 + x1) / 2
    f1 = fit(d, 'OVERLAND STAGE CO.', ['ariblk.ttf'], 74, x1 - x0 - 10)
    ctext(d, (mid, 92), 'OVERLAND STAGE CO.', f1, ink)
    d.rectangle([x0, 150, x1, 262], fill=red)
    f2 = fit(d, 'ONE WAY', ['ariblk.ttf'], 100, x1 - x0 - 60)
    ctext(d, (mid, 206), 'ONE WAY', f2, paper)
    for sx in (x0 + 34, x1 - 34):   # stars on the band
        pts = [(sx + 22 * math.cos(math.radians(90 + 144 * k)), 206 - 22 * math.sin(math.radians(90 + 144 * k))) for k in range(5)]
        d.polygon(pts, fill=paper)
    f3 = fit(d, '2 PASSENGERS', ['ariblk.ttf'], 70, x1 - x0 - 10)
    ctext(d, (mid, 322), '2 PASSENGERS', f3, ink)
    ctext(d, (mid, 372), 'NOT TRANSFERABLE  -  GOOD FOR ONE JOURNEY WEST', font(['arialbd.ttf'], 22), ink)
    aged(im, seed, 0.22).save(path)


def tag(path):
    W, H = 360, 600
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    manila, ink = (196, 160, 98, 255), (44, 34, 28, 255)
    c = 70
    d.polygon([(c, 0), (W - c, 0), (W, c), (W, H), (0, H), (0, c)], fill=manila)
    d.ellipse([W / 2 - 46, 34, W / 2 + 46, 126], fill=(226, 206, 160, 255), outline=(150, 118, 70, 255), width=6)   # eyelet patch
    d.ellipse([W / 2 - 20, 60, W / 2 + 20, 100], fill=(0, 0, 0, 0))
    d.line([(30, 170), (W - 30, 170)], fill=ink, width=5)
    ctext(d, (W / 2, 220), 'PASSENGER', font(['arialbd.ttf'], 40), ink)
    ctext(d, (W / 2, 330), 'GOING', font(['ariblk.ttf'], 82), (150, 36, 28, 255))
    ctext(d, (W / 2, 430), 'WEST', font(['ariblk.ttf'], 104), (150, 36, 28, 255))
    d.line([(30, 520), (W - 30, 520)], fill=ink, width=5)
    ctext(d, (W / 2, 560), 'NO RETURN', font(['arialbd.ttf'], 34), ink)
    rgb = aged(im.convert('RGB'), 7, 0.2).convert('RGBA'); rgb.putalpha(im.split()[3])
    rgb.save(path)


def floral(path):
    """Cup wrap: x = around (tiles), y: image bottom = cup foot (v 0), v 0.75 = rim, top quarter = the inside."""
    W, H = 1600, 640
    white, gold, blue = (236, 230, 216), (184, 140, 52), (52, 84, 150)
    im = Image.new('RGB', (W, H), white); d = ImageDraw.Draw(im)
    def yv(v): return int(H * (1 - v))
    # gold rim outside (v .70-.75) + inner rim (v .75-.79), blue foot line
    d.rectangle([0, yv(0.75), W, yv(0.70)], fill=gold)
    d.rectangle([0, yv(0.80), W, yv(0.76)], fill=gold)
    d.rectangle([0, yv(0.09), W, yv(0.05)], fill=blue)
    # floral band v .2 .. .62 (tiles 5x around)
    n = 5; tw = W / n
    rose, rose_d, leaf, leaf_d = (196, 58, 78), (140, 30, 52), (66, 128, 70), (40, 88, 48)
    band_y0, band_y1 = yv(0.64), yv(0.18)
    d.line([(0, yv(0.66)), (W, yv(0.66))], fill=blue, width=6)
    d.line([(0, yv(0.16)), (W, yv(0.16))], fill=blue, width=6)
    for k in range(n + 1):
        cx = k * tw; cy = (band_y0 + band_y1) / 2
        for side in (-1, 1):   # vine
            pts = [(cx + side * t, cy + 28 * math.sin(t / tw * 2 * math.pi)) for t in range(0, int(tw / 2), 6)]
            d.line(pts, fill=leaf_d, width=7)
        for lx, ly, a in ((cx - 92, cy - 36, -30), (cx + 92, cy + 30, 150), (cx - 70, cy + 48, 210), (cx + 76, cy - 46, 20)):
            L = Image.new('RGBA', (120, 60), (0, 0, 0, 0)); ld = ImageDraw.Draw(L)
            ld.ellipse([4, 8, 116, 52], fill=leaf + (255,)); ld.line([(10, 30), (110, 30)], fill=leaf_d + (255,), width=5)
            L = L.rotate(a, expand=True); im.paste(L, (int(lx - L.size[0] / 2), int(ly - L.size[1] / 2)), L)
        r = 58
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=rose)
        for rr, ofs in ((40, 6), (26, -4), (13, 3)):
            d.arc([cx - rr + ofs, cy - rr, cx + rr + ofs, cy + rr], 200, 520, fill=rose_d, width=7)
        for fx, fy in ((cx - tw / 2, cy - 30), (cx - tw / 2 + 40, cy + 40)):   # forget-me-nots between roses
            for p in range(5):
                a = math.radians(p * 72)
                px, py = fx + 18 * math.cos(a), fy + 18 * math.sin(a)
                d.ellipse([px - 13, py - 13, px + 13, py + 13], fill=blue)
            d.ellipse([fx - 8, fy - 8, fx + 8, fy + 8], fill=(232, 196, 70))
    im.save(path)


def lace(path):
    """Panel ~0.55 m wide x ~1.95 m tall: 512 x 2048 keeps the holes round. Net of diamond holes, rows of flower
    medallions, a solid band + scalloped hem at the bottom (image bottom = curtain hem)."""
    W, H = 512, 2048
    a = Image.new('L', (W, H), 255); d = ImageDraw.Draw(a)
    step = 46
    for j in range(0, H // step + 1):
        for i in range(-1, W // step + 2):
            cx = i * step + (step / 2 if j % 2 else 0); cy = j * step
            if j % 4 == 1 and i % 3 == 0:   # medallion: ring of petal holes around a small hole
                for p in range(6):
                    an = math.radians(p * 60)
                    px, py = cx + 15 * math.cos(an), cy + 15 * math.sin(an)
                    d.ellipse([px - 7, py - 7, px + 7, py + 7], fill=0)
                d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=0)
            elif not (j % 4 == 1 and i % 3 != 0 and False):   # net mesh: diamond holes
                d.polygon([(cx, cy - 15), (cx + 13, cy), (cx, cy + 15), (cx - 13, cy)], fill=0)
    # solid border band above the hem with a row of round holes, then the scallops
    d.rectangle([0, H - 150, W, H - 60], fill=255)
    for i in range(0, W // 32 + 1):
        d.ellipse([i * 32 + 8, H - 118, i * 32 + 24, H - 102], fill=0)
    d.rectangle([0, H - 60, W, H], fill=0)
    for i in range(-1, W // 64 + 2):
        d.pieslice([i * 64 - 4, H - 100, i * 64 + 68, H - 6], 0, 180, fill=255)
        d.ellipse([i * 64 + 24, H - 52, i * 64 + 40, H - 36], fill=0)
    rgb = Image.new('RGB', (W, H), (236, 232, 222))
    rgb.putalpha(a)
    rgb.save(path)


def wglass(path):
    W = H = 512
    im = Image.new('RGBA', (W, H), (255, 255, 255, 0)); d = ImageDraw.Draw(im)
    for x0, wd in ((90, 46), (190, 20)):
        d.polygon([(x0, H - 40), (x0 + wd, H - 40), (x0 + wd + 260, 40), (x0 + 260, 40)], fill=(235, 244, 250, 255))
    im.save(path)


def main(args):
    what = set(args or ['all'])
    allw = 'all' in what
    if allw or 'tickets' in what:
        ticket(os.path.join(HERE, 'gb_suitcase_ticket_a.png'), '0187', 3)
        ticket(os.path.join(HERE, 'gb_suitcase_ticket_b.png'), '0188', 5)
    if allw or 'tag' in what: tag(os.path.join(HERE, 'gb_suitcase_tag.png'))
    if allw or 'floral' in what: floral(os.path.join(HERE, 'gb_teacup_floral.png'))
    if allw or 'lace' in what: lace(os.path.join(HERE, 'gb_window_lace.png'))
    if allw or 'wglass' in what: wglass(os.path.join(HERE, 'gb_window_glass.png'))
    print('gb tex ok', sorted(what))


if __name__ == '__main__':
    main(sys.argv[1:])
