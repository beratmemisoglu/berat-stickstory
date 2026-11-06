# R19 "This is a truss" 1287-1316 (wide of the truss row, all green, pulse on "truss" 1301)
F0, F1 = 1287, 1316


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    R.world(F1, 'winter')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.55, ties=True)
    R.land(mt, winter=True)
    R.hide([o for o in P['deck'] if o.name.startswith('decka')] + [o for o in P['shingle_rows'] if o.name.startswith('shrowa')] + [o for o in P['extra'] if o.name == 'underlaya'] + [P['snow'][0], P['gables'][0]])
    xm = M.xray('r2_x_truss')
    R.xcopy(P['rafters'] + P['myties'], xm, 1.06)
    M.xray_fade(xm, [(R.t(1287), 0.75), (R.t(1297), 0.75), (R.t(1302), 1.0), (R.t(1310), 0.85)])
    R.flight([(1287, (-9.5, -4.5, 4.6), (0.0, 0.0, 3.6), 22),
              (1316, (-9.0, -7.5, 4.2), (0.0, 0.0, 3.4), 24)], F0, F1, calm=0.12)
    return F0, F1
