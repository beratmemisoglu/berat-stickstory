# Pine tree: a stylised ancient Chinese pine (the windswept kind on painted mountain tops). A twisted S-curved trunk
# with spiralling bark ridges and a root flare, crooked branches reaching out sideways, and flat cloud-like foliage pads
# (scalloped rims, domed tops, flat bottoms) in tiers. Trunk, roots and branches are each ONE smooth tube mesh (a UV
# sphere bent along a curve): no ink rings at joints.
# Floor prop: root at the trunk base on the floor; ~4.3 x 2.3 x 3.6 m at size 1 (the crown leans to -X; mirror=True
# leans it to +X).
# Animate: <name>_pad<i> rotation (foliage sway; pivot at the branch tip under the pad), <name>_crown rotation (the
# whole tree above the roots: a slow lean, pivot at the trunk base).
import math, random
from mathutils import Vector

META = {'size': (4.3, 2.3, 3.6), 'anchor': 'floor centre at the trunk base',
        'animate': ['_pad0.._pad6 (rotation: sway, pivot at the branch tip)', '_crown (rotation: lean, pivot at the base)'],
        'params': "size=1.0 (uniform), mirror=False (lean to +X instead of -X), foliage='#2f6a48', bark='#6a4a38', seed=2"}


def _cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return Vector(tuple(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
                        for a, b, c, d in zip(p0, p1, p2, p3)))


def _curve(pts, n=80):
    """Dense samples of the Catmull-Rom curve through pts + parallel-transport frames (T, N, B)."""
    P = [pts[0]] + list(pts) + [pts[-1]]
    seg = len(pts) - 1
    S = []
    for i in range(n + 1):
        u = i / n * seg; j = min(seg - 1, int(u)); k = u - j
        S.append(_cr(P[j], P[j + 1], P[j + 2], P[j + 3], k))
    T = [((S[min(n, i + 1)] - S[max(0, i - 1)]).normalized()) for i in range(n + 1)]
    ref = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    N = [T[0].cross(ref).normalized()]
    for i in range(1, n + 1):
        b = T[i - 1].cross(T[i])
        nv = N[-1]
        if b.length > 1e-8:
            b.normalize(); ang = math.acos(max(-1.0, min(1.0, T[i - 1].dot(T[i]))))
            from mathutils import Quaternion
            nv = Quaternion(b, ang) @ nv
        nv = (nv - T[i] * nv.dot(T[i])).normalized()
        N.append(nv)
    # arc length parameter
    L = [0.0]
    for i in range(1, n + 1): L.append(L[-1] + (S[i] - S[i - 1]).length)
    return S, T, N, L


def _tube(cz, name, pts, radius, mat, parent, ol=0.008, segs=18, rings=40, ridges=0, ridge_amp=0.0, twist=0.0, nose=0.5):
    """One closed smooth tube along the curve through pts: radius(t) (t = 0..1 by arc length), optional spiralling
    ridges (bark). A UV sphere whose rings are moved onto the curve, the poles become rounded ends."""
    S, T, N, L = _curve(pts)
    n = len(S) - 1; tot = L[-1]
    o = cz.sphere(name, 1.0, (0, 0, 0), mat, ol=ol, parent=parent, segs=segs, rings=rings)

    def at(t):   # frame at arc-length fraction t
        s = t * tot; i = 0
        while i < n - 1 and L[i + 1] < s: i += 1
        k = 0.0 if L[i + 1] == L[i] else (s - L[i]) / (L[i + 1] - L[i])
        c = S[i].lerp(S[i + 1], k); tg = T[i].lerp(T[i + 1], k).normalized()
        nv = N[i].lerp(N[i + 1], k); nv = (nv - tg * nv.dot(tg)).normalized()
        return c, tg, nv, tg.cross(nv)

    step = math.pi / rings
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        k = phi / step
        if k < 0.5:
            c, tg, nv, b = at(0.0); v.co = c - tg * radius(0.0) * nose; continue
        if k > rings - 0.5:
            c, tg, nv, b = at(1.0); v.co = c + tg * radius(1.0) * nose; continue
        t = (k - 1) / (rings - 2)
        c, tg, nv, b = at(t)
        r = radius(t) * (1 + ridge_amp * math.sin(ridges * th + twist * 2 * math.pi * t))
        if k < 1.5 or k > rings - 1.5:   # first / last ring a little smaller: a rounded end
            r *= 0.8
        v.co = c + (nv * math.cos(th) - b * math.sin(th)) * r
    o.data.update()
    return o


def _pad(cz, name, rx, ry, h, mat, parent, rnd, loc=(0, 0, 0), bumps=7):
    """Flat cloud-like foliage pad: scalloped rim, domed lumpy top, flat bottom; centre of the bottom at loc."""
    o = cz.sphere(name, 1.0, loc, mat, ol=0.009, parent=parent, segs=56, rings=16)
    ph = rnd.uniform(0, 6.28); ph2 = rnd.uniform(0, 6.28)
    hb = 0.28 * h
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        sc = 1 + 0.09 * math.cos(bumps * th + ph) + 0.04 * math.cos((bumps + 3) * th + ph2)
        s = math.sin(phi)
        if z >= 0:
            zz = hb + (h - hb) * (z ** 0.75) * (1 + 0.18 * math.cos(3 * th + ph2) * s)
            rr = s ** 0.8
        else:
            zz = hb * (1 + z) ** 1.6     # flat-ish bottom
            rr = s ** 0.5
        v.co = (math.cos(th) * rx * rr * sc, math.sin(th) * ry * rr * sc, zz)
    o.data.update()
    return o


