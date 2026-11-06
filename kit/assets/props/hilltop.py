# Hilltop: a grassy hill-top terrain piece for the night / dawn hill scenes - a gentle rounded mound with a flat top
# (where the inventor's bronze jar and his hut stand), a worn dirt path winding up the -Y side to the top, a few
# chunky rocks, flat stepping stones on the steep part of the path, grass tufts as single spiky clumps, a few wild
# flowers. The ground colour (path, worn patches, painted mottles) is one top-down PNG (tex/make_hilltop.py).
#
# Floor prop: the root is at the floor centre under the hilltop (z = 0 = the foot of the hill / the surrounding
# ground). The flat top is at z = TOP = 1.5 m (radius ~2.6 m): stand the jar on <name>_jar_spot and the hut on
# <name>_hut_spot (empties on the top, z = 1.5), or parent anything to <name>_top. The piece is ~11.5 m across; its
# rim dips 3 cm below z = 0, so a ground plane at z = 0 hides the edge. Walkers: height(x, y) (pure python, root-local)
# gives the ground z anywhere, PATH the path's centre line from the foot (-Y) to the top (use
# cz._PROPS['hilltop'].height after cz.prop('hilltop', ...)).
# Animate: <name>_tuft<i> rotation (grass sway, pivot at the tuft's base).
import math, random

TOP = 1.5                       # height of the flat top
R0 = 2.6                        # flat top radius (mean)
R1 = 5.3                        # foot of the slope (mean)
RE = 5.75                       # rim of the piece
E = 5.9                         # half extent of the ground texture (metres)
JAR = (-1.0, -0.75)             # jar spot (front left of the top)
HUT = (1.05, 0.85)              # hut spot (back right: a 2.5 x 2.0 m hut centred here, door toward -Y)
PW = 0.42                       # path half width
# path centre line, foot (-Y) -> top; Catmull-Rom smoothed in path_points()
PATH_CTRL = [(2.2, -6.3), (1.7, -5.3), (0.6, -4.4), (-0.6, -3.7), (-1.15, -2.9), (-1.1, -2.1), (-1.0, -1.5)]

META = {'size': (11.5, 11.5, 1.8), 'anchor': 'floor centre under the hilltop (z = 0 = foot of the hill); flat top at '
        'z = 1.5 (TOP), radius ~2.6; empties <name>_top, <name>_jar_spot (-1.0, -0.75, 1.5), <name>_hut_spot '
        '(1.05, 0.85, 1.5); rim at radius 5.75 dips to z = -0.03',
        'animate': ['_tuft<i> (rotation: sway, pivot at the base)'],
        'params': 'night=False (dark cool grass, tufts, rocks), tufts=28, flowers=True, stones=True (stepping stones '
                  'on the path), seed=5',
        'helpers': 'height(x, y) -> ground z (root-local); PATH = path centre points foot -> top'}


def _cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return tuple(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
                 for a, b, c, d in zip(p0, p1, p2, p3))


def path_points(step=0.1):
    P = [PATH_CTRL[0]] + PATH_CTRL + [PATH_CTRL[-1]]
    out = []
    for i in range(1, len(P) - 2):
        n = max(2, int(math.dist(P[i], P[i + 1]) / step))
        for k in range(n):
            out.append(_cr(P[i - 1], P[i], P[i + 1], P[i + 2], k / n))
    out.append(PATH_CTRL[-1])
    return out


PATH = path_points()


def path_dist(x, y):
    """Distance from (x, y) to the path centre line, and the index of the nearest sample."""
    best, bi = 1e9, 0
    for i in range(len(PATH) - 1):
        ax, ay = PATH[i]; bx, by = PATH[i + 1]
        dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy
        k = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - ax) * dx + (y - ay) * dy) / L2))
        d = math.hypot(x - ax - k * dx, y - ay - k * dy)
        if d < best: best, bi = d, i
    return best, bi


