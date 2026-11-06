# E21 "entire mountain" 956-990: high behind and above: the slab on its platform in a long trench through the
# snowfields, rails ahead; the whole mountain turns green x-ray.
F0, F1 = 956, 990


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    P.scene_track(F1, F0=F0, bowl=True, slab_xray=[(t(960), 0), (t(964), 1), (t(984), 1), (t(989), 0)], glide=lambda tt: (tt - t(956)) * 3)
    M.Flight([(t(955), (13, -61, 40), (2.0, 25, 15), 16, 0.0), (t(985), (12.6, -61, 39.8), (-1.6, 25, 14.8), 16, 2.0), (t(990), (12.5, -61, 39.8), (-1.7, 25, 14.8), 16, 2.0, True)]).bake(F0, F1)
    return F0, F1
