# Rubble pile: what is left of the palace after the earthquake - a heap of rammed earth and debris with broken red
# lacquered columns (one stump still standing on its stone base, one lying across the front, one jutting up out of the
# heap, pale splintered wood at the breaks), two big fallen sections of the golden glazed tile roof (rows of tile rolls,
# round end caps, the eave still curling up), timber beams sticking out (one with its painted teal-and-gold end), chunks
# of layered rammed-earth wall, scattered single roof tiles, broken stones and bricks, the cracked blue-and-gold palace
# name board leaning in front, a toppled red paper lantern, and pale dust clouds still settling.
# Floor prop: root at the floor centre of the heap (the rim dips 3 cm below z = 0); ~7.1 x 5.0 x 2.45 m (the heap itself 6.3 x 4.1 x 1.5); front = -Y.
# Animate: <name>_dust<i> (scale / location: drifting, settling dust), <name>_lantern (rotation: a little roll).
import math, random
from mathutils import Vector, Matrix, Quaternion

META = {'size': (7.1, 5.0, 2.45), 'anchor': 'floor centre of the heap; front -Y; rim at z = -0.03',
        'animate': ['_dust0.._dust5 (scale/location)', '_lantern (rotation)'],
        'params': 'dust=True, lantern=True, plaque=True, seed=3',
        'helpers': 'mound(x, y) -> heap surface z (root-local)'}

MA, MB, MH = 2.9, 1.9, 1.3         # heap half length (x), half depth (y), height


def mound(x, y):
    e = math.hypot(x / MA, y / MB)
    if e >= 1: return -0.03 * min(1.0, (e - 1) / 0.08)
    z = MH * (1 - e * e) ** 0.75
    z += 0.13 * math.sin(2.3 * x + 0.4) * math.cos(1.9 * y + 1.1) * (1 - e) + 0.06 * math.sin(5.1 * x + 2) * math.sin(4.3 * y) * (1 - e)
    z += 0.25 * math.exp(-((x + 0.4) ** 2 + (y - 0.2) ** 2) / 0.6) * (1 - e)
    return z


def P(x, y, lift=0.0): return Vector((x, y, max(0.0, mound(x, y)) + lift))


# ---------------------------------------------------------------- mesh helpers
def _flat(o):
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()


def _heap(cz, name, root, mat, ol=0.012, segs=120, rings=56):
    """UV sphere flattened into the heap (elliptical disc, heights from mound()), flat underside at -0.03."""
    o = cz.sphere(name, 1.0, (0, 0, 0), mat, ol=ol, parent=root, segs=segs, rings=rings)
    half = math.pi / 2; RE = 1.08
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        if phi <= half + 1e-6:
            e = RE * phi / half; px, py = e * MA * math.cos(th), e * MB * math.sin(th)
            v.co = (px, py, mound(px, py))
        else:
            e = RE * (math.pi - phi) / half
            v.co = (e * MA * math.cos(th), e * MB * math.sin(th), -0.03)
    o.data.update()
    return o


def _prism(cz, name, pts, depth, mat, loc=(0, 0, 0), rot=(0, 0, 0), ol=0.006, bevel=0.0, parent=None):
    """Extrude a 2-D outline (local XY, may be concave) along local +Z: a cz.cyl with its rings moved onto it."""
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    if area < 0: pts = pts[::-1]
    n = len(pts)
    o = cz.cyl(name, 1.0, depth, loc, mat, rot=rot, verts=n, bevel=bevel, ol=ol, parent=parent)
    vs = o.data.vertices
    a0 = math.atan2(vs[0].co.y, vs[0].co.x); step = 2 * math.pi / n
    for v in vs:
        k = int(round(((math.atan2(v.co.y, v.co.x) - a0) % (2 * math.pi)) / step)) % n
        v.co.x, v.co.y = pts[k]
    _flat(o)
    return o


def _cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return Vector(tuple(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
                        for a, b, c, d in zip(p0, p1, p2, p3)))


