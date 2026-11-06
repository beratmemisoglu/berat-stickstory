# Seismo jar (hero prop): an ancient Chinese earthquake detector as a chunky cartoon bronze. A fat wine-jar body on a
# round dais and a two-step octagonal base, a domed lid with a bud knob, cast bands (a belly frieze of auspicious
# clouds, a "thunder" key-fret band, raised rings, an engraved line), warm bronze with green patina in the recesses.
# Eight friendly-menacing dragons cling to the shoulder (S-curved bodies hugging the jar, horns, whiskers, a patina
# mane and spines), heads pitched down-outward, each holding a gold ball in its jaws over a squat bronze frog that sits
# on the base with its mouth gaping up. Inside: a heavy pendulum hanging from the lid, eight tilting radial rods on
# posts, a pushrod per rod up to a crank on each dragon's lower jaw (rod tilts -> pushrod -> crank -> jaw opens).
# Bagua trigrams (Fu Xi order, front = south = Qian) are cast on the base riser in front of each frog.
# Prints: tex/make_seismo_jar.py (seismo_jar_clouds.png, seismo_jar_fret.png).
#
# Sectors: i = 0..7, 0 = front (-Y), counter-clockwise seen from above (i = 2 is +X, 4 is +Y, 6 is -X).
# Animate (all rotations in radians, pivots already at their hinges):
#   <name>_jaw<i>       rotation_euler.x: 0 closed .. +JAW_OPEN deg open (the lower jaw swings down toward the jar)
#   <name>_rod<i>       rotation_euler.x: 0 rest .. negative = the outer end rises (seesaw on its post); the pushrod
#                       <name>_link<i> follows by itself (stretch-to constraint onto the crank pin <name>_pin<i>).
#                       open_angles(k) -> (jaw, rod) angles that keep rod, pushrod and crank in step;
#                       set_open(root, i, k) poses both. The jaw reads best from the side or a low 3/4 (it swings
#                       toward the jar); from straight in front the falling ball carries the moment.
#   <name>_ball<i>      location (root-local, the ball's parent is the root): BALL_START[i] in the mouth -> BALL_END[i]
#                       resting in the frog's mouth, a straight vertical drop. ball_path(root, i) -> world (start, end).
#   <name>_pendulum     rotation_euler x / y = swing (pivot at the lid's centre); pendulum_rot(i, deg) -> (rx, ry)
#                       tilts the bob toward sector i (the spike under the bob knocks rod i's tab at ~4.5 deg).
# kw: jaws=0..1 (float or 8 floats), drop=0..1 (float or 8: ball position along its drop path), swing=(i, deg),
#     cutaway=False|True (removes the wedge cut=-112.5 deg +-45 of the shell and lid, i.e. the front-left quarter
#     between dragon 6 and dragon 1; dragons 7 and 0 with their balls / pushrods / cranks go with it, all 8 frogs,
#     rods and posts stay; cut faces in bright raw bronze), patina=0..1 (default 0.35, greener), trigrams=True.
# Floor prop: root at the floor centre under the jar axis.
import math
from mathutils import Vector, Matrix

META = {'size': (2.14, 2.14, 1.88), 'anchor': 'floor centre (jar axis); base octagon 1.98 across flats / 2.14 across corners, '
                                               'jar body 1.19 wide (dragon ring ~1.6), lip at 1.455, lid knob top 1.88; '
                                               'ball drop 0.79 -> 0.41 m on the radius 0.73 line under each dragon',
        'animate': ['_jaw0..7', '_rod0..7', '_ball0..7', '_pendulum', '(_link0..7 follow)'],
        'params': 'jaws=0..1|[8], drop=0..1|[8], swing=(i, deg), cutaway=False, cut=-112.5 (deg, wedge centre), patina=0.35, '
                  'trigrams=True; helpers ball_path(root, i), set_open(root, i, k), open_angles(k), pendulum_rot(i, deg), '
                  'BALL_START / BALL_END (root-local)'}

TEX = 'assets/props/tex/'
BRONZE, PATINA = '#b07a3a', '#5f8f72'

# ---- layout (metres)
STEP_Z = (0.075, 0.15)          # tops of the two octagonal steps
STEP_R = (1.07, 0.995)          # their circumradius
DAIS_R, DAIS_Z = 0.48, 0.18     # round dais under the jar foot
ZB = 0.178                      # jar bottom (2 mm into the dais)
FZ = 0.24                       # inner floor of the jar
T_WALL = 0.035
CLOUD = (0.50, 0.74)            # belly frieze
FRET = (0.325, 0.395)           # key-fret band
GROOVE = 0.86                   # engraved line under the dragons
RIDGES = (0.316, 0.404, 0.492, 0.748)
BODY = [(0.27, 0.425), (0.36, 0.50), (0.48, 0.555), (0.62, 0.585), (0.76, 0.585), (0.90, 0.57), (1.02, 0.545),
        (1.14, 0.51), (1.25, 0.47), (1.33, 0.435), (1.38, 0.415), (1.40, 0.41)]
LID_Z, LID_H, LID_R = 1.515, 0.19, 0.45     # dome base height, dome rise, dome radius
FLANGE = (1.468, 1.503)                      # lid flange face (fret band)
# dragons
A_HEAD = 50.0                   # head pitch: snout down-outward
HEAD_S = 1.2                    # head scale (head parts are modelled in head units)
JAW_OPEN = 28.0                 # jaw angle at jaws=1 (deg); more and the jaw dips into the belly
R_DROP = 0.73                   # radius of the ball's vertical drop line
Z_HEAD = 1.02
BALL_R = 0.058
BALL_H = (0.0, -0.2, -0.05)     # ball centre in head coordinates (forward -Y, up +Z)
HINGE_H = (0.0, -0.045, -0.045) # lower-jaw hinge in head coordinates (under the snout root)
# mechanism
PIVOT_Z = 1.57                  # pendulum pivot under the lid
BOB_Z = (0.60, 0.80)
ROD_Z, ROD_R, ROD_IN, ROD_OUT = 0.52, 0.20, 0.125, 0.24
PUSH_R = ROD_R + ROD_OUT
TRIGRAMS = [(1, 1, 1), (1, 1, 0), (1, 0, 1), (1, 0, 0), (0, 0, 0), (0, 0, 1), (0, 1, 0), (0, 1, 1)]   # bottom..top, S SE E NE N NW W SW


