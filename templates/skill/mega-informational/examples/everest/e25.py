# E25 "attach giant ballast tanks underneath" 1271-1340: yellow radial beams on the water round the platform, then
# the green x-ray tank ring, which becomes the real dark tank ring; low flight in close to the wall, looking up.
F0, F1 = 1271, 1340


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M
    import props_c as P
    t, PR, WL = P.t, P.PR, P.WL
    M.setup(F1, sun_elev=26, sun_rot=60, sun_power=3.6)
    P.ssr()
    P.sea_set(F0, F1, beams_keys=[(t(1268), 0.7), (t(1284), 1.0), (t(1306), 1.0)],
              xr_keys=[(t(1294), 0.0), (t(1302), 1.0), (t(1317), 1.0), (t(1324), 0.0)], tanks_from=t(1317))
    # round 3 (Flight v2, matched to the reference curve): the push-in from E24 rushes past the slab's left side
    # (whip: image pans -x, turns -, zooms in), settles on the wall with the beams, slow drift along it; hard cut
    # at 1309.5 to the front view (still), slight yaw right, then a push forward into the channel between the tanks.
    fl = M.Flight([(t(1269), (2, -64, WL + 2.4), (-1, 0, WL + 6), 28, 0),
              (t(1275), (1, -58, WL + 2.4), (-1, 0, WL + 6), 28, 0),
              (t(1276), (-(PR + 5.5), -12, WL + 3.2), (-(PR + 3), 12, WL + 3.0), 24, 2),
              (t(1282), (-(PR + 2.2), -6, WL + 3.0), (-(PR - 3.5), 12, WL + 2.8), 22, -15),
              (t(1309), (-(PR + 3.0), -4, WL + 3.2), (-(PR - 3.0), 12, WL + 3.4), 22, -6),
              (t(1310), (0, -46, WL + 4.5), (0, 0, WL + 6), 26),
              (t(1327), (1.5, -44.5, WL + 4.3), (2.5, 0, WL + 6), 26),
              (t(1330), (1.8, -44.2, WL + 4.2), (2.8, 0, WL + 6), 26),
              (t(1331), (1.0, -PR - 8.5, WL + 1.3), (0.5, 0, WL + 5), 22),
              (t(1342), (1.0, -PR - 7.6, WL + 1.25), (0.5, 0, WL + 5.1), 22)],
             cuts=[t(1275.5), t(1309.5), t(1330.5)]); fl.bake(F0, F1)
    return F0, F1
