# Textures of the ROOM set ("banishment room") and its corridor glimpse, read by film/japan/dress_room.py:
#  - unique painted surfaces, world-mapped (no repeats): back / left / right wall, floor, ceiling, corridor wall.
#    Each is drawn in world metres (Surf.px) on top of the Flow-made seamless tiles in assets/tex (olive_wall,
#    lino_floor, ceiling_tiles, plaster_wall): two-tone wall with a darker dado, water stains, an AC drip, scuffs,
#    a patched hole, peeling paint, cracks, "ghost" rectangles where notices / a whiteboard / furniture were removed,
#    worn lino with a traffic path and caster arcs, a ceiling grid with one water-stained and one displaced tile.
#  - prints for the room_* props (signs, labels, the evacuation map, notices, cork-board papers).
#   .venv/Scripts/python.exe assets/props/tex/make_room.py [walls] [floor] [ceil] [prints]   (no args = all)
import math, os, random, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
LAB = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SRC = os.path.join(LAB, 'assets', 'tex')
JP = 'C:/Windows/Fonts/YuGothB.ttc'
JPR = 'C:/Windows/Fonts/YuGothM.ttc'
BLK = 'C:/Windows/Fonts/ariblk.ttf'
BD = 'C:/Windows/Fonts/arialbd.ttf'
INK = (40, 36, 32, 255)
WHAT = set(sys.argv[1:]) or {'walls', 'floor', 'ceil', 'prints'}


def out(name): return os.path.join(HERE, name)


def font(path, px): return ImageFont.truetype(path, int(px))


class Surf:
    """A surface in world metres: u0..u1 left -> right, v0..v1 bottom -> top, ppm pixels per metre."""
    def __init__(self, u0, u1, v0, v1, ppm):
        self.u0, self.u1, self.v0, self.v1, self.ppm = u0, u1, v0, v1, ppm
        self.W, self.H = int(round((u1 - u0) * ppm)), int(round((v1 - v0) * ppm))

    def px(self, u, v): return ((u - self.u0) * self.ppm, (self.v1 - v) * self.ppm)
    def m(self, d): return d * self.ppm
    def box(self, ua, va, ub, vb):
        (x0, y0), (x1, y1) = self.px(ua, vb), self.px(ub, va)
        return (min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))


def tinted(path, tile_px, target, sat=1.0, contrast=1.0):
    """The seamless source resized to tile_px, its mean colour moved to target, saturation / contrast scaled."""
    im = Image.open(path).convert('RGB').resize((tile_px, tile_px), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    mean = a.reshape(-1, 3).mean(0)
    g = a.mean(2, keepdims=True)
    a = g + (a - g) * sat                                  # saturation of the detail around its grey
    a = mean.mean() + (a - mean.mean()) * contrast
    a = a * (np.array(target, np.float32) / np.maximum(1, a.reshape(-1, 3).mean(0)))
    return seamless(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))


