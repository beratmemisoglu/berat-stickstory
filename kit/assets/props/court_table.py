# Low court table (1.0 x 0.5 x 0.4 m): red lacquer top whose two ends sweep up (everted ends, gold caps), a dark waist,
# four aprons (gold bead on the front / back, a gold medallion in the middle), four legs on gold hoof feet. On it:
#  - a three-legged bronze wine cup on its own pivot <name>_cup (hollow: a real inner wall, a teal patina band, two
#    capped posts on the rim, a ring handle on +X) with the wine surface <name>_wine (a polar grid: 8 rings x 32, so a
#    Wave modifier or vertex keys can ripple it; its little shine card rides on it),
#  - a celadon wine jug (pear body, spout to the front-left, handle at the back, bronze lid),
#  - a white dish with three peaches (the charm detail).
# Floor prop: root = floor centre, long side along X, front -Y.
# Picking the cup up: cup = cz.find(name + '_cup'); keep its world matrix, clear its parent, then char.hold(cup, 'R', ...).
import math, bmesh
from mathutils import Vector

TOP = 0.40
CUP_AT = (0.2, -0.08)

META = {'size': (1.02, 0.52, 0.66), 'anchor': 'floor centre, front -Y', 'top': TOP,
        'animate': ['_cup (the whole wine cup: pick it up / tip it)', '_wine (wine surface: ripple, scale z / level)'],
        'cup': {'at': (CUP_AT[0], CUP_AT[1], TOP), 'height': 0.14, 'rim_r': 0.054},
        'params': "cup=True, wine=1.0 (fill 0..1; 0 = empty), jug=True, peaches=True, lacquer='#9a221c'"}