def _frames(pts, n=60):
    P_ = [pts[0]] + list(pts) + [pts[-1]]; seg = len(pts) - 1
    S = []
    for i in range(n + 1):
        u = i / n * seg; j = min(seg - 1, int(u)); k = u - j
        S.append(_cr(P_[j], P_[j + 1], P_[j + 2], P_[j + 3], k))
    T = [(S[min(n, i + 1)] - S[max(0, i - 1)]).normalized() for i in range(n + 1)]
    ref = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    N = [T[0].cross(ref).normalized()]
    for i in range(1, n + 1):
        b = T[i - 1].cross(T[i]); nv = N[-1]
        if b.length > 1e-8:
            nv = Quaternion(b.normalized(), math.acos(max(-1.0, min(1.0, T[i - 1].dot(T[i]))))) @ nv
        N.append((nv - T[i] * nv.dot(T[i])).normalized())
    L = [0.0]
    for i in range(1, n + 1): L.append(L[-1] + (S[i] - S[i - 1]).length)

    def at(t):
        s = t * L[-1]; i = 0
        while i < n - 1 and L[i + 1] < s: i += 1
        k = 0.0 if L[i + 1] == L[i] else (s - L[i]) / (L[i + 1] - L[i])
        c = S[i].lerp(S[i + 1], k); tg = T[i].lerp(T[i + 1], k).normalized()
        nv = N[i].lerp(N[i + 1], k); nv = (nv - tg * nv.dot(tg)).normalized()
        return c, tg, nv, -(tg.cross(nv))        # centre, tangent, N (across), U (up)
    return at


def _outline_sampler(poly):
    """poly: closed CCW list of (u, v) -> f(frac) giving the point at that fraction of the perimeter."""
    pts = poly + [poly[0]]
    L = [0.0]
    for a, b in zip(pts, pts[1:]): L.append(L[-1] + math.dist(a, b))

    def f(fr):
        s = (fr % 1.0) * L[-1]; i = 0
        while i < len(L) - 2 and L[i + 1] < s: i += 1
        k = 0.0 if L[i + 1] == L[i] else (s - L[i]) / (L[i + 1] - L[i])
        return (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k)
    return f


def _sweep(cz, name, pts, poly, mat, parent, ol=0.008, segs=96, rings=16, vmod=None):
    """One closed mesh: the CCW outline poly (u across, v up) swept along the curve through pts (local to parent),
    flat end caps (the sphere's poles at the outline's centre); vmod(t, u, v) -> extra v (e.g. tile courses).
    Returns (object, frame function)."""
    at = _frames(pts)
    smp = _outline_sampler(poly)
    cu = sum(p[0] for p in poly) / len(poly); cv = sum(p[1] for p in poly) / len(poly)
    o = cz.sphere(name, 1.0, (0, 0, 0), mat, ol=ol, parent=parent, segs=segs, rings=rings)
    step = math.pi / rings
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        k = phi / step
        if k < 0.5 or k > rings - 0.5:
            c, tg, nv, up = at(0.0 if k < 0.5 else 1.0); v.co = c + nv * cu + up * cv; continue
        t = (k - 1) / (rings - 2)
        c, tg, nv, up = at(t)
        u, w = smp((th % (2 * math.pi)) / (2 * math.pi))
        if vmod: w += vmod(t, u, w)
        v.co = c + nv * u + up * w
    _flat(o)
    return o, at


def _rock(cz, name, loc, size, mat, parent, rnd, ol=0.006, rot_z=0.0):
    sx, sy, sz = size
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=8, rings=5)
    a = math.radians(rot_z)
    for v in o.data.vertices:
        x, y, z = v.co; k = 0.8 + 0.35 * rnd.random()
        x, y, z = x * k * sx, y * k * sy, max(z, -0.5) * k * sz
        v.co = (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a), z)
    _flat(o)
    return o


def _puff(cz, name, rx, rz, mat, parent, rnd, loc=(0, 0, 0)):
    """Dust cloud: a lumpy flattened ball, flat-ish bottom; loc = centre of its base."""
    o = cz.sphere(name, 1.0, loc, mat, ol=0.003, parent=parent, segs=32, rings=14)
    ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        k = 1 + 0.12 * math.cos(5 * th + ph[0]) * math.sin(phi) + 0.1 * math.cos(3 * phi + 2 * th + ph[1])
        zz = (z * rz * k) if z > 0 else z * rz * 0.35
        v.co = (x * rx * k, y * rx * 0.85 * k, zz + rz * 0.35)
    o.data.update()
    return o


