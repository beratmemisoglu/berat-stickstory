# E18 "the platform" 831-860: front cutaway - the dark backlit slab on the lit platform over the ground line, the
# lava-cracked ground section below; the platform flashes green, then a fast push into it.
F0, F1 = 831, 860


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    P.scene_cut(F1, F0=F0, xray_keys=[(t(838), 0), (t(842), 1), (t(860), 1)])
    M.Flight([(t(831), (0.2, -160, 0.0), (0.1, 0, 0.0), 50),
              (t(860), (0, -160.4, 0.05), (0, 0, 0.05), 50)]).bake(F0, F1)
    return F0, F1
