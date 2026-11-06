# R02 "you have a roof" 63-100: low hero angle under the flat board roof, hard sun, a little proud.
F0, F1 = 63, 100


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=30, sun_rot=268)
    mt = P.mats()
    P.ground(mt)
    hs = H.build('flat', mt)
    P.dress(hs, mt, 'flat', sunny=True)
    # a faint warm rim on the boards' edge as the camera passes ("proud"): a slow sun glint comes from the sun lamp
    P.fly([(T(63), (-10.0, -7.6, 0.95), (-0.5, -0.2, 2.5), 22),
           (T(82), (-8.9, -8.9, 0.85), (0.0, -0.3, 2.6), 22),
           (T(100), (-7.6, -10.0, 0.8), (0.5, -0.4, 2.7), 21)], F0, F1)
    return F0, F1