# ------------------------------------------------------------------ small math
def _rgb(h): h = h.lstrip('#'); return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def _hex(c): return '#%02x%02x%02x' % tuple(int(round(max(0, min(255, v)))) for v in c)
def mix(a, b, k): return _hex([x + (y - x) * k for x, y in zip(_rgb(a), _rgb(b))])
def _lin(h): return [((v / 255) / 12.92) if v / 255 <= 0.04045 else ((v / 255 + 0.055) / 1.055) ** 2.4 for v in _rgb(h)]
def _rx(deg): return Matrix.Rotation(math.radians(deg), 4, 'X')
def _rz(deg): return Matrix.Rotation(math.radians(deg), 4, 'Z')
def _T(p): return Matrix.Translation(Vector(p))
def phi(i): return math.radians(-90 + 45 * i)


def _herm(xs, ys, x):
    """Cubic Hermite (Catmull-Rom tangents) through (xs, ys), clamped at the ends."""
    n = len(xs)
    if x <= xs[0]: return ys[0]
    if x >= xs[-1]: return ys[-1]
    k = max(j for j in range(n - 1) if xs[j] <= x)
    def m(j):
        if j == 0: return (ys[1] - ys[0]) / (xs[1] - xs[0])
        if j == n - 1: return (ys[-1] - ys[-2]) / (xs[-1] - xs[-2])
        return (ys[j + 1] - ys[j - 1]) / (xs[j + 1] - xs[j - 1])
    h = xs[k + 1] - xs[k]; t = (x - xs[k]) / h
    return ((2 * t ** 3 - 3 * t * t + 1) * ys[k] + (t ** 3 - 2 * t * t + t) * h * m(k) + (-2 * t ** 3 + 3 * t * t) * ys[k + 1]
            + (t ** 3 - t * t) * h * m(k + 1))


_BX, _BY = [p[0] for p in BODY], [p[1] for p in BODY]
def R_base(z): return _herm(_BX, _BY, z)
def _bump(x): return (1 - x * x) ** 2 if abs(x) < 1 else 0.0
def R_out(z): return R_base(z) + sum(0.008 * _bump((z - zc) / 0.009) for zc in RIDGES)


def S(th, z, off=0.0):
    """Point on the jar's outer surface in a sector frame (outward -Y, theta toward +X), off metres outside it."""
    r = R_base(z) + off
    return Vector((r * math.sin(th), -r * math.cos(th), z))


def n_out(th, z):
    dr = (R_base(z + 0.005) - R_base(z - 0.005)) / 0.01
    return Vector((math.sin(th), -math.cos(th), -dr)).normalized()


def _world(o):
    m = o.matrix_basis.copy(); p = o.parent
    while p is not None: m = p.matrix_basis @ m; p = p.parent
    return m


def _eight(v):
    if isinstance(v, (int, float)): return [float(v)] * 8
    v = [float(x) for x in v]; return (v + [0.0] * 8)[:8]


# ---- the fixed geometry every scene can use (sector frame -> root frame: rotate 45 i about Z)
_SH = Matrix.Diagonal((HEAD_S, HEAD_S, HEAD_S, 1.0))
_off = _rx(A_HEAD) @ _SH @ Vector(BALL_H)
HEAD_C = Vector((0.0, -R_DROP - _off.y, Z_HEAD))         # head centre in the sector frame
MH = _T(HEAD_C) @ _rx(A_HEAD) @ _SH                       # head frame in the sector frame
HINGE_D = MH @ Vector(HINGE_H)
CRANK = HINGE_D.y + PUSH_R                                # (negative) crank length along +Y from the hinge
CRANK_L = abs(CRANK)
BALL_D = MH @ Vector(BALL_H)                              # ball start in the sector frame
MCUP = _rx(10) @ Matrix.Diagonal((1.25, 1.0, 1.0, 1.0))  # frog mouth cup in frog coordinates
FROG_MOUTH = MCUP @ Vector((0, 0, 0.2 + BALL_R + 0.002))  # where a ball rests in the frog's mouth (frog coordinates)
END_D = Vector((0, -R_DROP, STEP_Z[1] + FROG_MOUTH.z))    # ... in the sector frame


def open_angles(k):
    """Jaw and rod angles (radians, rotation_euler.x) for openness k = 0..1, keeping the linkage in step."""
    b = math.radians(JAW_OPEN * k)
    g = math.asin(max(-1.0, min(1.0, CRANK_L * math.sin(b) / ROD_OUT)))
    return b, -g


def pendulum_rot(i, deg):
    """rotation_euler (x, y) of <name>_pendulum that swings the bob toward sector i by deg."""
    a = math.radians(deg); d = (math.cos(phi(i)), math.sin(phi(i)))
    return a * d[1], -a * d[0]


# ------------------------------------------------------------------ mesh builders (on top of cz.sphere)
def _lathe(cz, name, prof, mats, parent, face, vmap, segs=96):
    """Body of revolution from a UV sphere: ring k of the sphere -> profile point k. prof = [(r, z, label)] from the
    start pole (r = 0) to the end pole (r = 0), solid on the right of the travel direction (normals come out right).
    face(label, r, z) -> material slot, vmap(label, z) -> UV v (u: 8 repeats around, tile centre on sector 0)."""
    R = len(prof) - 1
    o = cz.sphere(name, 1.0, (0, 0, 0), mats[0], ol=0, parent=parent, segs=segs, rings=R)
    me = o.data
    for m in mats[1:]: me.materials.append(m)
    vk, lon = {}, {}
    for v in me.vertices:
        x, y, z = v.co
        k = int(round(math.acos(max(-1.0, min(1.0, z))) / math.pi * R))
        a = math.atan2(y, x)
        r, zz, _ = prof[k]
        vk[v.index] = k; lon[v.index] = a
        v.co = (r * math.cos(a), r * math.sin(a), zz)
    for p in me.polygons:
        ks = [vk[j] for j in p.vertices]; k0, k1 = min(ks), max(ks)
        p.material_index = face(prof[k0][2], (prof[k0][0] + prof[k1][0]) / 2, (prof[k0][1] + prof[k1][1]) / 2)
    uvl = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        us = []
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index
            us.append((((lon[vi] - phi(0)) / (2 * math.pi)) % 1.0) * 8 + 0.5)
        if max(us) - min(us) > 4: us = [u + 8 if u < 4.5 else u for u in us]
        for li, u in zip(p.loop_indices, us):
            k = vk[me.loops[li].vertex_index]
            uvl.data[li].uv = (u, vmap(prof[k][2], prof[k][1]))
    me.update()
    return o


