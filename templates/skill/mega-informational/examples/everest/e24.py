# E24 "and when it reaches the Pacific Ocean" 1206-1270: the slab on its steel platform in the sea: close along the
# copper fin ring, then a low flight over the water past a snowy floe, the slab small on the horizon.
F0, F1 = 1206, 1270


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M
    import props_c as P
    t, PR, WL = P.t, P.PR, P.WL
    M.setup(F1, sun_elev=24, sun_rot=60, sun_power=3.6)
    P.ssr()
    P.sea_set(F0, F1, beams_keys=[(t(1258), 0.05), (t(1270), 0.7)], deck_on=False)
    # round 3 (Flight v2, matched to the reference curve): whip in from E23 (image pans +x, turns +, zooms in,
    # decelerating), slow drift left along the copper ring, near-still, hard cut at 1244.5 (the reference's measure is flat there) to the far
    # low view, slow yaw left + roll, push-in whip into E25 over the last frames.
    fl = M.Flight([(t(1203), (PR + 24, -28, 4.5), (PR + 4, 8, 2), 26, -14),
              (t(1207), (PR + 10, -21, 3), (PR - 1, 8, 1.2), 26, -5),
              (t(1212), (PR + 6.6, -15.5, 1.2), (PR - 1.5, 8, 0.5), 26, 0),
              (t(1226), (PR + 6.8, -16.2, 1.1), (PR - 0.6, 8, 0.4), 26, 1.5),
              (t(1244), (PR + 7.0, -16.6, 1.0), (PR - 0.5, 8, 0.3), 26, 1.6),
              (t(1245), (20, -205, WL + 3.0), (4, 0, WL + 8), 32, 0),
              (t(1264), (16, -195, WL + 2.6), (-12, 0, WL + 8), 32, 4),
              (t(1267), (15, -190, WL + 2.5), (-13, 0, WL + 7.8), 32, 5),
              (t(1272), (10, -150, WL + 2.0), (-12, 0, WL + 7), 32, 6)],
             cuts=[t(1244.5)]); fl.bake(F0, F1)
    # the dissolve from E23's globe: the coast map card fades out while the camera whips in
    import common as C
    if False: P.fade_card   # (calm camera: no transition cards)
    #(fl.obj, C.T('earth_day.png'), [(t(1204), 0.55), (t(1211), 0.0)], F0, F1)
    return F0, F1