def seamless(im):
    """Hide the tile seams (the Flow tiles are only nearly seamless): cross-fade with the half-rolled copy near the
    edges, so every edge pixel comes from the tile's continuous middle."""
    a = np.asarray(im).astype(np.float32); h, w = a.shape[:2]
    r = np.roll(np.roll(a, h // 2, 0), w // 2, 1)
    yy, xx = np.mgrid[0:h, 0:w]
    e = np.minimum(np.minimum(xx, w - 1 - xx) / (w / 2), np.minimum(yy, h - 1 - yy) / (h / 2))
    k = np.clip(e / 0.35, 0, 1)[..., None]; k = k * k * (3 - 2 * k)
    return Image.fromarray(np.clip(a * k + r * (1 - k), 0, 255).astype(np.uint8))


def tile_fill(surf, tile, ox=0, oy=0):
    im = Image.new('RGB', (surf.W, surf.H))
    t = tile.size[0]
    ox, oy = int(ox) % t - t, int(oy) % t - t
    for y in range(oy, surf.H, t):
        for x in range(ox, surf.W, t):
            im.paste(tile, (x, y))
    return im


def layer(surf): return Image.new('RGBA', (surf.W, surf.H), (0, 0, 0, 0))


def comp(base, lay, blur=0):
    if blur: lay = lay.filter(ImageFilter.GaussianBlur(blur))
    b = base.convert('RGBA'); b.alpha_composite(lay); return b.convert('RGB')


def blob(cx, cy, rx, ry, rnd, rough=0.25, n=28, rot=0.0):
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + rough * (0.5 * math.sin(2 * a + ph[0]) + 0.3 * math.sin(3 * a + ph[1]) + 0.2 * math.sin(5 * a + ph[2]))
        x, y = math.cos(a) * rx * r, math.sin(a) * ry * r
        c, s = math.cos(rot), math.sin(rot)
        pts.append((cx + x * c - y * s, cy + x * s + y * c))
    return pts


def stain(d, surf, u, v, ru, rv, rnd, fill=(120, 96, 40, 70), rim=(96, 72, 30, 150), rings=2, rimw=0.006):
    cx, cy = surf.px(u, v)
    for k in range(rings + 1):
        f = 1 - 0.28 * k
        pts = blob(cx + rnd.uniform(-0.15, 0.15) * surf.m(ru) * k, cy + 0.12 * surf.m(rv) * k, surf.m(ru) * f, surf.m(rv) * f, rnd)
        d.polygon(pts, fill=fill if k == 0 else (fill[0], fill[1], fill[2], fill[3] // 2))
        d.line(pts + [pts[0]], fill=rim if k == 0 else (rim[0], rim[1], rim[2], int(rim[3] * 0.7)), width=max(2, int(surf.m(rimw) * f)), joint='curve')


def drip(d, surf, u, v_top, length, w, rnd, col=(112, 86, 34, 120)):
    x, y0 = surf.px(u, v_top); y1 = y0 + surf.m(length); ww = surf.m(w)
    pts = []
    steps = 14
    for i in range(steps + 1):
        t = i / steps; pts.append((x + math.sin(t * 5 + u * 9) * ww * 0.25, y0 + (y1 - y0) * t))
    for i in range(steps):
        wid = max(2, int(ww * (1 - 0.55 * i / steps)))
        d.line([pts[i], pts[i + 1]], fill=col, width=wid)
    r = ww * 0.7; ex, ey = pts[-1]
    d.ellipse((ex - r, ey - r * 0.8, ex + r, ey + r * 1.2), fill=col)


def scuff(d, surf, u, v, length, rnd, col=(40, 36, 34, 120), w=0.006, ang=None):
    x, y = surf.px(u, v); L = surf.m(length)
    a = rnd.uniform(-0.5, 0.5) if ang is None else ang
    bend = rnd.uniform(-0.3, 0.3)
    pts = [(x + math.cos(a + bend * t) * L * t, y + math.sin(a + bend * t) * L * t) for t in np.linspace(0, 1, 8)]
    d.line(pts, fill=col, width=max(2, int(surf.m(w))), joint='curve')


def crack(d, surf, u, v, length, ang, rnd, col=(46, 42, 30, 190), w=0.0035, branch=True):
    x, y = surf.px(u, v); seg = surf.m(length) / 9; pts = [(x, y)]
    a = ang
    for i in range(9):
        a += rnd.uniform(-0.6, 0.6); x += math.cos(a) * seg; y += math.sin(a) * seg; pts.append((x, y))
    d.line(pts, fill=col, width=max(2, int(surf.m(w))), joint='curve')
    if branch:
        i = rnd.randint(3, 6); bx, by = pts[i]
        crack(d, surf, *_uv(surf, bx, by), length * 0.35, ang + rnd.choice((-0.9, 0.9)), rnd, col, w * 0.8, branch=False)


def _uv(surf, x, y): return (surf.u0 + x / surf.ppm, surf.v1 - y / surf.ppm)


def rect_ghost(d, surf, ua, va, ub, vb, clean=(255, 250, 225, 26), dirt=(40, 36, 20, 48), holes=(), tape=(), rnd=None):
    """Where something hung for years: a cleaner, paler rectangle with a dusty border; screw / pin holes; tape bits."""
    bx = surf.box(ua, va, ub, vb); e = surf.m(0.012)
    d.rectangle((bx[0] - e, bx[1] - e, bx[2] + e, bx[3] + e), outline=dirt, width=int(e * 1.3))
    d.rectangle(bx, fill=clean)
    for (u, v) in holes: hole(d, surf, u, v)
    for (u, v) in tape: tape_bit(d, surf, u, v, rnd)


def hole(d, surf, u, v, r=0.005):
    x, y = surf.px(u, v); rr = surf.m(r)
    d.ellipse((x - rr * 1.8, y - rr * 1.8, x + rr * 1.8, y + rr * 1.8), fill=(236, 230, 210, 140))
    d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(30, 26, 22, 230))


def tape_bit(d, surf, u, v, rnd, w=0.045, h=0.018):
    x, y = surf.px(u, v); a = rnd.uniform(-0.5, 0.5); ww, hh = surf.m(w) / 2, surf.m(h) / 2
    c, s = math.cos(a), math.sin(a)
    pts = [(x + px * c - py * s, y + px * s + py * c) for px, py in ((-ww, -hh), (ww, -hh), (ww, hh), (-ww, hh))]
    d.polygon(pts, fill=(222, 196, 120, 150), outline=(170, 140, 70, 170))


def vgrad(surf, v_a, v_b, col, a0, a1):
    """A vertical alpha gradient of one colour between heights v_a (alpha a0) and v_b (alpha a1)."""
    lay = np.zeros((surf.H, surf.W, 4), np.uint8); lay[..., :3] = col
    ys = np.arange(surf.H); v = surf.v1 - ys / surf.ppm
    t = np.clip((v - v_a) / (v_b - v_a), 0, 1); al = (a0 + (a1 - a0) * t)
    lay[..., 3] = np.repeat(al[:, None], surf.W, 1).astype(np.uint8)
    return Image.fromarray(lay, 'RGBA')


def ugrad(surf, u_a, u_b, col, a0, a1):
    lay = np.zeros((surf.H, surf.W, 4), np.uint8); lay[..., :3] = col
    xs = np.arange(surf.W); u = surf.u0 + xs / surf.ppm
    t = np.clip((u - u_a) / (u_b - u_a), 0, 1); al = (a0 + (a1 - a0) * t)
    lay[..., 3] = np.repeat(al[None, :], surf.H, 0).astype(np.uint8)
    return Image.fromarray(lay, 'RGBA')


def peel(d, surf, u, v, ru, rv, rnd, under=(222, 214, 186, 255)):
    cx, cy = surf.px(u, v)
    pts = blob(cx, cy, surf.m(ru), surf.m(rv), rnd, rough=0.45, n=22, rot=rnd.uniform(0, 3))
    d.polygon(pts, fill=under)
    d.line(pts + [pts[0]], fill=(58, 60, 34, 230), width=max(2, int(surf.m(0.004))), joint='curve')
    # the lifted lip: a lighter paint flake along one side
    k = len(pts) // 3
    d.line(pts[:k], fill=(170, 178, 120, 255), width=max(3, int(surf.m(0.007))), joint='curve')


def speckle(d, surf, ua, va, ub, vb, n, rnd, col, rmin=0.0015, rmax=0.004):
    for _ in range(n):
        x, y = surf.px(rnd.uniform(ua, ub), rnd.uniform(va, vb)); r = surf.m(rnd.uniform(rmin, rmax))
        d.ellipse((x - r, y - r, x + r, y + r), fill=col)


# ============================================================================== walls
OLIVE = (110, 132, 62)        # upper wall: a tired, slightly sickly olive (saturated: the toon lift greys it a bit)
DADO = (50, 96, 84)           # lower wall: deep teal-green institutional paint
DADO_TOP = 0.9


def wall_base(surf, seed, dado=True, ox=0):
    rnd = random.Random(seed)
    up = tile_fill(surf, tinted(os.path.join(SRC, 'olive_wall.png'), int(surf.m(1.4)), OLIVE, sat=1.25, contrast=1.35), ox)
    if dado:
        lo = tile_fill(surf, tinted(os.path.join(SRC, 'olive_wall.png'), int(surf.m(1.1)), DADO, sat=0.9, contrast=1.2), ox + 333, 177)
        y = int(surf.px(0, DADO_TOP)[1])
        up.paste(lo.crop((0, y, surf.W, surf.H)), (0, y))
    # grime: darker towards the floor and under the ceiling, a dirt line along the dado top
    up = comp(up, vgrad(surf, 0.0, 0.35, (20, 26, 16), 95, 0))
    up = comp(up, vgrad(surf, surf.v1 - 0.25, surf.v1, (30, 28, 16), 0, 85))
    d = ImageDraw.Draw(up, "RGBA")
    if dado:
        y = surf.px(0, DADO_TOP + 0.03)[1]
        d.rectangle((0, y - surf.m(0.02), surf.W, y), fill=(34, 34, 20, 50))
    # fly specks + tiny nail holes + paint pimples everywhere
    speckle(d, surf, surf.u0, 1.0, surf.u1, surf.v1 - 0.1, int((surf.u1 - surf.u0) * 22), rnd, (40, 36, 24, 150), 0.0012, 0.0026)
    for _ in range(int((surf.u1 - surf.u0) * 3)):
        hole(d, surf, rnd.uniform(surf.u0 + 0.1, surf.u1 - 0.1), rnd.uniform(1.0, 2.3), r=0.0028)
    return up, rnd


def corner_shade(img, surf, pairs):
    """Darker into the room corners: pairs of (u at the corner, u where the shade has faded out)."""
    for uc, uf in pairs:
        img = comp(img, ugrad(surf, uc, uf, (18, 22, 12), 70, 0))
    return img


def chair_rubs(d, surf, us, rnd):
    for u0 in us:
        for _ in range(9):
            scuff(d, surf, u0 + rnd.uniform(-0.2, 0.15), rnd.uniform(0.55, 0.86), rnd.uniform(0.06, 0.16), rnd,
                  col=(26, 30, 24, rnd.randint(70, 130)), w=rnd.uniform(0.004, 0.01), ang=rnd.uniform(-0.15, 0.15))


def kicks(d, surf, ua, ub, n, rnd):
    for _ in range(n):
        scuff(d, surf, rnd.uniform(ua, ub), rnd.uniform(0.06, 0.32), rnd.uniform(0.03, 0.09), rnd,
              col=(22, 20, 18, rnd.randint(110, 180)), w=rnd.uniform(0.004, 0.008))


def make_walls():
    # ---------------- back wall: x -1.85..1.85 (left -> right seen from the room), z 0..2.7
    S = Surf(-1.85, 1.85, 0.0, 2.7, 900)
    img, rnd = wall_base(S, 11)
    img = corner_shade(img, S, ((S.u0, S.u0 + 0.14), (S.u1, S.u1 - 0.14)))
    d = ImageDraw.Draw(img, "RGBA")
    # air-con (x -1.72..-1.02, z 2.30..2.56): a grey dust fan above it, a water stain + drips under its right end
    d.polygon([S.px(-1.76, 2.56), S.px(-0.98, 2.56), S.px(-0.9, 2.7), S.px(-1.84, 2.7)], fill=(40, 40, 30, 30))
    stain(d, S, -1.12, 2.22, 0.12, 0.09, rnd, fill=(150, 120, 46, 80), rim=(110, 82, 30, 170), rings=2)
    for u, ln, w in ((-1.16, 0.62, 0.016), (-1.10, 0.86, 0.02), (-1.05, 0.45, 0.012), (-1.21, 0.33, 0.01)):
        drip(d, S, u, 2.24, ln, w, rnd)
    # old tape where earlier notices hung, left of today's "quiet" notice
    for u, v in ((-1.66, 1.82), (-1.36, 1.86), (-1.68, 1.42), (-1.62, 1.12)): tape_bit(d, S, u, v, rnd)
    # the patched hole behind the corner guy: mismatched fresh paint over cream filler, sanding rings, a crack through
    cx, cy = S.px(-1.42, 1.06)
    d.polygon(blob(cx, cy, S.m(0.15), S.m(0.12), rnd, 0.2), fill=(176, 182, 140, 255))
    d.rounded_rectangle(S.box(-1.53, 0.98, -1.31, 1.15), radius=S.m(0.02), fill=(126, 146, 80, 255), outline=(104, 120, 64, 255), width=3)
    for k in range(5):
        r = S.m(0.13 + 0.012 * k); d.arc((cx - r, cy - r * 0.8, cx + r, cy + r * 0.8), 200 + 30 * k, 320 + 25 * k, fill=(236, 230, 206, 55), width=2)
    crack(d, S, -1.49, 1.0, 0.2, 2.2, rnd)
    # ghost of a removed framed picture under the clock, its nail still in (3D nail in dress_room)
    rect_ghost(d, S, -0.86, 1.56, -0.54, 1.86, holes=(), tape=(), rnd=rnd)
    # the PA speaker above the shelf left a ghost of a bigger, older box
    rect_ghost(d, S, -0.36, 2.28, -0.08, 2.6, clean=(255, 250, 225, 30), holes=((-0.33, 2.31), (-0.11, 2.57)), rnd=rnd)
    # dust shadow line above where the shelf board sits (z 1.52) and under the binders
    d.rectangle(S.box(-0.5, 1.53, 0.04, 1.6), fill=(30, 30, 18, 40))
    # window surround (opening x 0.12..1.08, z 1.22..2.28; frame 0.1..1.1, 1.15..2.35; sill z 1.16..1.2)
    peel(d, S, 0.03, 2.42, 0.07, 0.05, rnd); peel(d, S, -0.02, 2.31, 0.03, 0.025, rnd); peel(d, S, 1.17, 1.32, 0.035, 0.05, rnd)
    crack(d, S, 1.12, 2.37, 0.34, -0.9, rnd); crack(d, S, 0.08, 1.13, 0.28, 2.3, rnd)
    # condensation run-off under the sill: tide lines
    for k in range(3):
        stain(d, S, 0.6 + rnd.uniform(-0.1, 0.1), 1.08 - 0.03 * k, 0.4 - 0.08 * k, 0.05, rnd, fill=(150, 130, 60, 60), rim=(110, 86, 34, 175), rings=0, rimw=0.005)
    for u, ln in ((0.16, 0.2), (0.27, 0.12), (0.93, 0.17), (1.04, 0.24)):     # runs from the sill's ends down to the rail
        drip(d, S, u, 1.15, ln, 0.012, rnd, col=(112, 90, 36, 140))
    # right of the window: a calendar ghost + its bent nail (rarely seen)
    rect_ghost(d, S, 1.36, 1.3, 1.66, 1.78, holes=((1.51, 1.76),), rnd=rnd)
    # chair backs have rubbed the dado, shoes kicked the bottom; a long crack over the corner guy
    chair_rubs(d, S, (-0.95, 0.75), rnd)
    kicks(d, S, -1.8, 1.8, 26, rnd)
    crack(d, S, -0.48, 2.66, 0.5, 1.9, rnd)
    crack(d, S, 1.7, 0.95, 0.3, -2.0, rnd)
    # hand smudges on the wall above the desks (people leaning back)
    for u in (-1.05, -0.85, 0.55, 0.95):
        x, y = S.px(u, 1.02 + rnd.uniform(-0.05, 0.05)); r = S.m(0.05)
        d.ellipse((x - r, y - r * 0.7, x + r, y + r * 0.7), fill=(30, 34, 20, 34))
    img.save(out('room_wall_back.png'), compress_level=1); print('back', img.size)

    # ---------------- left wall: y -2.5..2.5 (front -> back seen from the room), z 0..2.7; door y -0.87..0.27
    S = Surf(-2.5, 2.5, 0.0, 2.7, 800)
    img, rnd = wall_base(S, 23, ox=150)
    img = corner_shade(img, S, ((1.75, 1.6),))
    d = ImageDraw.Draw(img, "RGBA")
    # grime around the door: hand prints by the latch side, a dark halo round the light switch, kicks at the bottom
    for k in range(7):
        x, y = S.px(0.31 + rnd.uniform(-0.03, 0.06), rnd.uniform(0.95, 1.3)); r = S.m(rnd.uniform(0.018, 0.035))
        d.ellipse((x - r, y - r * 1.2, x + r, y + r * 1.2), fill=(28, 30, 18, 60))
    x, y = S.px(0.355, 1.15); d.ellipse((x - S.m(0.07), y - S.m(0.09), x + S.m(0.07), y + S.m(0.09)), fill=(26, 28, 18, 70))
    kicks(d, S, 0.3, 0.9, 14, rnd); kicks(d, S, -1.4, -0.9, 10, rnd); kicks(d, S, 0.9, 1.7, 8, rnd)
    for v in np.linspace(0.2, 2.0, 9):           # paint chips along both casing edges
        for u in (-0.875, 0.275):
            x, y = S.px(u + rnd.uniform(-0.004, 0.004), v + rnd.uniform(-0.05, 0.05)); r = S.m(rnd.uniform(0.006, 0.014))
            d.polygon(blob(x, y, r, r * 0.7, rnd, 0.4, 10), fill=(214, 206, 178, 255), outline=(60, 62, 36, 255))
    # a bigger, older calendar hung where today's calendar hangs: a pale ghost around it
    rect_ghost(d, S, 0.39, 1.22, 0.71, 1.88, holes=((0.55, 1.86),), rnd=rnd)
    # removed notice board on the hinge side (rarely seen): pin holes + tape
    rect_ghost(d, S, -1.85, 1.08, -1.05, 1.72, holes=[(-1.8 + 0.12 * i, 1.68 - 0.1 * (i % 3)) for i in range(7)],
               tape=((-1.86, 1.7), (-1.06, 1.1)), rnd=rnd)
    # mildew in the damp back corner, low behind the plant + boxes
    for _ in range(140):
        u, v = 1.75 - abs(rnd.gauss(0, 0.12)), abs(rnd.gauss(0, 0.28))
        x, y = S.px(u, v); r = S.m(rnd.uniform(0.003, 0.012))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(28, 46, 26, rnd.randint(60, 150)))
    stain(d, S, 1.62, 0.35, 0.14, 0.3, rnd, fill=(60, 72, 30, 50), rim=(44, 56, 22, 120), rings=1)
    # coat-hook rail (y 1.32..1.68, z 1.72): coats rubbed a grey smear below it
    d.rectangle(S.box(1.34, 1.25, 1.66, 1.66), fill=(34, 34, 24, 30))
    # above the door: soot over the exit sign, a crack from the casing corner
    d.rectangle(S.box(-0.52, 2.44, -0.08, 2.62), fill=(30, 30, 20, 45))
    crack(d, S, 0.28, 2.14, 0.3, -1.1, rnd); crack(d, S, -0.9, 2.14, 0.22, -2.0, rnd)
    chair_rubs(d, S, (-1.6,), rnd)
    img.save(out('room_wall_left.png'), compress_level=1); print('left', img.size)

    # ---------------- right wall: u = -y (back -> front seen from the room), z 0..2.7 (rarely seen: low res)
    S = Surf(-2.5, 2.5, 0.0, 2.7, 300)
    img, rnd = wall_base(S, 37, ox=60)
    img = corner_shade(img, S, ((-1.75, -1.6),))
    d = ImageDraw.Draw(img, "RGBA")
    rect_ghost(d, S, -0.75, 0.0, -0.2, 1.32, clean=(255, 250, 225, 34), rnd=rnd)       # a removed cabinet
    rect_ghost(d, S, 0.2, 1.3, 1.1, 1.9, holes=((0.25, 1.85), (1.05, 1.85)), rnd=rnd)  # a removed whiteboard
    kicks(d, S, -2.4, 2.4, 18, rnd); crack(d, S, 1.4, 2.6, 0.5, 1.7, rnd)
    img.save(out('room_wall_right.png'), compress_level=1); print('right', img.size)

    # ---------------- corridor wall (x = -3.5, seen from the room through the door): y -1.8..1.2, z 0..2.8
    S = Surf(-1.8, 1.2, 0.0, 2.8, 600)
    rnd = random.Random(51)
    img = tile_fill(S, tinted(os.path.join(SRC, 'plaster_wall.png'), int(S.m(1.2)), (232, 190, 96), sat=1.1, contrast=1.3))
    img = comp(img, vgrad(S, 0.0, 0.3, (40, 26, 10), 80, 0))
    d = ImageDraw.Draw(img, "RGBA")
    kicks(d, S, -1.7, 1.1, 22, rnd)
    for _ in range(10): scuff(d, S, rnd.uniform(-1.7, 1.1), rnd.uniform(0.35, 0.7), rnd.uniform(0.1, 0.3), rnd, col=(60, 40, 20, 90), w=0.006, ang=rnd.uniform(-0.08, 0.08))
    rect_ghost(d, S, 0.78, 1.5, 1.12, 1.95, clean=(255, 255, 235, 40), holes=((0.95, 1.93),), rnd=rnd)
    speckle(d, S, -1.8, 0.9, 1.2, 2.6, 60, rnd, (90, 70, 30, 140))
    img.save(out('room_cor_wall.png'), compress_level=1); print('corridor', img.size)


# ============================================================================== floor
def make_floor():
    S = Surf(-2.5, 2.5, -2.5, 2.5, 640)
    rnd = random.Random(7)
    T = 0.3                                    # P-tile vinyl, 30 cm (the source has 6 x 6 tiles)
    src = tinted(os.path.join(SRC, 'lino_floor.png'), int(round(S.m(6 * T))), (120, 112, 86), sat=1.5, contrast=1.05)
    x0, y0 = S.px(-1.85, 1.75)                 # whole tiles start in the back-left corner
    img = tile_fill(S, src, x0, y0)
    a = np.asarray(img).astype(np.float32)
    # per-tile variation, three newer replacement tiles (bluer, cleaner), sun-faded tiles under the window
    tp = S.m(T)
    repl = {(3, 2), (8, 5), (1, 9)}
    for j in range(-2, 20):
        for i in range(-3, 20):
            xa, ya = int(x0 + i * tp), int(y0 + j * tp)
            xb, yb = int(xa + tp), int(ya + tp)
            if xb <= 0 or yb <= 0 or xa >= S.W or ya >= S.H: continue
            xa, ya = max(0, xa), max(0, ya)
            f = np.array([rnd.uniform(0.95, 1.05)] * 3, np.float32)
            if (i, j) in repl: f = np.array([0.78, 0.98, 0.86], np.float32)
            u, v = -1.85 + (i + 0.5) * T, 1.75 - (j + 0.5) * T
            if 0.05 < u < 1.15 and v > 1.1: f = f * np.array([1.12, 1.1, 1.04], np.float32)
            a[ya:yb, xa:xb] *= f
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    lay = layer(S); d = ImageDraw.Draw(lay)
    # the traffic path: door -> middle -> both desk fronts, worn pale and scratched
    path = [(-2.3, -0.3), (-1.5, -0.32), (-0.8, -0.38), (-0.15, -0.3), (0.2, 0.15), (0.5, 0.35)]
    path2 = [(-0.8, -0.38), (-0.95, 0.2)]
    for pth, wd in ((path, 0.5), (path2, 0.42)):
        d.line([S.px(*p) for p in pth], fill=(214, 222, 190, 70), width=int(S.m(wd)), joint='curve')
    wear = lay.filter(ImageFilter.GaussianBlur(S.m(0.12)))
    img = comp(img, wear)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(90):
        p = rnd.choice(path); u, v = p[0] + rnd.gauss(0, 0.35), p[1] + rnd.gauss(0, 0.2)
        scuff(d, S, u, v, rnd.uniform(0.04, 0.16), rnd, col=(230, 236, 214, rnd.randint(60, 130)), w=0.0025)
    # black heel marks everywhere, more on the path
    for _ in range(70):
        if rnd.random() < 0.6:
            p = rnd.choice(path); u, v = p[0] + rnd.gauss(0, 0.3), p[1] + rnd.gauss(0, 0.25)
        else:
            u, v = rnd.uniform(-1.8, 1.8), rnd.uniform(-2.4, 1.7)
        scuff(d, S, u, v, rnd.uniform(0.02, 0.07), rnd, col=(24, 22, 20, rnd.randint(120, 200)), w=rnd.uniform(0.004, 0.009))
    # chair zones: caster arcs + a worn disc behind each desk
    for cx, cy in ((-0.95, 1.42), (0.75, 1.42)):
        x, y = S.px(cx, cy); r = S.m(0.34)
        d.ellipse((x - r, y - r * 0.8, x + r, y + r * 0.8), fill=(220, 226, 196, 18))
        for _ in range(7):
            rr = S.m(rnd.uniform(0.1, 0.32)); a0 = rnd.uniform(0, 360)
            d.arc((x - rr, y - rr, x + rr, y + rr), a0, a0 + rnd.uniform(30, 110), fill=(36, 40, 36, rnd.randint(50, 100)), width=max(2, int(S.m(0.004))))
    # the ghost of a removed meeting table: a cleaner rectangle, four dents, tape corners of an old floor mat
    bx = S.box(0.45, -1.5, 1.55, -0.85)
    d.rectangle(bx, fill=(160, 196, 160, 46))
    d.rectangle((bx[0] - 6, bx[1] - 6, bx[2] + 6, bx[3] + 6), outline=(40, 50, 40, 60), width=10)
    for u, v in ((0.52, -1.43), (1.48, -1.43), (0.52, -0.92), (1.48, -0.92)):
        x, y = S.px(u, v); r = S.m(0.022)
        d.rectangle((x - r, y - r, x + r, y + r), fill=(34, 40, 32, 160)); d.rectangle((x - r + 4, y - r + 4, x + r - 4, y - r + 10), fill=(220, 226, 200, 120))
    for u, v in ((-1.2, -1.9), (-0.3, -1.9), (-1.2, -1.2)): tape_bit(d, S, u, v, rnd, 0.07, 0.03)
    # spills: an old coffee stain by the corner desk, a dark ring where a bin stood, a rusty ring under the boxes
    stain(d, S, -0.42, 0.18, 0.09, 0.07, rnd, fill=(110, 70, 30, 90), rim=(80, 46, 20, 170), rings=1)
    x, y = S.px(1.2, -0.35); r = S.m(0.13); d.ellipse((x - r, y - r, x + r, y + r), outline=(40, 44, 36, 120), width=int(S.m(0.012)))
    stain(d, S, 0.05, -1.2, 0.16, 0.1, rnd, fill=(130, 110, 60, 50), rim=(90, 74, 36, 130), rings=1)
    # a chipped tile near the door (black adhesive shows), a cracked one under the window
    x, y = S.px(-1.55 + 0.02, -0.65 - 0.02)
    d.polygon([(x, y), (x + S.m(0.09), y), (x + S.m(0.03), y + S.m(0.05))], fill=(30, 30, 26, 230))
    crack(d, S, 0.35, 1.5, 0.2, 0.3, rnd, col=(30, 34, 28, 200))
    # dust + grime along the walls and in the corners (lighter fluff, darker edge)
    for (ua, va, ub, vb) in ((-1.86, -2.5, -1.78, 1.76), (1.78, -2.5, 1.86, 1.76), (-1.86, 1.68, 1.86, 1.76)):
        d.rectangle(S.box(ua, va, ub, vb), fill=(40, 44, 34, 110))
    for cx, cy in ((-1.8, 1.7), (1.8, 1.7), (-1.8, 0.0), (1.8, -1.0), (0.1, 1.68)):
        for _ in range(4):
            x, y = S.px(cx + rnd.uniform(-0.06, 0.06), cy + rnd.uniform(-0.06, 0.04)); r = S.m(rnd.uniform(0.015, 0.035))
            d.polygon(blob(x, y, r, r * 0.8, rnd, 0.4, 12), fill=(196, 196, 184, 170), outline=(140, 140, 130, 200))
    img.save(out('room_floor.png'), compress_level=1); print('floor', img.size)


# ============================================================================== ceiling
def make_ceiling():
    S = Surf(-2.5, 2.5, -2.5, 1.85, 400)
    rnd = random.Random(5)
    src = Image.open(os.path.join(SRC, 'ceiling_tiles.png')).convert('RGB')
    clean = src.copy(); clean.paste(src.crop((512, 256, 768, 512)), (256, 256))     # the stained cell -> a clean one
    t = tinted_img(clean, int(S.m(2.4)), (222, 218, 200))
    # grid lines at x = 0.6 k, y = 0.1 + 0.6 k (the light panel at (0, 0.4) fills two tiles); source lines ~ at 256 k
    gx, gy = S.px(-2.4, 1.3)
    img = tile_fill(S, t, gx, gy)
    img = comp(img, vgrad(S, S.v1 - 0.5, S.v1, (40, 36, 20), 0, 60))          # dirt over the back wall
    d = ImageDraw.Draw(img, "RGBA")
    # one water-stained tile over the corner desk (x -1.2..-0.6, y 0.7..1.3) and a smaller one by the air-con
    stain(d, S, -0.92, 1.0, 0.24, 0.21, rnd, fill=(170, 140, 70, 110), rim=(130, 96, 40, 200), rings=3, rimw=0.007)
    stain(d, S, -1.55, 1.58, 0.13, 0.1, rnd, fill=(170, 140, 70, 80), rim=(130, 96, 40, 160), rings=1)
    # a displaced tile (x 1.2..1.8, y -0.5..0.1): pushed up, dark gaps along two edges, its edge lighter
    d.rectangle(S.box(1.2, -0.5, 1.8, -0.455), fill=(24, 22, 20, 255)); d.rectangle(S.box(1.755, -0.5, 1.8, 0.1), fill=(24, 22, 20, 255))
    d.rectangle(S.box(1.2, -0.455, 1.755, -0.44), fill=(250, 246, 230, 200))
    # soot round the light panel (x -0.6..0.6, y 0.1..0.7) and the air diffuser (x -1.2..-0.6, y 0.1..0.7)
    for (ua, va, ub, vb) in ((-0.64, 0.06, 0.64, 0.74), (-1.24, 0.06, -0.56, 0.74)):
        d.rectangle(S.box(ua, va, ub, vb), outline=(50, 46, 34, 70), width=int(S.m(0.05)))
    speckle(d, S, -2.4, -2.4, 2.4, 1.8, 120, rnd, (60, 56, 40, 120), 0.002, 0.004)
    img.save(out('room_ceiling.png'), compress_level=1); print('ceiling', img.size)


def tinted_img(im, px, target):
    im = im.resize((px, px), Image.LANCZOS); a = np.asarray(im).astype(np.float32)
    a = a * (np.array(target, np.float32) / a.reshape(-1, 3).mean(0))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ============================================================================== prints (signs, labels, papers)
def centered(d, box, txt, f, fill):
    bb = d.textbbox((0, 0), txt, font=f)
    x = (box[0] + box[2] - (bb[2] - bb[0])) / 2 - bb[0]; y = (box[1] + box[3] - (bb[3] - bb[1])) / 2 - bb[1]
    d.text((x, y), txt, font=f, fill=fill)


def paper(w, h, col=(238, 232, 214), age=0.0, seed=1):
    rnd = random.Random(seed)
    im = Image.new('RGB', (w, h), col); d = ImageDraw.Draw(im, 'RGBA')
    for _ in range(int(age * 30)):
        x, y = rnd.uniform(0, w), rnd.uniform(0, h); r = rnd.uniform(w * 0.05, w * 0.2)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(170, 140, 70, int(18 * age)))
    d.rectangle((0, 0, w - 1, h - 1), outline=(200, 190, 160), width=max(2, w // 120))
    return im, d


def make_prints():
    S = 2
    # quiet-please notice (A4 portrait): 私語厳禁 big, a line under it, a faded red stamp
    im, d = paper(420 * S, 594 * S, (236, 230, 208), age=0.8, seed=3)
    d.rectangle((26 * S, 26 * S, 394 * S, 568 * S), outline=(150, 40, 36), width=10 * S)
    for i, ch in enumerate('私語厳禁'):
        centered(d, (40 * S, (56 + i * 118) * S, 380 * S, (170 + i * 118) * S), ch, font(JP, 104 * S), (34, 30, 28))
    centered(d, (40 * S, 520 * S, 380 * S, 556 * S), '総務部', font(JPR, 26 * S), (80, 70, 60))
    d.ellipse((300 * S, 500 * S, 370 * S, 570 * S), outline=(196, 70, 60, 200), width=5 * S)
    centered(d, (300 * S, 500 * S, 370 * S, 570 * S), '済', font(JP, 40 * S), (196, 70, 60, 200))
    im.resize((420, 594), Image.LANCZOS).save(out('room_notice_quiet.png'))

    # evacuation route map (portrait 3:4): title band, a simple floor plan, green arrows, red you-are-here dot
    W, H = 480 * S, 640 * S
    im = Image.new('RGB', (W, H), (240, 236, 222)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 92 * S), fill=(40, 120, 76)); centered(d, (0, 0, W, 92 * S), '避難経路図', font(JP, 58 * S), (245, 242, 230))
    ox, oy = 50 * S, 130 * S
    d.rectangle((ox, oy, W - ox, H - 130 * S), outline=(60, 60, 60), width=8 * S)
    for k in range(1, 4):                                         # rooms along a corridor
        x = ox + k * (W - 2 * ox) / 4; d.line((x, oy, x, oy + 170 * S), fill=(60, 60, 60), width=5 * S)
        d.line((x, H - 130 * S - 150 * S, x, H - 130 * S), fill=(60, 60, 60), width=5 * S)
    d.line((ox, oy + 170 * S, W - ox, oy + 170 * S), fill=(60, 60, 60), width=5 * S)
    d.line((ox, H - 280 * S, W - ox, H - 280 * S), fill=(60, 60, 60), width=5 * S)
    d.rectangle((ox + 6 * S, H - 274 * S, ox + 104 * S, H - 136 * S), fill=(250, 214, 200))     # this room, tinted
    G = (40, 160, 80)
    ys = oy + 240 * S
    d.line((ox + 60 * S, H - 300 * S, ox + 60 * S, ys, W - ox - 40 * S, ys), fill=G, width=16 * S, joint='curve')
    d.polygon([(W - ox - 10 * S, ys), (W - ox - 60 * S, ys - 34 * S), (W - ox - 60 * S, ys + 34 * S)], fill=G)
    d.rectangle((W - ox - 8 * S, ys - 50 * S, W - ox + 8 * S, ys + 50 * S), fill=G)
    d.ellipse((ox + 34 * S, H - 236 * S, ox + 86 * S, H - 184 * S), fill=(210, 40, 36))
    centered(d, (ox, H - 120 * S, W - ox, H - 70 * S), '● 現在地   ▶ 避難方向', font(JP, 30 * S), (60, 56, 50))
    centered(d, (ox, H - 62 * S, W - ox, H - 20 * S), '4F 第二別室', font(JPR, 26 * S), (90, 84, 76))
    im.resize((480, 640), Image.LANCZOS).save(out('room_evac_map.png'))

    # exit light panel 3:1: green field, a white door frame, a white running figure, 非常口 (our own drawing)
    W, H = 600 * S, 200 * S
    im = Image.new('RGB', (W, H), (34, 176, 92)); d = ImageDraw.Draw(im)
    d.rectangle((30 * S, 26 * S, 170 * S, 176 * S), outline=(244, 252, 240), width=12 * S)
    d.rectangle((48 * S, 44 * S, 152 * S, 158 * S), fill=(250, 255, 246))
    Gd = (34, 176, 92)
    d.ellipse((96 * S, 54 * S, 124 * S, 82 * S), fill=Gd)                      # head
    d.line([(108 * S, 86 * S), (98 * S, 120 * S)], fill=Gd, width=16 * S)       # body
    d.line([(98 * S, 120 * S), (120 * S, 136 * S), (112 * S, 156 * S)], fill=Gd, width=12 * S, joint='curve')
    d.line([(98 * S, 120 * S), (80 * S, 140 * S), (62 * S, 140 * S)], fill=Gd, width=12 * S, joint='curve')
    d.line([(106 * S, 92 * S), (130 * S, 104 * S)], fill=Gd, width=11 * S); d.line([(104 * S, 94 * S), (80 * S, 104 * S)], fill=Gd, width=11 * S)
    centered(d, (190 * S, 20 * S, 580 * S, 180 * S), '非常口', font(JP, 120 * S), (250, 255, 246))
    im.resize((600, 200), Image.LANCZOS).save(out('room_exit_panel.png'))

    # air-con: maker plate and a taped energy-saving note (冷房 28℃)
    im = Image.new('RGBA', (360 * S, 90 * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    centered(d, (0, 0, 360 * S, 90 * S), 'KAZEMARU', font(BLK, 56 * S), (120, 126, 132, 255))
    im.resize((360, 90), Image.LANCZOS).save(out('room_aircon_plate.png'))
    im, d = paper(300 * S, 200 * S, (240, 226, 120), age=0.4, seed=8)
    centered(d, (0, 14 * S, 300 * S, 110 * S), '冷房 28℃', font(JP, 64 * S), (40, 36, 30))
    centered(d, (0, 110 * S, 300 * S, 180 * S), '節電中', font(JP, 48 * S), (180, 50, 40))
    im.resize((300, 200), Image.LANCZOS).save(out('room_aircon_note.png'))

    # archive-box label (3:2): printed form 文書保存箱 with fields filled by hand
    W, H = 480 * S, 320 * S
    for k, (yr, dept, box) in enumerate((('平成11年度', '営業二課', 'No.14'), ('平成12年度', '営業二課', 'No.15'), ('平成9年度', '総務', 'No.3'))):
        im, d = paper(W, H, (238, 232, 212), age=0.9, seed=20 + k)
        d.rectangle((14 * S, 14 * S, W - 14 * S, H - 14 * S), outline=(60, 80, 130), width=5 * S)
        d.rectangle((14 * S, 14 * S, W - 14 * S, 80 * S), fill=(60, 80, 130))
        centered(d, (14 * S, 14 * S, W - 14 * S, 80 * S), '文書保存箱', font(JP, 46 * S), (240, 238, 228))
        for i, (lab, val) in enumerate((('年度', yr), ('部署', dept), ('番号', box))):
            y = (96 + i * 70) * S
            d.line((24 * S, y + 60 * S, W - 24 * S, y + 60 * S), fill=(60, 80, 130), width=3 * S)
            d.text((28 * S, y + 6 * S), lab, font=font(JPR, 34 * S), fill=(60, 80, 130))
            d.text((140 * S, y), val, font=font(JP, 46 * S), fill=(36, 34, 40))
        im.resize((W // S, H // S), Image.LANCZOS).save(out(f'room_box_label{k}.png'))

    # binder spine labels (tall 1:4): year + section, written in marker on a yellowed card
    for k, (t1, t2) in enumerate((('H12', '庶務'), ('H13', '議事録'), ('H10', '雑件'))):
        im, d = paper(100 * S, 400 * S, (236, 228, 200), age=0.7, seed=40 + k)
        centered(d, (0, 20 * S, 100 * S, 110 * S), t1, font(BLK, 44 * S), (40, 36, 32))
        for i, ch in enumerate(t2):
            centered(d, (0, (130 + i * 80) * S, 100 * S, (200 + i * 80) * S), ch, font(JP, 64 * S), (40, 36, 32))
        im.resize((100, 400), Image.LANCZOS).save(out(f'room_binder_label{k}.png'))

    # cork-board papers in the corridor: a schedule grid, a memo, a pink event flyer, a safety poster, a staff list
    im, d = paper(400 * S, 300 * S, (242, 240, 230), seed=60)
    centered(d, (0, 8 * S, 400 * S, 60 * S), '会議室予約表', font(JP, 36 * S), (40, 40, 40))
    for i in range(6): d.line((20 * S, (70 + i * 38) * S, 380 * S, (70 + i * 38) * S), fill=(120, 120, 120), width=2 * S)
    for j in range(5): d.line(((20 + j * 90) * S, 70 * S, (20 + j * 90) * S, 260 * S), fill=(120, 120, 120), width=2 * S)
    rnd = random.Random(61)
    for _ in range(8):
        i, j = rnd.randint(0, 4), rnd.randint(0, 3); d.rectangle(((24 + j * 90) * S, (74 + i * 38) * S, (106 + j * 90) * S, (104 + i * 38) * S), fill=rnd.choice([(120, 170, 220), (240, 170, 90), (150, 200, 140)]))
    im.resize((400, 300), Image.LANCZOS).save(out('room_board_0.png'))
    im, d = paper(300 * S, 400 * S, (250, 210, 220), seed=62)
    centered(d, (0, 20 * S, 300 * S, 120 * S), '忘年会', font(JP, 72 * S), (190, 40, 80))
    centered(d, (0, 130 * S, 300 * S, 180 * S), '12/20 (金) 19:00', font(JP, 30 * S), (90, 40, 60))
    d.ellipse((90 * S, 200 * S, 210 * S, 320 * S), fill=(250, 240, 120)); d.arc((115 * S, 230 * S, 185 * S, 300 * S), 20, 160, fill=(90, 40, 60), width=8 * S)
    d.ellipse((122 * S, 236 * S, 138 * S, 252 * S), fill=(90, 40, 60)); d.ellipse((162 * S, 236 * S, 178 * S, 252 * S), fill=(90, 40, 60))
    centered(d, (0, 336 * S, 300 * S, 380 * S), '全員参加!', font(JP, 34 * S), (190, 40, 80))
    im.resize((300, 400), Image.LANCZOS).save(out('room_board_1.png'))
    im, d = paper(300 * S, 400 * S, (250, 236, 120), seed=63)
    d.rectangle((0, 0, 300 * S, 90 * S), fill=(220, 60, 40)); centered(d, (0, 0, 300 * S, 90 * S), '安全第一', font(JP, 60 * S), (255, 250, 230))
    d.polygon([(150 * S, 120 * S), (260 * S, 310 * S), (40 * S, 310 * S)], fill=(40, 36, 30)); d.polygon([(150 * S, 150 * S), (236 * S, 296 * S), (64 * S, 296 * S)], fill=(250, 236, 120))
    d.rectangle((142 * S, 180 * S, 158 * S, 250 * S), fill=(40, 36, 30)); d.ellipse((140 * S, 262 * S, 160 * S, 282 * S), fill=(40, 36, 30))
    centered(d, (0, 326 * S, 300 * S, 380 * S), '指差し確認', font(JP, 40 * S), (40, 36, 30))
    im.resize((300, 400), Image.LANCZOS).save(out('room_board_2.png'))
    im, d = paper(300 * S, 300 * S, (236, 240, 248), seed=64)
    centered(d, (0, 10 * S, 300 * S, 60 * S), 'お知らせ', font(JP, 40 * S), (40, 60, 120))
    for i in range(7): d.line((24 * S, (80 + i * 30) * S, rnd.randint(180, 276) * S, (80 + i * 30) * S), fill=(110, 110, 120), width=8 * S)
    im.resize((300, 300), Image.LANCZOS).save(out('room_board_3.png'))
    # corridor direction plate: 給湯室 →
    im = Image.new('RGB', (600 * S, 160 * S), (54, 70, 96)); d = ImageDraw.Draw(im)
    centered(d, (0, 0, 440 * S, 160 * S), '給湯室', font(JP, 90 * S), (244, 242, 232))
    d.polygon([(460 * S, 50 * S), (540 * S, 80 * S), (460 * S, 110 * S)], fill=(244, 242, 232)); d.rectangle((420 * S, 70 * S, 470 * S, 90 * S), fill=(244, 242, 232))
    im.resize((600, 160), Image.LANCZOS).save(out('room_cor_sign.png'))
    # fire-alarm box face: 発信機 + a push circle; extinguisher label 消火器
    im = Image.new('RGB', (300 * S, 300 * S), (206, 40, 36)); d = ImageDraw.Draw(im)
    d.ellipse((80 * S, 70 * S, 220 * S, 210 * S), fill=(236, 230, 220)); d.ellipse((110 * S, 100 * S, 190 * S, 180 * S), fill=(180, 30, 30))
    centered(d, (0, 220 * S, 300 * S, 290 * S), '強く押す', font(JP, 44 * S), (250, 246, 236)); centered(d, (0, 4 * S, 300 * S, 66 * S), '発信機', font(JP, 46 * S), (250, 246, 236))
    im.resize((300, 300), Image.LANCZOS).save(out('room_alarm_face.png'))
    im = Image.new('RGB', (200 * S, 300 * S), (240, 236, 222)); d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 200 * S, 70 * S), fill=(200, 40, 36)); centered(d, (0, 0, 200 * S, 70 * S), '消火器', font(JP, 50 * S), (255, 250, 240))
    for i, c in enumerate(((236, 236, 236), (250, 210, 40), (60, 120, 200))):
        d.rectangle(((22 + i * 56) * S, 100 * S, (66 + i * 56) * S, 150 * S), fill=c, outline=(40, 40, 40), width=3 * S)
    centered(d, (0, 170 * S, 200 * S, 220 * S), 'ABC粉末', font(JP, 34 * S), (40, 36, 30))
    for i in range(3): d.line((24 * S, (240 + i * 20) * S, 176 * S, (240 + i * 20) * S), fill=(130, 126, 116), width=6 * S)
    im.resize((200, 300), Image.LANCZOS).save(out('room_ext_label.png'))
    # door notice (A5 landscape): 退室時は 消灯・施錠 (lights off + lock when leaving), a pictogram bulb, a red line
    im, d = paper(420 * S, 297 * S, (240, 236, 220), age=0.6, seed=80)
    d.rectangle((0, 0, 420 * S, 70 * S), fill=(200, 50, 44)); centered(d, (0, 0, 420 * S, 70 * S), '退室時は', font(JP, 46 * S), (255, 250, 240))
    centered(d, (110 * S, 90 * S, 410 * S, 190 * S), '消灯', font(JP, 92 * S), (36, 32, 30))
    centered(d, (110 * S, 190 * S, 410 * S, 280 * S), '施錠', font(JP, 84 * S), (36, 32, 30))
    d.ellipse((24 * S, 100 * S, 104 * S, 180 * S), outline=(36, 32, 30), width=8 * S); d.rectangle((48 * S, 180 * S, 80 * S, 214 * S), fill=(36, 32, 30))
    for a in range(0, 360, 45):
        r0, r1 = 50 * S, 64 * S; cx, cy = 64 * S, 140 * S
        d.line((cx + r0 * math.cos(math.radians(a)), cy + r0 * math.sin(math.radians(a)), cx + r1 * math.cos(math.radians(a)), cy + r1 * math.sin(math.radians(a))), fill=(200, 50, 44), width=6 * S)
    im.resize((420, 297), Image.LANCZOS).save(out('room_notice_door.png'))
    # room plate for the top of the door (4:1): 第二別室 (Annex room 2) on a dark plate
    im = Image.new('RGB', (480 * S, 120 * S), (52, 58, 66)); d = ImageDraw.Draw(im)
    d.rectangle((6 * S, 6 * S, 474 * S, 114 * S), outline=(150, 156, 160), width=4 * S)
    centered(d, (0, 0, 480 * S, 120 * S), '第二別室', font(JP, 80 * S), (236, 234, 226))
    im.resize((480, 120), Image.LANCZOS).save(out('room_door_plate.png'))
    # thermo-hygrometer dials (2:1): temperature (red needle) + humidity (blue needle), cream faces, ticks
    im = Image.new('RGBA', (400 * S, 200 * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for k, (lab, ang, col) in enumerate((('℃', 205, (200, 50, 44)), ('%', 300, (50, 100, 190)))):
        cx, cy, r = (100 + 200 * k) * S, 100 * S, 90 * S
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(242, 236, 220), outline=(60, 56, 50), width=6 * S)
        for t in range(0, 271, 27):
            a = math.radians(135 + t); r0 = r * (0.72 if t % 54 == 0 else 0.8)
            d.line((cx + r0 * math.cos(a), cy + r0 * math.sin(a), cx + r * 0.9 * math.cos(a), cy + r * 0.9 * math.sin(a)), fill=(60, 56, 50), width=4 * S)
        a = math.radians(ang); d.line((cx, cy, cx + r * 0.7 * math.cos(a), cy + r * 0.7 * math.sin(a)), fill=col, width=7 * S)
        d.ellipse((cx - 9 * S, cy - 9 * S, cx + 9 * S, cy + 9 * S), fill=(60, 56, 50))
        centered(d, (cx - 40 * S, cy + 26 * S, cx + 40 * S, cy + 70 * S), lab, font(JP, 36 * S), col)
    im.resize((400, 200), Image.LANCZOS).save(out('room_thermo_face.png'))
    # cobweb (alpha): radial threads + sagging spiral, for the top corner
    W = 600 * S
    im = Image.new('RGBA', (W, W), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    rnd = random.Random(70); C = (232, 230, 220, 255)
    angs = [math.radians(a) for a in (2, 14, 27, 41, 55, 68, 80, 88)]
    rays = [(math.cos(a), math.sin(a)) for a in angs]
    for cx, cy in rays: d.line((0, 0, cx * W * 0.98, cy * W * 0.98), fill=C, width=3 * S)
    for k in range(1, 9):
        r = W * 0.11 * k * rnd.uniform(0.95, 1.05); pts = []
        for i in range(len(rays) - 1):
            (ax, ay), (bx, by) = rays[i], rays[i + 1]
            for t in np.linspace(0, 1, 6):
                sag = 1 - 0.12 * math.sin(math.pi * t)
                x = (ax * (1 - t) + bx * t) * r * sag; y = (ay * (1 - t) + by * t) * r * sag; pts.append((x, y))
        d.line(pts, fill=C, width=2 * S)
    im.resize((600, 600), Image.LANCZOS).save(out('room_cobweb.png'))
    print('prints ok')


if 'walls' in WHAT: make_walls()
if 'floor' in WHAT: make_floor()
if 'ceil' in WHAT: make_ceiling()
if 'prints' in WHAT: make_prints()