def _catmull(pts, n=16):
    P = [Vector(p) for p in pts]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2].copy())
    return out


class Curve:
    """Arc-length parametrised Catmull-Rom curve with parallel-transport frames: at(u) -> (pos, T, N, B), u = 0..1."""
    def __init__(self, ctrl, up=(0, 0, 1)):
        import bisect
        self._bis = bisect.bisect_right
        self.p = _catmull(ctrl, 16)
        self.L = [0.0]
        for a, b in zip(self.p, self.p[1:]): self.L.append(self.L[-1] + (b - a).length)
        self.tot = max(1e-6, self.L[-1])
        n = len(self.p)
        self.T = [(self.p[min(n - 1, k + 1)] - self.p[max(0, k - 1)]).normalized() for k in range(n)]
        ref = Vector(up)
        if abs(ref.dot(self.T[0])) > 0.95: ref = Vector((1, 0, 0))
        self.N = [(ref - self.T[0] * ref.dot(self.T[0])).normalized()]
        for k in range(1, n):
            v = self.N[-1] - self.T[k] * self.N[-1].dot(self.T[k]); self.N.append(v.normalized())

    def at(self, u):
        s = max(0.0, min(1.0, u)) * self.tot
        k = max(0, min(len(self.p) - 2, self._bis(self.L, s) - 1))
        f = (s - self.L[k]) / max(1e-9, self.L[k + 1] - self.L[k])
        p = self.p[k].lerp(self.p[k + 1], f)
        t = self.T[k].lerp(self.T[k + 1], f).normalized()
        nn = self.N[k].lerp(self.N[k + 1], f); nn = (nn - t * nn.dot(t)).normalized()
        return p, t, nn, t.cross(nn)


def _sweep(cz, name, ctrl, rad, mat, parent, ol=0.005, segs=16, rings=40, cap=5, curve=None):
    """Tapered round-ended tube along a curve through ctrl (parent coordinates); rad(u) radius, u = 0..1 along it."""
    cv = curve or Curve(ctrl)
    o = cz.sphere(name, 1.0, (0, 0, 0), mat, ol=0, parent=parent, segs=segs, rings=rings)
    c = cap / rings
    for v in o.data.vertices:
        x, y, z = v.co
        s = math.acos(max(-1.0, min(1.0, z))) / math.pi
        a = math.atan2(y, x)
        if s < c:
            f = s / c * math.pi / 2; p, t, n, b = cv.at(0.0); r0 = rad(0.0)
            ctr, rr = p - t * r0 * math.cos(f), r0 * math.sin(f)
        elif s > 1 - c:
            f = (1 - s) / c * math.pi / 2; p, t, n, b = cv.at(1.0); r1 = rad(1.0)
            ctr, rr = p + t * r1 * math.cos(f), r1 * math.sin(f)
        else:
            u = (s - c) / (1 - 2 * c); p, t, n, b = cv.at(u); ctr, rr = p, rad(u)
        v.co = ctr + rr * (math.cos(a) * n - math.sin(a) * b)
    o.data.update()
    if ol: cz.outline(o, ol)
    return o


def _place(o, M):
    o.matrix_basis = M
    return o


def _seg(cz, name, a, b, w, h, mat, parent, Mp=None, bevel=0.004, ol=0.004):
    """Box from point a to point b (frame F), w x h cross-section, parented to `parent` whose rest matrix in F is Mp."""
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.box(name, (w, d.length, h), (0, 0, 0), mat, bevel=bevel, ol=ol, parent=parent)
    M = _T((a + b) / 2) @ Vector((0, 1, 0)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    return _place(o, (Mp.inverted() @ M) if Mp is not None else M)


def _cone(cz, name, base, d, r, length, mat, parent, Mp=None, ol=0.003, r2=0.002, verts=16):
    """Cone from base along direction d."""
    d = Vector(d).normalized()
    o = cz.cyl(name, r, length, (0, 0, 0), mat, verts=verts, ol=ol, parent=parent, r2=r2)
    M = _T(base) @ Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
    return _place(o, (Mp.inverted() @ M) if Mp is not None else M)


def _arc(cx, cz_, r, a0, a1, n, lab):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)), cz_ + r * math.sin(math.radians(a0 + (a1 - a0) * k / n)), lab)
            for k in range(n + 1)]


def _dedupe(P):
    out = [P[0]]
    for p in P[1:]:
        if math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 2e-4: out.append(p)
    return out


# ------------------------------------------------------------------ profiles
def _body_profile():
    P = []
    rin = lambda z: R_base(z) - T_WALL
    rf = 0.03; rc = rin(FZ + rf) - rf
    for r in (0.0, 0.07, 0.14, 0.21, 0.28):
        if r < rc - 0.01: P.append((r, FZ, 'in'))
    P += _arc(rc, FZ + rf, rf, -90, 0, 5, 'in')
    z = FZ + rf + 0.02
    while z < 1.395: P.append((rin(z), z, 'in')); z += 0.02
    P += [(rin(1.40), 1.40, 'in'), (0.378, 1.425, 'in')]
    P += _arc(0.393, 1.44, 0.015, 180, 90, 4, 'in')
    P += _arc(0.44, 1.44, 0.015, 90, 0, 4, 'lip')
    P += _arc(0.44, 1.425, 0.015, 0, -90, 4, 'lip')
    P += [(0.422, 1.406, 'lip')]
    zs = set(round(1.40 - 0.01 * k, 4) for k in range(113))
    for zc in RIDGES:
        zs |= set(round(zc + 0.002 * k, 4) for k in range(-8, 9))
    zs |= {CLOUD[0], CLOUD[1], FRET[0], FRET[1], GROOVE - 0.004, GROOVE + 0.004}
    for z in sorted((z for z in zs if 0.279 <= z <= 1.40), reverse=True): P.append((R_out(z), z, 'out'))
    P += [(0.418, 0.264, 'foot'), (0.42, 0.257, 'foot'), (0.433, 0.251, 'foot')]
    P += _arc(0.433, 0.236, 0.015, 90, 0, 3, 'foot')
    P += [(0.448, 0.212, 'foot')]
    P += _arc(0.433, 0.197, 0.015, 0, -90, 3, 'foot')
    P += [(0.40, ZB, 'foot'), (0.30, ZB, 'foot'), (0.20, ZB, 'foot'), (0.10, ZB, 'foot'), (0.0, ZB, 'foot')]
    return _dedupe(P)


