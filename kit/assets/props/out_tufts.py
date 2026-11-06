# Ground scatter: spiky grass clumps (one mesh each, one clean outline), five-petal wild flowers on short stems in little
# groups, and pebbles, over a w x d area - for verges, wall feet, slopes and the joints of a ruined courtyard.
# On uneven ground pass ground=f(x, y) -> z (world) and at=(x, y) (the root's world position): every piece sits on it.
# Floor prop: root at the centre of the area. avoid = [(x, y, r), ...] root-local circles kept clear; keep=f(x, y) -> bool
# (world coordinates) rejects spots (e.g. off the path).
import math, random

META = {'size': (3.0, 3.0, 0.35), 'anchor': 'centre of the scatter area (z = 0, or the ground function)',
        'animate': [],
        'params': "w=3.0, d=3.0, n=30 (clumps), flowers=0.35 (share of clumps with flowers), pebbles=8, grass='#3c7a34', grass2='#4a8a3a', "
                  "petals=('#f2efe6', '#f2c84b', '#ef8fb0'), h=(0.22, 0.38) (clump height range), ground=None, at=(0, 0), avoid=(), keep=None, seed=1"}


def _tuft(cz, name, loc, h, r, mat, parent, rnd, k=5):
    o = cz.sphere(name, 1.0, loc, mat, ol=0.004, parent=parent, segs=k * 6, rings=8)
    ph = rnd.uniform(0, 6.28); hs = [rnd.uniform(0.7, 1.0) for _ in range(k)]
    for v in o.data.vertices:
        x, y, z = v.co
        phi = math.acos(max(-1.0, min(1.0, z))); th = math.atan2(y, x)
        u = 1 - phi / math.pi
        a = (k * th + ph) / (2 * math.pi); blade = int(math.floor(a + 0.5)) % k
        s = (0.5 + 0.5 * math.cos(k * th + ph)) ** 2.5
        H = h * (0.28 + 0.72 * s * hs[blade])
        if phi < 1e-4: v.co = (0, 0, h * 0.3); continue
        if phi > math.pi - 1e-4: v.co = (0, 0, 0); continue
        rad = r * (0.4 + u * (0.15 + 0.7 * s))
        v.co = (math.cos(th) * rad, math.sin(th) * rad, H * u ** 0.9)
    o.data.update()
    return o


def _flower(cz, name, loc, r, mat, cmat, parent, rnd):
    pv = cz.empty(name, loc, parent=parent)
    pv.rotation_euler = (math.radians(rnd.uniform(-25, 25)), math.radians(rnd.uniform(-25, 25)), rnd.uniform(0, 6.28))
    n = 30
    pts = [(r * (0.42 + 0.58 * abs(math.cos(2.5 * t))) * math.cos(t), r * (0.42 + 0.58 * abs(math.cos(2.5 * t))) * math.sin(t))
           for t in [k / n * 2 * math.pi for k in range(n)]]
    o = cz.cyl(name + '_m', 1.0, 0.012, (0, 0, 0), mat, verts=n, ol=0.003, parent=pv)
    vs = o.data.vertices; a0 = math.atan2(vs[0].co.y, vs[0].co.x); step = 2 * math.pi / n
    for v in vs:
        kk = int(round(((math.atan2(v.co.y, v.co.x) - a0) % (2 * math.pi)) / step)) % n
        v.co.x, v.co.y = pts[kk]
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    cz.sphere(name + '_c', r * 0.34, (0, 0, 0.012), cmat, ol=0.0, parent=pv, segs=10, rings=6)


def build(cz, name='out_tufts', w=3.0, d=3.0, n=30, flowers=0.35, pebbles=8, grass='#3c7a34', grass2='#4a8a3a',
          petals=('#f2efe6', '#f2c84b', '#ef8fb0'), h=(0.22, 0.38), ground=None, at=(0, 0), avoid=(), keep=None, seed=1):
    rnd = random.Random(seed)
    root = cz.empty(name)
    gm = [cz.toon(f'out_tufts_grass{grass}', grass, tex='grain', tex_strength=0.05), cz.toon(f'out_tufts_grass{grass2}', grass2, tex='grain', tex_strength=0.05)]
    cm = cz.toon('out_tufts_centre', '#e0a23a')
    stone = [cz.toon('out_tufts_peb0', '#a39a86', tex='grain', tex_strength=0.06), cz.toon('out_tufts_peb1', '#8b8476', tex='grain', tex_strength=0.06)]
    z0 = ground(at[0], at[1]) if ground else 0.0

    def gz(x, y): return (ground(at[0] + x, at[1] + y) - z0) if ground else 0.0

    def ok(x, y, m):
        if any(math.hypot(x - ax, y - ay) < ar + m for ax, ay, ar in avoid): return False
        if keep and not keep(at[0] + x, at[1] + y): return False
        return True

    spots, tries = [], 0
    while len(spots) < n and tries < n * 40:
        tries += 1
        x, y = rnd.uniform(-w / 2, w / 2), rnd.uniform(-d / 2, d / 2)
        if not ok(x, y, 0.1) or any(math.hypot(x - a, y - b) < 0.28 for a, b in spots): continue
        spots.append((x, y))
    for i, (x, y) in enumerate(spots):
        hh = rnd.uniform(*h); r = hh * rnd.uniform(0.3, 0.42)
        pv = cz.empty(f'{name}_tuft{i}', (x, y, gz(x, y) - 0.03), parent=root); pv.rotation_euler = (0, 0, rnd.uniform(0, 6.28))
        _tuft(cz, f'{name}_tuft{i}_m', (0, 0, 0), hh, r, gm[i % 2], pv, rnd, k=rnd.choice((4, 5, 5, 6)))
        if rnd.random() < flowers:
            c = rnd.choice(petals)
            fm = cz.toon(f'out_tufts_petal{c}', c, tex='grain', tex_strength=0.03)
            for j in range(rnd.randint(1, 3)):
                a = rnd.uniform(0, 6.28); dd = r * 0.5
                _flower(cz, f'{name}_tuft{i}_fl{j}', (math.cos(a) * dd, math.sin(a) * dd, hh * rnd.uniform(0.6, 0.85)), 0.05, fm, cm, pv, rnd)
    for i in range(pebbles):
        for _ in range(30):
            x, y = rnd.uniform(-w / 2, w / 2), rnd.uniform(-d / 2, d / 2)
            if ok(x, y, 0.05): break
        s = rnd.uniform(0.05, 0.12)
        o = cz.sphere(f'{name}_peb{i}', 1.0, (x, y, gz(x, y) - s * 0.25), stone[i % 2], ol=0.004, parent=root, segs=8, rings=5)
        for v in o.data.vertices:
            k = 0.8 + 0.35 * rnd.random(); v.co = (v.co.x * s * k, v.co.y * s * 0.8 * k, max(v.co.z, -0.3) * s * 0.6 * k)
        o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return root
