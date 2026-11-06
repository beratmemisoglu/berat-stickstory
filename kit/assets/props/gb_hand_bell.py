# BELL film: a small brass hand bell (~0.165 m): a hollow lathed bell (thick lip, flared skirt, two engraved rings),
# a brass collar and a turned dark-wood handle (collar, bulb, knob), and a clapper (rod + ball) hanging inside on the
# pivot empty <name>_clapper (rotation_euler.y swings it; kw clapper=deg for a test pose).
# Root = the bottom of the lip (the bell stands on a table), front -Y. META 'grip' = the handle middle (local).
import math, bmesh
from mathutils import Vector

META = {'size': (0.144, 0.144, 0.18), 'anchor': 'bottom of the lip (stands on a table), front -Y',
        'grip': (0.0, 0.0, 0.135), 'mouth': (0.0, 0.0, 0.0),
        'animate': ['_clapper (rotation_euler.y, +deg swings the ball toward -X; ~ +-30 deg reaches the lip)'],
        'params': "clapper=0.0 (deg, test pose), wood='#4e2c1a', brass='#9a6e1e'"}


def _lathe(cz, name, prof, mat, parent=None, loc=(0, 0, 0), segs=32, ol=0.004, vs=None):
    """Surface of revolution about Z. prof = [(r, z), ...] from the bottom centre, up the OUTSIDE (normals point out);
    r == 0 makes a pole. UVs: u around, v along the profile (or the explicit list vs)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    rings = []
    for r, z in prof:
        rings.append([bm.verts.new((0, 0, z))] if r < 1e-6 else
                     [bm.verts.new((r * math.cos(2 * math.pi * j / segs), r * math.sin(2 * math.pi * j / segs), z)) for j in range(segs)])
    if vs is None:
        L = [0.0]
        for (r0, z0), (r1, z1) in zip(prof, prof[1:]): L.append(L[-1] + math.hypot(r1 - r0, z1 - z0))
        vs = [x / (L[-1] or 1) for x in L]
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        if len(a) == 1 and len(b) == 1: continue
        for j in range(segs):
            j2 = (j + 1) % segs; u0, u1 = j / segs, (j + 1) / segs
            if len(a) == 1: q = [(a[0], (u0 + u1) / 2, vs[i]), (b[j2], u1, vs[i + 1]), (b[j], u0, vs[i + 1])]
            elif len(b) == 1: q = [(a[j], u0, vs[i]), (a[j2], u1, vs[i]), (b[0], (u0 + u1) / 2, vs[i + 1])]
            else: q = [(a[j], u0, vs[i]), (a[j2], u1, vs[i]), (b[j2], u1, vs[i + 1]), (b[j], u0, vs[i + 1])]
            f = bm.faces.new([x[0] for x in q])
            for lp, x in zip(f.loops, q): lp[uvl].uv = (x[1], x[2])
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), loc, (0, 0, 0), None, parent, ol, 0.0)


def _tube(cz, name, pts, r, mat, parent=None, ol=0.003, sides=10, closed=False, r_end=None):
    """A round tube swept along pts (parallel-transport frames), capped unless closed."""
    bm = bmesh.new(); P = [Vector(p) for p in pts]; n = len(P); rings = []; prev = None
    for i, p in enumerate(P):
        t = (P[(i + 1) % n] - P[i - 1]) if closed else (P[min(i + 1, n - 1)] - P[max(i - 1, 0)])
        t.normalize()
        if prev is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            nr = (ref - t * ref.dot(t)).normalized()
        else: nr = (prev - t * prev.dot(t)).normalized()
        prev = nr; bn = t.cross(nr)
        rr = r if r_end is None else r + (r_end - r) * i / max(1, n - 1)
        rings.append([bm.verts.new(p + (nr * math.cos(2 * math.pi * k / sides) + bn * math.sin(2 * math.pi * k / sides)) * rr) for k in range(sides)])
    for i in range(n if closed else n - 1):
        a, b = rings[i], rings[(i + 1) % n]
        for k in range(sides): bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    if not closed: bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def build(cz, name='gb_hand_bell', clapper=0.0, wood='#4e2c1a', brass='#9a6e1e'):
    root = cz.empty(name)
    bm_ = cz.toon(name + '_brass', brass, tex='grain', tex_scale=5.0, tex_strength=0.07)
    dark = cz.toon(name + '_brassdk', '#5e4012')
    inner = cz.toon(name + '_inner', '#5a3f14', tex='grain', tex_strength=0.05)
    wd = cz.toon(name + '_wood', wood, tex='wood', tex_scale=8.0, tex_strength=0.12)
    # hollow bell: from the inner apex down the inside, round the lip, up the outside to the crown
    # classic bell profile: round crown, shoulder, concave waist, flared skirt, thick bead lip
    prof = [(0, 0.07), (0.02, 0.066), (0.033, 0.055), (0.036, 0.04), (0.044, 0.024), (0.054, 0.008), (0.057, 0.0), (0.064, 0.002),
            (0.067, 0.009), (0.063, 0.017), (0.054, 0.027), (0.046, 0.042), (0.042, 0.056), (0.04, 0.067), (0.034, 0.078), (0.022, 0.085),
            (0, 0.087)]
    b = _lathe(cz, name + '_bell', prof, bm_, root, segs=48, ol=0.005)
    b.data.materials.append(inner)
    for p in b.data.polygons:   # the inside faces get a darker brass (it reads hollow)
        if p.center.z < 0.071 and p.normal.dot(Vector((p.center.x, p.center.y, 0))) < 0 and math.hypot(p.center.x, p.center.y) < 0.058:
            p.material_index = 1
    # engraved rings on the skirt
    for k, (z, r) in enumerate(((0.02, 0.0607), (0.034, 0.0507))):
        pts = [(r * math.cos(2 * math.pi * j / 48), r * math.sin(2 * math.pi * j / 48), z) for j in range(48)]
        _tube(cz, f'{name}_ring{k}', pts, 0.0016, dark, root, ol=0.0, sides=6, closed=True)
    # collar + turned handle (long enough to show past a 0.1 m ball hand)
    _lathe(cz, name + '_collar', [(0, 0.082), (0.024, 0.082), (0.025, 0.088), (0.018, 0.094), (0, 0.094)], bm_, root, segs=32, ol=0.003)
    _lathe(cz, name + '_handle', [(0, 0.093), (0.0135, 0.093), (0.0115, 0.1), (0.0115, 0.108), (0.016, 0.12), (0.0175, 0.133), (0.016, 0.146),
                                   (0.0115, 0.155), (0.01, 0.159), (0.0165, 0.165), (0.0155, 0.172), (0.007, 0.1755), (0, 0.176)],
           wd, root, segs=28, ol=0.004)
    # clapper: pivot just under the apex, rod + ball
    cl = cz.empty(name + '_clapper', (0, 0, 0.066), parent=root)
    cl.rotation_euler = (0, math.radians(clapper), 0)
    _tube(cz, name + '_rod', [(0, 0, 0.002), (0, 0, -0.044)], 0.0028, dark, cl, ol=0.0012, sides=8)
    cz.sphere(name + '_ball', 0.012, (0, 0, -0.05), dark, ol=0.002, parent=cl, segs=16, rings=10)
    root['grip'] = META['grip']
    return root
