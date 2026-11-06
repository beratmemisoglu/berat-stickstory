# R14 "So you hang a trough under the edge and run a pipe down the corner" 823-916 (storm, front-right corner)
F0, F1 = 823, 916


def build(ctx):
    import os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    R.world(F1, 'storm')
    mt = R.mats(wet=True)
    P = R.cottage(mt)
    R.land(mt, clouds=False)
    gz = P['gutter_z']
    k = lambda tt, a, b: cz.clamp(((tt * 30 + 1) - a) / (b - a))
    # the trough slides in under the eave on "trough" (849) and sits by "edge" (876)
    g = P['trough'][0]
    M.bake_path(g, F0, F1, pos=lambda tt: (11.0 * (1 - cz.out_cubic(k(tt, 846, 874))), -(R.EY + 0.02), gz + 0.25 * (1 - cz.out_cubic(k(tt, 846, 874)))))
    R.hide([P['trough'][1]])
    # the downpipe drops down the corner on "pipe" (893) -> "corner" (908)
    dp = P['downpipe_grp']
    M.bake_path(dp, F0, F1, pos=lambda tt: (0, 0, 3.2 * (1 - cz.out_cubic(k(tt, 889, 906))) - 0.04 * math.sin(math.pi * k(tt, 906, 914))))
    R.show_from([dp], 888, F0, F1)
    # water: the curtain off the bare eave until the gutter catches it, then the gutter fills and the shoe spills
    cu = R.sheet_curtain('curtain', -R.W / 2 - R.OVER, R.W / 2 + R.OVER, -(R.EY + 0.08), R.surf_z(R.EY) - 0.04, F0, F1)
    M.visible(cu, [(-1, R.t(874))], F0, F1)
    M.bake_path(P['gwater'], F0, F1, scale=lambda tt: (1, 1, 0.05 + 0.95 * cz.smooth(k(tt, 874, 912))))
    x, yw = P['dp_x'], P['dp_y']
    R.stream('spill', [(x, yw - 0.33, 0.12), (x + 0.1, yw - 0.8, 0.04), (x + 0.3, yw - 1.6, 0.02)], 0.045, mt['water'], F0, F1, 906, 916)
    R.rain('rain', mt, (4, -6), 30, F0, F1, n=8000, avoid=[(8.6, -10, 3.0)])
    R.splashes('spl', mt, (4, -8), 14, F0, F1, n=600, avoid=lambda x, y: abs(x) < 4.1 and abs(y) < 3.1)
    R.flight([(823, (7.4, -8.2, 1.4), (2.2, -3.6, 2.2), 24),
              (862, (6.8, -7.6, 1.2), (2.8, -3.6, 2.1), 24),
              (896, (6.6, -7.4, 1.0), (4.0, -3.4, 1.5), 26),
              (916, (6.5, -7.4, 0.8), (4.2, -3.3, 0.9), 26)], F0, F1, in_up=0.5, wf=7)
    return F0, F1
