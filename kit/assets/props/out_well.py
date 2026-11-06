# Village well: a round fieldstone well ring (chunky stones in two courses on a mortar core, a flat stone rim), a dark
# water disc inside with a pale glint, a wooden frame (two posts, a crossbeam) with a windlass (a log drum with a
# crank), a rope down to a wooden bucket hanging over the opening, a second bucket on the ground beside it, a little
# shingled roof on the frame.
# Floor prop: root at the floor centre of the well; front -Y. ~1.3 x 1.1 x 2.0 m.
import math, random

META = {'size': (1.3, 1.1, 2.0), 'anchor': 'floor centre of the well', 'animate': ['_drum (rotation x: the windlass turns)'],
        'params': "night=False, seed=2"}


def build(cz, name='out_well', night=False, seed=2):
    rnd = random.Random(seed)
    root = cz.empty(name)
    st = [cz.toon(f'out_well_stone{i}', c, tex='grain', tex_scale=2.0, tex_strength=0.09) for i, c in enumerate(('#a39a86', '#8b8476', '#b4aa94'))]
    mortar = cz.toon('out_well_mortar', '#6e665a', tex='grain', tex_strength=0.06)
    wood = cz.toon('out_well_wood', '#7a5236', tex='wood', tex_scale=3.0, tex_strength=0.08)
    wood2 = cz.toon('out_well_wood2', '#5e3f2b', tex='wood', tex_scale=3.0, tex_strength=0.08)
    rope = cz.toon('out_well_rope', '#c8a46a')
    R = 0.46
    cz.cyl(name + '_core', R - 0.02, 0.62, (0, 0, 0), mortar, verts=24, ol=0.006, parent=root)
    for c, (z, n) in enumerate(((0.16, 11), (0.44, 12))):
        for i in range(n):
            a = (i + 0.5 * c) / n * 2 * math.pi
            o = cz.sphere(f'{name}_stone{c}_{i}', 1.0, (math.cos(a) * R, math.sin(a) * R, z), st[(i + c) % 3], ol=0.004, parent=root, segs=8, rings=6)
            sx, sy, sz = 0.15 * rnd.uniform(0.85, 1.15), 0.11, 0.13 * rnd.uniform(0.85, 1.1)
            ca, sa = math.cos(a + math.pi / 2), math.sin(a + math.pi / 2)
            for v in o.data.vertices:
                x, y, zz = v.co; k = 0.85 + 0.25 * rnd.random()
                x, y, zz = x * sx * k, y * sy * k, zz * sz * k
                v.co = (x * ca - y * sa, x * sa + y * ca, zz)
            o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    cz.cyl(name + '_rim', R + 0.06, 0.07, (0, 0, 0.6), st[2], verts=24, ol=0.006, parent=root)
    cz.cyl(name + '_hole', R - 0.12, 0.01, (0, 0, 0.67), cz.toon('out_well_dark', '#1e2430'), verts=24, ol=0.0, parent=root)
    cz.cyl(name + '_water', R - 0.15, 0.01, (0, 0, 0.675), cz.toon('out_well_water', '#3a5a8a' if not night else '#4a5aa8'), verts=24, ol=0.0, parent=root)
    cz.box(name + '_glint', (0.12, 0.03, 0.004), (0.08, -0.06, 0.686), cz.toon('out_well_glint', '#c8e0f0'), bevel=0, ol=0.0, parent=root)
    # frame + windlass + roof
    for s in (-1, 1):
        cz.box(f'{name}_post{s}', (0.09, 0.09, 1.55), (s * (R + 0.12), 0, 0.775), wood2, bevel=0.01, ol=0.005, parent=root)
    cz.box(name + '_beam', (2 * R + 0.5, 0.1, 0.1), (0, 0, 1.6), wood2, bevel=0.01, ol=0.005, parent=root)
    dr = cz.empty(name + '_drum', (0, 0, 1.2), parent=root)
    cz.cyl(name + '_drum_m', 0.09, 2 * R + 0.2, (-(R + 0.1), 0, 0), wood, rot=(0, 90, 0), verts=14, ol=0.005, parent=dr)
    for k in range(5):
        cz.cyl(f'{name}_coil{k}', 0.1, 0.03, (-0.12 + k * 0.05, 0, 0), rope, rot=(0, 90, 0), verts=14, ol=0.0, parent=dr)
    cz.box(name + '_crank1', (0.04, 0.04, 0.22), (R + 0.2, 0, -0.1), wood2, bevel=0.005, ol=0.003, parent=dr)
    cz.box(name + '_crank2', (0.16, 0.035, 0.035), (R + 0.27, 0, -0.2), wood2, bevel=0.005, ol=0.003, parent=dr)
    cz.cyl(name + '_rope', 0.008, 0.32, (0.05, 0, 0.8), rope, verts=6, ol=0.0, parent=root)
    cz.cyl(name + '_bucket', 0.12, 0.18, (0.05, 0, 0.82 - 0.18), wood, verts=14, ol=0.004, parent=root, r2=0.14)
    cz.cyl(name + '_bucket2', 0.13, 0.2, (R + 0.45, -0.25, 0), wood, verts=14, ol=0.004, parent=root, r2=0.15)
    cz.cyl(name + '_bucket2_band', 0.142, 0.03, (R + 0.45, -0.25, 0.13), cz.toon('out_well_band', '#3a3430'), verts=14, ol=0.0, parent=root)
    roof = cz.toon('out_well_roof', '#6a5a4a' if not night else '#5a5a72', tex='wood', tex_scale=2.0, tex_strength=0.07)
    for s in (-1, 1):
        cz.box(f'{name}_roof{s}', (2 * R + 0.7, 0.5, 0.05), (0, s * 0.21, 1.82), roof, rot=(-s * 32, 0, 0), bevel=0.01, ol=0.005, parent=root)
    cz.box(name + '_ridge', (2 * R + 0.75, 0.08, 0.08), (0, 0, 1.96), wood2, bevel=0.01, ol=0.004, parent=root)
    return root