# ---------------------------------------------------------------- mesh helpers
def _lathe(cz, name, prof, mat, parent, loc=(0, 0, 0), segs=40, ol=0.003, closed=False, smooth=True):
    """Surface of revolution of (r, z) pairs; r = 0 at an end makes a pole (pointed / rounded tip), other open ends
    get a flat cap; closed=True treats the profile as a loop (rings, tori)."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r <= 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z))
                            for i in range(segs)])
    pairs = list(zip(rings, rings[1:])) + ([(rings[-1], rings[0])] if closed else [])
    for ra, rb in pairs:
        for i in range(segs):
            j = (i + 1) % segs
            if len(ra) == 1: bm.faces.new((ra[0], rb[j], rb[i]))
            elif len(rb) == 1: bm.faces.new((ra[i], ra[j], rb[0]))
            else: bm.faces.new((ra[i], ra[j], rb[j], rb[i]))
    if not closed:
        if len(rings[0]) > 1: bm.faces.new(rings[0][::-1])
        if len(rings[-1]) > 1: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=smooth), loc, (0, 0, 0), None, parent, ol, 0.0)


def _torus(cz, name, r0, rt, loc, mat, parent, rot=(90, 0, 0), ol=0.002):
    o = _lathe(cz, name, [(r0 + rt * math.cos(2 * math.pi * i / 12), rt * math.sin(2 * math.pi * i / 12)) for i in range(12)],
               mat, parent, loc, segs=24, ol=ol, closed=True)
    o.rotation_euler = [math.radians(a) for a in rot]
    return o


def _hslab(cz, name, xs, ztop, zbot, depth, mat, parent, ol=0.008, bevel=0.01):
    """A slab along X whose top follows ztop(x) (bottom flat at zbot), depth along Y, built from quads."""
    bm = bmesh.new(); F, B = [], []
    for x in xs:
        zt = ztop(x)
        F.append((bm.verts.new((x, -depth / 2, zbot)), bm.verts.new((x, -depth / 2, zt))))
        B.append((bm.verts.new((x, depth / 2, zbot)), bm.verts.new((x, depth / 2, zt))))
    for i in range(len(xs) - 1):
        bm.faces.new((F[i][0], F[i + 1][0], F[i + 1][1], F[i][1]))
        bm.faces.new((B[i][0], B[i][1], B[i + 1][1], B[i + 1][0]))
        bm.faces.new((F[i][1], F[i + 1][1], B[i + 1][1], B[i][1]))
        bm.faces.new((F[i][0], B[i][0], B[i + 1][0], F[i + 1][0]))
    for i in (0, len(xs) - 1):
        bm.faces.new((F[i][0], F[i][1], B[i][1], B[i][0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, bevel)


def _disc_grid(cz, name, r, z, mat, parent, rings=8, segs=32):
    """Flat polar grid disc facing +Z (for ripples)."""
    bm = bmesh.new(); c = bm.verts.new((0, 0, z)); prev = None
    for k in range(1, rings + 1):
        rr = r * k / rings
        ring = [bm.verts.new((rr * math.cos(2 * math.pi * i / segs), rr * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)]
        for i in range(segs):
            j = (i + 1) % segs
            if prev is None: bm.faces.new((c, ring[i], ring[j]))
            else: bm.faces.new((prev[i], ring[i], ring[j], prev[j]))
        prev = ring
    for f in bm.faces:
        if f.normal.z < 0: f.normal_flip()
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, 0.0, 0.0)


def _seg(cz, nm, a, b, r, mat, parent, ol):
    """Capsule between points a and b (ball centres)."""
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.capsule(nm, r, d.length + 2 * r, tuple(a - d.normalized() * r), mat, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def _interp(prof, z):
    for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
        if min(z0, z1) <= z <= max(z0, z1) and z0 != z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return prof[-1][0]


# ---------------------------------------------------------------- parts
def _cup(cz, name, root, wine):
    pv = cz.empty(name + '_cup', (CUP_AT[0], CUP_AT[1], TOP), parent=root)
    bronze = cz.toon(name + '_bronze', '#8f5e2c', tex='grain', tex_scale=4.0, tex_strength=0.06)
    patina = cz.toon(name + '_patina', '#3f8a78', tex='grain', tex_scale=4.0, tex_strength=0.06)
    for i in range(3):        # three pointed legs splaying out
        a = math.radians(90 + 120 * i)
        top = (0.02 * math.cos(a), 0.02 * math.sin(a), 0.042); tip = (0.034 * math.cos(a), 0.034 * math.sin(a), 0.002)
        d = Vector(top) - Vector(tip)
        o = cz.cyl(f'{name}_cupleg{i}', 0.0035, d.length, tip, bronze, r2=0.0105, verts=12, ol=0.0022, parent=pv)
        o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    outer = [(0.001, 0.036), (0.026, 0.038), (0.036, 0.048), (0.038, 0.06), (0.038, 0.088), (0.046, 0.106), (0.054, 0.118)]
    inner = [(0.048, 0.116), (0.040, 0.103), (0.033, 0.087), (0.033, 0.062), (0.026, 0.052), (0.001, 0.05)]
    _lathe(cz, name + '_cupbody', outer + [(0.0515, 0.121)] + inner, bronze, pv, segs=40, ol=0.0028)
    cz.cyl(name + '_cupband', 0.0393, 0.016, (0, 0, 0.066), patina, verts=40, ol=0.0, parent=pv)
    for k, a in enumerate((60, 120)):           # two capped posts on the rim (toward the back)
        x, y = 0.05 * math.cos(math.radians(a)), 0.05 * math.sin(math.radians(a))
        cz.cyl(f'{name}_cuppost{k}', 0.0042, 0.022, (x, y, 0.114), bronze, verts=10, ol=0.0018, parent=pv)
        cz.sphere(f'{name}_cupcap{k}', 0.0085, (x, y, 0.139), bronze, ol=0.0018, parent=pv, segs=14, rings=8)
    _torus(cz, name + '_cuphandle', 0.015, 0.0048, (0.051, 0, 0.074), bronze, pv, rot=(90, 0, 0), ol=0.0018)
    if wine > 0:
        zw = 0.062 + (0.106 - 0.062) * max(0.0, min(1.0, float(wine)))
        rw = _interp(inner[::-1], zw) - 0.0008
        wm = cz.toon(name + '_winem', '#6b1a2a', lift=0.7)
        w = _disc_grid(cz, name + '_wine', rw, 0.0, wm, pv)
        w.location = (0, 0, zw)
        cz.cyl(name + '_wineshine', rw * 0.28, 0.0006, (-rw * 0.35, -rw * 0.3, 0.0012), cz.toon(name + '_shinem', '#c98494', lift=0.8),
               verts=20, ol=0.0, parent=w)
    return pv


def _jug(cz, name, root, loc):
    pv = cz.empty(name + '_jug', loc, parent=root)
    cel = cz.toon(name + '_celadon', '#86b39c', tex='grain', tex_scale=3.0, tex_strength=0.04)
    bronze = cz.toon(name + '_lidm', '#8f5e2c', tex='grain', tex_scale=4.0, tex_strength=0.06)
    prof = [(0.042, 0.0), (0.048, 0.004), (0.046, 0.014), (0.062, 0.04), (0.075, 0.075), (0.074, 0.108), (0.06, 0.138),
            (0.034, 0.163), (0.027, 0.182), (0.027, 0.198), (0.035, 0.208), (0.034, 0.214)]
    _lathe(cz, name + '_jugbody', prof, cel, pv, segs=40, ol=0.0035)
    _lathe(cz, name + '_juglid', [(0.031, 0.212), (0.03, 0.222), (0.016, 0.232), (0.006, 0.236)], bronze, pv, segs=32, ol=0.0025)
    cz.sphere(name + '_jugknob', 0.011, (0, 0, 0.245), bronze, ol=0.002, parent=pv, segs=16, rings=8)
    # spout to the front-left, handle at the back-right
    a = math.radians(-135)
    base = Vector((0.058 * math.cos(a), 0.058 * math.sin(a), 0.1))
    d = Vector((math.cos(a) * 0.62, math.sin(a) * 0.62, 0.78)).normalized()
    sp = cz.cyl(name + '_jugspout', 0.013, 0.1, tuple(base - d * 0.01), cel, r2=0.008, verts=16, ol=0.0025, parent=pv)
    sp.rotation_euler = Vector((0, 0, 1)).rotation_difference(d).to_euler()
    ah = math.radians(45)
    pts = []
    for k in range(7):            # neck (r 0.03, z 0.19) -> out 0.1 -> shoulder (r 0.065, z 0.10), ends sunk in
        t = k / 6
        z = 0.19 - 0.09 * t
        rr = (0.03 if k == 0 else 0.065 if k == 6 else 0.072 + 0.035 * math.sin(math.pi * t))
        pts.append((rr * math.cos(ah), rr * math.sin(ah), z))
    for k in range(6):
        _seg(cz, f'{name}_jughandle{k}', pts[k], pts[k + 1], 0.0075, cel, pv, 0.0025)
    return pv


def _peaches(cz, name, root, loc):
    pv = cz.empty(name + '_dish', loc, parent=root)
    por = cz.toon(name + '_porcelain', '#ece4d2', tex='grain', tex_scale=3.0, tex_strength=0.03)
    _lathe(cz, name + '_dishbody', [(0.035, 0.0), (0.04, 0.004), (0.074, 0.012), (0.086, 0.022), (0.08, 0.025),
                                    (0.068, 0.017), (0.0, 0.013)], por, pv, segs=40, ol=0.003)
    cz.cyl(name + '_dishrim', 0.0872, 0.004, (0, 0, 0.0185), cz.toon(name + '_dishblue', '#3d5f9a'), verts=40, ol=0.0, parent=pv)
    pm = cz.toon(name + '_peachm', '#ee9472', tex='grain', tex_scale=5.0, tex_strength=0.05)
    lm = cz.toon(name + '_leafm', '#4f8a3c')
    for k, (x, y, z, yaw) in enumerate(((-0.026, -0.008, 0.038, 20), (0.026, -0.012, 0.038, -30), (0.0, 0.018, 0.074, 70))):
        R = 0.027
        prof = [(0.0, -R)] + [(R * math.sin(math.pi * j / 10) * (1 - 0.12 * (j / 10) ** 3), -R * math.cos(math.pi * j / 10)
                               + (0.006 * (j / 10) ** 4)) for j in range(1, 10)] + [(0.0, R + 0.008)]
        _lathe(cz, f'{name}_peach{k}', prof, pm, pv, loc=(x, y, z), segs=24, ol=0.0028)
        lf = cz.box(f'{name}_leaf{k}', (0.03, 0.012, 0.003), (x + 0.012 * math.cos(math.radians(yaw)), y + 0.012 * math.sin(math.radians(yaw)),
                    z + R + 0.004), lm, rot=(0, -20, yaw), bevel=0.0014, ol=0.0, parent=pv)
    return pv


# ---------------------------------------------------------------- build
def build(cz, name='court_table', cup=True, wine=1.0, jug=True, peaches=True, lacquer='#9a221c'):
    root = cz.empty(name)
    red = cz.toon(name + '_lacquer', lacquer, tex='grain', tex_strength=0.035)
    waist = cz.toon(name + '_waist', '#5e1714', tex='grain', tex_strength=0.03)
    gold = cz.toon(name + '_gold', '#c99a2e', tex='grain', tex_scale=2.0, tex_strength=0.05)
    W, D = 1.0, 0.5
    # top with swept-up ends
    xs = [-0.5 + 0.1 * j / 8 for j in range(8)] + [-0.4 + 0.8 * j / 8 for j in range(9)] + [0.4 + 0.1 * j / 8 for j in range(1, 9)]
    ztop = lambda x: TOP + (0.045 * ((abs(x) - 0.4) / 0.1) ** 2.2 if abs(x) > 0.4 else 0.0)
    _hslab(cz, name + '_top', xs, ztop, TOP - 0.05, D, red, root, ol=0.008, bevel=0.008)
    for sx in (-1, 1):       # gold caps on the upturned tips
        cz.box(f'{name}_tip{"LR"[sx > 0]}', (0.022, D + 0.006, 0.026), (sx * 0.492, 0, TOP + 0.036), gold, rot=(0, -sx * 30, 0),
               bevel=0.005, ol=0.003, parent=root)
    cz.box(name + '_waist', (W - 0.1, D - 0.07, 0.025), (0, 0, TOP - 0.05 - 0.0125), waist, bevel=0.004, ol=0.004, parent=root)
    # aprons
    za0, za1 = 0.25, TOP - 0.075
    for sy in (-1, 1):
        cz.box(f'{name}_apron{"FB"[sy > 0]}', (0.86, 0.03, za1 - za0), (0, sy * 0.185, (za0 + za1) / 2), red, bevel=0.008,
               ol=0.006, parent=root)
        cz.box(f'{name}_bead{"FB"[sy > 0]}', (0.82, 0.006, 0.014), (0, sy * 0.2028, za0 + 0.014), gold, bevel=0.002, ol=0.0,
               parent=root)
        cz.cyl(f'{name}_medal{"FB"[sy > 0]}', 0.03, 0.008, (0, sy * 0.2, (za0 + za1) / 2 + 0.006), gold, rot=(sy * -90, 0, 0),
               verts=24, bevel=0.003, ol=0.003, parent=root, origin='center')
    for sx in (-1, 1):
        cz.box(f'{name}_apron{"LR"[sx > 0]}', (0.03, 0.34, za1 - za0), (sx * 0.415, 0, (za0 + za1) / 2), red, bevel=0.008,
               ol=0.006, parent=root)
    # legs on gold hoof feet (feet turn inward a little)
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        x, y = sx * 0.4, sy * 0.175
        cz.box(f'{name}_leg{i}', (0.06, 0.06, za1 - 0.03), (x, y, 0.03 + (za1 - 0.03) / 2), red, bevel=0.01, ol=0.006, parent=root)
        cz.box(f'{name}_hoof{i}', (0.078, 0.078, 0.035), (x - sx * 0.008, y - sy * 0.004, 0.0175), gold, bevel=0.012, ol=0.004,
               parent=root)
    if cup: _cup(cz, name, root, wine)
    if jug: _jug(cz, name, root, (-0.28, 0.07, TOP))
    if peaches: _peaches(cz, name, root, (0.02, 0.12, TOP))
    return root
