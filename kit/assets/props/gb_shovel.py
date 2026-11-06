# BELL film: a period spade (~1.15 m): an iron blade (dished, pointed-round tip, rolled tread step on top, worn bright
# edge, dirt clods stuck on the front), a riveted socket, an ash shaft with grain, an iron ferrule and a wooden D-grip.
# Root = the BLADE TIP on the floor, the shovel standing up +Z, the blade's dished front facing -Y (lean it on a wall by
# rotating the root about X / Y). META 'grip' = D-grip centre, 'mid' = shaft middle (second hand), both local.
import math, bmesh
from mathutils import Vector

META = {'size': (0.21, 0.06, 1.145), 'anchor': 'blade tip (z = 0), shovel along +Z, dished blade front -Y',
        'grip': (0.0, 0.024, 1.118), 'mid': (0.0, 0.024, 0.72), 'tread': (0.0, 0.016, 0.296),
        'animate': [], 'params': "dirt=True (clods on the blade), wood='#7a4e2a', iron='#383b40'"}


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


def _blade_outline(n=14):
    """Spade outline in XZ, tip at (0, 0): rounded-pointed bottom, straight sides, flat top at z = 0.28."""
    W, Hs, Ht = 0.1, 0.085, 0.28
    pts = []
    for i in range(n + 1):                       # right half of the tip curve
        k = i / n
        pts.append((W * math.sin(k * math.pi / 2) ** 0.8, Hs * (1 - math.cos(k * math.pi / 2)) ** 1.0))
    pts += [(W, Hs + 0.02), (W * 0.99, Ht)]
    right = pts
    left = [(-x, z) for x, z in reversed(right[1:])]
    return right + [(-W * 0.99, Ht)][0:0] + left[:-0 or None]


