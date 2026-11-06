# E22 "glide forward with less friction" 991-1060: low beside the slab as it glides along the rails through a rock
# canyon, whip in close under the steel platform (panels, yellow bogies), whip out at the end.
F0, F1 = 991, 1060


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    v = 5.0
    P.scene_track(F1, F0=F0, canyon=True, glide=lambda tt: (tt - t(991)) * v)
    y = lambda f: (t(f) - t(991)) * v
    cam = M.Flight([(t(991), (-13, -95 + y(991), 2.5), (-14, y(991), 9), 30), (t(1010), (-13, -95 + y(1010), 2.5), (-2, y(1010), 9), 30), (t(1019), (-13, -95 + y(1019), 2.5), (-1.5, y(1019), 9), 30),
              (t(1022.9), (-13, -95 + y(1022.9), 2.5), (15, y(1022.9), 9), 30),
              (t(1023), (-15.3, -3 + y(1023), 0.9), (-6, y(1023) + 6, 3.2), 20), (t(1028), (-15.3, -3 + y(1028), 0.9), (-6, y(1028) + 2.5, 3.2), 20),
              (t(1046), (-15.3, -2.4 + y(1046), 0.9), (-6, y(1046) - 0.5, 3.2), 20), (t(1060), (-15.3, -2.2 + y(1060), 1.0), (-6, y(1060) - 0.8, 3.3), 20)],
             cuts=[t(1023)]).bake(F0, F1)
    return F0, F1
