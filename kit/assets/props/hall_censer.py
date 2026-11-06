# Bronze tripod incense burner (ding) on a carved rosewood stand: a round-bellied bronze bowl with a gold rim and a
# teal patina band, three cabriole legs ending in gold hooves, two upright loop handles, a pierced domed lid (gold
# vent holes) with a little lion-ball finial, and three curling wisps of incense smoke rising from the vents.
# smoke=False leaves the wisps out. Floor prop: root = floor centre; front -Y.
import math, bmesh
from mathutils import Vector, Matrix

META = {'size': (0.7, 0.7, 1.6), 'anchor': 'floor centre', 'animate': ['_smoke (rotation_euler.z drift / scale for a slow curl)'],
        'params': "size=1.0, smoke=True, stand=True"}


def tube(cz, name, pts, radii, mat, parent, segs=10, ol=0.003):
    """A tube swept along pts (list of xyz) with a radius per point; capped."""
    bm = bmesh.new(); rings = []
    P = [Vector(p) for p in pts]
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        u = t.orthogonal().normalized(); w = t.cross(u).normalized()
        r = radii[i] if isinstance(radii, (list, tuple)) else radii
        rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * k / segs) + w * math.sin(2 * math.pi * k / segs)) * r) for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for k in range(segs):
            bm.faces.new((a[k], a[(k + 1) % segs], b[(k + 1) % segs], b[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    o = cz._mesh_obj(name, bm, mat, smooth=True)
    return cz.place(o, (0, 0, 0), parent=parent, outline_t=ol)


def _lathe(cz, name, prof, mat, parent, loc, segs=36, ol=0.005):
    bm = bmesh.new(); rings = []
    for r, z in prof:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    if prof[0][0] > 0: bm.faces.new(rings[0][::-1])
    if prof[-1][0] > 0: bm.faces.new(rings[-1])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), loc, parent=parent, outline_t=ol)


def build(cz, name='hall_censer', size=1.0, smoke=True, stand=True):
    root = cz.empty(name)
    S = size
    br = cz.toon('hall_bronze', '#9a6a34', tex='grain', tex_strength=0.06)
    pat = cz.toon('hall_patina', '#3f8a78', tex='grain', tex_strength=0.05)
    gold = cz.toon('hall_gold', '#d2a23e', tex='grain', tex_scale=3.0, tex_strength=0.04)
    wood = cz.toon('hall_rosewood', '#4a2218', tex='wood', tex_strength=0.06)
    z = 0.0
    if stand:
        # round stand: top disc, apron, three short legs on a ring
        cz.cyl(name + '_st_top', 0.36 * S, 0.05 * S, (0, 0, 0.26 * S), wood, verts=40, bevel=0.01, ol=0.005, parent=root)
        cz.cyl(name + '_st_rim', 0.366 * S, 0.014 * S, (0, 0, 0.278 * S), gold, verts=40, ol=0.0, parent=root)
        cz.cyl(name + '_st_apron', 0.32 * S, 0.07 * S, (0, 0, 0.19 * S), wood, r2=0.34 * S, verts=40, ol=0.004, parent=root)
        for k in range(3):
            a = math.radians(90 + 120 * k)
            cz.box(f'{name}_st_leg{k}', (0.06 * S, 0.06 * S, 0.19 * S), (0.27 * S * math.cos(a), 0.27 * S * math.sin(a), 0), wood,
                   rot=(0, 0, math.degrees(a)), bevel=0.01, ol=0.004, parent=root, origin='bottom')
        cz.cyl(name + '_st_ring', 0.29 * S, 0.03 * S, (0, 0, 0.02 * S), wood, verts=40, ol=0.003, parent=root)
        z = 0.31 * S
    # three cabriole legs with gold hooves
    for k in range(3):
        a = math.radians(-90 + 120 * k)
        px, py = math.cos(a), math.sin(a)
        pts = [(px * 0.2 * S, py * 0.2 * S, z + 0.26 * S), (px * 0.24 * S, py * 0.24 * S, z + 0.15 * S), (px * 0.22 * S, py * 0.22 * S, z + 0.05 * S),
               (px * 0.25 * S, py * 0.25 * S, z + 0.015 * S)]
        tube(cz, f'{name}_leg{k}', pts, [0.045 * S, 0.035 * S, 0.03 * S, 0.034 * S], br, root, segs=10, ol=0.004)
        cz.sphere(f'{name}_hoof{k}', 0.042 * S, (px * 0.255 * S, py * 0.255 * S, z + 0.02 * S), gold, scale=(1, 1, 0.6), ol=0.003, parent=root, segs=14, rings=7)
    # the bowl: round belly, neck, rolled rim
    zb = z + 0.18 * S
    prof = [(0.0, 0.0), (0.12, 0.0), (0.22, 0.04), (0.29, 0.12), (0.31, 0.2), (0.29, 0.28), (0.26, 0.32), (0.265, 0.36), (0.29, 0.38), (0.27, 0.4), (0.0, 0.4)]
    _lathe(cz, name + '_bowl', [(r * S, h * S) for r, h in prof], br, root, (0, 0, zb), ol=0.006)
    cz.cyl(name + '_band', 0.312 * S, 0.06 * S, (0, 0, zb + 0.17 * S), pat, verts=40, ol=0.0, parent=root)
    for k in range(16):      # raised studs on the band
        a = 2 * math.pi * k / 16
        cz.sphere(f'{name}_stud{k}', 0.014 * S, (0.315 * S * math.cos(a), 0.315 * S * math.sin(a), zb + 0.2 * S), gold, ol=0.0, parent=root, segs=8, rings=4)
    cz.cyl(name + '_rim', 0.293 * S, 0.02 * S, (0, 0, zb + 0.37 * S), gold, verts=40, ol=0.003, parent=root)
    # upright loop handles (ears) on the rim, left / right
    for s in (-1, 1):
        for dy in (-0.06, 0.06):
            cz.box(f'{name}_ear{s}{dy:+.2f}', (0.035 * S, 0.035 * S, 0.17 * S), (s * 0.255 * S, dy * S, zb + 0.38 * S), br, bevel=0.008, ol=0.003, parent=root, origin='bottom')
        cz.box(f'{name}_eartop{s}', (0.04 * S, 0.17 * S, 0.035 * S), (s * 0.255 * S, 0, zb + 0.55 * S), br, bevel=0.01, ol=0.004, parent=root)
    # the domed, pierced lid with a finial
    zl = zb + 0.39 * S
    lid = [(0.25, 0.0), (0.25, 0.03), (0.22, 0.09), (0.16, 0.15), (0.08, 0.19), (0.0, 0.2)]
    _lathe(cz, name + '_lid', [(r * S, h * S) for r, h in lid], br, root, (0, 0, zl), ol=0.005)
    for k in range(8):
        a = 2 * math.pi * k / 8 + math.pi / 8
        cz.sphere(f'{name}_vent{k}', 0.03 * S, (0.17 * S * math.cos(a), 0.17 * S * math.sin(a), zl + 0.12 * S), cz.toon('hall_censer_vent', '#2a1a12'),
                  scale=(1, 1, 0.5), ol=0.0, parent=root, segs=10, rings=5)
    cz.cyl(name + '_fneck', 0.04 * S, 0.05 * S, (0, 0, zl + 0.19 * S), gold, verts=16, ol=0.003, parent=root)
    cz.sphere(name + '_finial', 0.07 * S, (0, 0, zl + 0.29 * S), gold, ol=0.004, parent=root, segs=18, rings=9)
    cz.sphere(name + '_finial2', 0.03 * S, (0, -0.06 * S, zl + 0.31 * S), br, ol=0.002, parent=root, segs=10, rings=5)
    if smoke:
        sm = cz.toon('hall_smoke', '#e8e2ee')
        piv = cz.empty(name + '_smoke', (0, 0, 0), parent=root)
        for j, (a0, turns, h) in enumerate(((20, 1.1, 0.75), (150, 0.9, 0.6), (270, 1.3, 0.85))):
            pts, rr = [], []
            a = math.radians(a0)
            x0, y0 = 0.14 * S * math.cos(a), 0.14 * S * math.sin(a)
            for i in range(19):
                t = i / 18
                ang = a + 2 * math.pi * turns * t
                pts.append((x0 * (1 - t) + 0.07 * S * math.cos(ang) * (0.3 + t), y0 * (1 - t) + 0.07 * S * math.sin(ang) * (0.3 + t), zl + 0.14 * S + h * S * t))
                rr.append(0.03 * S * (1 - 0.45 * t) + 0.006)
            tube(cz, f'{name}_smoke{j}', pts, rr, sm, piv, segs=8, ol=0.0)
    return root
