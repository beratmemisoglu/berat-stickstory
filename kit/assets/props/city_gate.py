# City gate: an 8 x 3 m section of brick city wall, 6 m tall, with an arched gate tunnel (3 m wide, springline 2.7 m,
# crown 4.2 m) through it, a gatehouse on top and the dressing around the gate.
#  - wall: one mesh (front, back, ends, top, the tunnel's jambs and vault) with chunky brick courses (PNG from
#    tex/make_city_gate.py, the vault a shade darker), a dark stone footing on the front, a ring of stone voussoirs with
#    a big keystone and stacked quoins framing the opening, a stone floor through the tunnel
#  - gate: two red leaves (5 x 7 gold studs, a gold knocker ring each, a round hinge post) on pivots <name>_doorL /
#    <name>_doorR set 0.8 m into the tunnel; they open INWARD (+Y, into the city) by 90 deg * open; above them a fixed
#    arched tympanum board with three gold rosettes; a low stone sill under them
#  - top: crenellated parapet along the front, a low rear parapet, a gatehouse on a stone platform (8 red columns, lattice
#    door panels across the front, red walls, a teal frieze with a gold stripe, a row of blue / green brackets, the
#    vertical name plaque "Gate of Eternal Peace" hung at the centre) under a hip roof with a concave profile, upturned
#    and flared corners, barrel-tile rows, round tile ends along the eaves, hip ridges that curl up at the corners, little
#    ridge beasts and a main ridge with curled end ornaments (gold eyes and pearls)
#  - two tall red dragon banners hanging from poles on the wall face, two torches by the opening (glowing flames on the
#    pivots <name>_flameL / _flameR; no light objects: the set adds its own warm point lights at META['torch_lights'])
# Floor prop: root = floor centre of the wall section (the front face is y = -1.5, the city side y = +1.5), front -Y.
import math, os, bmesh
from mathutils import Vector

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
W, H, D = 8.0, 6.0, 3.0          # wall
A, ZS = 1.5, 2.7                 # opening half-width, springline
YF, YB = -D / 2, D / 2
YH = YF + 0.8                    # door plane
TORCH_X, TORCH_Z = 2.3, 2.25

META = {'size': (8.0, 4.4, 11.7), 'anchor': 'floor centre of the wall section; front face y = -1.5, front -Y',
        'opening': {'width': 2 * A, 'springline': ZS, 'crown': ZS + A, 'door_plane_y': YH, 'clear_height_under_tympanum': ZS},
        'animate': ['_doorL (rotation_euler.z = +90 deg * open)', '_doorR (rotation_euler.z = -90 deg * open)',
                    '_flameL', '_flameR (flame flicker: scale)'],
        'torch_lights': [(-TORCH_X, YF - 0.56, TORCH_Z + 0.62), (TORCH_X, YF - 0.56, TORCH_Z + 0.62)],
        'params': "open=0..1 (both leaves; or openL / openR), lit=True (torch flames), windows_lit=False (gatehouse "
                  "lattice glows, night), banners=True, gatehouse=True"}


