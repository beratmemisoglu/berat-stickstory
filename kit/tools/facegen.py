# Procedural face renderer v3: one transparent PNG per frame from the face parameters (engine/faceparams.py), drawn
# in the owner's reference style (ref/ref.mp4, measured on full-size crops, ISSUES "Faces v3"): soft GREY features, no
# glints; resting eyes are grey half-ovals under a long straight lid line; shocked eyes are grey RINGS with a small grey
# pupil; thick rounded grey brows set high (they ride up over the hairline - drawn again on the hair from br_####.png);
# mouths with a thick dark outline, a dark interior, a white top-teeth band and a pink tongue; clenched teeth grids,
# wavy worry lines, a bushy moustache as a style option.
#   .venv/Scripts/python.exe tools/facegen.py <faces.json> <out_dir> [--size 1024]
#   .venv/Scripts/python.exe tools/facegen.py --sheet <out.jpg>        (every preset on a white head, for review)
# faces.json: {"frames": {"<global frame>": {param: value, ...}, ...}, "style": {...}}; files: <out_dir>/####.png (face)
# and <out_dir>/br_####.png (the brows alone, projected on the hair cap so raised brows stay visible over the hair).
import hashlib, json, math, os, shutil, sys
from PIL import Image, ImageDraw, ImageChops, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'engine'))
import faceparams as FP

FEAT = (74, 71, 71, 255)        # the grey of eyes, brows, lids, closed mouths (reference close-ups: ~70-95 grey)
LINE = (38, 32, 32, 255)        # mouth outline
MOUTH = (60, 46, 46, 255); MOUTH2 = (36, 28, 28, 255)
TONGUE = (243, 142, 160, 255); TEETH = (252, 251, 248, 255); WHITE = (255, 255, 255, 255)
BLUE = (128, 196, 238, 255); BLUE_D = (52, 98, 140, 255); PINK = (240, 140, 150, 255); RED = (220, 50, 40, 255)
GOLD = (250, 200, 40, 255)


class Pen:
    """Face space (u right, v up, 0..1) -> pixels of a supersampled canvas."""
    def __init__(self, S): self.S = S
    def p(self, u, v): return (u * self.S, (1 - v) * self.S)
    def w(self, d): return max(1, int(round(d * self.S)))


