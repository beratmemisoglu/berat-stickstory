# E01 "Carve a" 1-7: aerial over the snowy Everest summit, clouds, fast push down (whips into E02).
F0, F1 = 1, 7


def build(ctx):
    import bpy, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import numpy as np
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_elev=26, sun_rot=300, light_sat=1.15, exposure=-0.45, light_k=1.0)
    P.cool_fill()
    mt = C.mats()
    f = M.mountain_fn(peak_h=115, radius=95, seed=3, ridge=0.8, sharp=1.15)
    g = M.range_fn(height=30, scale=40, seed=8)
    M.heightfield('everest', 500, 360, lambda X, Y: f(X, Y) + g(X, Y) * 0.6, mat=P.terrain_mats()['peak'])
    P.far_range('far', mt['snow'], inner=230, height=90)
    for i, (x, y, z, w) in enumerate([(-40, 20, 108, 60), (45, 25, 112, 50), (0, 50, 120, 70)]):
        cz.plane(f'cl{i}', w, w * 0.56, (x, y, z), P.cloud_mat(), rot=(90, 0, 0), ol=0)
    t = lambda fr: (fr - 1) / 30
    # v2 from the reference curve: an accelerating pull-back with a slight tilt down (zoom -5 .. -28 %/f).
    import math
    keys = []
    for fr, k in ((0, 1.0), (2, 1.03), (3, 1.16), (4, 1.42), (5, 1.85), (6, 2.5), (7, 3.4), (8, 4.6)):
        e = (-12 * k, -105 * k, 92 + 26 * k)
        keys.append((t(fr), e, (8 * (k - 1), 0, 92 - 30 * (k - 1)), 28))
    M.Flight(keys, smooth=0.6).bake(F0, F1)
    return F0, F1
