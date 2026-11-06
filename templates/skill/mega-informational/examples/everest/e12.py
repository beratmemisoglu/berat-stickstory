# E12 "in reinforced steel mesh / to keep it" 401-480: the net on the cap under the crane jib, a skim low over the
# mesh (green x-ray at "steel mesh"), whip down to the wall with the yellow straps.
F0, F1 = 401, 480


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    P.scene_wrap(F1, net_drop=[(0, 3.0), (t(404), 0.0)], straps_on=True, F0=F0, side_span=[(t(458), 99)], hole=40,
                 cranes=[((-24, 2, -8), -12, 41, 52, 16), ((16, 10, -8), 150, 34, 22, 30)],
                 xray_keys=[(t(436), 0), (t(442), 1), (t(456), 1), (t(462), 0)])
    import bpy
    for c in ('crane0', 'crane1'): M.visible(bpy.data.objects[c], [(0, t(431)), (t(459), 99)], F0, F1)
    cam = M.Flight([(t(401), (4, -50, 27), (-2, 0, 15), 26, 0), (t(427), (4, -49, 27), (2.0, 0, 15), 26, -7),
              (t(432.9), (3.8, -48, 27), (2.6, 0, 15), 26, -8),
              (t(433), (-1, -10.5, 21.0), (1.2, 5, 20.5), 18, 0), (t(452), (-0.8, -9.8, 21.4), (-0.9, 6, 21.0), 18, 8),
              (t(455.5), (-0.8, -9.7, 21.4), (-1.0, 6, 21.0), 18, 8.5), (t(460.9), (-0.6, -9.4, 21.6), (10, 6, 21.0), 18, 0),
              (t(461), (5, -19, 10), (-0.5, -9, 17), 22, 0), (t(480), (6, -18.8, 9.8), (1.5, -9, 16.8), 22, 0)],
             cuts=[t(433), t(461)]).bake(F0, F1)
    return F0, F1
