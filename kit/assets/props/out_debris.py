# Debris scatter: the small rubble of the morning after, strewn over a w x d area - curved glazed roof tiles (whole and
# broken), round tile end caps, bricks and brick halves, faceted stones, splintered red-lacquer planks with pale broken
# ends, pottery shards, a few scattered scroll / paper sheets. Pieces lie at random turns, partly sunk, a few tilted on
# each other. Everything is chunky (phone-size readable) and inked.
# Floor prop: root at the centre of the area (z = 0 ground). avoid = [(x, y, r), ...] root-local circles kept clear.
import math, random

META = {'size': (4.0, 3.0, 0.25), 'anchor': 'centre of the scatter area on the floor',
        'animate': [],
        'params': "w=4.0, d=3.0, n=60 (pieces), tiles='#d6a032' (glazed tile colour), mix=(tile, brick, stone, plank, shard, "
                  "paper) weights, avoid=[], seed=1, scale=1.0"}


def _tile(cz, name, loc, rz, mat, parent, L=0.3, r=0.075, ang=150, t=0.014, broken=False, tilt=0.0, ol=0.004):
    """A curved roof tile: an arc section extruded along X, open side down."""
    import bmesh
    bm = bmesh.new(); n = 7
    a0, a1 = math.radians(90 - ang / 2), math.radians(90 + ang / 2)
    L2 = L * (0.55 if broken else 1.0)
    rings = []
    for x in (-L2 / 2, L2 / 2):
        outer = [bm.verts.new((x, r * math.cos(a0 + (a1 - a0) * i / n), r * math.sin(a0 + (a1 - a0) * i / n) - r * 0.6)) for i in range(n + 1)]
        inner = [bm.verts.new((x, (r - t) * math.cos(a0 + (a1 - a0) * i / n), (r - t) * math.sin(a0 + (a1 - a0) * i / n) - r * 0.6)) for i in range(n + 1)]
        rings.append((outer, inner))
    (o0, i0), (o1, i1) = rings
    for i in range(n):
        bm.faces.new((o0[i], o0[i + 1], o1[i + 1], o1[i])); bm.faces.new((i0[i + 1], i0[i], i1[i], i1[i + 1]))
    bm.faces.new((o0[0], o1[0], i1[0], i0[0])); bm.faces.new((o0[n], i0[n], i1[n], o1[n]))
    bm.faces.new(o0 + i0[::-1]); bm.faces.new(o1[::-1] + i1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mat, smooth=False)
    return cz.place(o, loc, (tilt, 0, rz), None, parent, ol, 0.0)