def _aim(pv, d):
    pv.rotation_euler = Vector(d).normalized().to_track_quat('Z', 'Y').to_euler()


# ---------------------------------------------------------------- parts
def _column(cz, name, A, B, r, red, gold, brk, parent, rnd, bands=(0.12,), break_a=False):
    """Red lacquered column from A to B, broken (slanted cut, pale wood, splinters) at the B end (and at A with
    break_a: a snapped column), gold bands at fractions of its length from A."""
    d = B - A; L = d.length
    pv = cz.empty(name, tuple(A), parent=parent); _aim(pv, d)
    o = cz.cyl(name + '_m', r, L, (0, 0, 0), red, verts=20, ol=0.01, parent=pv)
    me = o.data
    # the break: a slanted PLANAR cut (a jagged non-planar cap tessellates into see-through black triangles) + splinters
    ends = [(L, 1)] + ([(0.0, -1)] if break_a else [])
    cuts = {}
    for z0, sg in ends:
        a = rnd.uniform(0, 2 * math.pi); sl = rnd.uniform(0.35, 0.6); cuts[sg] = (z0, a, sl)
        ca, sa = math.cos(a), math.sin(a)
        for v in me.vertices:
            if abs(v.co.z - z0) < 1e-5:
                v.co.z = z0 + sg * sl * (v.co.x * ca + v.co.y * sa)
        for i in range(4):
            b = a + math.pi * (0.25 + 0.5 * i) + rnd.uniform(-0.3, 0.3); rr = r * rnd.uniform(0.25, 0.65)
            x, y = rr * math.cos(b), rr * math.sin(b)
            h = rnd.uniform(0.1, 0.2) * (1.4 if i == 1 else 1.0)
            cz.cyl(f'{name}_shard{"AB"[sg > 0]}{i}', r * rnd.uniform(0.16, 0.24), h,
                   (x, y, z0 + sg * (sl * (x * ca + y * sa) - 0.03)), brk,
                   rot=(rnd.uniform(-12, 12) + (180 if sg < 0 else 0), rnd.uniform(-12, 12), rnd.uniform(0, 90)), r2=0.004,
                   verts=4, ol=0.004, parent=pv)
    me.update()
    # the break shows pale wood: material slot 1 on the cut caps, ink moves to slot 2 (the hull clamps to the last slot)
    me.materials[1] = brk; me.materials.append(cz.ink()); o.modifiers['cz_outline'].material_offset = 2
    for p in me.polygons:
        if (p.center.z > L - 0.2 and p.normal.z > 0.5) or (break_a and p.center.z < 0.2 and p.normal.z < -0.5):
            p.material_index = 1
    _flat(o)
    for i, f in enumerate(bands):
        cz.cyl(f'{name}_band{i}', r * 1.05, 0.08, (0, 0, L * f), gold, verts=20, ol=0.006, parent=pv)
    return pv


def _beam(cz, name, A, B, w, mat, parent, splinter=None, painted=None):
    d = B - A; L = d.length
    pv = cz.empty(name, tuple((A + B) / 2), parent=parent); _aim(pv, d)
    cz.box(name + '_m', (w, w * 0.92, L), (0, 0, 0), mat, bevel=0.012, ol=0.008, parent=pv)
    if splinter:   # shards of pale wood at the B end
        for i, (sx, sy, h, tx, ty) in enumerate(((0.045, 0.03, 0.2, 8, -6), (-0.04, -0.035, 0.15, -10, 5),
                                                  (0.0, 0.05, 0.12, 4, 12), (-0.05, 0.04, 0.09, -6, -8))):
            cz.cyl(f'{name}_shard{i}', w * 0.24, h, (sx, sy, L / 2 - 0.04), splinter, rot=(tx, ty, i * 37), r2=0.004,
                   verts=4, ol=0.004, parent=pv)
    if painted:    # the painted beam end (teal square, gold disc) on the B end face
        teal, gold = painted
        cz.box(name + '_paint', (w * 0.8, w * 0.74, 0.004), (0, 0, L / 2 + 0.0015), teal, bevel=0, ol=0.0, parent=pv)
        cz.cyl(name + '_paintdot', w * 0.24, 0.003, (0, 0, L / 2 + 0.0035), gold, verts=20, ol=0.0, parent=pv)
    return pv


