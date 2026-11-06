# E26 "pumping out the water and floating" 1341-1400: low between the tanks, then the ship-like pump hulls moored
# under the platform edge, their ballast tanks lit green (x-ray); whip up at the end.
F0, F1 = 1341, 1400


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M
    import props_c as P
    t, PR, WL = P.t, P.PR, P.WL
    M.setup(F1, sun_elev=26, sun_rot=60, sun_power=3.6)
    P.ssr()
    P.sea_set(F0, F1, tanks_from=0.0, hulls=True, hull_xr_keys=[(t(1360), 0.0), (t(1372), 1.0)])
    # round 3 (Flight v2, matched to the reference curve): still in the channel, a quick pull-back (zoom out, pan
    # -x) onto the hull, slow push-in (+0.5 %/f), a short yaw + roll closer to the hull end, hold-ish, hard cut at
    # 1394.5 into a decelerating whip toward the wide of E27.
    fl = M.Flight([(t(1338), (1.0, -PR - 7.6, WL + 1.25), (0.5, 0, WL + 5.1), 22),
              (t(1344), (1.0, -PR - 8.0, WL + 1.25), (0.5, 0, WL + 5.0), 22),
              (t(1349), (1.0, -PR - 8.0, WL + 1.25), (4.5, 0, WL + 5.0), 22, -3),
              (t(1350), (0, -62, WL + 2.2), (0, -16, WL + 2.9), 24),
              (t(1376), (0, -57, WL + 2.2), (0, -18, WL + 2.9), 24),
              (t(1384), (-0.8, -53, WL + 2.2), (-1.6, -20, WL + 2.5), 22, 3),
              (t(1394), (-0.9, -52.7, WL + 2.2), (-1.7, -20, WL + 2.5), 22, 3),
              (t(1395), (-5.5, -116, WL + 3.1), (0, 0, WL + 8), 26, 0),
              (t(1402), (-5, -114, WL + 3.1), (0, 0, WL + 8), 26, 0)],
             cuts=[t(1349.5), t(1394.5)]); fl.bake(F0, F1)
    return F0, F1
