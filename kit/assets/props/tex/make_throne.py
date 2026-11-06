# Throne graphics (lab venv): .venv/Scripts/python.exe assets/props/tex/make_throne.py
#   throne_dragon.png  - the carved back panel: one gold S-curled dragon chasing a flaming pearl through ruyi clouds,
#                        gold on lacquer red, a gold fret border (bold flat cartoon shapes, readable small)
#   throne_crest.png   - the crest board above the panel: a gold sun disc between two cloud scrolls
import math, os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
RED, RED2, RED3 = (150, 30, 28), (178, 48, 38), (120, 22, 22)
GOLD, GOLD_D, GOLD_L = (232, 176, 58), (128, 78, 18), (250, 220, 128)
INK = (58, 20, 14)
CREAM = (242, 236, 222)
SS = 2   # supersample


def bez(p0, p1, p2, p3, n=200):
    out = []
    for i in range(n + 1):
        t = i / n; a = (1 - t) ** 3; b = 3 * t * (1 - t) ** 2; c = 3 * t * t * (1 - t); d = t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out


def stroke(d, pts, widths, fill):
    for (x, y), w in zip(pts, widths):
        d.ellipse([x - w, y - w, x + w, y + w], fill=fill)


def cloud(d, cx, cy, s, flip=1):
    """Ruyi cloud: three lobes on a flat base with a curl in each lobe, gold outline on lighter red."""
    lobes = [(-0.55, 0.05, 0.42), (0.0, -0.22, 0.55), (0.55, 0.02, 0.4)]
    for k, fill in ((1.0 + 0.11, GOLD_D), (1.0 + 0.06, GOLD), (1.0, RED2)):
        for lx, ly, lr in lobes:
            r = lr * s * k
            d.ellipse([cx + flip * lx * s - r, cy + ly * s - r, cx + flip * lx * s + r, cy + ly * s + r], fill=fill)
        d.rounded_rectangle([cx - 0.95 * s * k, cy + 0.0 * s, cx + 0.95 * s * k, cy + 0.38 * s * k], radius=0.19 * s, fill=fill)
    # curls
    for lx, ly, lr in lobes:
        x, y = cx + flip * lx * s, cy + ly * s
        pts = []
        for i in range(60):
            a = i / 60 * 1.6 * math.pi; r = lr * s * 0.62 * (1 - i / 75)
            pts.append((x + flip * r * math.cos(a + 1.2), y - r * math.sin(a + 1.2)))
        d.line(pts, fill=GOLD, width=int(0.07 * s), joint='curve')
    d.line([(cx - 0.8 * s, cy + 0.2 * s), (cx + 0.8 * s, cy + 0.2 * s)], fill=GOLD, width=int(0.06 * s))