def _lid_profile():
    kz = LID_Z + LID_H + 0.0            # dome top
    knob = [(0.0, 0.13), (0.018, 0.127), (0.034, 0.119), (0.048, 0.105), (0.057, 0.087), (0.058, 0.068), (0.051, 0.052),
            (0.040, 0.043), (0.050, 0.038), (0.056, 0.030), (0.052, 0.022), (0.038, 0.017), (0.034, 0.008), (0.042, 0.001),
            (0.062, -0.004)]
    P = [(r * 1.3, kz + z * 1.25, 'top') for r, z in knob]            # (scaled up: it must read in the wide shot)
    r = 0.08
    while r < LID_R - 0.004:
        z = LID_Z + LID_H * math.sqrt(max(0.0, 1 - (r / LID_R) ** 2)) + 0.007 * _bump((r - 0.30) / 0.011)
        P.append((r, z, 'top')); r += 0.004 if abs(r - 0.30) < 0.02 or r > 0.40 else 0.012
    P += [(LID_R, LID_Z, 'top'), (0.462, LID_Z - 0.001, 'flange')]
    P += _arc(0.458, FLANGE[1], 0.01, 90 - 25, 0, 3, 'flange')
    P += [(0.468, 0.5 * (FLANGE[0] + FLANGE[1]), 'flange'), (0.468, FLANGE[0], 'flange')]
    P += _arc(0.458, FLANGE[0], 0.01, 0, -90, 3, 'flange')
    P += [(0.43, 1.4555, 'bottom'), (0.395, 1.4555, 'bottom'), (0.385, 1.46, 'lin'), (0.376, 1.475, 'lin')]
    r = 0.37
    while r > 0.0:
        P.append((r, 1.475 + 0.135 * math.sqrt(max(0.0, 1 - (r / 0.376) ** 2)), 'lin')); r -= 0.03 if r < 0.3 else 0.012
    P.append((0.0, 1.61, 'lin'))
    return _dedupe(P)