# ---------------------------------------------------------------- generic helpers
def _band(cz, name, inner, outer, y0, y1, mat, parent, ol=0.006, bevel=0.0, smooth=False):
    """A solid between two matching XZ polylines (inner / outer, same length), extruded from y0 to y1."""
    bm = bmesh.new()
    vi0 = [bm.verts.new((x, y0, z)) for x, z in inner]; vo0 = [bm.verts.new((x, y0, z)) for x, z in outer]
    vi1 = [bm.verts.new((x, y1, z)) for x, z in inner]; vo1 = [bm.verts.new((x, y1, z)) for x, z in outer]
    n = len(inner)
    for k in range(n - 1):
        bm.faces.new((vi0[k], vo0[k], vo0[k + 1], vi0[k + 1]))
        bm.faces.new((vi1[k], vi1[k + 1], vo1[k + 1], vo1[k]))
        bm.faces.new((vi0[k], vi0[k + 1], vi1[k + 1], vi1[k]))
        bm.faces.new((vo0[k], vo1[k], vo1[k + 1], vo0[k + 1]))
    for k in (0, n - 1):
        bm.faces.new((vi0[k], vi1[k], vo1[k], vo0[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=smooth), (0, 0, 0), (0, 0, 0), None, parent, ol, bevel)


def _lathe(cz, name, prof, mat, parent, loc=(0, 0, 0), segs=24, ol=0.0, closed=False):
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
    return cz.place(cz._mesh_obj(name, bm, mat), loc, (0, 0, 0), None, parent, ol, 0.0)


def _sweep(cz, name, pts, w, h, mat, parent, ol=0.008):
    """A ridge beam along a 3D polyline: chamfered profile w wide, h tall, its base on the points."""
    prof = [(-w / 2, 0.0), (w / 2, 0.0), (w / 2, h * 0.65), (w * 0.3, h), (-w * 0.3, h), (-w / 2, h * 0.65)]
    bm = bmesh.new(); rings = []
    P = [Vector(p) for p in pts]
    for k, p in enumerate(P):
        t = (P[min(len(P) - 1, k + 1)] - P[max(0, k - 1)]).normalized()
        s = t.cross(Vector((0, 0, 1)))
        s = s.normalized() if s.length > 1e-4 else Vector((1, 0, 0))
        n = s.cross(t).normalized()
        if n.z < 0: n = -n
        rings.append([bm.verts.new(p + s * a + n * b) for a, b in prof])
    m = len(prof)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(m):
            bm.faces.new((ra[i], ra[(i + 1) % m], rb[(i + 1) % m], rb[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=False), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _seg(cz, nm, a, b, r, mat, parent, ol):
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.capsule(nm, r, d.length + 2 * r, tuple(a - d.normalized() * r), mat, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def _disc(cz, nm, r, t, loc, axis, mat, parent, ol=0.0, verts=24, bevel=0.0):
    rot = {'x': (0, 90, 0), 'y': (90, 0, 0), 'z': (0, 0, 0)}[axis]
    return cz.cyl(nm, r, t, loc, mat, rot=rot, verts=verts, bevel=bevel, ol=ol, parent=parent, origin='center')


def _arc(n):
    return [(A * math.cos(math.pi - math.pi * i / n), ZS + A * math.sin(math.pi - math.pi * i / n)) for i in range(n + 1)]


# ---------------------------------------------------------------- the wall
def _wall(cz, name, root, brick, vault):
    N = 24
    arc = _arc(N)
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    cache = {}

    def V(x, y, z):
        k = (round(x, 5), round(y, 5), round(z, 5))
        if k not in cache: cache[k] = bm.verts.new((x, y, z))
        return cache[k]

    def face(pts, kind, mi=0, smooth=False, s_of=None):
        f = bm.faces.new([V(*p) for p in pts]); f.material_index = mi; f.smooth = smooth
        for lp, p in zip(f.loops, pts):
            x, y, z = p
            u, v = {'xz': (x, z), 'yz': (y, z), 'xy': (x, y)}[kind] if kind != 'vault' else (y, s_of(p))
            lp[uvl].uv = (u / 2.0, v / 2.0)
        return f

    for y, sgn in ((YF, 1), (YB, -1)):
        quads = [[(-W / 2, 0), (-A, 0), (-A, ZS), (-W / 2, ZS)], [(-W / 2, ZS), (-A, ZS), (-A, H), (-W / 2, H)],
                 [(A, 0), (W / 2, 0), (W / 2, ZS), (A, ZS)], [(A, ZS), (W / 2, ZS), (W / 2, H), (A, H)]]
        quads += [[arc[i], arc[i + 1], (arc[i + 1][0], H), (arc[i][0], H)] for i in range(N)]
        for q in quads:
            face([(x, y, z) for x, z in q], 'xz')
    xs_top = [-W / 2] + [p[0] for p in arc] + [W / 2]
    for x0, x1 in zip(xs_top, xs_top[1:]):
        face([(x0, YF, H), (x1, YF, H), (x1, YB, H), (x0, YB, H)], 'xy')
    for sx in (-1, 1):
        X = sx * W / 2
        face([(X, YF, 0), (X, YB, 0), (X, YB, ZS), (X, YF, ZS)], 'yz')
        face([(X, YF, ZS), (X, YB, ZS), (X, YB, H), (X, YF, H)], 'yz')
        x0, x1 = sorted((sx * W / 2, sx * A))
        face([(x0, YF, 0), (x1, YF, 0), (x1, YB, 0), (x0, YB, 0)], 'xy')
        face([(sx * A, YF, 0), (sx * A, YF, ZS), (sx * A, YB, ZS), (sx * A, YB, 0)], 'yz', mi=1)
    sofs = {}
    for i, p in enumerate(arc): sofs[round(p[0], 5)] = ZS + A * math.pi * i / N
    s_of = lambda p: sofs[round(p[0], 5)]
    for i in range(N):
        (xa, za), (xb, zb) = arc[i], arc[i + 1]
        face([(xa, YF, za), (xb, YF, zb), (xb, YB, zb), (xa, YB, za)], 'vault', mi=1, smooth=True, s_of=s_of)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name + '_wall', bm, brick, smooth=False)
    o.data.materials.append(vault)
    return cz.place(o, (0, 0, 0), (0, 0, 0), None, root, 0.018, 0.04)


def _arch_stones(cz, name, root, stone):
    y0, y1 = YF - 0.07, YF + 0.03
    n, gap = 9, 0.014
    ri = A - 0.02
    for k in range(n):
        a0 = math.pi - math.pi * k / n - (gap if k else 0); a1 = math.pi - math.pi * (k + 1) / n + (gap if k < n - 1 else 0)
        ro = A + (0.52 if k == n // 2 else 0.38)
        yy0 = y0 - (0.07 if k == n // 2 else 0.0)
        steps = 4
        aa = [a0 + (a1 - a0) * s / steps for s in range(steps + 1)]
        inner = [(ri * math.cos(a), ZS + ri * math.sin(a)) for a in aa]
        outer = [(ro * math.cos(a), ZS + ro * math.sin(a)) for a in aa]
        _band(cz, f'{name}_vous{k}', inner, outer, yy0, y1, stone, root, ol=0.009, bevel=0.015)
    for sx in (-1, 1):            # quoins: four stacked blocks per side, alternating long / short
        z = 0.0
        for k in range(4):
            h = ZS / 4 - (0.014 if k < 3 else 0.0)
            wq = 0.38 if k % 2 == 0 else 0.28
            x0, x1 = sx * ri, sx * (A + wq)
            inner = [(x0, z), (x0, z + h)]; outer = [(x1, z), (x1, z + h)]
            if sx > 0: inner, outer = outer, inner
            _band(cz, f'{name}_quoin{"LR"[sx > 0]}{k}', inner, outer, y0, y1, stone, root, ol=0.009, bevel=0.015)
            z += ZS / 4


def _gate(cz, name, root, open_l, open_r):
    red = cz.toon(name + '_doorm', '#8c231b', tex='grain', tex_strength=0.05)
    gold = cz.toon(name + '_gold', '#c99a2e', tex='grain', tex_scale=2.0, tex_strength=0.05)
    dark = cz.toon(name + '_irondark', '#2e2620')
    stone = cz.toon(name + '_sillm', '#a49a87', tex='grain', tex_strength=0.05)
    cz.box(name + '_sill', (2 * A, 0.3, 0.06), (0, YH, 0.03), stone, bevel=0.01, ol=0.006, parent=root)
    LW = A - 0.04                       # leaf width (hinge post on the outer edge)
    z0, z1 = 0.065, ZS - 0.02
    for side, op in (('L', open_l), ('R', open_r)):
        s = -1 if side == 'L' else 1
        pv = cz.empty(f'{name}_door{side}', (s * (A - 0.03), YH, 0), parent=root)
        pv.rotation_euler = (0, 0, math.radians(-s * 90.0 * max(0.0, min(1.0, float(op)))))
        X = lambda u: -s * u            # pivot-local: u = distance from the hinge toward the middle
        cz.box(f'{name}_leaf{side}', (LW - 0.06, 0.16, z1 - z0), (X(0.06 + (LW - 0.06) / 2), 0, (z0 + z1) / 2), red, bevel=0.012,
               ol=0.012, parent=pv)
        cz.cyl(f'{name}_post{side}', 0.09, z1 - z0 + 0.02, (X(0.07), 0, z0 - 0.01), red, verts=24, bevel=0.01, ol=0.01, parent=pv)
        ku, kz = LW - 0.16, 1.5         # knocker
        for c in range(5):              # studs 5 x 7 on the front face (none under the knocker)
            for r in range(7):
                u = 0.3 + c * (LW - 0.5) / 4; z = 0.42 + r * (z1 - 0.42 - 0.4) / 6
                if math.hypot(u - ku, z - (kz - 0.06)) < 0.24: continue
                cz.sphere(f'{name}_stud{side}{c}{r}', 0.042, (X(u), -0.08, z), gold, ol=0.0035, parent=pv, segs=16, rings=8)
        for k, z in enumerate((z0 + 0.22, z1 - 0.18)):     # two dark iron straps
            cz.box(f'{name}_strap{side}{k}', (LW - 0.12, 0.01, 0.08), (X(0.06 + (LW - 0.06) / 2), -0.083, z), dark, bevel=0.003,
                   ol=0.003, parent=pv)
        _disc(cz, f'{name}_knockplate{side}', 0.11, 0.025, (X(ku), -0.09, kz), 'y', gold, pv, ol=0.005, verts=32, bevel=0.005)
        _disc(cz, f'{name}_knockmouth{side}', 0.042, 0.006, (X(ku), -0.104, kz), 'y', dark, pv, verts=20)
        ring = _lathe(cz, f'{name}_knockring{side}', [(0.08 + 0.016 * math.cos(2 * math.pi * i / 12), 0.016 * math.sin(2 * math.pi * i / 12))
                                                     for i in range(12)], gold, pv, segs=28, ol=0.004, closed=True)
        ring.rotation_euler = (math.radians(90), 0, 0); ring.location = (X(ku), -0.125, kz - 0.085)
    # fixed arched tympanum over the leaves (radius 1 cm inside the vault)
    N = 18
    xs = [(A - 0.01) * math.cos(math.pi - math.pi * i / N) for i in range(N + 1)]
    inner = [(x, ZS) for x in xs]
    outer = [(x, ZS + math.sqrt(max(0.0, (A - 0.01) ** 2 - x * x))) for x in xs]
    _band(cz, name + '_tympanum', inner, outer, YH - 0.06, YH + 0.06, red, root, ol=0.01)
    for k, x in enumerate((-0.75, 0.0, 0.75)):
        r = 0.16 if k == 1 else 0.11
        _disc(cz, f'{name}_rosette{k}', r, 0.03, (x, YH - 0.07, ZS + 0.55 + (0.25 if k == 1 else 0.0)), 'y', gold, root, ol=0.005,
              verts=8, bevel=0.01)


# ---------------------------------------------------------------- roof
def _roof(cz, name, parent, A_, B_, Hr, T, Ze, tiles, soffit, rim, ends, ridge, gold, tile=0.25, bump=0.06, L=0.55, F=0.32,
          S=1.4, nv=22):
    dl = tile / 8

    def prof(v): return Hr * (0.3 * v + 0.7 * v * v)

    def bumpf(c):
        f = ((c / tile + 0.5) % 1.0) - 0.5
        return math.sqrt(max(0.0, 1 - (f / 0.3) ** 2))

    def point(patch, c, v, mode='top'):
        d = v * B_
        if patch in 'FK':
            a = A_ - d; x = max(-a, min(a, c)); s = a - abs(x)
            y = -(B_ - d) if patch == 'F' else (B_ - d); along = x
        else:
            b = B_ - d; y = max(-b, min(b, c)); s = b - abs(y)
            x = (A_ - d) if patch == 'R' else -(A_ - d); along = y
        w = (1 - min(1.0, s / S)) ** 2
        z = prof(v) + L * w * (1 - v) ** 1.5
        if mode == 'top': z += bump * bumpf(along) * min(1.0, s / 0.18)
        elif mode == 'bottom': z -= T
        fl = F * w * (1 - v) ** 2 / math.sqrt(2)
        x += fl * (1 if x > 1e-9 else -1 if x < -1e-9 else 0)
        y += fl * (1 if y > 1e-9 else -1 if y < -1e-9 else 0)
        return (x, y, Ze + z)

    Kx, Ky = int(math.ceil(A_ / dl)), int(math.ceil(B_ / dl))
    csx = [k * dl for k in range(-Kx, Kx + 1)]; csy = [k * dl for k in range(-Ky, Ky + 1)]
    bm = bmesh.new()
    for patch, cs in (('F', csx), ('K', csx), ('R', csy), ('L', csy)):
        Gt = [[bm.verts.new(point(patch, c, j / nv, 'top')) for c in cs] for j in range(nv + 1)]
        Gb = [[bm.verts.new(point(patch, c, j / nv, 'bottom')) for c in cs] for j in range(nv + 1)]
        for j in range(nv):
            for k in range(len(cs) - 1):
                bm.faces.new((Gt[j][k], Gt[j][k + 1], Gt[j + 1][k + 1], Gt[j + 1][k])).material_index = 0
                bm.faces.new((Gb[j][k], Gb[j + 1][k], Gb[j + 1][k + 1], Gb[j][k + 1])).material_index = 1
        for k in range(len(cs) - 1):
            bm.faces.new((Gt[0][k], Gb[0][k], Gb[0][k + 1], Gt[0][k + 1])).material_index = 2
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bad = [f for f in bm.faces if f.calc_area() < 1e-10]
    if bad: bmesh.ops.delete(bm, geom=bad, context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces: f.smooth = True
    o = cz._mesh_obj(name + '_roof', bm, tiles, smooth=False)
    for m in (soffit, rim): o.data.materials.append(m)
    try: o.data.set_sharp_from_angle(angle=math.radians(38))
    except Exception as e: print('CZ gate: sharp edges', e)
    cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, 0.016, 0.0)
    # round tile ends along all four eaves
    k = 0
    for patch, cs_n, axis, sgn in (('F', A_, 'y', -1), ('K', A_, 'y', 1), ('R', B_, 'x', 1), ('L', B_, 'x', -1)):
        m = int((cs_n - 0.3) / tile)
        for i in range(-m, m + 1):
            x, y, z = point(patch, i * tile, 0.0, 'base')
            off = (0, sgn * 0.012, 0) if axis == 'y' else (sgn * 0.012, 0, 0)
            _disc(cz, f'{name}_tileend{k}', 0.07, 0.03, (x + off[0], y + off[1], z + bump * 0.5), axis, ends, parent, ol=0.004,
                  verts=16)
            k += 1
    # hip ridges (up from the ridge ends, curling up past the corners) + ridge beasts
    for hx, hy, patch in ((1, -1, 'F'), (-1, -1, 'F'), (1, 1, 'K'), (-1, 1, 'K')):
        pts = [point(patch, hx * 99.0, 1 - j / 16, 'base') for j in range(17)]
        p0, p1 = Vector(pts[-1]), Vector(pts[-2])
        dv = Vector((p0.x - p1.x, p0.y - p1.y, 0)).normalized()
        pts += [tuple(p0 + dv * 0.16 + Vector((0, 0, 0.1))), tuple(p0 + dv * 0.28 + Vector((0, 0, 0.28))),
                tuple(p0 + dv * 0.33 + Vector((0, 0, 0.42)))]
        _sweep(cz, f'{name}_hip{"LR"[hx > 0]}{"FB"[hy > 0]}', pts, 0.2, 0.17, ridge, parent, ol=0.01)
        for b, v in enumerate((0.1, 0.17, 0.24, 0.31)):
            x, y, z = point(patch, hx * 99.0, v, 'base')
            cz.sphere(f'{name}_beast{"LR"[hx > 0]}{"FB"[hy > 0]}{b}', 0.07 if b else 0.085, (x, y, z + 0.2 + (0.02 if b == 0 else 0)),
                      ends, ol=0.005, parent=parent, segs=16, rings=8)
    # main ridge + curled end ornaments
    Zr = Ze + Hr
    RL = A_ - B_
    cz.box(name + '_ridge', (2 * RL + 0.3, 0.3, 0.34), (0, 0, Zr + 0.11), ridge, bevel=0.03, ol=0.012, parent=parent)
    for sx in (-1, 1):
        k = 'LR'[sx > 0]; xe = sx * (RL + 0.1)
        cz.box(f'{name}_chiwenbase{k}', (0.36, 0.34, 0.3), (xe, 0, Zr + 0.38), ridge, bevel=0.03, ol=0.01, parent=parent)
        c = Vector((xe - sx * 0.02, 0, Zr + 0.82)); R = 0.3
        arc = [c + Vector((sx * R * math.cos(math.radians(a)), 0, R * math.sin(math.radians(a)) * 1.05))
               for a in (-80, -30, 20, 70, 120, 165, 205)]
        for j in range(len(arc) - 1):
            _seg(cz, f'{name}_chiwen{k}{j}', arc[j], arc[j + 1], 0.12 - 0.012 * j, ridge, parent, 0.01)
        cz.sphere(f'{name}_chiwenpearl{k}', 0.075, tuple(arc[-1] + Vector((0, 0, -0.03))), gold, ol=0.005, parent=parent,
                  segs=20, rings=10)
        for sy in (-1, 1):
            _disc(cz, f'{name}_chiweneye{k}{"FB"[sy > 0]}', 0.055, 0.012, (c.x, sy * 0.125, c.z), 'y', gold, parent, ol=0.003,
                  verts=20)


# ---------------------------------------------------------------- top of the wall + gatehouse
def _top(cz, name, root, gatehouse, windows_lit, brick):
    stone = cz.toon(name + '_stonem', '#b9ad96', tex='grain', tex_scale=0.6, tex_strength=0.06)
    for i in range(8):                      # crenellated front parapet
        x = -3.5 + i
        cz.box(f'{name}_merlon{i}', (0.62, 0.45, 0.62), (x, YF + 0.225, H + 0.31), brick, bevel=0.03, ol=0.012, parent=root)
    cz.box(name + '_parapetlow', (W, 0.45, 0.2), (0, YF + 0.225, H + 0.1), brick, bevel=0.02, ol=0.01, parent=root)
    cz.box(name + '_rearparapet', (W, 0.3, 0.5), (0, YB - 0.15, H + 0.25), brick, bevel=0.03, ol=0.012, parent=root)
    if not gatehouse: return
    red = cz.toon(name + '_lacquer', '#9a221c', tex='grain', tex_strength=0.04)
    wallm = cz.toon(name + '_gwall', '#8c2e22', tex='grain', tex_strength=0.05)
    teal = cz.toon(name + '_teal', '#2b6a5c', tex='grain', tex_strength=0.04)
    blue = cz.toon(name + '_blue', '#2a4d7a', tex='grain', tex_strength=0.04)
    gold = cz.toon(name + '_gold', '#c99a2e', tex='grain', tex_scale=2.0, tex_strength=0.05)
    darkred = cz.toon(name + '_plate', '#4e1712')
    z0 = H + 0.25
    cz.box(name + '_platform', (5.4, 2.0, 0.25), (0, 0, H + 0.125), stone, bevel=0.03, ol=0.012, parent=root)
    zc1 = z0 + 2.1
    for i, x in enumerate((-2.4, -0.8, 0.8, 2.4)):
        for j, y in enumerate((-0.8, 0.8)):
            cz.cyl(f'{name}_colbase{i}{j}', 0.2, 0.08, (x, y, z0), stone, verts=24, bevel=0.015, ol=0.006, parent=root)
            cz.cyl(f'{name}_col{i}{j}', 0.14, zc1 - z0 - 0.08, (x, y, z0 + 0.08), red, verts=24, ol=0.009, parent=root)
    # front lattice panels (2 per bay), side + back walls
    pm = (cz.toon(name + '_latticelit', img=os.path.join(TEX, 'city_gate_lattice_lit.png'), lift=0.6, emit=0.9)
          if windows_lit else cz.toon(name + '_latticem', img=os.path.join(TEX, 'city_gate_lattice.png'), lift=0.55))
    for b, xc in enumerate((-1.6, 0.0, 1.6)):
        for p, dx in enumerate((-0.33, 0.33)):
            cz.plane(f'{name}_panel{b}{p}', 0.655, 1.96, (xc + dx, -0.8, z0 + 0.04 + 0.98), pm, parent=root)
    cz.box(name + '_panelsill', (4.8, 0.14, 0.06), (0, -0.8, z0 + 0.03), red, bevel=0.01, ol=0.006, parent=root)
    cz.box(name + '_lintel', (4.8, 0.14, 0.12), (0, -0.8, zc1 - 0.06), red, bevel=0.01, ol=0.006, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_sidewall{"LR"[sx > 0]}', (0.12, 1.6, 2.02), (sx * 2.4, 0, z0 + 1.01), wallm, bevel=0.01, ol=0.009, parent=root)
    cz.box(name + '_backwall', (4.8, 0.12, 2.02), (0, 0.8, z0 + 1.01), wallm, bevel=0.01, ol=0.009, parent=root)
    # frieze + gold stripe, roof base, brackets
    cz.box(name + '_frieze', (5.1, 1.86, 0.25), (0, 0, zc1 + 0.125), teal, bevel=0.015, ol=0.01, parent=root)
    for sy in (-1, 1):
        cz.box(f'{name}_friezestripe{"FB"[sy > 0]}', (5.0, 0.006, 0.05), (0, sy * 0.933, zc1 + 0.13), gold, bevel=0.0, ol=0.0,
               parent=root)
    cz.box(name + '_roofbase', (5.0, 1.8, 0.36), (0, 0, zc1 + 0.25 + 0.17), darkred, bevel=0.0, ol=0.0, parent=root)
    zb = zc1 + 0.25
    for sy in (-1, 1):
        for i, x in enumerate((-2.4, -1.6, -0.8, 0.0, 0.8, 1.6, 2.4)):
            cz.box(f'{name}_brk{"FB"[sy > 0]}{i}', (0.22, 0.34, 0.12), (x, sy * 0.92, zb + 0.06), blue, bevel=0.015, ol=0.005,
                   parent=root)
            cz.box(f'{name}_brkcap{"FB"[sy > 0]}{i}', (0.3, 0.24, 0.1), (x, sy * 1.0, zb + 0.17), teal, bevel=0.015, ol=0.005,
                   parent=root)
    for sx in (-1, 1):
        for j, y in enumerate((-0.4, 0.4)):
            cz.box(f'{name}_brkS{"LR"[sx > 0]}{j}', (0.34, 0.22, 0.12), (sx * 2.55, y, zb + 0.06), blue, bevel=0.015, ol=0.005,
                   parent=root)
    # name plaque hung at the centre front
    cz.box(name + '_plaqueboard', (0.5, 0.05, 1.2), (0, -0.98, zc1 - 0.42), gold, bevel=0.01, ol=0.006, parent=root)
    cz.plane(name + '_plaque', 0.42, 0.42 * 760 / 300, (0, -1.0065, zc1 - 0.42),
             cz.toon(name + '_plaquem', img=os.path.join(TEX, 'city_gate_plaque.png'), lift=0.55), parent=root)
    # roof
    tiles = cz.toon(name + '_tiles', '#46525a', tex='grain', tex_scale=1.5, tex_strength=0.05)
    soffit = cz.toon(name + '_soffit', '#24493f', tex='grain', tex_strength=0.04)
    rim = cz.toon(name + '_rim', '#36414a')
    ends = cz.toon(name + '_tileends', '#77838b', tex='grain', tex_strength=0.04)
    ridge = cz.toon(name + '_ridgem', '#3a454d', tex='grain', tex_strength=0.05)
    _roof(cz, name, root, 3.3, 1.65, 1.6, 0.2, zb + 0.2, tiles, soffit, rim, ends, ridge, gold)


# ---------------------------------------------------------------- dressing
def _wave_card(cz, name, w, h, loc, mat, parent, amp=0.05, nx=6, nz=18):
    """A banner card hanging from its top edge (loc = top centre), facing -Y, gently waved (more at the bottom)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); vs = []
    for j in range(nz + 1):
        t = j / nz; row = []
        for i in range(nx + 1):
            u = i / nx
            y = amp * (0.25 + 0.75 * t) * math.sin(2 * math.pi * (u * 0.8 + t * 0.9))
            row.append(bm.verts.new((loc[0] + (u - 0.5) * w, loc[1] + y, loc[2] - t * h)))
        vs.append(row)
    for j in range(nz):
        for i in range(nx):
            f = bm.faces.new((vs[j][i], vs[j + 1][i], vs[j + 1][i + 1], vs[j][i + 1]))
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j))):
                lp[uvl].uv = (ii / nx, 1 - jj / nz)
    for f in bm.faces:
        if f.normal.y > 0: f.normal_flip()
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, 0.0, 0.0)


def _banners(cz, name, root):
    bm = cz.toon(name + '_bannerm', img=os.path.join(TEX, 'city_gate_banner.png'), alpha_clip=True, lift=0.6)
    wood = cz.toon(name + '_polem', '#4a2e1f', tex='wood', tex_scale=20.0, tex_strength=0.08)
    gold = cz.toon(name + '_gold', '#c99a2e')
    for sx in (-1, 1):
        k = 'LR'[sx > 0]; x = sx * 3.1; zt = 5.86; yb = YF - 0.2
        cz.cyl(f'{name}_pole{k}', 0.035, 1.0, (x - 0.5, yb, zt + 0.02), wood, rot=(0, 90, 0), verts=16, ol=0.005, parent=root)
        for e in (-1, 1):
            cz.sphere(f'{name}_polecap{k}{"ab"[e > 0]}', 0.055, (x + e * 0.52, yb, zt + 0.02), gold, ol=0.004, parent=root, segs=16,
                      rings=8)
            cz.box(f'{name}_polearm{k}{"ab"[e > 0]}', (0.05, 0.24, 0.05), (x + e * 0.38, YF - 0.1, zt + 0.02), wood, bevel=0.008,
                   ol=0.004, parent=root)
        _wave_card(cz, f'{name}_banner{k}', 0.8, 2.4, (x, yb, zt), bm, root, amp=0.06)


def _torches(cz, name, root, lit):
    iron = cz.toon(name + '_iron', '#2e2620')
    wood = cz.toon(name + '_torchwood', '#5a3a24', tex='wood', tex_scale=20.0, tex_strength=0.08)
    head = cz.toon(name + '_torchhead', '#3a2a20' if lit else '#2a221e')
    for sx in (-1, 1):
        k = 'LR'[sx > 0]; x = sx * TORCH_X
        lean = math.radians(16)
        yr = YF - 0.3 - 0.26 * math.tan(lean)           # the leaning stick's centre at the ring's height
        cz.box(f'{name}_tplate{k}', (0.16, 0.03, 0.3), (x, YF - 0.015, TORCH_Z), iron, bevel=0.008, ol=0.004, parent=root)
        cz.box(f'{name}_tarm{k}', (0.05, (YF - 0.015) - (yr + 0.06), 0.05), (x, ((YF - 0.015) + (yr + 0.06)) / 2, TORCH_Z - 0.06), iron,
               bevel=0.008, ol=0.004, parent=root)
        ring = _lathe(cz, f'{name}_tring{k}', [(0.062 + 0.012 * math.cos(2 * math.pi * i / 10), 0.012 * math.sin(2 * math.pi * i / 10))
                                              for i in range(10)], iron, root, segs=20, ol=0.003, closed=True)
        ring.location = (x, yr, TORCH_Z - 0.04)
        tp = cz.empty(f'{name}_torch{k}', (x, YF - 0.3, TORCH_Z - 0.3), parent=root)
        tp.rotation_euler = (lean, 0, 0)                 # the top leans out, away from the wall (-Y)
        cz.cyl(f'{name}_tstick{k}', 0.04, 0.62, (0, 0, 0), wood, r2=0.05, verts=16, ol=0.005, parent=tp)
        cz.cyl(f'{name}_thead{k}', 0.07, 0.16, (0, 0, 0.6), head, r2=0.075, verts=20, bevel=0.01, ol=0.005, parent=tp)
        if lit:
            fp = cz.empty(f'{name}_flame{k}', (0, 0, 0.74), parent=tp)
            fp.rotation_euler = (-lean, 0, 0)            # flames stand straight up
            outer = cz.glow(name + '_flameout', '#ff8a2c', 3.0)
            inner = cz.glow(name + '_flamein', '#ffe08a', 4.0)
            _lathe(cz, f'{name}_flameo{k}', [(0, 0.0), (0.08, 0.03), (0.115, 0.12), (0.095, 0.24), (0.05, 0.36), (0, 0.48)], outer,
                   fp, segs=20)
            _lathe(cz, f'{name}_flamei{k}', [(0, 0.02), (0.05, 0.04), (0.07, 0.11), (0.05, 0.2), (0, 0.3)], inner, fp,
                   loc=(0, -0.05, 0.0), segs=16)


def build(cz, name='city_gate', open=0.0, openL=None, openR=None, lit=True, windows_lit=False, banners=True, gatehouse=True):
    root = cz.empty(name)
    brick = cz.toon(name + '_brick', img=os.path.join(TEX, 'city_gate_brick.png'), lift=0.6)
    vault = cz.toon(name + '_vault', img=os.path.join(TEX, 'city_gate_brick.png'), lift=0.6, tint='#a69a8a')
    stone = cz.toon(name + '_archstone', '#b9ad96', tex='grain', tex_scale=0.8, tex_strength=0.06)
    footing = cz.toon(name + '_footing', '#857c6d', tex='grain', tex_scale=0.8, tex_strength=0.06)
    _wall(cz, name, root, brick, vault)
    _arch_stones(cz, name, root, stone)
    for sx in (-1, 1):            # dark stone footing along the front, up to the quoins
        x0, x1 = sx * (A + 0.4), sx * W / 2
        cz.box(f'{name}_footing{"LR"[sx > 0]}', (abs(x1 - x0), 0.1, 0.45), ((x0 + x1) / 2, YF - 0.03, 0.225), footing, bevel=0.02,
               ol=0.009, parent=root)
    cz.box(name + '_floor', (2 * A - 0.02, D + 0.6, 0.03), (0, 0, 0.015), cz.toon(name + '_floorm', '#a9a08e', tex='grain',
           tex_scale=0.8, tex_strength=0.06), bevel=0.008, ol=0.008, parent=root)
    _gate(cz, name, root, open if openL is None else openL, open if openR is None else openR)
    _top(cz, name, root, gatehouse, windows_lit, brick)
    if banners: _banners(cz, name, root)
    _torches(cz, name, root, lit)
    return root