def radii(th):
    r0 = R0 + 0.1 * math.sin(2 * th + 1.3)
    r1 = R1 + 0.18 * math.sin(2 * th + 0.7) + 0.1 * math.sin(3 * th + 2.1)
    return r0, r1


def height(x, y, wear=True):
    """Ground height (root-local) at x, y."""
    rho = math.hypot(x, y); th = math.atan2(y, x)
    r0, r1 = radii(th)
    if rho <= r0:
        z = TOP
    elif rho < r1:
        u = (rho - r0) / (r1 - r0)
        z = TOP * (1 + math.cos(math.pi * u)) / 2
        z += 0.08 * math.sin(math.pi * u) * (math.sin(4 * th + 0.5) + 0.6 * math.sin(7 * th + 1.9)) * min(1.0, u * 3)
    else:
        z = -0.03 * min(1.0, (rho - r1) / max(0.05, RE - r1))
    if wear and rho > r0 - 0.4:   # the path is worn a few cm into the slope (only painted on the flat top)
        d, _ = path_dist(x, y)
        if d < PW:
            z -= 0.035 * (1 - (d / PW) ** 2) * min(1.0, (rho - r0 + 0.4) / 0.4)
    return z


# ---------------------------------------------------------------- mesh helpers (deformed cz primitives)
def _prism(cz, name, pts, depth, mat, loc=(0, 0, 0), rot=(0, 0, 0), ol=0.006, parent=None):
    """Extrude a 2-D outline (local XY, may be concave) along local +Z: a cz.cyl with its rings moved onto it."""
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    if area < 0: pts = pts[::-1]
    n = len(pts)
    o = cz.cyl(name, 1.0, depth, loc, mat, rot=rot, verts=n, ol=ol, parent=parent)
    vs = o.data.vertices
    a0 = math.atan2(vs[0].co.y, vs[0].co.x); step = 2 * math.pi / n
    for v in vs:
        k = int(round(((math.atan2(v.co.y, v.co.x) - a0) % (2 * math.pi)) / step)) % n
        v.co.x, v.co.y = pts[k]
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def _terrain(cz, name, root, mat, R_out, ol, segs=144, rings=72, bottom=-0.03):
    """A UV sphere flattened into a round heightfield disc: the top hemisphere -> the ground (radius R_out, heights from
    height()), the bottom hemisphere -> a flat underside. UVs = top-down projection over +-E."""
    o = cz.sphere(name, 1.0, (0, 0, 0), mat, ol=ol, parent=root, segs=segs, rings=rings)
    me = o.data
    half = math.pi / 2
    for v in me.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        if phi <= half + 1e-6:
            rho = R_out * phi / half; px, py = rho * math.cos(th), rho * math.sin(th)
            v.co = (px, py, height(px, py))
        else:
            rho = R_out * (math.pi - phi) / half
            v.co = (rho * math.cos(th), rho * math.sin(th), bottom)
    uvl = me.uv_layers.new(name='UVMap')
    lv = [0] * len(me.loops); me.loops.foreach_get('vertex_index', lv)
    co = [0.0] * (3 * len(me.vertices)); me.vertices.foreach_get('co', co)
    uv = []
    for vi in lv:
        uv += [(co[3 * vi] + E) / (2 * E), (co[3 * vi + 1] + E) / (2 * E)]
    uvl.data.foreach_set('uv', uv)
    me.update()
    return o


def _rock(cz, name, loc, size, mat, parent, rnd, flat=0.6, ol=0.008, rot_z=0.0):
    """Chunky faceted rock: a low-poly sphere with jittered radii, scale baked into the mesh, flat bottom, flat shaded."""
    sx, sy, sz = size
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=9, rings=6)
    a = math.radians(rot_z)
    for v in o.data.vertices:
        x, y, z = v.co
        k = 0.82 + 0.3 * rnd.random()
        x, y, z = x * k * sx, y * k * sy, max(max(z, -flat) * k * sz, -0.02 - loc[2])   # never below the ground plane
        v.co = (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a), z)
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    o.data.update()
    return o