def _slab(cz, name, loc, rot, tile, cap, parent, length=2.0, width=1.3, rolls=5):
    """A fallen section of the glazed tile roof: rows of tile rolls (corrugated top), the eave end curling up, round
    tile end caps along the eave. Built along local +X from loc, rot = (roll, pitch, yaw) degrees."""
    pv = cz.empty(name, tuple(loc), parent=parent)
    pv.rotation_euler = tuple(math.radians(a) for a in rot)
    T0, A = 0.07, 0.075
    poly = [(-width / 2, 0.0), (width / 2, 0.0)]
    n = rolls * 12
    for i in range(n + 1):
        u = width / 2 - width * i / n
        fr = ((u + width / 2) / width * rolls) % 1.0
        poly.append((u, T0 + A * math.sin(math.pi * fr) ** 0.75))
    L = length
    pts = [(0, 0, 0), (L * 0.33, 0, 0), (L * 0.66, 0, L * 0.015), (L * 0.88, 0, L * 0.065), (L, 0, L * 0.14)]
    course = 0.3

    def steps(t, u, w):   # overlapping tile courses: the top rises along each course and steps down at its edge
        if w < T0 * 0.6: return 0.0
        return 0.03 * ((t * L / course) % 1.0)
    o, at = _sweep(cz, name + '_m', pts, poly, tile, pv, ol=0.009, segs=120, rings=int(L / course * 7) + 2, vmod=steps)
    c, tg, nv, up = at(1.0)
    for j in range(rolls):
        u = -width / 2 + (j + 0.5) * width / rolls
        cp = cz.empty(f'{name}_cap{j}', tuple(c + nv * u + up * (T0 + A * 0.45)), parent=pv); _aim(cp, tg)
        cz.cyl(f'{name}_cap{j}_m', 0.068, 0.035, (0, 0, -0.012), cap, verts=20, bevel=0.006, ol=0.005, parent=cp)
    return pv


def _chunk(cz, name, x, y, yaw, tilt, w, d, n, mats, parent, rnd):
    """A chunk of rammed-earth wall: n stacked, slightly offset layers (the tamped courses)."""
    pv = cz.empty(name, tuple(P(x, y, -0.06)), parent=parent)
    pv.rotation_euler = (math.radians(tilt[0]), math.radians(tilt[1]), math.radians(yaw))
    z = 0.0
    for i in range(n):
        # each course an irregular broken footprint (plain boxes read as planks / crates)
        lw = w * (1 - 0.08 * i) * rnd.uniform(0.92, 1.0); ld = d * rnd.uniform(0.88, 1.0); h = 0.21
        ox = rnd.uniform(-0.05, 0.05) + (0.03 if i % 2 else -0.03); oy = rnd.uniform(-0.03, 0.03)
        j = lambda: rnd.uniform(-0.07, 0.07)
        pts = [(-lw / 2 + j(), -ld / 2 + j() * 0.5), (lw * 0.1 + j(), -ld / 2 - 0.02), (lw / 2 + j(), -ld / 2 + j() * 0.5),
               (lw / 2 - 0.05 + j(), ld / 2 + j() * 0.5), (-lw * 0.15 + j(), ld / 2 + 0.02), (-lw / 2 + 0.04 + j(), ld / 2 + j() * 0.5)]
        b = _prism(cz, f'{name}_l{i}', [(x + ox, y + oy) for x, y in pts], h + 0.015, mats[i % 2], (0, 0, z), ol=0.008,
                   bevel=0.03, parent=pv)
        if i == n - 1: b.rotation_euler = (math.radians(rnd.uniform(-5, 5)), math.radians(rnd.uniform(-7, 7)), math.radians(rnd.uniform(-8, 8)))
        z += h
    return pv