def stroke(dr, pen, pts, width, color=FEAT):
    P = [pen.p(*q) for q in pts]; w = pen.w(width)
    if len(P) > 1: dr.line(P, fill=color, width=w, joint='curve')
    for x, y in P[1:-1:max(1, len(P) // 6)] + [P[0], P[-1]]:      # round caps + smooth joints
        dr.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=color)


def ellipse(dr, pen, c, rx, ry, fill=None, outline=None, width=0.0):
    x0, y0 = pen.p(c[0] - rx, c[1] + ry); x1, y1 = pen.p(c[0] + rx, c[1] - ry)
    dr.ellipse([x0, y0, x1, y1], fill=fill, outline=outline, width=pen.w(width) if outline else 0)


def bez(a, b, c, n=28):
    return [((1 - t) ** 2 * a[0] + 2 * t * (1 - t) * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * t * (1 - t) * b[1] + t * t * c[1])
            for t in (i / (n - 1) for i in range(n))]


def layer(S): return Image.new('RGBA', (S, S), (0, 0, 0, 0))


def cut(img, keep):
    """Keep only where the L mask `keep` is 255."""
    img.putalpha(ImageChops.multiply(img.getchannel('A'), keep))


# ---------------------------------------------------------------- layout (face units: the head is ~1.19 u wide)
EYE_C = {'L': (0.665, 0.52), 'R': (0.335, 0.52)}     # L = the character's own left = +X = image right
RX, RY = 0.088, 0.108          # the eye's oval (resting eyes show its lower ~60 % under the lid); +25 % after the first side by side
RING = 0.148                  # shock rings (outer radius)
LW = 0.033                    # ring / closed-line weight
LID = 0.025                   # the lid line is thinner than the rings (reference f140; critic: lids read as heavy bars)


def draw_eye(img, pen, side, f, st):
    S = pen.S; dr = ImageDraw.Draw(img)
    cx, cy = EYE_C[side]; es = f['es'] * f.get('pop', 1.0)
    rx, ry = RX * es * st.get('eye_w', 1.0), RY * es
    gx, gy = f['gx'], f['gy']
    mode = int(round(f['em'])); eo = f['eo_' + side]; el = f['el_' + side]
    tilt = f.get('lt_' + side, 0.0) * (1 if side == 'L' else -1)     # lid tilt (+ = inner end down: unimpressed / angry)
    lw = LW * st.get('line_w', 1.0)
    if mode == 1:      # happy closed arcs (an n-shape)
        stroke(dr, pen, bez((cx - rx * 1.45, cy - ry * 0.3), (cx, cy + ry * 1.45), (cx + rx * 1.45, cy - ry * 0.3)), lw * 1.45); return
    if mode == 6:      # X
        k = rx * 1.0
        stroke(dr, pen, [(cx - k, cy + k), (cx + k, cy - k)], lw * 1.1); stroke(dr, pen, [(cx - k, cy - k), (cx + k, cy + k)], lw * 1.1); return
    if mode == 5:      # spiral
        pts = [(cx + rx * 1.3 * (a / 14) * math.cos(a), cy + rx * 1.3 * (a / 14) * math.sin(a)) for a in [i * 0.35 for i in range(40)]]
        stroke(dr, pen, pts, lw * 0.85); return
    if mode == 3:      # star
        pts = []
        for i in range(10):
            a = math.pi / 2 + i * math.pi / 5; r = rx * (1.55 if i % 2 == 0 else 0.62)
            pts.append(pen.p(cx + r * math.cos(a), cy + r * math.sin(a)))
        dr.polygon(pts, fill=GOLD, outline=LINE, width=pen.w(0.01)); return
    if mode == 4:      # heart
        hl = layer(S); hd = ImageDraw.Draw(hl); r = rx * 0.72
        ellipse(hd, pen, (cx - r * 0.75, cy + r * 0.35), r, r, fill=RED); ellipse(hd, pen, (cx + r * 0.75, cy + r * 0.35), r, r, fill=RED)
        hd.polygon([pen.p(cx - r * 1.68, cy + r * 0.05), pen.p(cx + r * 1.68, cy + r * 0.05), pen.p(cx, cy - r * 1.85)], fill=RED)
        img.alpha_composite(hl); return
    if eo < 0.07 and mode == 0 and f['ms'] > 0.45 and f['eo_' + ('R' if side == 'L' else 'L')] > 0.3:
        # a wink (this eye shut, the other open, smiling): a happy arc, not a flat bar (that read as an eye patch)
        stroke(dr, pen, bez((cx - rx * 1.4, cy - ry * 0.25), (cx, cy + ry * 1.2), (cx + rx * 1.4, cy - ry * 0.25)), lw * 1.35); return
    if eo < 0.07:      # shut: one straight soft line, a touch longer than the eye (blinks, the frame of a swap)
        half = (RING * es if mode == 2 else rx * 1.35)
        stroke(dr, pen, [(cx - half, cy + ry * 0.05), (cx + half, cy + ry * 0.05 - tilt * 0.01)], lw); return
    eye = layer(S); ed = ImageDraw.Draw(eye)
    if mode == 2:      # wide: a grey ring, white inside, a small soft grey pupil
        R = RING * es * st.get('eye_w', 1.0); Ry = RING * es
        ellipse(ed, pen, (cx, cy), R, Ry, fill=WHITE, outline=FEAT, width=lw)
        pr = 0.036 * f.get('pupil', 1.0) * (0.7 + 0.3 * es)
        px, py = cx + gx * R * 0.48, cy + gy * Ry * 0.42
        ellipse(ed, pen, (px, py), pr, pr, fill=FEAT)
        top_r, half_w = Ry, R
    elif st.get('dot_eyes'):   # behind glasses (the reference's lady, f865): a small grey dot, the lens frame is the
        # ring - grey ovals + lids behind the frames read as SUNGLASSES (OFFICE); a lid only when really squinting
        pr = 0.05 * f.get('pupil', 1.0) * (0.75 + 0.25 * es)
        ellipse(ed, pen, (cx + gx * rx * 0.6, cy + gy * ry * 0.45), pr, pr, fill=FEAT)
        top_r, half_w = pr, pr * 1.4
        eo = 1.0 if eo > 0.35 else eo / 0.35; el = 0.0
    else:              # resting: a solid grey oval (no glint), looking = the oval shifts a little
        ox, oy = gx * rx * 0.42, gy * ry * 0.3
        ellipse(ed, pen, (cx + ox, cy + oy), rx, ry, fill=FEAT)
        # a whisper of shading: darker under the lid
        sh = layer(S); ImageDraw.Draw(sh).rectangle([0, 0, S, pen.p(0, cy + ry * 0.2)[1]], fill=(30, 28, 28, 70))
        sh.putalpha(ImageChops.multiply(sh.getchannel('A'), eye.getchannel('A'))); eye.alpha_composite(sh)
        top_r, half_w = ry, rx
    top = cy + top_r * (2 * eo - 1)
    bot = cy - top_r * (1 - 2 * min(el, 0.9)) if el > 0.01 else None
    if eo < 0.985 or bot is not None:
        mask = Image.new('L', (S, S), 255); md = ImageDraw.Draw(mask)
        if eo < 0.985:
            # the lid: a straight line (tilted by lt_*), everything above it goes
            x0, x1 = pen.p(cx - 1, 0)[0], pen.p(cx + 1, 0)[0]
            y0 = pen.p(0, top + tilt * 0.06)[1]; y1 = pen.p(0, top - tilt * 0.06)[1]
            md.polygon([(x0, 0), (x1, 0), (x1, y1), (x0, y0)], fill=0)
        if bot is not None: md.rectangle([0, pen.p(0, bot)[1], S, S], fill=0)
        cut(eye, mask)
    img.alpha_composite(eye); dr = ImageDraw.Draw(img)
    if eo < 0.985:
        # the lid line runs past the eye on both sides (~1.6x its width at rest), straight, round caps
        h = max(0.0, 1 - ((top - cy) / top_r) ** 2)
        half = max(half_w * math.sqrt(h) + 0.022, half_w * (1.55 if mode == 0 else 1.15)) * st.get('lid_len', 1.0)
        a = (cx - half, top + tilt * 0.06 * (half / 1.0)); b = (cx + half, top - tilt * 0.06 * (half / 1.0))
        stroke(dr, pen, [a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), b], LID * st.get('line_w', 1.0))
    if bot is not None and mode == 2:
        h = max(0.0, 1 - ((bot - cy) / top_r) ** 2); half = half_w * math.sqrt(h) * 1.05
        stroke(dr, pen, [(cx - half, bot), (cx + half, bot)], lw * 0.85)


