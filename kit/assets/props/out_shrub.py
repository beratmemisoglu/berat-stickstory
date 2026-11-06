# Shrubs and small trees for the outdoor sets (chunky toy foliage, one ink line per blob):
#   kind='bush'     3-6 lumpy faceted foliage blobs, a lighter blob or two on top, optional flowers / berries dotted on it
#   kind='tree'     a round deciduous tree: a tapered trunk with two branches and a crown of 4-7 blobs
#   kind='bamboo'   a clump of 5-9 culms (one lathe mesh per culm with bulging node rings) leaning out a little, slim
#                   pointed leaves in sprays on the upper half (one mesh of leaves per culm)
#   kind='flowers'  a leafy clump with 5-9 five-petal flower heads on stems
# Floor prop: root at the floor centre; size scales everything.
# Animate: <name>_crown (tree / bamboo sway: rotation, pivot at the base).
import math, random

META = {'size': (1.2, 1.2, 0.9), 'anchor': 'floor centre (tree ~3.2 m tall, bamboo ~3.5 m at size 1)',
        'animate': ['_crown (rotation: sway, pivot at the base)'],
        'params': "kind='bush'|'tree'|'bamboo'|'flowers', size=1.0, leaf='#3f7a3a', leaf2='#5a9a48', bloom=None (flower colour "
                  "dotted on a bush / the flower heads), night=False (darker cool foliage), seed=1"}


def _blob(cz, name, loc, r, mat, parent, rnd, flat=0.45, ol=0.008, segs=12, rings=8, sq=1.0):
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=segs, rings=rings)
    for v in o.data.vertices:
        x, y, z = v.co
        k = 0.86 + 0.24 * rnd.random()
        v.co = (x * r * k, y * r * k, max(z, -flat) * r * k * sq)
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def _petals(cz, name, loc, r, mat, cmat, parent, rnd, tilt=20):
    import bmesh
    pv = cz.empty(name, loc, parent=parent)
    pv.rotation_euler = (math.radians(rnd.uniform(-tilt, tilt)), math.radians(rnd.uniform(-tilt, tilt)), rnd.uniform(0, 6.28))
    pts = [(r * (0.42 + 0.58 * abs(math.cos(2.5 * t))) * math.cos(t), r * (0.42 + 0.58 * abs(math.cos(2.5 * t))) * math.sin(t))
           for t in [k / 30 * 2 * math.pi for k in range(30)]]
    o = cz.cyl(name + '_m', 1.0, 0.012, (0, 0, 0), mat, verts=30, ol=0.003, parent=pv)
    vs = o.data.vertices; a0 = math.atan2(vs[0].co.y, vs[0].co.x); step = 2 * math.pi / 30
    for v in vs:
        kk = int(round(((math.atan2(v.co.y, v.co.x) - a0) % (2 * math.pi)) / step)) % 30
        v.co.x, v.co.y = pts[kk]
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    cz.sphere(name + '_c', r * 0.34, (0, 0, 0.012), cmat, ol=0.0, parent=pv, segs=10, rings=6)
    return pv


