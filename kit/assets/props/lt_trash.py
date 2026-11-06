# One piece of flying trash (LOTTERY L06): kind='banana' (a yellow peel: 4 floppy petals on a stalk), 'cup' (a white
# paper cup), 'paper' (a crumpled ball, flat shaded so the facets read as creases), 'can' (a red soda can).
# Root = the piece's centre (it is thrown around by the shot).
import math, random

META = {'size': (0.16, 0.16, 0.12), 'anchor': 'centre of the piece', 'animate': [],
        'params': "kind='banana'|'cup'|'paper'|'can', seed=1"}


def build(cz, name='lt_trash', kind='paper', seed=1):
    import bmesh
    root = cz.empty(name)
    rnd = random.Random(seed)
    if kind == 'paper':
        p = cz.sphere(name + '_ball', 0.055, (0, 0, 0), cz.toon('lt_paperm', '#f2efe6', tex='paper'), ol=0.004, parent=root, segs=10, rings=6)
        for v in p.data.vertices: v.co = v.co * (1 + rnd.uniform(-0.28, 0.28))
        p.data.polygons.foreach_set('use_smooth', [False] * len(p.data.polygons))
    elif kind == 'cup':
        cz.cyl(name + '_cup', 0.032, 0.1, (0, 0, -0.05), cz.toon('lt_cupm', '#f4f1ea'), r2=0.043, ol=0.004, parent=root, verts=20)
        cz.cyl(name + '_band', 0.04, 0.025, (0, 0, 0.0), cz.toon('lt_cupband', '#3a8fd0'), r2=0.042, ol=0.0, parent=root, verts=20)
        cz.cyl(name + '_hole', 0.036, 0.003, (0, 0, 0.049), cz.toon('lt_cuphole', '#9a9890'), ol=0.0, parent=root, verts=20)
    elif kind == 'can':
        cz.cyl(name + '_can', 0.03, 0.11, (0, 0, -0.055), cz.toon('lt_canm', '#d8302a', tex='grain'), ol=0.004, parent=root, verts=20, bevel=0.004)
        cz.cyl(name + '_top', 0.026, 0.004, (0, 0, 0.055), cz.toon('lt_cantop', '#b9bec4'), ol=0.0, parent=root, verts=20)
    else:   # banana peel
        y = cz.toon('lt_banana', '#f2c32a', tex='grain', tex_strength=0.05); br = cz.toon('lt_bananabr', '#6a4a1a')
        cz.cyl(name + '_stalk', 0.012, 0.04, (0, 0, 0.0), br, r2=0.008, ol=0.003, parent=root, verts=10)
        for i in range(4):
            a = i * math.pi / 2 + rnd.uniform(-0.2, 0.2)
            bm = bmesh.new(); pts = []
            for k in range(9):          # a petal: wide in the middle, pointed tip, drooping down
                t = k / 8.0
                w = 0.022 * math.sin(math.pi * min(1.0, t * 1.05)) + 0.004
                z = -0.11 * t * t
                for s in (-1, 1): pts.append((t, s, w, z))
            vs = []
            for (t, s, w, z) in pts:
                r = 0.13 * t
                vs.append(bm.verts.new((math.cos(a) * r - math.sin(a) * w * s, math.sin(a) * r + math.cos(a) * w * s, z)))
            for k in range(8):
                bm.faces.new((vs[2 * k], vs[2 * k + 1], vs[2 * k + 3], vs[2 * k + 2]))
            bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.006)
            o = cz._mesh_obj(f'{name}_petal{i}', bm, y, smooth=True); cz.place(o, (0, 0, 0), parent=root); cz.outline(o, 0.003)
    return root
