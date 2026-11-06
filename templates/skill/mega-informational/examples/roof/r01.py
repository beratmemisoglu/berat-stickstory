# R01 "If you lay flat boards across the top of your walls" 1-62: aerial push down onto four bare stone walls on the
# hill; the planks drop in one by one across the wall tops; green x-ray on the boards on "boards" (f33).
F0, F1 = 1, 62


def build(ctx):
    import bpy, os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=33, sun_rot=268)
    mt = P.mats()
    G = P.ground(mt)
    hs = H.build('flat', mt)
    P.dress(hs, mt, 'flat', sunny=True)
    boards = hs['boards']
    r = random.Random(4)
    n = len(boards)
    t_first, t_last = T(12), T(54)
    for i, b in enumerate(boards):
        loc = b.location.copy(); rz = math.degrees(b.rotation_euler.z)
        tl = t_first + (t_last - t_first) * i / (n - 1)       # landing time
        h0 = 3.5 + r.uniform(0, 1.5); tilt = r.uniform(-14, 14); spin = r.uniform(-25, 25)
        def pos(t, loc=loc, tl=tl, h0=h0):
            if t >= tl:
                k = t - tl; bounce = 0.05 * math.exp(-k * 14) * abs(math.sin(k * 30))
                return (loc.x, loc.y, loc.z + bounce)
            k = max(0.0, (tl - t) / 0.42)
            return (loc.x, loc.y + 0.25 * k * k, loc.z + h0 * min(1.0, k) ** 2 + (2.0 if k > 1 else 0) * (k - 1))
        def rot(t, tl=tl, tilt=tilt, spin=spin, rz=rz):
            k = max(0.0, min(1.0, (tl - t) / 0.42))
            return (tilt * k * k, 0, rz + spin * k * k)
        def sc(t, tl=tl):
            return 1.0 if t > tl - 0.42 else 0.001
        M.bake_path(b, F0, F1, pos=pos, rot=rot, scale=sc)
    xm = M.xray('r1_xr_boards01')
    P.xray_over(boards, xm, grow=1.03)
    tb = T(33)
    M.xray_fade(xm, [(0, 0), (tb - 0.1, 0), (tb + 0.03, 1.0), (tb + 0.55, 0.85), (T(F1) - 0.15, 0.25), (T(F1), 0.1)])
    # aerial push down: high, wide over the hill -> down to a three-quarter view of the wall tops
    P.fly([(T(1), (-13, -36, 16), (0, 0, 1.0), 26),
           (T(30), (-9, -20, 10), (0, 0, 2.0), 27),
           (T(62), (-6.2, -11.8, 6.4), (0.2, 0.3, 2.7), 28)], F0, F1, whip_in=False)
    return F0, F1
