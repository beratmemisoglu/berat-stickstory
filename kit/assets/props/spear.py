# Palace guard's spear (~2.24 m): a chunky wooden shaft (lengthwise grain), a bronze butt cap with a knob, a dark cord
# grip wrap at the hand, a bronze socket with a collar, a big red horsehair tassel flaring around the socket, and a
# leaf-shaped steel blade with a raised centre ridge (diamond section). kind='halberd' adds a crescent side blade on
# +X and a short back spike on -X (a ji).
# Hand-held prop: the ROOT IS THE GRIP POINT (centre of the wrap); the spear points up +Z, the butt is grip metres
# below it (default 0.62: held at a standing hand's height, the butt touches the floor). char.hold(spear, 'R', ...)
# puts the root on the hand; tilt it with hold(rot=...) (e.g. rot=(0, 12, 0) to lean it on the shoulder).
import math, bmesh
from mathutils import Vector

META = {'size': (0.2, 0.2, 2.24), 'anchor': 'grip point (centre of the cord wrap); points +Z, butt at -grip',
        'animate': [], 'params': "kind='spear'|'halberd', grip=0.62 (butt to grip, m), tassel='#c22a1e'"}

L = 2.24


def _lathe(cz, name, prof, mat, parent, loc=(0, 0, 0), segs=32, ol=0.003, mod=None):
    """Surface of revolution; r = 0 makes a pole. mod(a, z) -> radius factor (tufts)."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r <= 1e-6: rings.append([bm.verts.new((0, 0, z))]); continue
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs; k = mod(a, z) if mod else 1.0
            ring.append(bm.verts.new((r * k * math.cos(a), r * k * math.sin(a), z)))
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            if len(ra) == 1: bm.faces.new((ra[0], rb[j], rb[i]))
            elif len(rb) == 1: bm.faces.new((ra[i], ra[j], rb[0]))
            else: bm.faces.new((ra[i], ra[j], rb[j], rb[i]))
    if len(rings[0]) > 1: bm.faces.new(rings[0][::-1])
    if len(rings[-1]) > 1: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat), loc, (0, 0, 0), None, parent, ol, 0.0)


def _blade(cz, name, z0, length, wmax, th, mat, parent):
    """Leaf blade: diamond cross-section rows from the base (z0) to a point."""
    bm = bmesh.new(); rows = []
    n = 14
    for k in range(n):
        t = k / n
        w = wmax * (math.sin(math.pi * min(1.0, t / 0.62) / 2) if t < 0.3 else (1 - (t - 0.3) / 0.7) ** 0.85)
        w = max(w, 0.012) if k == 0 else w
        tt = th * (1 - 0.6 * t)
        z = z0 + length * t
        rows.append([bm.verts.new(p) for p in ((w, 0, z), (0, tt, z), (-w, 0, z), (0, -tt, z))])
    tip = bm.verts.new((0, 0, z0 + length))
    for ra, rb in zip(rows, rows[1:]):
        for i in range(4):
            bm.faces.new((ra[i], ra[(i + 1) % 4], rb[(i + 1) % 4], rb[i]))
    for i in range(4): bm.faces.new((rows[-1][i], rows[-1][(i + 1) % 4], tip))
    bm.faces.new(rows[0][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=False), (0, 0, 0), (0, 0, 0), None, parent, 0.004, 0.0)


def _crescent(cz, name, zc, mat, parent, side=1):
    """Ji side blade: a crescent in the XZ plane on +X (side=1), thick in the middle, outer edge sharp."""
    bm = bmesh.new(); n = 16
    outer, inner = [], []
    for k in range(n + 1):
        a = math.radians(-70 + 140 * k / n)
        outer.append((side * (0.03 + 0.16 * math.cos(a)), zc + 0.19 * math.sin(a)))
        inner.append((side * (0.03 + 0.085 * math.cos(a) + 0.02), zc + 0.12 * math.sin(a)))
    T = 0.012
    vo = [(bm.verts.new((x, 0, z)),) for x, z in outer]
    vf = [bm.verts.new((x, -T, z)) for x, z in inner]; vb = [bm.verts.new((x, T, z)) for x, z in inner]
    for k in range(n):
        o0, o1 = vo[k][0], vo[k + 1][0]
        bm.faces.new((o0, o1, vf[k + 1], vf[k])); bm.faces.new((o1, o0, vb[k], vb[k + 1]))
    # spine (inner edge, flat) + end caps
    for k in range(n): bm.faces.new((vf[k], vf[k + 1], vb[k + 1], vb[k]))
    bm.faces.new((vo[0][0], vf[0], vb[0])); bm.faces.new((vo[n][0], vb[n], vf[n]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=False), (0, 0, 0), (0, 0, 0), None, parent, 0.003, 0.0)


def build(cz, name='spear', kind='spear', grip=0.62, tassel='#c22a1e'):
    root = cz.empty(name)
    wood = cz.toon(name + '_wood', '#8a5a33', tex='wood', tex_scale=30.0, tex_strength=0.09)
    bronze = cz.toon(name + '_bronze', '#9a6a30', tex='grain', tex_scale=4.0, tex_strength=0.05)
    steel = cz.toon(name + '_steel', '#b8bcb9', tex='grain', tex_scale=4.0, tex_strength=0.04)
    wrap = cz.toon(name + '_wrap', '#4a2a20')
    zb = -grip                         # butt
    zs = zb + L - 0.38                 # socket base
    # butt cap + knob
    cz.cyl(name + '_butt', 0.031, 0.09, (0, 0, zb + 0.02), bronze, r2=0.028, verts=20, bevel=0.004, ol=0.004, parent=root)
    cz.sphere(name + '_buttknob', 0.029, (0, 0, zb + 0.025), bronze, ol=0.004, parent=root, segs=20, rings=10)
    # shaft
    cz.cyl(name + '_shaft', 0.025, zs - zb - 0.08, (0, 0, zb + 0.09), wood, verts=20, ol=0.0045, parent=root)
    # cord grip wrap (rings) centred on the root
    for k in range(7):
        cz.cyl(f'{name}_wrap{k}', 0.0288, 0.014, (0, 0, -0.105 + k * 0.032), wrap, verts=20, bevel=0.003, ol=0.0025, parent=root)
    # socket + collar
    cz.cyl(name + '_collar', 0.035, 0.03, (0, 0, zs - 0.02), bronze, verts=24, bevel=0.005, ol=0.004, parent=root)
    cz.cyl(name + '_socket', 0.03, 0.14, (0, 0, zs + 0.005), bronze, r2=0.023, verts=24, bevel=0.003, ol=0.004, parent=root)
    cz.cyl(name + '_socketring', 0.027, 0.015, (0, 0, zs + 0.13), bronze, verts=24, bevel=0.003, ol=0.003, parent=root)
    # red horsehair tassel: a bell of strands hanging around the socket from its top
    tm = cz.toon(name + '_tasselm', tassel, tex='grain', tex_scale=6.0, tex_strength=0.05)
    tt = zs + 0.1
    prof = [(0.03, tt), (0.06, tt - 0.03), (0.088, tt - 0.09), (0.1, tt - 0.16), (0.094, tt - 0.21), (0.06, tt - 0.225),
            (0.03, tt - 0.215)]
    mod = lambda a, z: 1 - 0.1 * (1 - abs(math.sin(7 * a))) ** 2 if z < tt - 0.06 else 1.0
    tsl = _lathe(cz, name + '_tassel', prof, tm, root, segs=56, ol=0.004, mod=mod)
    for v in tsl.data.vertices:         # ragged hem: strand ends at different lengths
        if v.co.z < tt - 0.2:
            a = math.atan2(v.co.y, v.co.x)
            v.co.z -= 0.03 * abs(math.sin(7 * a)) + 0.01 * abs(math.sin(19 * a))
    # blade
    _blade(cz, name + '_blade', zs + 0.135, L + zb - (zs + 0.135), 0.066, 0.02, steel, root)
    if kind == 'halberd':
        _crescent(cz, name + '_ji', zs + 0.24, steel, root, side=1)
        cz.box(name + '_jibar', (0.13, 0.016, 0.034), (0.075, 0, zs + 0.24), bronze, bevel=0.004, ol=0.003, parent=root)
        sp = cz.cyl(name + '_backspike', 0.012, 0.1, (-0.012, 0, zs + 0.24), steel, r2=0.002, verts=4, ol=0.003, parent=root)
        sp.rotation_euler = (0, math.radians(-75), 0)
    return root