def _tile(cz, name, loc, yaw, mat, parent, tilt=(0, 0), length=0.32, broken=False):
    """A single curved roof tile lying convex side up: a half-pipe (C-shaped outline extruded)."""
    pv = cz.empty(name, tuple(loc), parent=parent)
    pv.rotation_euler = (math.radians(tilt[0]), math.radians(tilt[1]), math.radians(yaw))
    ro, ri = 0.11, 0.088
    pts = [(ro * math.cos(math.pi * k / 10), ro * math.sin(math.pi * k / 10)) for k in range(11)]
    pts += [(ri * math.cos(math.pi * k / 10), ri * math.sin(math.pi * k / 10)) for k in range(10, -1, -1)]
    L = length * (0.6 if broken else 1.0)
    _prism(cz, name + '_m', pts, L, mat, (0, L / 2, 0), (90, 0, 0), ol=0.004, parent=pv)
    return pv


def _lantern(cz, name, loc, rot, parent, rnd):
    """A toppled red paper lantern: ribbed oblate body with a dent, gold caps, a red tassel lying on the ground."""
    red = cz.toon(name + '_lantred', '#c2382c', tex='paper', tex_strength=0.05)
    gold = cz.toon(name + '_lantgold', '#c99a3a', tex='grain', tex_strength=0.05)
    pv = cz.empty(name + '_lantern', tuple(loc), parent=parent)
    pv.rotation_euler = tuple(math.radians(a) for a in rot)
    R = 0.27
    b = cz.sphere(name + '_lantbody', 1.0, (0, 0, 0), red, ol=0.007, parent=pv, segs=48, rings=18)
    dent = Vector((0.6, -0.5, 0.62)).normalized()
    for v in b.data.vertices:
        x, y, z = v.co; th = math.atan2(y, x)
        k = 1 + 0.035 * math.cos(12 * th) * (1 - z * z)
        dd = Vector((x, y, z)).dot(dent)
        if dd > 0.8: k *= 1 - 0.55 * (dd - 0.8)          # crushed in on one side
        v.co = (x * R * k, y * R * k, z * R * 0.82 * k)
    b.data.update()
    for i, sz in enumerate((1, -1)):
        cz.cyl(f'{name}_lantcap{i}', 0.11, 0.07, (0, 0, sz * R * 0.78 - (0.07 if sz < 0 else 0)), gold, verts=20,
               bevel=0.008, ol=0.005, parent=pv)
    # the tassel hangs from the bottom cap: built in root space so it can droop onto the ground
    M = Matrix.Translation(loc) @ Matrix(pv.rotation_euler.to_matrix()).to_4x4()
    a = M @ Vector((0, 0, -R * 0.78 - 0.07))
    out = (M.to_3x3() @ Vector((0, 0, -1))).normalized()
    pts = [a, a + out * 0.08, Vector((a.x + out.x * 0.22, a.y + out.y * 0.22, 0.03)), Vector((a.x + out.x * 0.42, a.y + out.y * 0.42 + 0.05, 0.02))]
    cz.sphere(name + '_lantknot', 0.035, tuple(a + out * 0.03), gold, ol=0.004, parent=parent, segs=14, rings=8)
    at = _frames(pts)
    tas = _sweep(cz, name + '_tassel', pts, [(0.03 * math.cos(a_), 0.03 * math.sin(a_)) for a_ in
                                             [k / 10 * 2 * math.pi for k in range(10)]], red, parent, ol=0.004, segs=12, rings=10)
    return pv


