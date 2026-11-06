# Chime-bell rack (bianzhong): a black-and-red lacquer frame - two posts on heavy block feet, two cross beams with
# gold end caps curling up, gold bands - with two rows of bronze bells hanging on hooks: small ones on the top beam,
# bigger ones below, each bell an almond-section bell with rows of raised studs, a teal patina band and a shank;
# a pair of wooden mallets hangs from the right post.
# Floor prop: root = floor centre, long side along X, front -Y.
import math, bmesh
from mathutils import Matrix

META = {'size': (2.4, 0.5, 1.75), 'anchor': 'floor centre', 'animate': [], 'params': "length=2.4, top=6, bottom=5"}


def _bell(cz, name, r, h, loc, mats, parent):
    """An almond-section bell: lathe flattened in Y, studs on the front, a shank + hook on top."""
    bm = bmesh.new(); segs = 28
    prof = [(1.0, 0.0), (0.96, 0.25), (0.86, 0.6), (0.74, 0.9), (0.7, 1.0), (0.0, 1.0)]
    rings = []
    for k, z in prof:
        rings.append([bm.verts.new((r * k * math.cos(2 * math.pi * i / segs), r * k * 0.72 * math.sin(2 * math.pi * i / segs), -h + h * z))
                      for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for i in range(segs): bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    # the mouth curves up between the two points (a shallow arc cut): lift the front / back bottom verts
    for i, v in enumerate(rings[0]):
        a = 2 * math.pi * i / segs
        v.co.z += h * 0.12 * abs(math.sin(a))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    o = cz.place(cz._mesh_obj(name, bm, mats['bronze'], smooth=True), loc, parent=parent, outline_t=0.004)
    x, y, z = loc
    # studs: 3 rows x 3 on the front face
    for j in range(3):
        for i in range(3):
            zz = z - h * (0.3 + 0.18 * j); fx = (i - 1) * r * 0.42 * (1 + 0.08 * j)
            kk = 0.96 - 0.1 * (2 - j)
            cz.sphere(f'{name}_stud{j}{i}', r * 0.1, (x + fx, y - r * 0.72 * kk * 0.86 - 0.005, zz), mats['gold'], ol=0.0, parent=parent, segs=8, rings=4)
    cz.cyl(name + '_shank', r * 0.18, h * 0.35, (x, y, z), mats['bronze'], verts=12, ol=0.003, parent=parent)
    cz.cyl(name + '_ring', r * 0.2, h * 0.06, (x, y, z + h * 0.08), mats['patina'], verts=12, ol=0.0, parent=parent)
    return o


def build(cz, name='hall_bells', length=2.4, top=6, bottom=5):
    root = cz.empty(name)
    lac = cz.toon('hall_lac_black', '#2a1c18', tex='grain', tex_strength=0.05)
    red = cz.toon('hall_lac_red', '#9a2a1e', tex='grain', tex_strength=0.04)
    gold = cz.toon('hall_gold', '#d2a23e', tex='grain', tex_scale=3.0, tex_strength=0.04)
    mats = {'bronze': cz.toon('hall_bronze', '#9a6a34', tex='grain', tex_strength=0.06), 'patina': cz.toon('hall_patina', '#3f8a78', tex='grain', tex_strength=0.05),
            'gold': gold}
    L = length; px = L / 2 - 0.08
    # feet + posts
    for s in (-1, 1):
        cz.box(f'{name}_foot{s}', (0.22, 0.46, 0.14), (s * px, 0, 0), lac, bevel=0.02, ol=0.006, parent=root, origin='bottom')
        cz.box(f'{name}_footg{s}', (0.225, 0.465, 0.025), (s * px, 0, 0.1), gold, bevel=0.004, ol=0.0, parent=root, origin='bottom')
        cz.box(f'{name}_post{s}', (0.1, 0.1, 1.6), (s * px, 0, 0.14), red, bevel=0.01, ol=0.006, parent=root, origin='bottom')
        for zz in (0.5, 1.02, 1.62):
            cz.box(f'{name}_pband{s}{zz}', (0.11, 0.11, 0.04), (s * px, 0, zz), gold, bevel=0.004, ol=0.003, parent=root)
        cz.sphere(f'{name}_pknob{s}', 0.07, (s * px, 0, 1.8), gold, ol=0.004, parent=root, segs=16, rings=8)
    # beams with up-curled gold end caps
    for zb, nm in ((1.62, 'top'), (1.02, 'low')):
        cz.box(f'{name}_beam_{nm}', (L + 0.2, 0.09, 0.09), (0, 0, zb), lac, bevel=0.01, ol=0.006, parent=root)
        cz.box(f'{name}_beamg_{nm}', (L + 0.1, 0.092, 0.015), (0, 0, zb - 0.03), gold, bevel=0.002, ol=0.0, parent=root)
        for s in (-1, 1):
            cz.cyl(f'{name}_cap_{nm}{s}', 0.06, 0.1, (s * (L / 2 + 0.1), 0.05, zb + 0.02), gold, rot=(90, 0, 0), verts=16, bevel=0.01, ol=0.004, parent=root)
    # bells
    for row, (n, zb, r, h) in enumerate(((top, 1.62, 0.09, 0.25), (bottom, 1.02, 0.13, 0.38))):
        span = L - 0.45
        for i in range(n):
            x = -span / 2 + span * i / max(1, n - 1)
            k = 1.0 - 0.25 * i / max(1, n - 1)             # bells get smaller toward +X
            hz = zb - 0.06
            cz.cyl(f'{name}_hook{row}{i}', 0.008, 0.07, (x, 0, hz - 0.02), gold, verts=6, ol=0.0, parent=root)
            _bell(cz, f'{name}_bell{row}{i}', r * k, h * k, (x, 0, hz - 0.03), mats, root)
    # mallets hanging from the right post
    for j, dy in enumerate((-0.02, 0.03)):
        cz.cyl(f'{name}_mallet{j}', 0.012, 0.45, (px + 0.08, -0.06 + dy, 0.7), cz.toon('hall_scroll_wood_5a2618', '#5a2618', tex='wood', tex_strength=0.05),
               rot=(0, 8 + 6 * j, 0), verts=8, ol=0.003, parent=root)
        cz.sphere(f'{name}_mhead{j}', 0.035, (px + 0.08 + 0.0, -0.06 + dy, 0.7), cz.toon('hall_ivory', '#efe6cf'), ol=0.003, parent=root, segs=12, rings=6)
    return root