def dragon_panel(path=os.path.join(HERE, 'throne_dragon.png')):
    W, H = 1024 * SS, 896 * SS
    im = Image.new('RGB', (W, H), RED); d = ImageDraw.Draw(im)
    S = SS
    # border: gold frame + inner fret line + corner key frets
    d.rectangle([0, 0, W, H], fill=GOLD_D)
    d.rectangle([14 * S, 14 * S, W - 14 * S, H - 14 * S], fill=GOLD)
    d.rectangle([34 * S, 34 * S, W - 34 * S, H - 34 * S], fill=RED3)
    d.rectangle([44 * S, 44 * S, W - 44 * S, H - 44 * S], fill=RED)
    for cx, cy, sx, sy in ((70, 70, 1, 1), (W / S - 70, 70, -1, 1), (70, H / S - 70, 1, -1), (W / S - 70, H / S - 70, -1, -1)):
        p = [(0, 0), (60, 0), (60, 36), (24, 36), (24, 60), (0, 60), (0, 0)]
        d.line([((cx + sx * x) * S, (cy + sy * y) * S) for x, y in p], fill=GOLD, width=9 * S, joint='curve')
        q = [(12, 12), (44, 12), (44, 22)]
        d.line([((cx + sx * x) * S, (cy + sy * y) * S) for x, y in q], fill=GOLD, width=6 * S)
    # clouds (behind the dragon)
    for cx, cy, s, f in ((205, 230, 92, 1), (820, 700, 95, -1), (300, 735, 70, -1), (835, 215, 62, 1)):
        cloud(d, cx * S, cy * S, s * S, f)
    # the pearl with flames (upper centre-left), the dragon's head faces it
    px, py, pr = 470 * S, 205 * S, 50 * S
    for i in range(9):
        a = i / 9 * 2 * math.pi + 0.3
        tip = (px + math.cos(a) * pr * 2.0, py + math.sin(a) * pr * 2.0)
        l = (px + math.cos(a - 0.38) * pr * 0.95, py + math.sin(a - 0.38) * pr * 0.95)
        r = (px + math.cos(a + 0.38) * pr * 0.95, py + math.sin(a + 0.38) * pr * 0.95)
        d.polygon([l, tip, r], fill=GOLD)
    d.ellipse([px - pr - 6 * S, py - pr - 6 * S, px + pr + 6 * S, py + pr + 6 * S], fill=GOLD_D)
    d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=CREAM)
    d.ellipse([px - pr * 0.55, py - pr * 0.65, px - pr * 0.05, py - pr * 0.2], fill=(255, 255, 250))
    # dragon body: head upper right, S-curve down to a tail at the lower left
    segs = [((720, 250), (900, 330), (880, 560), (690, 560)),
            ((690, 560), (520, 560), (520, 330), (380, 380)),
            ((380, 380), (230, 430), (200, 600), (120, 640))]
    pts = []
    for sg in segs:
        pts += bez(*[(x * S, y * S) for x, y in sg], n=260)[:-1]
    n = len(pts)
    wid = [S * (44 - 30 * max(0.0, (i / n - 0.35) / 0.65) ** 1.2) for i in range(n)]
    # dorsal spikes (on the outer side of the curve, drawn first so the body overlaps their bases)
    for i in range(30, n - 40, 34):
        (x0, y0), (x1, y1) = pts[i - 3], pts[i + 3]
        tx, ty = x1 - x0, y1 - y0; L = math.hypot(tx, ty) or 1; nx, ny = -ty / L, tx / L
        w = wid[i]
        base_a = (pts[i][0] + nx * w * 0.6 - tx / L * w * 0.5, pts[i][1] + ny * w * 0.6 - ty / L * w * 0.5)
        base_b = (pts[i][0] + nx * w * 0.6 + tx / L * w * 0.5, pts[i][1] + ny * w * 0.6 + ty / L * w * 0.5)
        tip = (pts[i][0] + nx * w * 1.75 + tx / L * w * 0.4, pts[i][1] + ny * w * 1.75 + ty / L * w * 0.4)
        d.polygon([base_a, tip, base_b], fill=GOLD_D)
        k = 0.25   # inner lighter spike, shrunk toward its own centroid
        cxs, cys = (base_a[0] + tip[0] + base_b[0]) / 3, (base_a[1] + tip[1] + base_b[1]) / 3
        d.polygon([(p[0] + (cxs - p[0]) * k, p[1] + (cys - p[1]) * k) for p in (base_a, tip, base_b)], fill=GOLD)
    # legs with three claws (four of them, at fixed body positions)
    for k, side in ((0.12, 1), (0.30, -1), (0.55, 1), (0.74, -1)):
        i = int(k * n); (x0, y0), (x1, y1) = pts[i - 3], pts[i + 3]
        tx, ty = x1 - x0, y1 - y0; L = math.hypot(tx, ty) or 1; nx, ny = ty / L * side, -tx / L * side
        w = wid[i]
        kx, ky = pts[i][0] + nx * w * 1.6 - tx / L * w * 0.6, pts[i][1] + ny * w * 1.6 - ty / L * w * 0.6
        fx, fy = kx + nx * w * 0.6 - tx / L * w * 0.9, ky + ny * w * 0.6 - ty / L * w * 0.9
        d.line([pts[i], (kx, ky), (fx, fy)], fill=GOLD_D, width=int(w * 0.62), joint='curve')
        d.line([pts[i], (kx, ky), (fx, fy)], fill=GOLD, width=int(w * 0.42), joint='curve')
        for c in (-0.6, 0.0, 0.6):
            ex = fx + (nx * math.cos(c) - tx / L * math.sin(c)) * w * 0.55 - tx / L * w * 0.25
            ey = fy + (ny * math.cos(c) - ty / L * math.sin(c)) * w * 0.55 - ty / L * w * 0.25
            d.line([(fx, fy), (ex, ey)], fill=GOLD_D, width=int(w * 0.2))
    stroke(d, pts, [w + 7 * S for w in wid], GOLD_D)
    stroke(d, pts, wid, GOLD)
    # belly: a lighter stripe along the inner side with chevron scale marks
    bel = []
    for i in range(0, n - 30):
        (x0, y0), (x1, y1) = pts[max(0, i - 2)], pts[min(n - 1, i + 2)]
        tx, ty = x1 - x0, y1 - y0; L = math.hypot(tx, ty) or 1; nx, ny = ty / L, -tx / L
        bel.append((pts[i][0] + nx * wid[i] * 0.42, pts[i][1] + ny * wid[i] * 0.42))
    stroke(d, bel, [w * 0.42 for w in wid[:len(bel)]], GOLD_L)
    for i in range(14, len(bel) - 10, 22):
        (x0, y0), (x1, y1) = pts[i - 2], pts[i + 2]
        tx, ty = x1 - x0, y1 - y0; L = math.hypot(tx, ty) or 1
        w = wid[i] * 0.5
        a = (bel[i][0] - tx / L * w * 0.4 + ty / L * w * 0.6, bel[i][1] - ty / L * w * 0.4 - tx / L * w * 0.6)
        b = (bel[i][0] + tx / L * w * 0.3, bel[i][1] + ty / L * w * 0.3)
        c = (bel[i][0] - tx / L * w * 0.4 - ty / L * w * 0.6, bel[i][1] - ty / L * w * 0.4 + tx / L * w * 0.6)
        d.line([a, b, c], fill=GOLD_D, width=4 * S, joint='curve')
    # back scales: small arcs along the top of the body
    for i in range(20, n - 60, 16):
        (x0, y0), (x1, y1) = pts[i - 2], pts[i + 2]
        tx, ty = x1 - x0, y1 - y0; L = math.hypot(tx, ty) or 1; nx, ny = -ty / L, tx / L
        w = wid[i]; cx, cy = pts[i][0] + nx * w * 0.28, pts[i][1] + ny * w * 0.28
        r = w * 0.34
        ang = math.degrees(math.atan2(ny, nx))
        d.arc([cx - r, cy - r, cx + r, cy + r], ang - 70, ang + 70, fill=GOLD_D, width=4 * S)
    # tail fin tuft
    tx_, ty_ = pts[-1]
    for a, l in ((200, 70), (235, 82), (265, 64)):
        ex, ey = tx_ + math.cos(math.radians(a)) * l * S, ty_ - math.sin(math.radians(a)) * l * S
        d.polygon([(tx_, ty_ - 9 * S), (ex, ey), (tx_ + 4 * S, ty_ + 9 * S)], fill=GOLD_D)
        d.polygon([(tx_, ty_ - 5 * S), (ex * 0.92 + tx_ * 0.08, ey * 0.92 + ty_ * 0.08), (tx_ + 2 * S, ty_ + 5 * S)], fill=GOLD)
    # head (at pts[0], looking left / up toward the pearl)
    hx, hy = pts[0][0] - 20 * S, pts[0][1] - 18 * S
    # mane flames behind the head
    for a in (60, 95, 130, 165):
        ex, ey = hx + math.cos(math.radians(a)) * 95 * S + 40 * S, hy - math.sin(math.radians(a)) * 85 * S
        d.polygon([(hx + 10 * S, hy - 20 * S), (ex, ey), (hx + 50 * S, hy + 10 * S)], fill=GOLD_D)
    # horns (two antlers)
    for ox, a in ((10, 108), (40, 80)):
        bx, by = hx + ox * S, hy - 40 * S
        ex, ey = bx + math.cos(math.radians(a)) * 90 * S, by - math.sin(math.radians(a)) * 90 * S
        d.line([(bx, by), (ex, ey)], fill=GOLD_D, width=16 * S)
        d.line([(bx, by), (ex, ey)], fill=GOLD_L, width=9 * S)
        mx, my = (bx + ex) / 2, (by + ey) / 2
        d.line([(mx, my), (mx + 28 * S, my - 22 * S)], fill=GOLD_D, width=11 * S)
    # skull + long snout pointing left
    d.rounded_rectangle([hx - 120 * S, hy - 22 * S, hx + 40 * S, hy + 44 * S], radius=30 * S, fill=GOLD_D)
    d.rounded_rectangle([hx - 114 * S, hy - 16 * S, hx + 34 * S, hy + 38 * S], radius=26 * S, fill=GOLD)
    d.ellipse([hx - 40 * S, hy - 62 * S, hx + 60 * S, hy + 30 * S], fill=GOLD_D)
    d.ellipse([hx - 34 * S, hy - 56 * S, hx + 54 * S, hy + 24 * S], fill=GOLD)
    # brow ridge, eye, nostril, open jaw, teeth
    d.ellipse([hx - 30 * S, hy - 42 * S, hx + 6 * S, hy - 6 * S], fill=CREAM)
    d.ellipse([hx - 24 * S, hy - 34 * S, hx - 6 * S, hy - 14 * S], fill=INK)
    d.ellipse([hx - 20 * S, hy - 32 * S, hx - 13 * S, hy - 25 * S], fill=(255, 255, 255))
    d.line([(hx - 42 * S, hy - 50 * S), (hx + 14 * S, hy - 44 * S)], fill=GOLD_D, width=10 * S)
    d.ellipse([hx - 110 * S, hy - 8 * S, hx - 94 * S, hy + 6 * S], fill=GOLD_D)
    d.polygon([(hx - 116 * S, hy + 22 * S), (hx - 20 * S, hy + 18 * S), (hx - 70 * S, hy + 54 * S)], fill=RED3)
    d.polygon([(hx - 100 * S, hy + 50 * S), (hx - 10 * S, hy + 30 * S), (hx - 40 * S, hy + 72 * S), (hx - 96 * S, hy + 70 * S)], fill=GOLD_D)
    d.polygon([(hx - 96 * S, hy + 54 * S), (hx - 16 * S, hy + 34 * S), (hx - 44 * S, hy + 66 * S), (hx - 92 * S, hy + 64 * S)], fill=GOLD)
    for tx2 in (-104, -84, -64):
        d.polygon([(hx + tx2 * S, hy + 22 * S), (hx + (tx2 + 12) * S, hy + 22 * S), (hx + (tx2 + 6) * S, hy + 36 * S)], fill=CREAM)
    # whiskers: two curly strokes from the snout, sweeping down and back under the jaw (clear of the pearl)
    for k, (x0, y0) in enumerate(((-104, 4), (-96, 44))):
        wp = []
        for i in range(50):
            t = i / 49
            a = math.radians(200 + 150 * t + 25 * k)
            r = (60 - 30 * t) * S
            wp.append((hx + x0 * S + (math.cos(a) + 1) * r * 0.9 + t * 70 * S, hy + y0 * S - math.sin(a) * r + t * 40 * S))
        d.line(wp, fill=GOLD_D, width=12 * S, joint='curve')
        d.line(wp, fill=GOLD, width=7 * S, joint='curve')
    im = im.resize((W // SS, H // SS), Image.LANCZOS)
    im.save(path); print('wrote', path)


def crest(path=os.path.join(HERE, 'throne_crest.png')):
    W, H = 1024 * SS, 320 * SS
    im = Image.new('RGB', (W, H), RED); d = ImageDraw.Draw(im); S = SS
    d.rectangle([0, 0, W, H], fill=GOLD_D)
    d.rectangle([12 * S, 12 * S, W - 12 * S, H - 12 * S], fill=GOLD)
    d.rectangle([28 * S, 28 * S, W - 28 * S, H - 28 * S], fill=RED)
    cloud(d, 250 * S, 175 * S, 85 * S, -1)
    cloud(d, 774 * S, 175 * S, 85 * S, 1)
    cx, cy, r = 512 * S, 160 * S, 86 * S
    for i in range(16):
        a = i / 16 * 2 * math.pi
        tip = (cx + math.cos(a) * r * 1.42, cy + math.sin(a) * r * 1.42)
        l = (cx + math.cos(a - 0.2) * r, cy + math.sin(a - 0.2) * r); rr = (cx + math.cos(a + 0.2) * r, cy + math.sin(a + 0.2) * r)
        d.polygon([l, tip, rr], fill=GOLD)
    d.ellipse([cx - r - 6 * S, cy - r - 6 * S, cx + r + 6 * S, cy + r + 6 * S], fill=GOLD_D)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=GOLD)
    d.ellipse([cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7], fill=GOLD_L)
    d.ellipse([cx - r * 0.45, cy - r * 0.55, cx - r * 0.05, cy - r * 0.2], fill=(255, 246, 210))
    im = im.resize((W // SS, H // SS), Image.LANCZOS)
    im.save(path); print('wrote', path)


if __name__ == '__main__':
    dragon_panel(); crest()