# ------------------------------------------------------------------ build
def build(cz, name='seismo_jar', jaws=0.0, drop=0.0, swing=None, cutaway=False, cut=-112.5, patina=0.35, trigrams=True):
    jaws, drop = _eight(jaws), _eight(drop)
    p = cz.clamp(float(patina))
    root = cz.empty(name)

    # ---- materials
    bronze_c = mix(BRONZE, PATINA, 0.42 * p)
    lin0, lin1 = _lin(BRONZE), _lin(bronze_c)
    tint = tuple(b / max(1e-6, a) for a, b in zip(lin0, lin1))
    M = {}
    M['bronze'] = cz.toon(name + '_bronze', bronze_c, tex='grain', tex_scale=2.0, tex_strength=0.06)
    M['cloud'] = cz.toon(name + '_cloud', img=TEX + 'seismo_jar_clouds.png', tint=tint, tex='grain', tex_scale=2.0, tex_strength=0.06)
    M['fret'] = cz.toon(name + '_fret', img=TEX + 'seismo_jar_fret.png', tint=tint, scale=(2, 1), tex='grain', tex_scale=2.0, tex_strength=0.05)
    M['lidfret'] = cz.toon(name + '_lidfret', img=TEX + 'seismo_jar_fret.png', tint=tint, scale=(3, 1), tex='grain', tex_scale=2.0, tex_strength=0.05)
    M['groove'] = cz.toon(name + '_groove', mix('#4e3418', PATINA, 0.35 + 0.3 * p))
    M['inner'] = cz.toon(name + '_inner', mix('#6a4524', PATINA, 0.2 * p), tex='grain', tex_scale=2.0, tex_strength=0.05)
    M['cut'] = cz.toon(name + '_cut', '#e8c288', tex='grain', tex_scale=3.0, tex_strength=0.03)
    M['dragon'] = cz.toon(name + '_dragon', mix(bronze_c, '#e2ad5a', 0.4), tex='grain', tex_scale=3.0, tex_strength=0.05)
    M['light'] = cz.toon(name + '_light', mix('#dcaa5c', PATINA, 0.15 * p))
    M['dark'] = cz.toon(name + '_dark', mix('#7a5029', PATINA, 0.25 * p), tex='grain', tex_scale=2.0, tex_strength=0.05)
    M['base'] = cz.toon(name + '_base', mix('#8a5a2c', PATINA, 0.3 * p), tex='grain', tex_scale=1.5, tex_strength=0.06)
    M['accent'] = cz.toon(name + '_accent', mix(PATINA, '#82b8a0', 0.35 * p), tex='grain', tex_scale=4.0, tex_strength=0.05)
    M['frog'] = cz.toon(name + '_frog', mix(BRONZE, PATINA, 0.42 + 0.35 * p), tex='grain', tex_scale=4.0, tex_strength=0.06)
    M['spot'] = cz.toon(name + '_spot', mix('#3f6b55', PATINA, 0.2 * p))
    M['lip'] = cz.toon(name + '_lip', mix('#d8b066', PATINA, 0.2 * p))
    M['mouth'] = cz.toon(name + '_mouth', '#3a2416')
    M['tongue'] = cz.toon(name + '_tongue', '#b45a3e')
    M['gold'] = cz.toon(name + '_gold', '#eab84e', lift=0.7)
    M['eye'] = cz.toon(name + '_eye', '#f0e3bd', lift=0.75)
    M['iris'] = cz.toon(name + '_iris', '#e9a52a', lift=0.75)
    M['pupil'] = cz.toon(name + '_pupil', '#2a2622')
    M['mech'] = cz.toon(name + '_mech', mix('#c4893f', PATINA, 0.1 * p))
    slots = [M['bronze'], M['cloud'], M['fret'], M['groove'], M['inner'], M['cut']]
    CUT_SLOT = 5

    # ---- cut-away wedge (front-left quarter by default): a hidden box the shell and lid subtract
    cutter = None
    removed = set()
    if cutaway:
        c = float(cut); psi = c - 45.0; eps = 0.012; Sz = 0.78; z0, z1 = 0.16, 1.84
        corner = Vector((-eps * math.cos(math.radians(c)), -eps * math.sin(math.radians(c)), 0))
        ctr = corner + (_rz(psi) @ Vector((Sz / 2, Sz / 2, 0)))
        cutter = cz.box(name + '_cutter', (Sz, Sz, z1 - z0), (ctr.x, ctr.y, (z0 + z1) / 2), M['cut'], rot=(0, 0, psi), bevel=0, ol=0, parent=root)
        for _ in range(CUT_SLOT): cutter.data.materials.append(M['cut'])
        for pg in cutter.data.polygons: pg.material_index = CUT_SLOT
        cutter.hide_render = True; cutter.display_type = 'WIRE'
        for i in range(8):
            dd = (math.degrees(phi(i)) - c + 180) % 360 - 180
            if abs(dd) < 44.0: removed.add(i)

    def _cut(o, ol):
        if cutter is not None:
            b = o.modifiers.new('cz_cut', 'BOOLEAN'); b.operation = 'DIFFERENCE'; b.solver = 'EXACT'; b.object = cutter
            b.material_mode = 'INDEX'
        cz.outline(o, ol)

    # ---- base: two octagonal steps (flat faces toward the sectors), round dais, trigrams on the upper riser
    for k, (r, z1, mat) in enumerate(((STEP_R[0], STEP_Z[0], M['base']), (STEP_R[1], STEP_Z[1], M['dark']))):
        z0 = 0.0 if k == 0 else STEP_Z[0] - 0.001
        o = cz.cyl(f'{name}_step{k}', r, z1 - z0, (0, 0, z0), mat, verts=8, bevel=0.014, ol=0.008, parent=root)
        v0 = o.data.vertices[0].co; a0 = math.degrees(math.atan2(v0.y, v0.x))
        # turned in the mesh itself (an object rotation would blow up its bounding box for the viewer's framing)
        o.data.transform(Matrix.Rotation(math.radians(-((a0 + 22.5) % 45.0)), 4, 'Z')); o.data.update()
    cz.cyl(name + '_dais', DAIS_R, DAIS_Z - STEP_Z[1] + 0.001, (0, 0, STEP_Z[1] - 0.001), M['base'], verts=64, bevel=0.008, ol=0.006, parent=root)

    # ---- jar body (hollow shell) and lid
    def body_face(lab, r, z):
        if lab == 'in': return 4
        if lab == 'out':
            if CLOUD[0] <= z <= CLOUD[1]: return 1
            if FRET[0] <= z <= FRET[1]: return 2
            if abs(z - GROOVE) < 0.004: return 3
        return 0

    def body_v(lab, z):
        if CLOUD[0] - 0.001 <= z <= CLOUD[1] + 0.001: return (z - CLOUD[0]) / (CLOUD[1] - CLOUD[0])
        if FRET[0] - 0.001 <= z <= FRET[1] + 0.001: return (z - FRET[0]) / (FRET[1] - FRET[0])
        return 0.0
    body = _lathe(cz, name + '_body', _body_profile(), slots, root, body_face, body_v, segs=96)
    _cut(body, 0.01)

    def lid_face(lab, r, z):
        if lab == 'lin': return 4
        if lab == 'top' and 0.205 < r < 0.222: return 3
        if lab == 'flange' and FLANGE[0] - 0.001 <= z <= FLANGE[1] + 0.001 and r > 0.463: return 2
        return 0
    lslots = [M['bronze'], M['cloud'], M['lidfret'], M['groove'], M['inner'], M['cut']]
    lid = _lathe(cz, name + '_lid', _lid_profile(), lslots, root, lid_face,
                 lambda lab, z: (z - FLANGE[0]) / (FLANGE[1] - FLANGE[0]), segs=96)
    _cut(lid, 0.009)

    # ---- pendulum: hanger under the lid, rod, heavy barrel bob with a patina band, a striker spike underneath
    cz.cyl(name + '_hanger', 0.032, 0.05, (0, 0, PIVOT_Z + 0.005), M['dark'], verts=24, bevel=0.006, ol=0.004, parent=root)
    cz.sphere(name + '_knuckle', 0.03, (0, 0, PIVOT_Z), M['mech'], ol=0.004, parent=root, segs=24, rings=12)
    pend = cz.empty(name + '_pendulum', (0, 0, PIVOT_Z), parent=root)
    if swing:
        rx, ry = pendulum_rot(int(swing[0]), float(swing[1])); pend.rotation_euler = (rx, ry, 0)
    cz.cyl(name + '_pend_rod', 0.022, PIVOT_Z - BOB_Z[1] + 0.01, (0, 0, -(PIVOT_Z - BOB_Z[1]) - 0.01), M['mech'], verts=16, ol=0.004, parent=pend)
    bh = BOB_Z[1] - BOB_Z[0]
    cz.cyl(name + '_bob', 0.125, bh, (0, 0, BOB_Z[0] - PIVOT_Z), M['dark'], verts=40, bevel=0.05, ol=0.006, parent=pend)
    cz.cyl(name + '_bob_band', 0.129, 0.034, (0, 0, BOB_Z[0] - PIVOT_Z + bh / 2 - 0.017), M['accent'], verts=40, bevel=0.006, ol=0.004, parent=pend)
    sp = cz.cyl(name + '_spike', 0.035, 0.125, (0, 0, BOB_Z[0] - PIVOT_Z + 0.01), M['mech'], verts=20, ol=0.004, parent=pend, r2=0.006)
    sp.rotation_euler.x = math.pi

    # ---- per sector: dragon, frog, ball, mechanism
    starts, ends = [], []
    for i in range(8):
        sec = cz.empty(f'{name}_sector{i}', (0, 0, 0), parent=root); sec.rotation_euler.z = math.radians(45 * i)
        Rs = _rz(45 * i)
        # frog (sits on the upper step under the ball)
        fr, mouth = _frog(cz, f'{name}_frog{i}', sec, M)
        fr.location = (0, -R_DROP - mouth.y, STEP_Z[1])
        end_d = END_D.copy()
        # rod on its post + tab for the striker
        pz = ROD_Z
        cz.cyl(f'{name}_post{i}', 0.017, pz - FZ - 0.012, (0, -ROD_R, FZ - 0.004), M['dark'], verts=16, ol=0.004, parent=sec)
        cz.sphere(f'{name}_postknuckle{i}', 0.024, (0, -ROD_R, pz), M['dark'], ol=0.003, parent=sec, segs=20, rings=10)
        cz.cyl(f'{name}_axle{i}', 0.009, 0.07, (-0.035, -ROD_R, pz), M['mech'], rot=(0, 90, 0), verts=12, ol=0.002, parent=sec)
        kj = jaws[i] if i not in removed else 0.0
        jaw_a, rod_a = open_angles(kj)
        rod = cz.empty(f'{name}_rod{i}', (0, -ROD_R, pz), parent=sec); rod.rotation_euler.x = rod_a
        cz.box(f'{name}_rod{i}_bar', (0.028, ROD_IN + ROD_OUT, 0.026), (0, (ROD_IN - ROD_OUT) / 2, 0), M['mech'], bevel=0.006, ol=0.004, parent=rod)
        cz.box(f'{name}_rod{i}_tab', (0.032, 0.018, 0.05), (0, ROD_IN - 0.01, -0.04), M['mech'], bevel=0.004, ol=0.003, parent=rod)
        cz.sphere(f'{name}_rod{i}_eye', 0.019, (0, -ROD_OUT, 0), M['mech'], ol=0.003, parent=rod, segs=16, rings=8)
        # trigram on the riser of the upper step in front of the frog
        if trigrams:
            ri = STEP_R[1] * math.cos(math.radians(22.5))
            for row, bit in enumerate(TRIGRAMS[i]):
                z = STEP_Z[0] + 0.019 + row * 0.019
                parts = [(0.0, 0.25)] if bit else [(-0.08, 0.10), (0.08, 0.10)]
                for q, (x, w) in enumerate(parts):
                    cz.box(f'{name}_tri{i}_{row}{q}', (w, 0.012, 0.011), (x, -ri - 0.003, z), M['light'], bevel=0.003, ol=0.002, parent=sec)
        ball_d = BALL_D.copy()
        starts.append(Rs @ ball_d); ends.append(Rs @ end_d)
        if i in removed: continue
        dr = cz.empty(f'{name}_dragon{i}', (0, 0, 0), parent=sec)
        jaw = _dragon(cz, name, i, dr, M, jaw_a)
        # pushrod: from the rod's outer eye to the crank pin on the jaw (follows both by a stretch-to constraint)
        pin = cz.empty(f'{name}_pin{i}', tuple((MH @ _T(HINGE_H)).inverted() @ Vector((0, -PUSH_R, HINGE_D.z))), parent=jaw, size=0.02)
        link = cz.empty(f'{name}_link{i}', (0, -ROD_OUT, 0), parent=rod, size=0.02)
        L = HINGE_D.z - pz
        cz.cyl(f'{name}_link{i}_bar', 0.012, L, (0, 0, 0), M['mech'], rot=(-90, 0, 0), verts=12, ol=0.003, parent=link)
        con = link.constraints.new('STRETCH_TO'); con.target = pin; con.rest_length = L; con.volume = 'NO_VOLUME'
        # the ball (own root: animate its location)
        b = cz.empty(f'{name}_ball{i}', tuple(starts[-1].lerp(ends[-1], cz.clamp(drop[i]))), parent=root, size=0.06)
        cz.sphere(f'{name}_ball{i}_m', BALL_R, (0, 0, 0), M['gold'], ol=0.004, parent=b, segs=32, rings=16)
    root['ball_start'] = [c for v in starts for c in v]
    root['ball_end'] = [c for v in ends for c in v]
    return root


