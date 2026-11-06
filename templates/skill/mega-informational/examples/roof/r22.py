# R22 "This is an ice dam" 1571-1610 (the ice ridge along the eave glows green on "ice" 1599)
F0, F1 = 1571, 1610


def build(ctx):
    import os, sys
    import numpy as np
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    R.world(F1, 'winter')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.38)
    R.land(mt, winter=True)
    wd = R.W + 2 * R.OVER + 0.12
    def dam_top(U, V):
        n = M.fbm(U * 30, V * 3 + 4, seed=8, octaves=4)
        return 0.42 * np.sin(np.pi * np.clip(V, 0, 1)) ** 0.6 * (0.75 + 0.5 * n) * (0.4 + 0.6 * np.clip(U / 0.02, 0, 1) * np.clip((1 - U) / 0.02, 0, 1))
    dam = R.slab('icedam', wd, 0.95, dam_top, nx=120, ny=12, mat=mt['ice'])
    R.on_slope(dam, -1, R.EY + 0.08, lift=-0.02)
    R.icicles('icic', mt['ice'], -R.W / 2 - R.OVER, R.W / 2 + R.OVER, -(R.EY + 0.12), P['gutter_z'] - 0.08, n=70, lmax=0.6)
    xm = M.xray('r2_x_dam')
    x = R.xcopy([dam], xm, 1.0)[0]; x.scale = (1.0, 1.08, 1.25)
    R.xfade(xm, 1597, hold=None, rise=6)
    R.flight([(1571, (-3.2, -8.2, 2.2), (0.0, -3.6, 2.9), 26),
              (1610, (1.8, -7.6, 2.0), (0.6, -3.6, 2.9), 26)], F0, F1, calm=0.12)
    return F0, F1
