# R15 "This is a gutter, and it carries the rain away from your house" 917-1008 (follow the water)
F0, F1 = 917, 1008


def build(ctx):
    import os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    R.world(F1, 'storm')
    mt = R.mats(wet=True)
    P = R.cottage(mt)
    R.land(mt, clouds=False)
    k = lambda tt, a, b: cz.clamp(((tt * 30 + 1) - a) / (b - a))
    gw = P['gwater']; gw.scale = (1, 1, 1)
    # bright droplets riding the gutter toward the downpipe (one joined object sliding +x)
    import random
    r = random.Random(2); drops = []
    for i in range(90):
        drops.append(cz.sphere(f'gd{i}', r.uniform(0.012, 0.025), (r.uniform(-14, 4.3), r.uniform(-0.05, 0.05), -0.035), mt['water'], segs=8, rings=5, ol=0))
    dj = M.join('gdrops', drops); dj.parent = P['trough'][0]
    M.bake_path(dj, F0, F1, pos=lambda tt: (min(1.6 * (tt - R.t(F0)), 9.5) * 1.0, 0, 0))
    # green on "gutter" (942)
    xm = M.xray('r2_x_gutter')
    xs = R.xcopy([P['trough'][0]], xm, 1.04) + R.xcopy(P['downpipe'][:4], xm, 1.15)
    R.xfade(xm, 942, hold=34, off=12)
    # the water leaves the shoe and runs out across the lawn, away from the house ("away" 980)
    x, yw = P['dp_x'], P['dp_y']
    R.stream('spill', [(x, yw - 0.33, 0.12), (x + 0.1, yw - 0.8, 0.04), (x + 0.3, yw - 1.6, 0.02)], 0.045, mt['water'], F0, F1, F0 - 5, F0)
    R.stream('runoff', [(x + 0.3, yw - 1.6, 0.02), (x + 0.9, yw - 3.5, 0.02), (x + 2.4, yw - 6.0, 0.02), (x + 4.5, yw - 9.0, 0.02)], 0.06, mt['water'], F0, F1, 968, 1000)
    R.rain('rain', mt, (4, -6), 34, F0, F1, n=8000, avoid=[(-2.5, -7, 2.5), (2, -7.2, 2.5), (7.5, -8, 2.5), (10, -15, 3)])
    R.splashes('spl', mt, (5, -9), 16, F0, F1, n=700, avoid=lambda x, y: abs(x) < 4.1 and abs(y) < 3.1)
    R.flight([(917, (-2.6, -7.2, 3.9), (0.4, -3.5, 2.4), 22),
              (950, (1.8, -7.4, 3.5), (4.2, -3.5, 2.0), 22),
              (975, (7.6, -8.2, 2.2), (4.3, -3.3, 0.6), 22),
              (1008, (8.5, -12.0, 1.2), (5.5, -6.5, 0.6), 26)], F0, F1, calm=0.12)
    return F0, F1