def draw_brow(img, pen, side, f, st):
    dr = ImageDraw.Draw(img)
    cx, cy = EYE_C[side]; cy = cy + 0.2 + f['bh_' + side] * 1.6 + st.get('brow_y', 0.0)
    L = 0.112 * st.get('brow_len', 1.0); sgn = 1 if side == 'L' else -1         # inner end toward the middle
    t = math.radians(f['bt_' + side])
    inner = (cx - sgn * L * 0.92, cy + math.sin(t) * L * 0.95); outer = (cx + sgn * L * 1.08, cy - math.sin(t) * L * 0.95)
    arch = 0.012 if st.get('brow_flat') else 0.02 + f['ba_' + side] * 0.045
    mid = ((inner[0] + outer[0]) / 2, (inner[1] + outer[1]) / 2 + arch)
    # a soft arc, fuller in the middle than at the ends (the reference's brows), round caps
    w = 0.05 * f['bw'] * st.get('brow_w', 1.0)
    pts = bez(inner, mid, outer, 32); top, bot = [], []
    for i, p in enumerate(pts):
        q = pts[min(i + 1, len(pts) - 1)]; o = pts[max(i - 1, 0)]
        tx, ty = q[0] - o[0], q[1] - o[1]; n = math.hypot(tx, ty) or 1.0
        nx, ny = -ty / n, tx / n; hw = w / 2 * (0.7 + 0.42 * math.sin(math.pi * i / (len(pts) - 1)))
        top.append(pen.p(p[0] + nx * hw, p[1] + ny * hw)); bot.append(pen.p(p[0] - nx * hw, p[1] - ny * hw))
    dr.polygon(top + bot[::-1], fill=FEAT)
    for p, hw in ((pts[0], w * 0.35), (pts[-1], w * 0.35)):
        ellipse(dr, pen, p, hw, hw, fill=FEAT)


