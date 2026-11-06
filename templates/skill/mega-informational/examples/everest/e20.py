# E20 "letting the" 916-955: down from the arcs to the rails; low along the green x-ray track toward the platform
# riding on it (fins, steel skirt, bogies), the slab above.
F0, F1 = 916, 955


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    P.scene_track(F1, F0=F0, rail_xray=[(t(916), 1.0), (t(950), 1.0)], glide=lambda tt: (tt - t(916)) * 3)
    M.Flight([(t(916), (0, -38, 1.6), (-1.0, 0, 3), 22), (t(931), (0, -42.5, 1.5), (0.6, 0, 3), 22),
              (t(945), (0, -46.7, 1.4), (2.1, 0, 3), 22), (t(955), (0, -55, 7.5), (2.4, 0, 2.5), 22)]).bake(F0, F1)
    return F0, F1
