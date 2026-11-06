# E14 "Next" 521-545: wide low, the slab lifted on red/white steel legs above the rock stub; push in under it as
# the first support columns rise (stub gone), looking up at the underside.
F0, F1 = 521, 545


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    mt, o = P.scene_lift(F1, F0=F0, stub=True, mach=False, cols=True, cols_xray=[(t(530), 0.6)], cols_len=None)
    import bpy
    M.visible(bpy.data.objects['stub'], [(0, t(531))], F0, F1)
    c, x, n = o['cols']
    for ob in (c, x):
        M.bake_path(ob, F0, F1, scale=lambda tt: (1, 1, max(0.001, max(0.0, min(1, (tt - t(527)) / (t(545) - t(527)))) ** 0.7)))
    cam = M.Flight([(t(519), (0, -56, 5.5), (0, 0, 12.5), 26), (t(530), (0, -52, 5.5), (0, 0, 12.5), 26),
              (t(537), (1, -12, 2.5), (0, -6, 13), 24), (t(545), (2, -6, 4), (-2, 6, 11), 24)]).bake(F0, F1)
    return F0, F1