BALL_START = [tuple(_rz(45 * i) @ BALL_D) for i in range(8)]     # root-local
BALL_END = [tuple(_rz(45 * i) @ END_D) for i in range(8)]


def ball_path(root, i):
    """World-space (start, end) of ball i: start in the dragon's mouth, end resting in the frog's mouth (straight down).
    The ball object <name>_ball<i> is parented to the root: animate its location between root['ball_start'][3i:3i+3]
    and root['ball_end'][3i:3i+3] (root-local; ease in like a fall, a small bounce in the frog's mouth)."""
    s = list(root['ball_start']); e = list(root['ball_end'])
    Mw = _world(root)
    return Mw @ Vector(s[3 * i:3 * i + 3]), Mw @ Vector(e[3 * i:3 * i + 3])


def set_open(root, i, k):
    """Pose sector i at openness k = 0..1: jaw and rod together (the pushrod follows). Bake both rotation_euler.x
    channels per frame (cz.bake) when animating."""
    import bpy
    b, g = open_angles(k)
    j = bpy.data.objects.get(f'{root.name}_jaw{i}'); r = bpy.data.objects.get(f'{root.name}_rod{i}')
    if j: j.rotation_euler.x = b
    if r: r.rotation_euler.x = g


# ------------------------------------------------------------------ dragon (sector frame: outward -Y)
def _dragon(cz, name, i, dr, M, jaw_a):
    P = f'{name}_dragon{i}_'
    hd = cz.empty(f'{name}_head{i}', tuple(HEAD_C), parent=dr); hd.rotation_euler.x = math.radians(A_HEAD); hd.scale = (HEAD_S,) * 3
    D, L, A = M['dragon'], M['light'], M['accent']
    # -- head (head coordinates: forward -Y, up +Z, X across)
    cz.sphere(P + 'skull', 0.1, (0, 0.016, 0.02), D, scale=(1.0, 1.12, 0.9), ol=0.006, parent=hd)
    cz.box(P + 'snout', (0.13, 0.19, 0.068), (0, -0.112, -0.003), D, bevel=0.03, ol=0.006, parent=hd)
    cz.sphere(P + 'nosepad', 0.04, (0, -0.196, 0.02), D, scale=(1.7, 0.85, 0.62), ol=0.004, parent=hd)
    for s in (1, -1):
        # flared slit nostrils on the nose pad, angled outward
        o = cz.sphere(P + f'nostril{s}', 0.012, (s * 0.034, -0.219, 0.036), M['mouth'], scale=(1.7, 0.6, 0.75), ol=0.0, parent=hd, segs=16, rings=8)
        o.rotation_euler = (math.radians(-35), 0, math.radians(28 * s))
        # eyes: cream ball, amber iris, slit pupil (looking down at the frog) under a heavy V brow
        cz.sphere(P + f'brow{s}', 0.038, (s * 0.05, -0.058, 0.088), D, scale=(1.4, 0.72, 0.5), ol=0.004, parent=hd).rotation_euler.y = math.radians(-30 * s)
        ec = Vector((s * 0.056, -0.072, 0.047))
        cz.sphere(P + f'eye{s}', 0.034, tuple(ec), M['eye'], ol=0.003, parent=hd, segs=32, rings=16)
        look = Vector((-s * 0.08, -0.894, 0.42)).normalized()     # between a front camera and the frog below
        cz.sphere(P + f'iris{s}', 0.021, tuple(ec + look * 0.02), M['iris'], ol=0.0, parent=hd, segs=24, rings=12)
        cz.sphere(P + f'pupil{s}', 0.014, tuple(ec + look * 0.0275), M['pupil'], scale=(0.38, 1.0, 1.2), ol=0.0, parent=hd, segs=16, rings=8)
        # finned ears behind the eyes
        for q, (zz, ln) in enumerate(((0.06, 0.085), (0.02, 0.065))):
            _cone(cz, P + f'ear{s}{q}', (s * 0.085, 0.03, zz), (s * 1.0, 0.75, 0.25 - 0.3 * q), 0.026, ln, A, hd, ol=0.004, r2=0.004)
        # upper fangs either side of the ball
        _cone(cz, P + f'fang{s}', (s * 0.05, -0.19, -0.022), (s * 0.15, -0.1, -1), 0.015, 0.05, M['eye'], hd, ol=0.003, r2=0.002)
        # horns: curved, tapering, swept back and up
        _sweep(cz, P + f'horn{s}', [(s * 0.035, 0.05, 0.06), (s * 0.06, 0.10, 0.11), (s * 0.09, 0.16, 0.14), (s * 0.125, 0.21, 0.13)],
               lambda u: 0.024 - 0.017 * u, L, hd, ol=0.004, segs=14, rings=30, cap=4)
        # whiskers: out of the snout sides, drooping (world down is head (0, -0.77, -0.64)) and curling out at the tips
        dn = Vector((0, -0.766, -0.643)); w0 = Vector((s * 0.062, -0.168, 0.002))
        wpts = [w0 + Vector((s * w, 0, 0)) + dn * dd for w, dd in ((0, 0), (0.04, 0.004), (0.076, 0.02), (0.1, 0.046), (0.106, 0.074), (0.12, 0.09), (0.138, 0.088))]
        _sweep(cz, P + f'whisker{s}', wpts, lambda u: 0.0095 - 0.004 * u, L, hd, ol=0.003, segs=10, rings=40, cap=3)
    # mane: patina flames round the back of the head (the low ones hide the crank's way into the jar)
    for k, ang in enumerate((-150, -110, -70, -35, 0, 35, 70, 110, 150)):
        a = math.radians(ang)
        # (head "down" points into the jar: the low ones sit further forward and point sideways / world-down)
        low = abs(ang) > 120
        base = Vector((0.085 * math.sin(a), 0.035 if low else 0.075, 0.02 + 0.08 * math.cos(a)))
        d = Vector((math.sin(a) * 1.6, -0.3, -0.4)) if low else Vector((math.sin(a), 0.9, math.cos(a)))
        _cone(cz, P + f'mane{k}', base, d, 0.027, 0.06 if low else 0.075, A, hd, ol=0.004, r2=0.004)
    # mouth interior (dark, seen when the jaw drops)
    cz.box(P + 'palate', (0.095, 0.13, 0.026), (0, -0.095, -0.042), M['mouth'], bevel=0.008, ol=0.0, parent=hd)
    # -- lower jaw on its hinge
    jaw = cz.empty(f'{name}_jaw{i}', HINGE_H, parent=hd); jaw.rotation_euler.x = jaw_a
    # a slim rounded jaw tapering to nothing at the hinge: fully open it hangs clear of the jar's belly
    cz.sphere(P + 'jaw', 0.07, (0, -0.06, -0.012), D, scale=(0.86, 1.0, 0.34), ol=0.006, parent=jaw)
    cz.sphere(P + 'tongue', 0.034, (0, -0.06, 0.009), M['tongue'], scale=(1.0, 1.5, 0.3), ol=0.002, parent=jaw, segs=24, rings=12)
    for s in (1, -1):
        _cone(cz, P + f'lfang{s}', (s * 0.04, -0.112, 0.0), (s * 0.1, -0.15, 1), 0.012, 0.032, M['eye'], jaw, ol=0.002, r2=0.002)
    # crank (the jaw lever): from the hinge back through the jar wall to the pushrod pin
    MJ0 = MH @ _T(HINGE_H)
    tip = Vector((0, -PUSH_R, HINGE_D.z))
    _seg(cz, P + 'crank', HINGE_D, tip, 0.024, 0.024, M['mech'], jaw, Mp=MJ0, bevel=0.005, ol=0.003)
    cz.sphere(P + 'crankeye', 0.02, tuple(MJ0.inverted() @ tip), M['mech'], ol=0.003, parent=jaw, segs=16, rings=8)
    # -- serpentine body hugging the shoulder (sector frame)
    ctrl = [MH @ Vector((0, 0.0, 0.03)), MH @ Vector((0, 0.09, 0.07))]
    path = [(0.0, 1.165, 0.034), (0.09, 1.21, 0.031), (0.16, 1.255, 0.029), (0.11, 1.30, 0.026), (-0.02, 1.32, 0.022),
            (-0.13, 1.333, 0.017), (-0.17, 1.357, 0.013), (-0.12, 1.378, 0.010)]
    ctrl += [S(th, z, off) for th, z, off in path]
    cv = Curve(ctrl)
    rad = lambda u: 0.06 - 0.012 * min(1.0, u / 0.35) if u < 0.35 else 0.048 - 0.032 * ((u - 0.35) / 0.65) ** 1.2
    _sweep(cz, P + 'body', None, rad, D, dr, ol=0.006, segs=24, rings=72, cap=6, curve=cv)
    # spines along the back (pointing away from the jar, swept toward the tail)
    for k in range(7):
        u = 0.22 + 0.1 * k
        pp, t, _, _ = cv.at(u)
        th = math.atan2(pp.x, -pp.y)
        n = n_out(th, pp.z)
        _cone(cz, P + f'spine{k}', pp + n * rad(u) * 0.7, n * 0.85 + t * 0.55, 0.02 * (1 - 0.4 * u), 0.05 * (1 - 0.45 * u), A, dr, ol=0.003, r2=0.003)
    # tail tuft
    pp, t, nn, bb = cv.at(1.0)
    for k, sd in enumerate((-1, 0, 1)):
        _cone(cz, P + f'tuft{k}', pp - t * 0.01, t + bb * 0.6 * sd + n_out(math.atan2(pp.x, -pp.y), pp.z) * 0.3, 0.018, 0.06, A, dr, ol=0.003, r2=0.003)
    # front legs: clinging to the shoulder either side of the head
    for s in (1, -1):
        hip, _, _, _ = cv.at(0.12)
        foot = S(s * 0.25, 0.985, 0.012)
        knee = S(s * 0.2, 1.08, 0.075)
        _sweep(cz, P + f'leg{s}', [hip + Vector((s * 0.02, 0, 0)), knee, foot], lambda u: 0.03 - 0.008 * u, D, dr, ol=0.005, segs=14, rings=32, cap=4)
        n = n_out(s * 0.25, 0.985)
        cz.sphere(P + f'foot{s}', 0.032, tuple(foot), D, scale=(1.2, 1.2, 0.8), ol=0.004, parent=dr, segs=20, rings=10)
        for q in (-1, 0, 1):
            th = s * 0.25 + q * 0.045
            cbase = S(th, 0.965, 0.014)
            _cone(cz, P + f'claw{s}{q}', cbase, Vector((0, 0, -1)) + n * 0.5, 0.011, 0.03, L, dr, ol=0.002, r2=0.002)
    return jaw