def mouth_shape(f, st):
    vm = 0.27 + f['my'] + st.get('mouth_y', 0.0)
    W = 0.185 * f['mw'] * (1 - 0.45 * f['mr']) * st.get('mouth_w', 1.0)
    H = f['mo'] * 0.27 * (1 + 0.3 * f['mr'])
    s, k, wv = f['ms'], f['mk'], f['mv']
    n = 40; xs = [-W + 2 * W * i / (n - 1) for i in range(n)]
    def corner(x):
        q = x / W; return vm + s * 0.05 * q * q + k * 0.03 * q + wv * 0.012 * math.sin(q * math.pi * 3)
    edge = lambda x: max(0.0, 1 - (x / W) ** 2)
    # a rounded-rect opening (the reference): flat-ish top, deep rounded bottom, round corners
    sq = 0.28 + 0.5 * f['mr']                     # exponent: low = boxy, high (round O) = elliptic
    top = [(0.5 + x, corner(x) + H * 0.16 * edge(x) ** sq * (1 - 0.7 * max(0, s))) for x in xs]
    bot = [(0.5 + x, corner(x) - H * edge(x) ** (sq + 0.12)) for x in reversed(xs)]
    return vm, W, H, top, bot, corner


def draw_mouth(img, pen, f, st):
    S = pen.S; dr = ImageDraw.Draw(img)
    vm, W, H, top, bot, corner = mouth_shape(f, st)
    mt = int(round(f['mt']))
    if f['mo'] < 0.05 and mt != 2:   # closed: a soft grey curve (wavy when mv)
        stroke(dr, pen, [(p[0], p[1]) for p in top[2:-2]], 0.032 * st.get('line_w', 1.0)); return
    if mt == 2 and f['mo'] < 0.05:   # closed clenched grin: a white rounded bar with a grid (the reference's ^_^ grin)
        hh = 0.075 + 0.03 * f['mw']
        top = [(p[0], p[1] + hh * 0.5) for p in top]
        bot = [(x, y - hh) for (x, y) in reversed(top)]
        H = hh
    poly = [pen.p(*q) for q in top + bot]
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).polygon(poly, fill=255)
    inside = layer(S); idr = ImageDraw.Draw(inside)
    # dark interior with a vertical gradient (lighter at the top)
    y_top = min(p[1] for p in poly); y_bot = max(p[1] for p in poly)
    for i in range(12):
        a = i / 11; c = tuple(int(MOUTH[j] + (MOUTH2[j] - MOUTH[j]) * a) for j in range(3)) + (255,)
        idr.rectangle([0, y_top + (y_bot - y_top) * i / 12, S, y_top + (y_bot - y_top) * (i + 1) / 12 + 1], fill=c)
    if mt == 2:          # clenched teeth: white with a middle line and tooth dividers
        idr.rectangle([0, 0, S, S], fill=TEETH)
        ymid = (y_top + y_bot) / 2
        idr.line([(0, ymid), (S, ymid)], fill=LINE, width=pen.w(0.01))
        nt = 4 if W < 0.2 else 5
        for i in range(1, nt):
            x = pen.p(0.5 - W + 2 * W * i / nt, 0)[0]; idr.line([(x, y_top), (x, y_bot)], fill=LINE, width=pen.w(0.009))
    else:
        if mt == 1 and H > 0.03:   # top teeth band
            th = min(H * 0.3, 0.05)
            band = [pen.p(*q) for q in top] + [pen.p(q[0], q[1] - th) for q in reversed(top)]
            idr.polygon(band, fill=TEETH)
            if f.get('mz', 0) > 0.5:     # tooth dividers on a grin
                for i in range(1, 6):
                    x = 0.5 - W + 2 * W * i / 6; xp = pen.p(x, 0)[0]
                    yt = pen.p(0, corner(x - 0.5) + H * 0.1)[1]; yb = pen.p(0, corner(x - 0.5) - th * 1.1)[1]
                    idr.line([(xp, yt), (xp, yb)], fill=LINE, width=pen.w(0.007))
        if H > 0.035 and f['mg'] > 0.05:   # tongue: a pink mound at the bottom
            tw = W * (0.62 if f['mr'] < 0.5 else 0.5)
            ellipse(idr, pen, (0.5 + f['mk'] * 0.02, corner(0) - H * 0.98), tw, H * 0.42 * min(1.2, f['mg'] + 0.4), fill=TONGUE)
    cut(inside, mask)
    img.alpha_composite(inside)
    dr = ImageDraw.Draw(img)
    ow = (0.03 if H > 0.05 else 0.022) * st.get('line_w', 1.0)
    dr.line(poly + [poly[0], poly[1]], fill=LINE, width=pen.w(ow), joint='curve')


