# Smoke column: a thin plume rising from a smouldering ruin - soft faceted puffs that grow and drift sideways with
# height (bent by a light wind toward +X), two-tone (a lighter puff on each, the lit side), fading lighter toward the
# top. No ink (inked puffs read as cotton), casts no shadow. Floor prop: root at the plume's foot.
# Animate: <name>_puff<i> location / scale (rising: shift each puff up its path and loop).
import math, random

META = {'size': (2.5, 2.0, 7.0), 'anchor': 'foot of the plume (on the ground / the heap)',
        'animate': ['_puff<i> (location / scale: rise and loop)'],
        'params': "height=7.0, n=11 (puffs), r0=0.35 (foot puff radius), drift=1.6 (sideways at the top, +X), col='#a898a8', "
                  "col2='#d8c8cc' (lit puffs), seed=1"}


def build(cz, name='out_smoke', height=7.0, n=11, r0=0.35, drift=1.6, col='#a898a8', col2='#d8c8cc', seed=1):
    rnd = random.Random(seed)
    root = cz.empty(name)
    m1 = cz.toon(f'out_smoke{col}', col, lift=0.5, tex='grain', tex_strength=0.04)
    m2 = cz.toon(f'out_smoke{col2}', col2, lift=0.5, tex='grain', tex_strength=0.04)
    for i in range(n):
        u = i / max(1, n - 1)
        z = height * (u ** 0.9); x = drift * u ** 1.6 + rnd.uniform(-0.1, 0.1); y = rnd.uniform(-0.1, 0.1)
        r = r0 * (1 + 2.2 * u) * rnd.uniform(0.85, 1.15)
        pv = cz.empty(f'{name}_puff{i}', (x, y, z), parent=root)
        # smooth round puffs (faceted ones read as a column of rocks), a lit cap on the sun side
        o = cz.sphere(f'{name}_puff{i}_m', 1.0, (0, 0, 0), m1, ol=0.0, parent=pv, segs=24, rings=14)
        sq = rnd.uniform(0.75, 0.9)
        for v in o.data.vertices: v.co = (v.co.x * r * 1.2, v.co.y * r, v.co.z * r * sq)
        o.data.update(); o.visible_shadow = False
        h = cz.sphere(f'{name}_puff{i}_lit', 1.0, (-r * 0.22, -r * 0.28, r * 0.3), m2, ol=0.0, parent=pv, segs=20, rings=10)
        for v in h.data.vertices: v.co = (v.co.x * r * 0.75, v.co.y * r * 0.7, v.co.z * r * 0.55)
        h.data.update(); h.visible_shadow = False
    return root
