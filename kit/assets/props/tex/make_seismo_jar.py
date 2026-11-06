# Seismo jar bands (original designs, drawn as cast-bronze relief: bronze ground, dark engraved lines, green patina
# collected in the recesses). Both tiles repeat seamlessly left-right; seismo_jar.py wraps them around the body by UV.
#   seismo_jar_clouds.png  belly frieze, 8 tiles around: a three-lobed auspicious cloud with scroll spirals, its ribbon
#                          tail running into the next tile's cloud (one cloud under every dragon).
#   seismo_jar_fret.png    lower band / lid flange: a square-spiral "thunder" key pattern, raised bronze lines on a
#                          patina ground (16 tiles around the body, 24 around the lid).
#   .venv/Scripts/python.exe assets/props/tex/make_seismo_jar.py
import math, os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
S = 2                                   # supersample, then downscale for clean edges
BRONZE = (176, 122, 58)                 # #b07a3a  (the prop's bronze at patina 0: the ground must match it)
LINE = (84, 52, 24)                     # engraved line
PAT = (95, 143, 114)                    # #5f8f72  patina
PAT_D = (72, 116, 92)                   # deeper patina (spiral cores)
RAISED = (204, 148, 78)                 # raised, rubbed-bright bronze


def spiral(cx, cy, r0, r1, turns, a0=0.0, n=160, cw=1):
    pts = []
    for k in range(n + 1):
        t = k / n
        a = a0 + cw * t * turns * 2 * math.pi
        r = r0 + (r1 - r0) * t
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def sc(pts): return [(x * S, y * S) for x, y in pts]


def line(d, pts, fill, w):
    """A round-capped stroke stamped as discs (PIL's wide-line joints leave hairline ticks on curves)."""
    r = w / 2
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / max(1.0, w / 6)))
        for k in range(n + 1):
            x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
            d.ellipse((S * (x - r), S * (y - r), S * (x + r), S * (y + r)), fill=fill)


def disc(d, cx, cy, r, fill):
    d.ellipse((S * (cx - r), S * (cy - r), S * (cx + r), S * (cy + r)), fill=fill)


# ------------------------------------------------------------------ clouds (1024 x 512, 0.46 x 0.24 m on the jar)
W, H = 1024, 512
im = Image.new('RGB', (W * S, H * S), BRONZE)
d = ImageDraw.Draw(im)
OUT = 22                                 # outline width (px)
lobes = [(392, 300, 92), (540, 214, 112), (684, 296, 88)]
base = (350, 262, 726, 392)              # the cloud's flat underside joining the lobes


def tail_pts():
    """Ribbon from the left cloud lobe out to the left edge (y 352) and in from the right edge into the right lobe."""
    left = [(322, 340), (262, 372), (188, 384), (120, 366), (70, 352), (0, 352), (-40, 352)]
    right = [(W + 40, 352), (W, 352), (960, 352), (900, 372), (836, 380), (780, 362), (742, 336)]
    return left, right


left, right = tail_pts()
# 1) dark under-layer (outline of the whole cloud + ribbon)
for pts in (left, right):
    line(d, pts, LINE, 52 + 2 * OUT)
for cx, cy, r in lobes:
    disc(d, cx, cy, r + OUT, LINE)
d.rounded_rectangle((S * (base[0] - OUT), S * (base[1] - OUT), S * (base[2] + OUT), S * (base[3] + OUT)), radius=S * (65 + OUT), fill=LINE)
# small curls in the top corners (they read as wisps between the clouds)
wisps = [(170, 176, 50), (874, 168, 46)]
for cx, cy, r in wisps:
    disc(d, cx, cy, r + OUT * 0.8, LINE)
# 2) patina fill (the recess)
for pts in (left, right):
    line(d, pts, PAT, 52)
for cx, cy, r in lobes:
    disc(d, cx, cy, r, PAT)
d.rounded_rectangle((S * base[0], S * base[1], S * base[2], S * base[3]), radius=S * 65, fill=PAT)
for cx, cy, r in wisps:
    disc(d, cx, cy, r, PAT)
# 3) raised scroll spirals in each lobe (bright bronze ridge with a dark edge), deeper patina at the core
for k, (cx, cy, r) in enumerate(lobes):
    cw = -1 if k == 0 else 1
    sp = spiral(cx, cy, 6, r * 0.78, 1.55, a0=math.radians(90 if k != 1 else 200), cw=cw)
    disc(d, cx, cy, r * 0.22, PAT_D)
    line(d, sp, LINE, 30)
    line(d, sp, RAISED, 14)
for k, (cx, cy, r) in enumerate(wisps):
    sp = spiral(cx, cy, 4, r * 0.74, 1.3, a0=math.radians(30), cw=1 if k else -1)
    line(d, sp, LINE, 24)
    line(d, sp, RAISED, 10)
# a raised line running along the ribbon's middle
for pts in (left, right):
    line(d, pts, LINE, 22)
    line(d, pts, RAISED, 9)
# 4) engraved border lines (top and bottom) + a dotted row under the top line
for y in (34, H - 34):
    d.rectangle((0, S * (y - 7), W * S, S * (y + 7)), fill=LINE)
for k in range(16):
    x = k * W / 16 + W / 32
    disc(d, x, 66, 7, LINE)
im = im.resize((W, H), Image.LANCZOS)
im.save(os.path.join(HERE, 'seismo_jar_clouds.png'))

# ------------------------------------------------------------------ fret (512 x 176: two square spirals per tile)
W, H = 512, 176
im = Image.new('RGB', (W * S, H * S), PAT)
d = ImageDraw.Draw(im)
EDGE = 16
d.rectangle((0, 0, W * S, EDGE * S), fill=BRONZE)                  # plain bronze rims top and bottom
d.rectangle((0, (H - EDGE) * S, W * S, H * S), fill=BRONZE)
d.rectangle((0, EDGE * S, W * S, (EDGE + 6) * S), fill=LINE)
d.rectangle((0, (H - EDGE - 6) * S, W * S, (H - EDGE) * S), fill=LINE)


def square_spiral(x0, y0, w, h, step, mirror=False):
    """Inward rectangular spiral starting at the bottom-left corner of the cell."""
    pts = [(x0, y0 + h)]
    l, t, r, b = x0, y0, x0 + w, y0 + h
    side = 0
    while r - l > step * 0.9 and b - t > step * 0.9:
        if side == 0: pts.append((l, t)); l += step
        elif side == 1: pts.append((r, t)); t += step
        elif side == 2: pts.append((r, b)); r -= step
        else: pts.append((l + 0, b)); b -= step
        side = (side + 1) % 4
        if len(pts) > 12: break
    if mirror: pts = [(2 * x0 + w - x, y) for x, y in pts]
    return pts


cell = W // 2
for c in range(2):
    m = 28
    y0, h = EDGE + 26, H - 2 * EDGE - 52
    pts = square_spiral(c * cell + m, y0, cell - 2 * m, h, 27, mirror=bool(c))
    # joiner along the bottom to the neighbour cell (the two spirals of a tile meet in the middle, tiles meet at the edges)
    jx = c * cell + (m if not c else cell - m)
    join = [(jx, y0 + h), (c * cell + (0 if not c else cell), y0 + h)]
    line(d, join, LINE, 26)
    line(d, pts, LINE, 26)
    line(d, join, RAISED, 14)
    line(d, pts, RAISED, 14)
im = im.resize((W, H), Image.LANCZOS)
im.save(os.path.join(HERE, 'seismo_jar_fret.png'))
print('ok')
