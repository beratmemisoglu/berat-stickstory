# Pillow textures for assets/props/rubber_stamp.py (original drawings):
#   rubber_stamp_paper.png         the sheet: a personnel notice (company seal, NAME / DEPT / DATE in handwriting, ID
#                                  photo of a round-headed figure, text lines, an "HR DECISION" box where the stamp
#                                  lands, signature, coffee ring). 840 x 1188 = 0.21 x 0.297 m
#   rubber_stamp_mark_<TEXT>.png   the stamped mark: rough red ink (uneven pressure, speckle holes, ragged edges) in a
#                                  double border; RGBA, the alpha is the ink (RGB is cream where there is no ink, so
#                                  the same file also works unclipped). 960 x 400 = 0.12 x 0.05 m (the rubber die)
#   rubber_stamp_label_<TEXT>.png  the index label on the front of the wooden mount (clean red text on cream). 900 x 180
# run: .venv/Scripts/python.exe assets/props/tex/make_rubber_stamp.py [TEXT ...]     (default: FIRED REASSIGNED)
import os, sys, re
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('CZ_TEX_OUT') or HERE   # (Toon Studio: the project's .suite/btex, never the app's kit)
FD = 'C:/Windows/Fonts/'
INK = '#2a2622'; PAPER = '#e9e4d6'; RED = (192, 44, 36); CREAM = (242, 239, 230)   # flat-lying paper catches the most light: keep it darker than wall prints


def font(name, px): return ImageFont.truetype(FD + name, int(px))
def safe(t): return re.sub(r'[^A-Z0-9]+', '_', t.upper()).strip('_')


def fit(d, text, name, max_w, max_h, start=300):
    px = start
    while px > 8:
        f = font(name, px); b = d.textbbox((0, 0), text, font=f)
        if b[2] - b[0] <= max_w and b[3] - b[1] <= max_h: return f, b
        px -= 3
    return f, b