def _rock(cz, name, loc, size, mat, parent, rnd, ol=0.005, rz=0.0):
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=8, rings=5)
    a = math.radians(rz)
    for v in o.data.vertices:
        x, y, z = v.co; k = 0.8 + 0.35 * rnd.random()
        x, y, z = x * k * size[0], y * k * size[1], max(z, -0.3) * k * size[2]
        v.co = (x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a), z)
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def build(cz, name='out_debris', w=4.0, d=3.0, n=60, tiles='#d6a032', mix=(4, 3, 3, 1.5, 1.5, 0.6), avoid=(), seed=1, scale=1.0):
    rnd = random.Random(seed)
    root = cz.empty(name)
    k = scale
    tm = cz.toon(f'out_debris_tile{tiles}', tiles, tex='grain', tex_scale=2.0, tex_strength=0.06)
    tmd = cz.toon(f'out_debris_tiled{tiles}', _dark(tiles, 0.72), tex='grain', tex_strength=0.05)
    brick = cz.toon('out_debris_brick', '#8f6a58', tex='grain', tex_scale=3.0, tex_strength=0.08)
    brick2 = cz.toon('out_debris_brick2', '#7a7468', tex='grain', tex_scale=3.0, tex_strength=0.08)
    stone = cz.toon('out_debris_stone', '#a39a86', tex='grain', tex_scale=2.0, tex_strength=0.08)
    stone2 = cz.toon('out_debris_stone2', '#8b8476', tex='grain', tex_scale=2.0, tex_strength=0.08)
    lac = cz.toon('out_debris_lacquer', '#9a2a1e', tex='grain', tex_strength=0.05)
    wood = cz.toon('out_debris_splinter', '#e2c48c', tex='wood', tex_scale=3.0, tex_strength=0.06)
    pot = cz.toon('out_debris_pot', '#b0603a', tex='grain', tex_strength=0.05)
    paper = cz.toon('out_debris_paper', '#efe6cf', tex='paper', tex_strength=0.04)
    kinds = ('tile', 'brick', 'stone', 'plank', 'shard', 'paper')
    tot = float(sum(mix))
    placed = []
    tries = 0
    while len(placed) < n and tries < n * 30:
        tries += 1
        x, y = rnd.uniform(-w / 2, w / 2), rnd.uniform(-d / 2, d / 2)
        if any(math.hypot(x - ax, y - ay) < ar for ax, ay, ar in avoid): continue
        if any(math.hypot(x - px, y - py) < 0.12 * k for px, py in placed): continue
        placed.append((x, y))
        u = rnd.random() * tot; acc = 0
        for kind, wgt in zip(kinds, mix):
            acc += wgt
            if u <= acc: break
        i = len(placed); nm = f'{name}_{kind}{i}'; rz = rnd.uniform(0, 360)
        if kind == 'tile':
            if rnd.random() < 0.2:    # a round tile end cap lying flat
                cz.cyl(nm, 0.08 * k, 0.03 * k, (x, y, 0.0), tm, verts=14, ol=0.004, parent=root, rot=(rnd.uniform(-10, 10), rnd.uniform(-10, 10), 0))
                cz.cyl(nm + '_boss', 0.035 * k, 0.012 * k, (x, y, 0.028 * k), tmd, verts=10, ol=0.0, parent=root)
            else:
                up = rnd.random() < 0.7      # (degrees: cz.place converts)
                _tile(cz, nm, (x, y, (0.024 if up else 0.028) * k), rz, tm if rnd.random() < 0.8 else tmd, root,
                      L=0.3 * k, r=0.075 * k, broken=rnd.random() < 0.45, tilt=rnd.uniform(-12, 12) if up else 180.0)
        elif kind == 'brick':
            half = rnd.random() < 0.4
            sz = ((0.13 if half else 0.25) * k, 0.12 * k, 0.065 * k)
            cz.box(nm, sz, (x, y, sz[2] / 2 - 0.005), brick if rnd.random() < 0.6 else brick2, rot=(rnd.uniform(-8, 8), rnd.uniform(-8, 8), rz),
                   bevel=0.008 * k, ol=0.004, parent=root)
        elif kind == 'stone':
            s = rnd.uniform(0.06, 0.16) * k
            _rock(cz, nm, (x, y, 0.0), (s, s * rnd.uniform(0.7, 1.0), s * rnd.uniform(0.5, 0.8)), stone if rnd.random() < 0.5 else stone2, root, rnd, rz=rz)
        elif kind == 'plank':
            L = rnd.uniform(0.5, 1.1) * k
            r_ = cz.empty(nm, (x, y, 0.035 * k), parent=root); r_.rotation_euler = (0, math.radians(rnd.uniform(-6, 6)), math.radians(rz))
            painted = rnd.random() < 0.6
            cz.box(nm + '_b', (L, 0.13 * k, 0.08 * k), (0, 0, 0.005 * k), lac if painted else cz.toon('out_debris_timber', '#8a5a3a', tex='wood', tex_strength=0.07),
                   bevel=0.008 * k, ol=0.005, parent=r_)
            # one broken end: a pale raw-wood face and three jagged splinters of different lengths
            s_ = rnd.choice((-1, 1))
            cz.box(f'{nm}_face', (0.012, 0.125 * k, 0.075 * k), (s_ * (L / 2 + 0.002), 0, 0.005 * k), wood, bevel=0, ol=0.0, parent=r_)
            for j, (dy, dz, ln) in enumerate(((-0.035, 0.015, 0.09), (0.0, -0.01, 0.15), (0.04, 0.012, 0.06))):
                cz.box(f'{nm}_sp{j}', (ln * k, 0.03 * k, 0.025 * k), (s_ * (L / 2 + ln * k / 2 - 0.01), dy * k, dz * k + 0.005 * k), wood,
                       rot=(0, s_ * rnd.uniform(-8, 8), rnd.uniform(-12, 12)), bevel=0.003, ol=0.003, parent=r_)
        elif kind == 'shard':
            s = rnd.uniform(0.05, 0.09) * k
            o = _rock(cz, nm, (x, y, 0.0), (s, s * 0.8, s * 0.25), pot, root, rnd, rz=rz)
        else:
            p = cz.box(nm, (0.2 * k, 0.26 * k, 0.004), (x, y, 0.004), paper, rot=(0, 0, rz), bevel=0, ol=0.003, parent=root)
    return root


def _dark(h, k):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{int(x * k):02x}' for x in c)
