# E13 "from collapsing" 481-520: travel along the netted wall, yellow straps, the steel belt, crane behind; whip out.
F0, F1 = 481, 520


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    P.scene_wrap(F1, straps_on=True, F0=F0, hole=60,
                 cranes=[((-22, 8, -8), -18, 46, 34, 10), ((22, 26, -8), 20, 44, 50, 35)])
    cam = M.Flight([(t(480), (-3.5, -19.5, 10.5), (3, -8.5, 13), 20), (t(496), (-2, -19.5, 10.5), (4.5, -8, 13), 20),
              (t(512), (-0.5, -19.5, 10.5), (6, -7.5, 13), 20), (t(520), (6, -20, 10), (16, -2, 14), 20)],
             ease=["linear", "linear", "in"]).bake(F0, F1)
    if False: P.wipe_card   # (calm camera, 2026-10-27: no black-card slide; a plain cut)
    #(cam, [(t(510), 1.0), (t(515), 0.0), (t(517), 0.0), (t(521), -1.0)], F0, F1)
    return F0, F1
