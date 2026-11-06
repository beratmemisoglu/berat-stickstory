# R09 "These are shingles" 486-520: wide three-quarter of the finished shingle roof; a green x-ray pulse runs over
# the shingles on "shingles" (f510).
F0, F1 = 486, 520


def build(ctx):
    import bpy, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=34, sun_rot=268)
    mt = P.mats()
    P.ground(mt)
    hs = H.build('shingles', mt)
    P.dress(hs, mt, 'shingles', sunny=True)
    xm = M.xray('r1_xr_shingles')
    P.xray_over(hs['shingle_rows'], xm, grow=1.004)
    tw = T(510)
    M.xray_fade(xm, [(T(F0), 0), (tw - 0.15, 0), (tw + 0.03, 1.0), (tw + 0.4, 0.85), (T(F1), 0.6)])
    P.fly([(T(486), (-13.5, -12.0, 7.5), (0, 0, 3.0), 26),
           (T(520), (-10.0, -15.5, 6.4), (0.5, 0, 3.2), 26)], F0, F1)
    return F0, F1