def draw_mustache(img, pen, f, st):
    col = st.get('mustache')
    if not col: return
    c = tuple(int(col.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
    dark = tuple(int(v * 0.55) for v in c[:3]) + (255,)
    vm = 0.27 + f['my'] + st.get('mouth_y', 0.0) + 0.065 + f['mo'] * 0.04
    S = pen.S; m = layer(S); d = ImageDraw.Draw(m)
    # the reference's bushy moustache: a thick horseshoe band arching over the mouth, the ends drooping to the mouth
    # corners, a small notch in the top middle, a wavy lower edge
    def yc(q): return vm + 0.025 - 0.075 * q * q
    def th(q): return 0.085 * (1 - 0.45 * q * q) + 0.01
    pts = []
    for i in range(61):
        q = -1 + 2 * i / 60
        pts.append((0.5 + q * 0.19, yc(q) + th(q) / 2 - 0.016 * max(0, 1 - abs(q) * 7)))
    for i in range(61):
        q = 1 - 2 * i / 60
        pts.append((0.5 + q * 0.19, yc(q) - th(q) / 2 + 0.008 * math.cos(q * math.pi * 4.5)))
    P = [pen.p(*q) for q in pts]
    d.polygon(P, fill=c); d.line(P + [P[0], P[1]], fill=dark, width=pen.w(0.013), joint='curve')
    img.alpha_composite(m)


def draw_extras(img, pen, f):
    dr = ImageDraw.Draw(img)
    if f['x_blush'] > 0.05:
        bl = layer(pen.S); bd = ImageDraw.Draw(bl); a = int(160 * min(1, f['x_blush']))
        for u in (0.25, 0.75):
            ellipse(bd, pen, (u, 0.4), 0.065, 0.03, fill=PINK[:3] + (a,))
        img.alpha_composite(bl.filter(ImageFilter.GaussianBlur(pen.S * 0.008)))
    if f['x_sweat'] > 0.05:      # the reference's drop: light blue, dark outline, a white glint
        cx, cy = 0.83, 0.74
        P = [pen.p(cx, cy + 0.085)] + [pen.p(cx + 0.042 * math.sin(a), cy - 0.012 - 0.042 * math.cos(a) * 0.95) for a in [math.pi * (-0.5 + i / 20) for i in range(21)]]
        dr.polygon(P, fill=BLUE); dr.line(P + [P[0]], fill=BLUE_D, width=pen.w(0.009), joint='curve')
        ellipse(dr, pen, (cx + 0.014, cy - 0.008), 0.009, 0.016, fill=WHITE)
    if f['x_tears'] > 0.05:
        for side in ('L', 'R'):
            cx, cy = EYE_C[side]
            stroke(dr, pen, [(cx - 0.01, cy - 0.07), (cx - 0.015, cy - 0.24)], 0.026, BLUE)
    if f['x_stress'] > 0.05:
        for i, (u, v, a) in enumerate(((0.8, 0.86, 30), (0.87, 0.8, 10), (0.84, 0.93, 55))):
            r = math.radians(a); stroke(dr, pen, [(u, v), (u + 0.045 * math.cos(r), v + 0.045 * math.sin(r))], 0.014, RED)
    if f['x_sparkle'] > 0.05:
        for (u, v, s) in ((0.84, 0.86, 0.05), (0.92, 0.76, 0.03)):
            pts = []
            for i in range(8):
                a = i * math.pi / 4; r = s if i % 2 == 0 else s * 0.3; pts.append(pen.p(u + r * math.cos(a), v + r * math.sin(a)))
            dr.polygon(pts, fill=WHITE, outline=LINE, width=pen.w(0.005))
    if f['x_vein'] > 0.05:
        u, v = 0.26, 0.86
        for a in (45, 135, 225, 315):
            r = math.radians(a); stroke(dr, pen, [(u + 0.01 * math.cos(r), v + 0.01 * math.sin(r)), (u + 0.04 * math.cos(r), v + 0.04 * math.sin(r))], 0.013, RED)
    if f['x_gloom'] > 0.05:
        for i in range(5):
            u = 0.3 + i * 0.1; stroke(dr, pen, [(u, 0.95), (u, 0.78)], 0.009, (120, 90, 170, int(200 * f['x_gloom'])))


def soften(img, S, k=0.0013):
    """The reference's features are soft-edged grey (not crisp black): a small blur on the whole feature layer."""
    return img.filter(ImageFilter.GaussianBlur(max(0.6, S * k)))


def draw_face(f, size=1024, ss=2, style=None):
    st = style or {}
    S = size * ss; pen = Pen(S); img = layer(S)
    draw_mouth(img, pen, f, st)
    draw_mustache(img, pen, f, st)
    for side in ('L', 'R'): draw_eye(img, pen, side, f, st)
    for side in ('L', 'R'): draw_brow(img, pen, side, f, st)
    draw_extras(img, pen, f)
    return soften(img, S, st.get('soft', 0.0013)).resize((size, size), Image.LANCZOS)


def draw_brows_only(f, size=512, ss=2, style=None):
    st = style or {}
    S = size * ss; pen = Pen(S); img = layer(S)
    for side in ('L', 'R'): draw_brow(img, pen, side, f, st)
    return soften(img, S, st.get('soft', 0.0013)).resize((size, size), Image.LANCZOS)


def full(f):
    d = dict(FP.BASE); d.update(f); return d


def main():
    if sys.argv[1] == '--sheet':
        names = list(FP.P); cols = 8; cell = 220
        rows = (len(names) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cell, rows * (cell + 18)), (205, 205, 205)); d = ImageDraw.Draw(sheet)
        style = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
        for i, n in enumerate(names):
            head = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); ImageDraw.Draw(head).ellipse([6, 6, 506, 506], fill=(246, 245, 241, 255), outline=(26, 20, 16, 255), width=14)
            head.alpha_composite(draw_face(full(FP.P[n]), 512, 2, style))
            x, y = (i % cols) * cell, (i // cols) * (cell + 18)
            sheet.paste(head.resize((cell - 10, cell - 10), Image.LANCZOS).convert('RGB'), (x + 5, y + 18)); d.text((x + 6, y + 3), n, fill='black')
        sheet.save(sys.argv[2], quality=90); print('sheet', sys.argv[2]); return
    data = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]
    size = int(sys.argv[sys.argv.index('--size') + 1]) if '--size' in sys.argv else 1024
    os.makedirs(out, exist_ok=True)
    cache_f = os.path.join(out, '_hash.json')
    cache = json.load(open(cache_f)) if os.path.exists(cache_f) else {}
    style = data.get('style', {}); prev_h = None; prev = None; drawn = 0
    # the drawing code is part of the cache key: a layout change must redraw every frame (it once kept stale faces)
    code = hashlib.md5(open(os.path.abspath(__file__), 'rb').read()).hexdigest()[:8]
    for fr in sorted(data['frames'], key=int):
        f = full(data['frames'][fr]); key = json.dumps([round(v, 4) if isinstance(v, float) else v for v in (f[k] for k in sorted(f))] + [style], sort_keys=True)
        h = hashlib.md5((key + code).encode()).hexdigest()[:16]
        path = os.path.join(out, f'{int(fr):04d}.png'); bpath = os.path.join(out, f'br_{int(fr):04d}.png')
        if cache.get(fr) == h and os.path.exists(path) and os.path.exists(bpath): prev_h, prev = h, (path, bpath); continue
        if h == prev_h and prev:
            shutil.copyfile(prev[0], path); shutil.copyfile(prev[1], bpath)
        else:
            draw_face(f, size, 2, style).save(path, optimize=False)
            draw_brows_only(f, size // 2, 2, style).save(bpath, optimize=False); drawn += 1
        cache[fr] = h; prev_h, prev = h, (path, bpath)
    json.dump(cache, open(cache_f, 'w'))
    print('FACEGEN', out, len(data['frames']), 'frames,', drawn, 'drawn')


if __name__ == '__main__':
    main()