def mark(text, seed=3):
    S = 2; W, H = 960 * S, 400 * S
    sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
    d.rounded_rectangle((18 * S, 18 * S, W - 18 * S, H - 18 * S), radius=34 * S, outline=255, width=22 * S)
    d.rounded_rectangle((54 * S, 54 * S, W - 54 * S, H - 54 * S), radius=18 * S, outline=255, width=8 * S)
    f, b = fit(d, text, 'ariblk.ttf', W - 190 * S, H - 170 * S, 400 * S)
    d.text(((W - (b[2] - b[0])) / 2 - b[0], (H - (b[3] - b[1])) / 2 - b[1]), text, font=f, fill=255)
    rng = np.random.default_rng(seed)
    a = np.asarray(sh.filter(ImageFilter.GaussianBlur(3 * S)), dtype=np.float32) / 255
    # ragged edges: low-frequency noise added to the blurred edge before the threshold
    n1 = Image.fromarray((rng.random((H // 6, W // 6)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    n1 = np.asarray(n1.filter(ImageFilter.GaussianBlur(2 * S)), dtype=np.float32) / 255 - 0.5
    ink = (a + n1 * 0.55) > 0.5
    # uneven pressure: fewer ink on the left and the top edge, plus speckle holes
    yy, xx = np.mgrid[0:H, 0:W]
    press = 0.55 + 0.45 * (xx / W) * 0.7 + 0.3 * (yy / H)
    n2 = Image.fromarray((rng.random((H // 3, W // 3)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    n2 = np.asarray(n2.filter(ImageFilter.GaussianBlur(1.2 * S)), dtype=np.float32) / 255
    holes = n2 > (0.42 + 0.5 * press.clip(0, 1) * 0.6)
    ink &= ~holes
    alpha = Image.fromarray((ink * 255).astype(np.uint8)).resize((960, 400), Image.LANCZOS).point(lambda v: 255 if v > 110 else 0)
    # colour: red, a little darker where the ink pooled
    pool = np.asarray(Image.fromarray((n1 * 255 + 128).clip(0, 255).astype(np.uint8)).resize((960, 400)), dtype=np.float32) / 255
    rgb = np.zeros((400, 960, 3), np.float32)
    for i in range(3): rgb[..., i] = RED[i] * (0.82 + 0.3 * pool)
    al = np.asarray(alpha) > 0
    out = np.where(al[..., None], rgb, np.array(CREAM, np.float32)).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(out, 'RGB').convert('RGBA'); im.putalpha(alpha)
    return im


def label(text):
    S = 2; W, H = 900, 180
    im = Image.new('RGB', (W * S, H * S), CREAM); d = ImageDraw.Draw(im)
    d.rectangle((6 * S, 6 * S, (W - 6) * S, (H - 6) * S), outline=INK, width=6 * S)
    f, b = fit(d, text, 'ariblk.ttf', (W - 80) * S, (H - 60) * S, 200 * S)
    d.text(((W * S - (b[2] - b[0])) / 2 - b[0], (H * S - (b[3] - b[1])) / 2 - b[1]), text, font=f, fill=RED)
    return im.resize((W, H), Image.LANCZOS)


def paper():
    S = 2; W, H = 840, 1188
    def P(*v): return [int(round(x * S)) for x in v]
    im = Image.new('RGB', (W * S, H * S), PAPER); d = ImageDraw.Draw(im)
    # company seal + title
    d.ellipse(P(50, 50, 170, 170), fill='#c8463c'); d.ellipse(P(62, 62, 158, 158), outline=PAPER, width=5 * S)
    try:
        fk = ImageFont.truetype(FD + 'YuGothB.ttc', 64 * S); d.text(tuple(P(110, 110)), '株', font=fk, fill=PAPER, anchor='mm')
    except OSError:
        pass
    d.text(tuple(P(196, 58)), 'PERSONNEL', font=font('ariblk.ttf', 62 * S), fill=INK)
    d.text(tuple(P(196, 124)), 'NOTICE', font=font('ariblk.ttf', 46 * S), fill=INK)
    d.line(P(50, 200, W - 50, 200), fill=INK, width=6 * S)
    # fields (handwriting) + ID photo
    hand = 'segoepr.ttf'
    for k, (lab, val) in enumerate((('NAME', 'Tanaka H.'), ('DEPT', 'Sales 2'), ('DATE', 'Oct 23'))):
        y = 240 + k * 92
        d.text(tuple(P(56, y)), lab + ':', font=font('arialbd.ttf', 34 * S), fill=INK)
        d.text(tuple(P(196, y - 12)), val, font=font(hand, 44 * S), fill='#2f4a8a')
        d.line(P(190, y + 46, 560, y + 46), fill='#6f6a61', width=3 * S)
    d.rectangle(P(600, 228, 790, 470), fill='#cfe3ef', outline=INK, width=5 * S)
    d.rounded_rectangle(P(640, 400, 750, 520), radius=40 * S, fill='#5b6270', outline=INK, width=5 * S)
    d.rectangle(P(605, 470, 785, 520), fill=PAPER)
    d.line(P(600, 470, 790, 470), fill=INK, width=5 * S)
    d.ellipse(P(642, 262, 748, 368), fill='#f6f3ec', outline=INK, width=5 * S)
    d.chord(P(642, 262, 748, 368), 190, 350, fill='#2a2622', outline=INK, width=5 * S)
    d.ellipse(P(670, 318, 680, 330), fill=INK); d.ellipse(P(710, 318, 720, 330), fill=INK)
    d.line(P(682, 348, 708, 348), fill=INK, width=4 * S)
    # body text lines
    for k in range(4):
        y = 530 + k * 28; ln = 700 if k < 3 else 420
        d.rounded_rectangle(P(56, y, 56 + ln, y + 12), radius=6 * S, fill='#b3ac9e')
    # HR DECISION box (the stamp lands here: centre 420, 790 px = (0, -0.049) m on the sheet)
    d.text(tuple(P(120, 642)), 'HR DECISION', font=font('arialbd.ttf', 28 * S), fill='#6f6a61')
    for x in range(120, 720, 24): d.line(P(x, 680, x + 12, 680), fill='#6f6a61', width=3 * S); d.line(P(x, 900, x + 12, 900), fill='#6f6a61', width=3 * S)
    for y in range(680, 900, 24): d.line(P(120, y, 120, y + 12), fill='#6f6a61', width=3 * S); d.line(P(720, y, 720, y + 12), fill='#6f6a61', width=3 * S)
    # signature
    d.line(P(440, 1060, 790, 1060), fill=INK, width=3 * S)
    d.text(tuple(P(440, 1070)), 'Manager', font=font('arial.ttf', 26 * S), fill='#6f6a61')
    pts = [(460, 1040), (490, 1000), (505, 1046), (530, 1004), (548, 1050), (580, 1020), (640, 1036), (700, 1012)]
    d.line([tuple(P(*p)) for p in pts], fill='#2f4a8a', width=5 * S, joint='curve')
    # coffee ring
    ring = Image.new('L', im.size, 0); rd = ImageDraw.Draw(ring)
    rd.ellipse(P(30, 930, 250, 1150), outline=130, width=12 * S); rd.ellipse(P(40, 942, 238, 1140), outline=60, width=6 * S)
    ring = ring.filter(ImageFilter.GaussianBlur(3 * S))
    im = Image.composite(Image.new('RGB', im.size, '#8f5e34'), im, ring)
    return im.resize((W, H), Image.LANCZOS)


if __name__ == '__main__':
    texts = sys.argv[1:] or ['FIRED', 'REASSIGNED']
    p = os.path.join(OUT, 'rubber_stamp_paper.png'); paper().save(p); print('wrote', p)
    for t in texts:
        for nm, fn in (('mark', mark), ('label', label)):
            p = os.path.join(OUT, f'rubber_stamp_{nm}_{safe(t)}.png'); fn(t.upper()).save(p); print('wrote', p)