def _lathe(cz, name, prof, mat, parent, segs=8, ol=0.004):
    import bmesh
    bm = bmesh.new(); rings = []
    for r, z in prof:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for ra, rb in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _leaves(cz, name, sprays, mat, parent, rnd, L=0.24, W=0.045, ol=0.003):
    """One mesh of slim pointed leaves: sprays = [(origin (x, y, z), out direction angle, count)]."""
    import bmesh
    from mathutils import Matrix, Vector
    bm = bmesh.new()
    for (ox, oy, oz), ang, n in sprays:
        for j in range(n):
            a = ang + rnd.uniform(-0.9, 0.9); droop = rnd.uniform(0.35, 1.0); l = L * rnd.uniform(0.75, 1.15)
            M = Matrix.Translation((ox, oy, oz)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(droop, 4, 'Y')
            # leaf outline in local XZ... built along +X, flat in XY, folded slightly
            pts = [(0, 0), (l * 0.25, W * 0.5), (l * 0.6, W * 0.42), (l, 0), (l * 0.6, -W * 0.42), (l * 0.25, -W * 0.5)]
            top = [bm.verts.new(M @ Vector((x, y, 0.004 + 0.012 * (1 - abs(y) / W)))) for x, y in pts]
            bot = [bm.verts.new(M @ Vector((x, y, -0.004))) for x, y in pts]
            bm.faces.new(top); bm.faces.new(bot[::-1])
            for i in range(len(pts)):
                bm.faces.new((bot[i], bot[(i + 1) % len(pts)], top[(i + 1) % len(pts)], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mat, smooth=False)
    return cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def build(cz, name='out_shrub', kind='bush', size=1.0, leaf='#3f7a3a', leaf2='#5a9a48', bloom=None, night=False, seed=1):
    rnd = random.Random(seed)
    root = cz.empty(name)
    if night: leaf, leaf2 = '#2a5650', '#376a5e'
    k = size
    lm = cz.toon(f'out_shrub_leaf{leaf}', leaf, tex='grain', tex_scale=2.0, tex_strength=0.07)
    lm2 = cz.toon(f'out_shrub_leaf{leaf2}', leaf2, tex='grain', tex_scale=2.0, tex_strength=0.07)
    bark = cz.toon('out_shrub_bark', '#6a4a38', tex='wood', tex_scale=2.0, tex_strength=0.08)
    crown = cz.empty(name + '_crown', parent=root)
    if kind == 'bush':
        n = rnd.randint(3, 6); blobs = []
        for i in range(n):
            a = i / n * 2 * math.pi + rnd.uniform(-0.3, 0.3); d = rnd.uniform(0.12, 0.32) * k
            r = rnd.uniform(0.24, 0.36) * k
            blobs.append((math.cos(a) * d, math.sin(a) * d, r * 0.75, r))
        blobs.append((rnd.uniform(-0.05, 0.05) * k, rnd.uniform(-0.05, 0.05) * k, 0.42 * k, 0.3 * k))
        for i, (x, y, z, r) in enumerate(blobs):
            _blob(cz, f'{name}_blob{i}', (x, y, z), r, lm2 if i == len(blobs) - 1 or i % 3 == 1 else lm, crown, rnd,
                  ol=0.008 if k > 0.6 else 0.006)
        if bloom:
            bm_ = cz.toon(f'out_shrub_bloom{bloom}', bloom, tex='grain', tex_strength=0.03)
            for j in range(int(9 * k + 3)):
                x, y, z, r = rnd.choice(blobs)
                a = rnd.uniform(0, 6.28); e = rnd.uniform(0.15, 1.2)
                p = (x + math.cos(a) * math.cos(e) * r * 0.95, y + math.sin(a) * math.cos(e) * r * 0.95, z + math.sin(e) * r * 0.9)
                cz.sphere(f'{name}_bl{j}', 0.035 * k, p, bm_, ol=0.003, parent=crown, segs=8, rings=5)
    elif kind == 'tree':
        H = 1.9 * k
        _lathe(cz, name + '_trunk', [(0.2 * k, 0), (0.14 * k, 0.15 * k), (0.11 * k, H * 0.6), (0.08 * k, H)], bark, root, segs=10, ol=0.008)
        for s in (-1, 1):
            br = _lathe(cz, f'{name}_branch{s}', [(0.06 * k, 0), (0.035 * k, 0.75 * k)], bark, root, segs=8, ol=0.006)
            br.location = (0, 0, H * (0.62 if s > 0 else 0.75)); br.rotation_euler = (0, math.radians(s * 48), rnd.uniform(0, 6.28))
        n = rnd.randint(4, 7)
        for i in range(n):
            a = i / n * 2 * math.pi + rnd.uniform(-0.3, 0.3); d = rnd.uniform(0.35, 0.65) * k
            _blob(cz, f'{name}_crownblob{i}', (math.cos(a) * d, math.sin(a) * d, H + rnd.uniform(-0.1, 0.45) * k), rnd.uniform(0.5, 0.75) * k,
                  lm if i % 2 else lm2, crown, rnd, flat=0.7, ol=0.01)
        _blob(cz, name + '_crowntop', (0, 0, H + 0.75 * k), 0.62 * k, lm2, crown, rnd, flat=0.7, ol=0.01)
    elif kind == 'bamboo':
        culm = cz.toon('out_shrub_culm' + ('n' if night else ''), '#4f7a3a' if night else '#7aa04a', tex='grain', tex_scale=3.0, tex_strength=0.06)
        node = cz.toon('out_shrub_node' + ('n' if night else ''), '#3f6a32' if night else '#5d8a3a')
        n = rnd.randint(5, 9)
        for i in range(n):
            a = rnd.uniform(0, 6.28); d = rnd.uniform(0.0, 0.35) * k
            h = rnd.uniform(2.6, 4.0) * k; r = rnd.uniform(0.03, 0.045) * k
            prof = [(r * 1.1, 0.0)]
            z = 0.0; step = 0.38 * k
            while z + step < h:
                z += step
                prof += [(r, z - 0.04 * k), (r * 1.3, z - 0.012 * k), (r * 1.3, z + 0.012 * k), (r, z + 0.04 * k)]
            prof += [(r * 0.8, h)]
            pv = cz.empty(f'{name}_culm{i}', (math.cos(a) * d, math.sin(a) * d, 0), parent=crown)
            lean = rnd.uniform(3, 12)
            pv.rotation_euler = (math.radians(lean * math.sin(a + 1.57)), math.radians(lean * math.cos(a + 1.57)), 0)
            _lathe(cz, f'{name}_culm{i}_m', prof, culm, pv, segs=8, ol=0.004)
            sprays = []
            zz = h * 0.45
            while zz < h:
                sprays.append(((0, 0, zz), rnd.uniform(0, 6.28), rnd.randint(3, 6))); zz += rnd.uniform(0.25, 0.45) * k
            _leaves(cz, f'{name}_culm{i}_leaves', sprays, lm2 if i % 2 else lm, pv, rnd, L=0.26 * k, W=0.05 * k)
    else:   # flowers
        for i in range(rnd.randint(4, 6)):
            a = rnd.uniform(0, 6.28); d = rnd.uniform(0.02, 0.12) * k
            _blob(cz, f'{name}_leafblob{i}', (math.cos(a) * d, math.sin(a) * d, 0.06 * k), rnd.uniform(0.09, 0.14) * k, lm if i % 2 else lm2,
                  crown, rnd, flat=0.3, ol=0.004, segs=10, rings=6, sq=0.8)
        col = bloom or rnd.choice(('#f2efe6', '#f2c84b', '#ef8fb0', '#a7b2f2'))
        fm = cz.toon(f'out_shrub_petal{col}', col, tex='grain', tex_strength=0.03)
        cm = cz.toon('out_shrub_centre', '#e0a23a')
        stem = cz.toon('out_shrub_stem', '#3f7a3a')
        for j in range(rnd.randint(5, 9)):
            a = rnd.uniform(0, 6.28); d = rnd.uniform(0.0, 0.16) * k; hz = rnd.uniform(0.22, 0.38) * k
            x, y = math.cos(a) * d, math.sin(a) * d
            cz.cyl(f'{name}_stem{j}', 0.006 * k, hz, (x * 0.5, y * 0.5, 0.05 * k), stem, verts=6, ol=0.0, parent=crown)
            _petals(cz, f'{name}_head{j}', (x * 0.5, y * 0.5, 0.05 * k + hz), 0.05 * k, fm, cm, crown, rnd)
    return root
