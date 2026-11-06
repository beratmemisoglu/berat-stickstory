# R08 "each row lapped over the one below, like the scales of a fish" 401-485: the shingle rows cascade up the front
# slope, each landing over the one below; the camera pushes square onto the slope and on "scales" (f463) the rows
# match-cut to the scales of a fish's flank (same row pitch, same framing), then back to the roof.
F0, F1 = 401, 485


def build(ctx):
    import bpy, os, sys, math
    from mathutils import Vector
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=34, sun_rot=268)
    mt = P.mats()
    G = P.ground(mt)
    hs = H.build('shingles', mt)
    P.dress(hs, mt, 'shingles', sunny=True)
    rows = hs['shingle_rows']
    front = rows[:16]
    down, across, nrm = P.slope_basis(-1)
    t0, t1 = T(403), T(452); late = []
    for i, rw in enumerate(front):
        if i == 0: continue                                    # the bottom row was laid in R07
        loc0 = rw.location.copy()
        tl = t0 + (t1 - t0) * (i - 1) / 14; fall = 0.28
        def pos(t, loc0=loc0, tl=tl):
            k = max(0.0, (tl - t) / fall)
            if t >= tl:
                b = 0.02 * math.exp(-(t - tl) * 20) * abs(math.sin((t - tl) * 45))
                return tuple(loc0 + nrm * b)
            return tuple(loc0 + nrm * (1.3 * min(1.0, k) ** 2) - down * (0.4 * min(1.0, k) ** 2))
        M.bake_path(rw, F0, F1, pos=pos)
        late.append((rw, tl - fall))
    # the fish flank, laid on the slope plane with the shingle row pitch
    fc = P.slope_point(-1, 0.55, 0.3, lift=0.04)
    fish = P.fish_flank('fish', tuple(fc), (H.PITCH, 0, 0), rows=24, cols=30, pitch_r=0.27, pitch_c=0.405)
    ts0, ts1 = T(459), T(479)
    M.visible(fish['root'], [(ts0, ts1)], F0, F1)
    world_objs = [hs['root'], G['hill'], G['grass'], G['stones']] + [tr['root'] for tr in G['trees']]
    for o in world_objs: M.visible(o, [(0, ts0), (ts1, 99)], F0, F1)
    for rw, ta in late: M.visible(rw, [(ta, ts0), (ts1, 99)], F0, F1)
    sp = lambda u, x, l: tuple(P.slope_point(-1, u, x, l))
    P.fly([(T(401), sp(0.9, -1.6, 4.6), sp(0.57, 0.1, 0.0), 25),
           (T(468), sp(0.6, 0.4, 3.0), sp(0.55, 0.45, 0.0), 26),
           (T(485), sp(0.58, 0.8, 3.4), sp(0.55, 0.65, 0.0), 26)], F0, F1, smooth=4)
    return F0, F1