def _blade(cz, name, mat, parent, ol):
    """Dished slab: the outline extruded 12 mm in Y, the front bowed back (concave toward -Y)."""
    ring = _blade_outline()
    # close the loop: right side goes tip -> top-right; left mirrored back down; add the top edge implicitly
    loop = ring[:]                                # tip .. right top .. left top .. left tip side
    bm = bmesh.new(); T = 0.012
    def dish(x, z): return 0.9 * x * x   # sides come forward (-Y): a concave front
    fr = [bm.verts.new((x, -T / 2 - dish(x, z) + 0.02, z)) for x, z in loop]
    bk = [bm.verts.new((x, T / 2 - dish(x, z) + 0.02, z)) for x, z in loop]
    n = len(loop)
    bm.faces.new(fr[::-1]); bm.faces.new(bk)
    for i in range(n):
        bm.faces.new((fr[i], fr[(i + 1) % n], bk[(i + 1) % n], bk[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=False), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.004)


def build(cz, name='gb_shovel', dirt=True, wood='#7a4e2a', iron='#383b40'):
    root = cz.empty(name)
    im = cz.toon(name + '_iron', iron, tex='grain', tex_scale=4.0, tex_strength=0.09)
    worn = cz.toon(name + '_worn', '#8c8f92', tex='grain', tex_scale=5.0, tex_strength=0.08)
    wd = cz.toon(name + '_wood', wood, tex='wood', tex_scale=5.0, tex_strength=0.12)
    dk = cz.toon(name + '_dirt', '#4b3322', tex='grain', tex_scale=8.0, tex_strength=0.15)
    _blade(cz, name + '_blade', im, root, 0.005)
    # worn bright cutting edge: a flat band 1.5 mm in front of the blade face, inset from the bevel, along the tip curve
    edge = []
    for i in range(0, 15):
        k = i / 14
        edge.append((0.1 * math.sin(k * math.pi / 2) ** 0.8, 0.085 * (1 - math.cos(k * math.pi / 2))))
    curve = [(-x, z) for x, z in reversed(edge[1:])] + edge
    bm = bmesh.new()
    def fy(x): return 0.0125 - 0.9 * x * x
    outer = [bm.verts.new((x * 0.95, fy(x * 0.95), z * 0.95 + 0.006)) for x, z in curve]
    inner = [bm.verts.new((x * 0.86, fy(x * 0.86), z * 0.86 + 0.016)) for x, z in curve]
    for i in range(len(curve) - 1):
        bm.faces.new((outer[i], outer[i + 1], inner[i + 1], inner[i]))
    for f in bm.faces:
        if f.normal.y > 0: f.normal_flip()
    cz.place(cz._mesh_obj(name + '_edge', bm, worn, smooth=False), (0, 0, 0), (0, 0, 0), None, root, 0.0, 0.0)
    # rolled tread step on top of the blade + the strap running up into the socket
    cz.box(name + '_tread', (0.205, 0.03, 0.016), (0, 0.016, 0.288), im, bevel=0.005, ol=0.004, parent=root)
    cz.box(name + '_strap', (0.05, 0.016, 0.16), (0, 0.024, 0.22), im, bevel=0.004, ol=0.004, parent=root)
    cz.cyl(name + '_socket', 0.026, 0.17, (0, 0.024, 0.29), im, r2=0.021, verts=16, bevel=0.003, ol=0.004, parent=root)
    for i, z in enumerate((0.33, 0.42)):
        cz.sphere(f'{name}_rivet{i}', 0.006, (0, 0.024 - 0.024, z), worn, ol=0.0015, parent=root, segs=10, rings=6)
    # shaft (grain runs along it: wave bands across X), ferrule, D-grip
    cz.cyl(name + '_shaft', 0.0205, 0.62, (0, 0.024, 0.42), wd, r2=0.019, verts=16, ol=0.005, parent=root)
    cz.cyl(name + '_ferrule', 0.0225, 0.04, (0, 0.024, 1.0), im, verts=16, bevel=0.003, ol=0.004, parent=root)
    loop = [(0, 0.024, 1.03), (0.036, 0.024, 1.05), (0.058, 0.024, 1.08), (0.062, 0.024, 1.105), (0.05, 0.024, 1.125),
            (0, 0.024, 1.128), (-0.05, 0.024, 1.125), (-0.062, 0.024, 1.105), (-0.058, 0.024, 1.08), (-0.036, 0.024, 1.05)]
    _tube(cz, name + '_dgrip', loop, 0.0125, wd, root, ol=0.004, sides=12, closed=True)
    cz.cyl(name + '_handle', 0.017, 0.11, (0, 0.024, 1.118), wd, rot=(0, 90, 0), verts=16, bevel=0.004, ol=0.004, parent=root, origin='center')
    cz.cyl(name + '_neck', 0.021, 0.035, (0, 0.024, 1.025), wd, r2=0.016, verts=16, ol=0.004, parent=root)
    if dirt:
        # clods stuck on the dished front, lower half (meshes deformed in place, no object scale: ISSUES 16)
        for i, (x, z, r) in enumerate(((0.045, 0.045, 0.03), (0.075, 0.085, 0.016), (-0.055, 0.15, 0.013), (0.01, 0.12, 0.009),
                                        (0.02, 0.21, 0.008))):
            o = cz.sphere(f'{name}_clod{i}', r, (x, 0.02 - 0.9 * x * x - 0.009, z), dk, ol=0.002, parent=root, segs=12, rings=8)
            for v in o.data.vertices:
                c = v.co
                w = 1 + 0.25 * math.sin(c.x * 300 + i) * math.cos(c.z * 260)
                v.co = (c.x * 1.3 * w, c.y * 0.45, c.z * w)
            o.data.update()
        o = cz.sphere(name + '_clod_tread', 0.014, (0.05, 0.016, 0.3), dk, ol=0.002, parent=root, segs=12, rings=8)
        for v in o.data.vertices: v.co = (v.co.x * 1.4, v.co.y * 1.1, v.co.z * 0.55)
        o.data.update()
    root['grip'] = META['grip']; root['mid'] = META['mid']
    return root
