# R16 "But the first big snow weighs as much as six cars" 1009-1107 (winter: snow piles up, six ghost cars stack on)
F0, F1 = 1009, 1107


def build(ctx):
    import os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    R.world(F1, 'winter')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.55)
    R.land(mt, winter=True)
    k = lambda tt, a, b: cz.clamp(((tt * 30 + 1) - a) / (b - a))
    # snow piles up from "first" (1027) to "weighs" (1056)
    for sn in P['snow']:
        M.bake_path(sn, F0, F1, scale=lambda tt: (1, 1, 0.08 + 0.92 * cz.smooth(k(tt, 1020, 1058))))
    R.snowfall('flakes', mt, (0, -4), 40, F0, F1, n=3000)
    # six ghost cars drop onto the roof, one every ~5 frames from "much" (1069) to "cars" (1091)
    cols = ['#ff4a3a', '#3aa0ff', '#ffd23a', '#4aff8a', '#c06aff', '#ff9a3a']
    cars = [R.car_full(f'car{i}', c) for i, c in enumerate(cols)]
    spots = [(-2.3, 0, 0), (2.3, 0, 0), (-2.0, 0, 1), (2.1, 0, 1), (-2.2, 0, 2), (2.0, 0, 2)]
    ridge = R.WALL + R.RISE + 0.45
    for i, (c, (x, y, lvl)) in enumerate(zip(cars, spots)):
        fa = 1062 + i * 5
        z1 = ridge + lvl * 1.45
        M.bake_path(c, F0, F1, pos=lambda tt, fa=fa, x=x, z1=z1: (x, 0.0, z1 + 9.0 * (1 - cz.in_cubic(k(tt, fa, fa + 8))) + 0.3 * math.sin(math.pi * k(tt, fa + 8, fa + 14))),
                    rot=lambda tt, i=i: (0, 0, 4 * (i % 2 - 0.5)))
        R.show_from([c], fa, F0, F1)
    # a big counter-weight read: "6 CARS" counter would be text; the stack itself carries it
    R.flight([(1009, (9.0, -10.0, 1.6), (0.0, 0.0, 3.2), 24),
              (1050, (8.0, -10.5, 1.8), (0.0, 0.0, 3.8), 24),
              (1080, (8.5, -12.5, 2.4), (0.0, 0.0, 5.6), 22),
              (1107, (8.0, -13.5, 2.6), (0.0, 0.0, 6.0), 22)], F0, F1)
    return F0, F1
