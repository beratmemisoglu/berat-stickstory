# Coffee mug motif: a round cartoon cat face (ears, closed happy eyes, blush, a "w" mouth, whiskers), original design,
# cut into vertical slices that wrap around the mug (alpha outside the drawing).
#   .venv/Scripts/python.exe assets/props/tex/make_coffee_mug.py
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
N = 6                               # slices (coffee_mug.py STRIPS)
W, H = 600, 540                     # 0.056 x 0.05 m on the mug
INK = (42, 38, 34, 255)
FUR = (236, 160, 72, 255)           # ginger cat
S = 2                               # supersample, then downscale for clean edges
im = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
d = ImageDraw.Draw(im)


def P(*xy): return [v * S for v in xy]


# ears (behind the head), head, inner ears
for ex in (1, -1):
    cx = 300 + ex * 150
    d.polygon(P(cx - 95 * ex, 210, cx + 30 * ex, 40, cx + 70 * ex, 250), fill=INK)
    d.polygon(P(cx - 70 * ex, 210, cx + 26 * ex, 72, cx + 52 * ex, 230), fill=FUR)
d.ellipse(P(70, 120, 530, 520), fill=INK)
d.ellipse(P(84, 134, 516, 506), fill=FUR)
for ex in (1, -1):
    cx = 300 + ex * 150
    d.polygon(P(cx - 40 * ex, 190, cx + 22 * ex, 100, cx + 40 * ex, 205), fill=(246, 196, 170, 255))
# a lighter muzzle
d.ellipse(P(190, 330, 410, 470), fill=(250, 226, 190, 255))
# closed happy eyes (arcs), blush, nose, "w" mouth
for ex in (1, -1):
    cx = 300 + ex * 105
    d.arc(P(cx - 48, 250, cx + 48, 330), 200, 340, fill=INK, width=18 * S)
    d.ellipse(P(cx + ex * 30 - 34, 340, cx + ex * 30 + 34, 380), fill=(232, 112, 104, 255))
d.polygon(P(276, 345, 324, 345, 300, 372), fill=INK)
d.arc(P(248, 360, 302, 420), 0, 180, fill=INK, width=12 * S)
d.arc(P(298, 360, 352, 420), 0, 180, fill=INK, width=12 * S)
# whiskers
for ex in (1, -1):
    for k, dy in enumerate((-18, 14)):
        x0 = 300 + ex * 170
        d.line(P(x0, 380 + dy, x0 + ex * 120, 370 + dy * 2.4), fill=INK, width=10 * S)
im = im.resize((W, H), Image.LANCZOS)
for i in range(N):
    im.crop((i * W // N, 0, (i + 1) * W // N, H)).save(os.path.join(HERE, f'coffee_mug_motif{i}.png'))
im.save(os.path.join(HERE, 'coffee_mug_motif_full.png'))
print('ok')