# ---------------------------------------------------------------- build
def build(cz, name='rubble_pile', dust=True, lantern=True, plaque=True, seed=3):
    rnd = random.Random(seed)
    root = cz.empty(name)
    earth = cz.toon(name + '_earth', '#86705a', tex='grain', tex_scale=2.0, tex_strength=0.1)
    ram = [cz.toon(name + '_ram1', '#a9845a', tex='grain', tex_scale=2.0, tex_strength=0.08),
           cz.toon(name + '_ram2', '#97744d', tex='grain', tex_scale=2.0, tex_strength=0.08)]
    red = cz.toon(name + '_red', '#a32e27', tex='grain', tex_strength=0.05)
    gold = cz.toon(name + '_gold', '#c69432', tex='grain', tex_strength=0.05)
    brk = cz.toon(name + '_break', '#d2a86e', tex='wood', tex_scale=3.0, tex_strength=0.1)
    beam = cz.toon(name + '_beam', '#5c3324', tex='wood', tex_scale=2.0, tex_strength=0.09)
    tile = cz.toon(name + '_tile', '#bb8c28', tex='grain', tex_strength=0.05)
    capm = cz.toon(name + '_tilecap', '#a5771f', tex='grain', tex_strength=0.05)
    stone = cz.toon(name + '_stone', '#9a9286', tex='grain', tex_scale=1.5, tex_strength=0.06)
    brick = cz.toon(name + '_brick', '#8d8780', tex='grain', tex_strength=0.06)
    teal = cz.toon(name + '_teal', '#3a8580', tex='grain', tex_strength=0.04)

    _heap(cz, name + '_heap', root, earth)

    # ---- the standing stump on its stone base (back left), two fallen columns
    cz.cyl(name + '_stumpbase', 0.44, 0.22, (-2.55, 1.05, -0.02), stone, verts=8, bevel=0.02, ol=0.008, parent=root)
    cz.cyl(name + '_stumpbase2', 0.35, 0.09, (-2.55, 1.05, 0.19), stone, verts=8, bevel=0.015, ol=0.006, parent=root)
    _column(cz, name + '_stump', Vector((-2.55, 1.05, 0.27)), Vector((-2.55, 1.05, 1.72)), 0.26, red, gold, brk, root, rnd,
            bands=(0.08,))
    _column(cz, name + '_colA', P(1.3, -0.95, 0.06), P(-1.75, -1.65, 0.25), 0.26, red, gold, brk, root, rnd, bands=(0.86,),
            break_a=True)
    _column(cz, name + '_colB', P(0.35, 0.55, -0.45), Vector((1.75, 0.02, 1.86)), 0.24, red, gold, brk, root, rnd, bands=(0.7,))

    # ---- fallen roof sections
    _slab(cz, name + '_roofA', P(0.15, -0.05, 0.14), (6, 17, -38), tile, capm, root, length=2.1, width=1.35)
    _slab(cz, name + '_roofB', P(-1.45, 0.72, -0.12), (0, -52, 100), tile, capm, root, length=1.8, width=1.2, rolls=4)

    # ---- timber beams
    _beam(cz, name + '_beamA', P(-0.5, 0.2, -0.4), Vector((-1.38, -0.85, 1.95)), 0.21, beam, root, splinter=brk)
    _beam(cz, name + '_beamB', P(0.55, 0.15, 0.32), P(2.78, -0.55, 0.1), 0.2, beam, root, painted=(teal, gold))
    _beam(cz, name + '_beamC', P(-1.7, 1.05, 0.06), P(0.6, 1.3, 0.05), 0.19, beam, root)

    # ---- rammed-earth wall chunks
    _chunk(cz, name + '_wallA', -2.05, -0.55, 25, (0, -12), 1.0, 0.5, 4, ram, root, rnd)
    _chunk(cz, name + '_wallB', 2.3, 0.55, -30, (8, 10), 1.1, 0.5, 3, ram, root, rnd)
    _chunk(cz, name + '_wallC', -0.35, 1.38, 5, (-10, 0), 1.3, 0.5, 4, ram, root, rnd)
    _chunk(cz, name + '_wallD', 1.05, -1.72, 15, (0, 6), 0.75, 0.45, 2, ram, root, rnd)

    # ---- the cracked palace name board leaning against the small wall chunk at the front
    if plaque:
        pq = cz.empty(name + '_plaque', (0.95, -2.12, 0.0), parent=root)
        pq.rotation_euler = (math.radians(-18), 0, math.radians(12))
        cz.box(name + '_plaqueboard', (1.16, 0.08, 0.6), (0, 0, 0.3), cz.toon(name + '_plaquewood', '#6e4a26', tex='wood'),
               bevel=0.015, ol=0.008, parent=pq)
        cz.plane(name + '_plaqueface', 1.08, 0.54, (0, -0.0415, 0.3),
                 cz.toon(name + '_plaque_pic', img='assets/props/tex/rubble_pile_plaque.png', lift=0.72), parent=pq)

    # ---- scattered single tiles, stones, bricks (around the foot, a few up the slope)
    for i in range(18):
        for _ in range(40):
            th = rnd.uniform(-math.pi * 0.95, math.pi * 0.15) if i < 13 else rnd.uniform(0, 2 * math.pi)
            e = rnd.uniform(0.96, 1.3) if i < 14 else rnd.uniform(0.7, 0.9)
            x, y = e * MA * math.cos(th), e * MB * math.sin(th)
            if abs(x - 0.95) < 0.75 and abs(y + 2.1) < 0.4: continue      # keep the plaque clear
            if math.hypot(x + 1.1, y + 2.35) < 0.6: continue              # and the lantern
            break
        z = max(0.0, mound(x, y)) - (0.03 if e < 0.95 else 0.0)
        _tile(cz, f'{name}_tile{i}', (x, y, z), rnd.uniform(0, 360), tile, root,
              tilt=(rnd.uniform(-8, 8), rnd.uniform(-10, 10) + (20 if e < 0.95 else 0)), broken=(i % 4 == 3))
    for i in range(34):
        th = rnd.uniform(0, 2 * math.pi); e = math.sqrt(rnd.uniform(0.04, 1.0)) * 1.2
        x, y = e * MA * math.cos(th), e * MB * math.sin(th)
        if math.hypot(x + 1.1, y + 2.35) < 0.6 or (abs(x - 0.95) < 0.7 and abs(y + 2.1) < 0.35): continue
        s = rnd.uniform(0.1, 0.24)
        if i % 3 == 0:
            cz.box(f'{name}_brick{i}', (0.26, 0.13, 0.075), (x, y, max(0.0, mound(x, y)) + 0.02), brick,
                   rot=(rnd.uniform(-10, 10), rnd.uniform(-15, 15), rnd.uniform(0, 180)), bevel=0.008, ol=0.005, parent=root)
        else:
            _rock(cz, f'{name}_stone{i}', (x, y, max(0.0, mound(x, y)) - s * 0.25), (s * 1.2, s, s * 0.8), stone, root, rnd,
                  rot_z=rnd.uniform(0, 180))

    if lantern:
        _lantern(cz, name, (-1.1, -2.35, 0.25), (0, 84, 28), root, rnd)
    if dust:
        # low, wide, dusty-beige (white puffs read as cotton / sheep), hugging the foot of the heap
        # small round puffs hanging just above the ground in loose clusters (puffs lying ON the ground read as cream)
        dm = cz.toon(name + '_dust', '#cfc3a8', tex='grain', tex_strength=0.04)
        for i, (x, y, z, rx) in enumerate(((-3.0, -0.9, 0.22, 0.3), (3.05, -0.4, 0.3, 0.34), (-0.4, -2.1, 0.16, 0.24),
                                           (2.05, -1.8, 0.2, 0.26), (-2.3, 1.55, 0.35, 0.3), (0.6, 0.15, 1.95, 0.28))):
            pv = cz.empty(f'{name}_dust{i}', (x, y, z), parent=root)
            _puff(cz, f'{name}_dust{i}_a', rx, rx * 0.62, dm, pv, rnd, loc=(0, 0, -rx * 0.2))
            _puff(cz, f'{name}_dust{i}_b', rx * 0.62, rx * 0.45, dm, pv, rnd, loc=(rx * 0.85, -0.06, -rx * 0.35))
            _puff(cz, f'{name}_dust{i}_c', rx * 0.5, rx * 0.36, dm, pv, rnd, loc=(-rx * 0.9, 0.05, -rx * 0.1))
    return root
