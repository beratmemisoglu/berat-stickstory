# R20 "But the warm air from your house heats the roof from below" 1317-1395 (thermal section through the gable end)
F0, F1 = 1317, 1395


def build(ctx):
    import os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import bpy, cz, mega as M, props_r2 as R
    R.world(F1, 'thermal')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.55, ties=True, ceiling=True)
    R.land(mt, winter=True, trees=True, n=14, clouds=False)
    k = lambda tt, a, b: cz.clamp(((tt * 30 + 1) - a) / (b - a))
    # section: the -X gable end and wall are cut away
    R.hide([o for o in P['walls'] if o.name.startswith('wL')] + [P['gables'][0]])
    stove = cz.box('stove', (0.7, 0.6, 0.9), (-1.8, 1.8, 0.55), mt['metal'], bevel=0.04, ol=0)
    flue = cz.cyl('flue', 0.08, 2.0, (-1.8, 1.8, 1.0), mt['metal'], verts=12, ol=0)
    table = cz.box('table', (1.2, 0.8, 0.75), (1.0, -0.8, 0.475), mt['wood'], bevel=0.02, ol=0)
    divider = cz.box('divider', (0.15, R.D - 2 * R.T, R.WALL), (1.6, 0, R.WALL / 2), mt['stone'], bevel=0.01, ol=0)
    # the roof underside: glows from cold to hot on "heats" (1355) .. "below" (1377)
    hot = R.thermal_mat('th_underside', 0.2, strength=1.8)
    R.thermal_key(hot, [(1348, 0.2), (1382, 0.78)])
    for s in (-1, 1):
        R.sloped(f'under{s}', s, R.EY - 0.3, 0.05, -0.33, 0.02, R.W + 0.6, hot)
    def rule(o):
        n = o.name
        if n.startswith('under'): return None
        if n.startswith(('stove', 'flue')): return 1.0
        if n.startswith(('table', 'floor')): return 0.62
        if n.startswith(('ceiling', 'divider')): return 0.58
        if n.startswith(('wF', 'wB', 'wR', 'w')) and o.parent == P['root'] and n[:2] in ('wF', 'wB', 'wR'): return 0.5
        if n.startswith(('gable', 'chimney')): return 0.4
        if n.startswith(('rafter', 'mytie', 'deck')): return 0.26
        if n.startswith('shrow'): return 0.16
        if n.startswith('snow'): return 0.06
        if n.startswith('hill'): return 0.03
        return 0.08
    R.thermalize(rule)
    # warm air rising from the rooms into the attic ("warm air" 1326 ->)
    warm = R.thermal_mat('th_air', 0.8, strength=2.2, soft=True)
    rr = random.Random(5)
    for i in range(46):
        x, y = rr.uniform(-3.3, 1.4), rr.uniform(-2.3, 2.3)
        fa = 1322 + rr.uniform(0, 40); sp = rr.uniform(0.9, 1.4); ph = rr.uniform(0, 6)
        top = R.surf_z(abs(y)) - 0.55
        b = cz.sphere(f'air{i}', rr.uniform(0.16, 0.3), (x, y, 0.5), warm, segs=16, rings=8, ol=0)
        def pos(tt, x=x, y=y, fa=fa, sp=sp, ph=ph, top=top):
            f = tt * 30 + 1; z = 0.6 + sp * max(0.0, f - fa) / 30 * 1.6
            return (x + 0.15 * math.sin(tt * 2 + ph), y + 0.1 * math.cos(tt * 1.7 + ph), min(z, top))
        def scl(tt, fa=fa, sp=sp, top=top):
            f = tt * 30 + 1; z = 0.6 + sp * max(0.0, f - fa) / 30 * 1.6
            if f < fa: return 0.001
            return max(0.001, min(1.0, (f - fa) / 6) * (1.0 if z < top else 1.4))
        M.bake_path(b, F0, F1, pos=pos, scale=scl)
    R.flight([(1317, (-13.5, -3.5, 3.0), (0.0, 0.0, 2.6), 24),
              (1356, (-12.0, -2.5, 3.4), (0.0, 0.0, 2.9), 24),
              (1395, (-10.8, -1.5, 4.0), (0.0, 0.0, 3.2), 24)], F0, F1)
    return F0, F1
