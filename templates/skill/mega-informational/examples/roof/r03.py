# R03 "But the rain sits on it in puddles" 101-155: the sky turns to storm, rain streaks come down; the camera rises to
# a top view and puddles spread across the flat boards.
F0, F1 = 101, 155


def build(ctx):
    import bpy, os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=30, sun_rot=245, storm=[(T(101), 0.0), (T(124), 1.0)])
    mt = P.mats()
    G = P.ground(mt)
    hs = H.build('flat', mt)
    P.dress(hs, mt, 'flat', sunny=False)
    ztop = H.WALL + 0.066
    P.rain('rain', (0, 0, 0), (26, 26), F0, F1, n=6000, speed=11, top=14, length=0.6)
    # rain starts on "rain" (f113): hide the column before
    rn = bpy.data.objects['rain']; M.visible(rn, [(T(111), 99)], F0, F1)
    r = random.Random(5)
    spots = []
    for i in range(22):
        x = r.uniform(-3.8, 3.8); y = r.uniform(-3.0, 3.0)
        a = T(126) + r.uniform(0, 0.5) + (0.25 if i > 8 else 0); spots.append((x, y, r.uniform(0.45, 1.05), a, a + r.uniform(0.6, 0.9)))
    P.puddles('pud', spots, F0, F1, ztop)
    P.splashes('spl', lambda rr: (rr.uniform(-4.3, 4.3), rr.uniform(-3.3, 3.3), ztop), F0, F1, n=110, life=5, size=0.6, f_on=116)
    P.splashes('splg', lambda rr: (rr.uniform(-12, 12), rr.choice((-1, 1)) * rr.uniform(3.8, 12), 0.02), F0, F1, n=90, life=5, size=0.8, f_on=114)
    # sky going dark -> rise and tilt down to the top view of the boards
    P.fly([(T(101), (-6.5, -12.5, 4.0), (0.3, 2.0, 9.5), 22),
           (T(122), (-4.0, -8.5, 8.5), (0.0, 0.0, 3.5), 24),
           (T(140), (-0.8, -3.2, 12.5), (0.0, 0.0, 2.9), 26),
           (T(155), (0.6, -1.4, 13.4), (0.2, 0.3, 2.9), 27)], F0, F1, smooth=4)
    return F0, F1