# ------------------------------------------------------------------ frog (sector frame, facing outward -Y)
def _frog(cz, nm, parent, M):
    fr = cz.empty(nm, (0, 0, 0), parent=parent)
    F = M['frog']
    cz.sphere(nm + '_body', 0.13, (0, 0.02, 0.09), F, scale=(1.3, 1.05, 0.72), ol=0.006, parent=fr)
    # head: a round, wide dome with the mouth gaping straight up out of its top (dark inside, a tongue on the floor),
    # tilted a little toward the viewer; the head's bulging cheeks sink into the body
    prof = [(0.0, 0.2, 'm'), (0.03, 0.2, 'm'), (0.055, 0.204, 'm'), (0.072, 0.214, 'm'), (0.084, 0.23, 'm'), (0.09, 0.247, 'm'),
            (0.092, 0.256, 'l'), (0.097, 0.263, 'l'), (0.105, 0.266, 'l'), (0.113, 0.264, 's'), (0.123, 0.256, 's'), (0.133, 0.24, 's'),
            (0.14, 0.218, 's'), (0.142, 0.195, 's'), (0.138, 0.17, 's'), (0.127, 0.145, 's'), (0.108, 0.122, 's'), (0.08, 0.106, 's'),
            (0.04, 0.098, 's'), (0.0, 0.096, 's')]
    cup = _lathe(cz, nm + '_mouth', prof, [F, M['mouth'], M['frog']], fr, lambda lab, r, z: {'m': 1, 'l': 2}.get(lab, 0), lambda lab, z: 0.0, segs=48)
    cup.matrix_basis = MCUP
    cz.outline(cup, 0.005)
    cz.sphere(nm + '_tongue', 0.045, (0, 0.012, 0.204), M['tongue'], scale=(1.0, 0.8, 0.25), ol=0.0, parent=cup, segs=24, rings=12)
    mouth = FROG_MOUTH
    # eyes on the back rim, looking up at the dragon
    for s in (1, -1):
        e = Vector((s * 0.088, 0.07, 0.262))
        cz.sphere(nm + f'_eyelid{s}', 0.048, tuple(e), F, ol=0.005, parent=fr, segs=32, rings=16)
        w = e + Vector((0, -0.014, 0.024))
        cz.sphere(nm + f'_eye{s}', 0.035, tuple(w), M['eye'], ol=0.003, parent=fr, segs=24, rings=12)
        look = Vector((-s * 0.15, -0.45, 0.88)).normalized()
        cz.sphere(nm + f'_pupil{s}', 0.016, tuple(w + look * 0.028), M['pupil'], ol=0.0, parent=fr, segs=16, rings=8)
        # haunch + long hind foot with three toes
        cz.sphere(nm + f'_haunch{s}', 0.07, (s * 0.135, 0.06, 0.075), F, scale=(0.9, 1.3, 0.85), ol=0.005, parent=fr)
        hf = cz.sphere(nm + f'_hfoot{s}', 0.05, (s * 0.195, -0.04, 0.012), F, scale=(0.9, 1.6, 0.3), ol=0.004, parent=fr, segs=24, rings=12)
        hf.rotation_euler.z = math.radians(20 * s)          # toes splay outward
        for q in (-1, 0, 1):
            a = math.radians(20 * s + q * 22)
            cz.sphere(nm + f'_htoe{s}{q}', 0.016, (s * 0.195 + 0.075 * math.sin(a), -0.04 - 0.075 * math.cos(a), 0.012), F, ol=0.002, parent=fr, segs=12, rings=8)
        # front leg + hand
        _sweep(cz, nm + f'_arm{s}', [(s * 0.09, -0.06, 0.12), (s * 0.125, -0.115, 0.075), (s * 0.13, -0.145, 0.02)], lambda u: 0.026 - 0.006 * u,
               F, fr, ol=0.004, segs=12, rings=28, cap=4)
        cz.sphere(nm + f'_hand{s}', 0.034, (s * 0.132, -0.158, 0.01), F, scale=(1.25, 1.0, 0.32), ol=0.003, parent=fr, segs=20, rings=10)
        for q in (-1, 0, 1):
            cz.sphere(nm + f'_ftoe{s}{q}', 0.013, (s * 0.132 + q * 0.03, -0.188 + abs(q) * 0.008, 0.01), F, ol=0.002, parent=fr, segs=12, rings=8)
    # patina spots on the back
    for k, (dx, dy, dz, r) in enumerate(((0.45, 0.6, 0.8, 0.026), (-0.5, 0.5, 0.8, 0.022), (0.05, 0.8, 0.65, 0.02), (-0.15, 0.25, 1.0, 0.018))):
        d = Vector((dx, dy, dz)).normalized()
        a, b, c = 0.13 * 1.3, 0.13 * 1.05, 0.13 * 0.72
        t = 1 / math.sqrt((d.x / a) ** 2 + (d.y / b) ** 2 + (d.z / c) ** 2)
        cz.sphere(nm + f'_spot{k}', r, tuple(Vector((0, 0.02, 0.09)) + d * t), M['spot'], scale=(1, 1, 0.35), ol=0.0, parent=fr, segs=16, rings=8)
    return fr, mouth
