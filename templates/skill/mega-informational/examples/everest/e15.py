# E15 "drill thousands of support columns / under the slab" 546-640: among the columns under the slab (green x-ray),
# the red lattice tower, machinery below, then wide: the slab on legs over the column forest; the platform appears.
F0, F1 = 546, 640


def build(ctx):
    import os, sys, bpy
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    mt, o = P.scene_lift(F1, F0=F0, cols=True, cols_xray=[(t(546), 0.7), (t(600), 0.7), (t(612), 0.25)], plat=True,
                         tower=(12, -5, 0))
    P.show_but_xray(o['plat'], [(t(626), 99)], F0, F1)
    cam = M.Flight([(t(546), (6, -11.5, 8), (-1.2, 0.5, 9.8), 14), (t(590), (5.9, -11.55, 8), (-1.4, 0.45, 9.8), 14),
              (t(592.9), (5.9, -11.55, 8), (2.5, 3.5, 10.2), 14),
              (t(593), (2, -54, 8), (1.5, 0, 13), 28), (t(597), (2, -54, 8), (0.2, 0, 13), 28), (t(625), (1.6, -55, 8), (0, 0, 13), 28),
              (t(640), (2.0, -46, 8), (0, 0, 10.5), 28)], cuts=[t(593)]).bake(F0, F1)
    return F0, F1