def _tuft(cz, name, loc, h, r, mat, parent, rnd, k=5):
    """Grass clump as ONE spiky mesh (one clean outline): a sphere pulled up into k pointed blades leaning out."""
    o = cz.sphere(name, 1.0, loc, mat, ol=0.004, parent=parent, segs=k * 6, rings=8)
    ph = rnd.uniform(0, 6.28); hs = [rnd.uniform(0.7, 1.0) for _ in range(k)]
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        u = 1 - phi / math.pi                       # 0 bottom .. 1 top
        a = (k * th + ph) / (2 * math.pi)
        blade = int(math.floor(a + 0.5)) % k
        s = (0.5 + 0.5 * math.cos(k * th + ph)) ** 2.5
        H = h * (0.28 + 0.72 * s * hs[blade])
        if phi < 1e-4:     # top pole: the clump's centre, low
            v.co = (0, 0, h * 0.3); continue
        if phi > math.pi - 1e-4:
            v.co = (0, 0, 0); continue
        rad = r * (0.4 + u * (0.15 + 0.7 * s))
        v.co = (math.cos(th) * rad, math.sin(th) * rad, H * u ** 0.9)
    o.data.update()
    return o


# ---------------------------------------------------------------- build
def build(cz, name='hilltop', night=False, tufts=28, flowers=True, stones=True, seed=5):
    rnd = random.Random(seed)
    root = cz.empty(name)
    tod = 'night' if night else 'day'
    gm = cz.toon(f'{name}_ground_{tod}', img=f'assets/props/tex/hilltop_ground_{tod}.png', lift=0.62)
    _terrain(cz, name + '_ground', root, gm, RE, ol=0.012)
    top = cz.empty(name + '_top', (0, 0, TOP), parent=root)
    cz.empty(name + '_jar_spot', (JAR[0], JAR[1], TOP), parent=root, size=0.3)
    cz.empty(name + '_hut_spot', (HUT[0], HUT[1], TOP), parent=root, size=0.3)

    C = dict(day=dict(rock='#8b8476', rock2='#7d7a70', stone='#a39a86', tuft='#3c7a34', tuft2='#4a8a3a',
                      fl=['#f0e8d4', '#f2c84b', '#e98aa2'], flc='#e0a23a'),
             night=dict(rock='#5d6370', rock2='#555b68', stone='#6f7280', tuft='#1f4a45', tuft2='#265349',
                        fl=['#b9c0d8', '#b7ac7c', '#a58aa6'], flc='#8c7a4e'))[tod]
    rockm = cz.toon(f'{name}_rock_{tod}', C['rock'], tex='grain', tex_scale=1.5, tex_strength=0.06)
    rock2 = cz.toon(f'{name}_rock2_{tod}', C['rock2'], tex='grain', tex_scale=1.5, tex_strength=0.06)

    def on_ground(x, y, sink):
        return (x, y, height(x, y) - sink)

    # ---- rocks: chunky, partly sunk, at the slopes and the rim of the top (none on the path or the spots)
    rocks = [(2.25, -4.75, 0.42, 0.34, 0.3, 20), (2.75, -4.35, 0.2, 0.18, 0.16, 70), (-2.0, -3.1, 0.34, 0.28, 0.24, -30),
             (0.55, -3.0, 0.16, 0.13, 0.11, 10), (-3.7, 1.3, 0.55, 0.42, 0.38, 40), (-3.25, 1.95, 0.26, 0.22, 0.2, -10),
             (3.5, -1.55, 0.36, 0.3, 0.26, 15), (-2.55, -1.15, 0.24, 0.2, 0.16, 60), (2.9, 2.75, 0.44, 0.36, 0.3, -25),
             (-0.4, 3.9, 0.3, 0.26, 0.22, 5)]
    for i, (x, y, a, b, c, rz) in enumerate(rocks):
        _rock(cz, f'{name}_rock{i}', on_ground(x, y, c * 0.35), (a, b, c), rockm if i % 3 else rock2, root, rnd,
              rot_z=rz, ol=0.008 if a > 0.25 else 0.006)
    # ---- stepping stones on the steep middle of the path (flat slabs a few cm proud of the worn dirt)
    if stones:
        stm = cz.toon(f'{name}_stone_{tod}', C['stone'], tex='grain', tex_strength=0.05)
        for j, fi in enumerate((0.34, 0.43, 0.52, 0.61)):
            px, py = PATH[int(fi * (len(PATH) - 1))]
            px += rnd.uniform(-0.08, 0.08)
            _rock(cz, f'{name}_stone{j}', on_ground(px, py, 0.02), (0.24, 0.17, 0.07), stm, root, rnd, flat=0.2, ol=0.005,
                  rot_z=rnd.uniform(0, 180))

    # ---- grass tufts (not on the path, the spots or the rocks)
    tm = [cz.toon(f'{name}_tuft_{tod}', C['tuft'], tex='grain', tex_strength=0.05),
          cz.toon(f'{name}_tuft2_{tod}', C['tuft2'], tex='grain', tex_strength=0.05)]

    def free(x, y, margin):
        if math.hypot(x, y) > RE - 0.35: return False
        if path_dist(x, y)[0] < PW + margin: return False
        if math.hypot(x - JAR[0], y - JAR[1]) < 0.95: return False
        if abs(x - HUT[0]) < 1.45 and abs(y - HUT[1]) < 1.3: return False
        for (rx, ry, a, b, c, rz) in rocks:
            if math.hypot(x - rx, y - ry) < max(a, b) + 0.12: return False
        return True

    spots, tries = [], 0
    while len(spots) < tufts and tries < 4000:
        tries += 1
        rho = math.sqrt(rnd.uniform(0.04, 1.0)) * (RE - 0.4); th = rnd.uniform(0, 2 * math.pi)
        x, y = rho * math.cos(th), rho * math.sin(th)
        if not free(x, y, 0.12) or any(math.hypot(x - a, y - b) < 0.55 for a, b, *_ in spots): continue
        spots.append((x, y))
    for i, (x, y) in enumerate(spots):
        h = rnd.uniform(0.22, 0.36); r = rnd.uniform(0.08, 0.12)
        pv = cz.empty(f'{name}_tuft{i}', on_ground(x, y, 0.03), parent=root)
        pv.rotation_euler = (0, 0, rnd.uniform(0, 6.28))
        _tuft(cz, f'{name}_tuft{i}_m', (0, 0, 0), h, r, tm[i % 2], pv, rnd, k=rnd.choice((4, 5, 5, 6)))
        if flowers and i % 5 == 1:   # a few wild flowers on the clumps: flat five-petal heads with a centre
            # (round balls read as mushrooms at night)
            c = C['fl'][(i // 5) % 3]
            fm = cz.toon(f'{name}_flower_{c[1:]}', c, tex='grain', tex_strength=0.03)
            cm = cz.toon(f'{name}_flowerc_{tod}', C['flc'])
            for j in range(2):
                a = rnd.uniform(0, 6.28); d = r * 0.45
                fp = cz.empty(f'{name}_tuft{i}_fl{j}', (math.cos(a) * d, math.sin(a) * d, h * (0.62 + 0.18 * j)), parent=pv)
                fp.rotation_euler = (math.radians(rnd.uniform(-25, 25)), math.radians(rnd.uniform(-25, 25)), rnd.uniform(0, 6.28))
                rf = 0.05
                pts = [(rf * (0.42 + 0.58 * abs(math.cos(2.5 * t))) * math.cos(t), rf * (0.42 + 0.58 * abs(math.cos(2.5 * t))) * math.sin(t))
                       for t in [k / 30 * 2 * math.pi for k in range(30)]]
                _prism(cz, f'{name}_tuft{i}_fl{j}_m', pts, 0.012, fm, ol=0.003, parent=fp)
                cz.sphere(f'{name}_tuft{i}_fl{j}_c', 0.016, (0, 0, 0.012), cm, ol=0.0, parent=fp, segs=10, rings=6)
    return root