def build(cz, name='pine_tree', size=1.0, mirror=False, foliage='#2f6a48', bark='#6a4a38', seed=2):
    s = float(size); f = -1.0 if mirror else 1.0
    rnd = random.Random(seed)
    root = cz.empty(name)
    crown = cz.empty(name + '_crown', parent=root)
    bm = cz.toon(name + '_bark', bark, tex='wood', tex_scale=2.5, tex_strength=0.1)
    bm2 = cz.toon(name + '_bark2', bark, tex='grain', tex_scale=2.0, tex_strength=0.08)
    fm = [cz.toon(name + '_needles', foliage, tex='grain', tex_scale=3.0, tex_strength=0.07),
          cz.toon(name + '_needles2', _shade(foliage, 0.88), tex='grain', tex_scale=3.0, tex_strength=0.07)]

    def Q(x, y, z): return (x * s * f, y * s, z * s)
    # (coordinates below are written for the crown leaning to -X: Q scales them and mirrors them for mirror=True)
    trunk = [(0, 0, 0.02), (0.06, 0, 0.45), (0.24, 0.04, 1.05), (0.08, 0.0, 1.62), (-0.26, -0.04, 2.15),
             (-0.44, 0.0, 2.68), (-0.36, 0.04, 3.08)]
    trunk = [Q(x, y, z) for (x, y, z) in trunk]
    _tube(cz, name + '_trunk', trunk, lambda t: s * (0.19 * (1 - 0.55 * t) + 0.14 * max(0.0, 1 - t / 0.09) ** 2),
          bm, crown, ol=0.01, segs=20, rings=48, ridges=5, ridge_amp=0.08, twist=1.3, nose=0.12)
    # root flare: three short roots sprawling on the ground
    for i, (ax, ay) in enumerate(((0.55, -0.25), (-0.4, -0.38), (-0.1, 0.5))):
        rp = [Q(0.0, 0.0, 0.32), Q(ax * 0.45, ay * 0.45, 0.12), Q(ax, ay, 0.035)]
        _tube(cz, f'{name}_root{i}', rp, lambda t: s * (0.1 - 0.065 * t), bm2, crown, ol=0.008, segs=12, rings=14)
    # branches (trunk -> tip) and the pad on each tip: (points, base radius, pad rx, ry, h)
    br = [
        ([(0.14, 0.0, 1.38), (-0.35, -0.05, 1.48), (-0.9, -0.1, 1.42), (-1.32, -0.06, 1.56)], 0.085, 0.72, 0.55, 0.3),
        ([(-0.05, 0.0, 1.95), (0.35, 0.06, 2.12), (0.82, 0.1, 2.06), (1.18, 0.06, 2.2)], 0.08, 0.75, 0.58, 0.32),
        ([(-0.38, 0.0, 2.45), (-0.82, 0.18, 2.56), (-1.22, 0.28, 2.72)], 0.065, 0.6, 0.48, 0.27),
        ([(0.22, 0.0, 0.92), (0.58, -0.14, 1.0), (0.9, -0.22, 1.12)], 0.06, 0.48, 0.4, 0.22),
        ([(-0.3, 0.0, 2.3), (-0.2, -0.35, 2.42), (-0.05, -0.62, 2.5)], 0.05, 0.5, 0.42, 0.22),
    ]
    pads = []
    for i, (pts, r0, prx, pry, ph) in enumerate(br):
        pts = [Q(x, y, z) for (x, y, z) in pts]
        _tube(cz, f'{name}_branch{i}', pts, (lambda r0: (lambda t: s * r0 * (1 - 0.5 * t)))(r0), bm2, crown, ol=0.008,
              segs=12, rings=24, ridges=3, ridge_amp=0.06, twist=0.6)
        pads.append((Vector(pts[-1]), prx, pry, ph))
    # the crown: a big pad on the trunk top, a smaller one stacked above it
    top = Vector(trunk[-1])
    pads.append((top + Vector((0, 0, -0.04 * s)), 0.92, 0.7, 0.32))
    pads.append((top + Vector((Q(0.12, 0, 0)[0], 0.03 * s, 0.24 * s)), 0.52, 0.42, 0.26))
    for i, (p, prx, pry, ph) in enumerate(pads):
        pv = cz.empty(f'{name}_pad{i}', tuple(p), parent=crown)
        pv.rotation_euler = (math.radians(rnd.uniform(-4, 4)), math.radians(rnd.uniform(-5, 5)), math.radians(rnd.uniform(0, 360)))
        _pad(cz, f'{name}_pad{i}_m', prx * s, pry * s, ph * s, fm[i % 2], pv, rnd, loc=(0, 0, -0.06 * s))
    return root


def _shade(h, k):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v * k)))) for v in c)
