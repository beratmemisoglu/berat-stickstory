# R06 "But it still finds the cracks between the boards" 269-336: macro sliding down the sloped board deck in the
# rain: rivulets run down and thread into the cracks between the boards (green x-ray on the cracks on "cracks" f297),
# then the camera drops under the eave: drops fall from the cracks underneath.
F0, F1 = 269, 336


def build(ctx):
    import bpy, os, sys, math, random
    from mathutils import Vector
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=30, sun_rot=245, storm=[(T(260), 0.85), (T(340), 0.85)], exposure=0.0)
    mt = P.mats(wet=True)
    P.ground(mt)
    hs = H.build('gable', mt)
    P.dress(hs, mt, 'gable', sunny=False)
    s = -1
    n = 14
    gaps = [(i + 1) / n for i in range(n - 1)]
    ang = H.PITCH
    xm = M.xray('r1_xr_cracks')
    cracks = []
    for i, u in enumerate(gaps):
        p = P.slope_point(s, u, 0, lift=-0.005)
        cracks.append(cz.box(f'crack{i}', (H.W + 2 * H.OVER, 0.026, 0.02), tuple(p), xm, rot=(ang, 0, 0), bevel=0, ol=0))
    tc = T(297)
    M.xray_fade(xm, [(T(F0), 0), (tc - 0.12, 0), (tc + 0.03, 1.0), (tc + 0.7, 0.9), (T(330), 0.5), (T(F1), 0.35)])
    # water standing in the cracks (glossy line) - fills from "finds"
    wm = P.flow_mat('r1_crackwater', F0, F1, speed=0.6, axis='X', sign=1, alpha=0.85, stretch=(6, 30, 1.0), strength=0.2)
    for i, u in enumerate(gaps):
        p = P.slope_point(s, u, 0, lift=0.002)
        cw = cz.box(f'cw{i}', (H.W + 2 * H.OVER, 0.03, 0.004), tuple(p), wm, rot=(ang, 0, 0), bevel=0, ol=0)
        P.no_shadow(cw)
    P.gate_keys(wm, [(T(F0), 0.2), (T(285), 0.6), (T(300), 1.0), (T(F1), 1.0)])
    # rivulets running down the deck into each crack
    rm = P.flow_mat('r1_rivulet', F0, F1, speed=2.4, axis='Z', sign=1, alpha=0.7, stretch=(60, 60, 4.0), strength=0.12, color=(0.45, 0.6, 0.75), streak=True)
    r = random.Random(8)
    down, across, nrm = P.slope_basis(s)
    verts, faces = [], []
    for i, u in enumerate(gaps):
        for k in range(7):
            x = r.uniform(-4.6, 4.6); u0 = max(0.0, u - r.uniform(0.05, 0.1)); w = r.uniform(0.008, 0.016)
            a = P.slope_point(s, u0, x, 0.004); b = P.slope_point(s, u, x + r.uniform(-0.03, 0.03), 0.004)
            j = len(verts)
            verts += [a - across * w, a + across * w, b + across * w * 1.6, b - across * w * 1.6]
            faces.append((j, j + 1, j + 2, j + 3))
    riv = P.mesh('rivulets', verts, faces, rm); P.no_shadow(riv)
    P.gate_keys(rm, [(T(F0), 0.3), (T(280), 1.0), (T(F1), 1.0)])
    # drops falling from the cracks underneath (under the overhang the camera ends in)
    dm = P.drop_mat()
    srcs = []
    for u in gaps:
        if u < 0.8: continue
        for k in range(9):
            p = P.slope_point(s, u, r.uniform(-4.4, 4.4), lift=-0.1)
            srcs.append(tuple(p))
    drops, hits = P.drips('drip', srcs, 0.02, F0, F1, dm, every=(7, 15))
    P.splash_at('dsp', hits, F0, F1, P.rain_mat('r1_splash2', strength=1.0, alpha=0.45), size=0.9)
    P.rain('rain', (0, 0, 0), (24, 24), F0, F1, n=5000, speed=11, top=14, hole=(-5.5, 5.5, -7.5, 0.5))
    sp = lambda u, x, l: tuple(P.slope_point(s, u, x, l))
    P.fly([(T(269), sp(0.3, -2.0, 1.7), sp(0.6, -1.3, 0.0), 26),
           (T(300), sp(0.5, -1.6, 1.5), sp(0.8, -1.0, 0.0), 26),
           (T(336), sp(0.72, -1.2, 1.35), sp(1.02, -0.8, -0.3), 26)], F0, F1, smooth=6, delay=1, n=8)
    return F0, F1
