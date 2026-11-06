# R04 "and drips through every gap" 156-195: inside the house looking up: drops form in the gaps between the boards,
# fall and splash on the floor; thin grey daylight lines in every gap.
F0, F1 = 156, 195


def build(ctx):
    import bpy, os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=30, sun_rot=245, storm=[(T(150), 1.0), (T(200), 1.0)], exposure=0.1)
    mt = P.mats(wet=True)
    P.ground(mt, trees=False)
    hs = H.build('flat', mt)
    P.dress(hs, mt, 'flat', sunny=False)
    n = len(hs['boards']); bw = (H.D + 2 * H.OVER) / n
    zb = H.WALL                                    # board underside
    # daylight in every gap: thin bright strips just above the gaps (seen from below)
    sky = M.emit('r1_gaplight', '#c9d4e0', 2.2)
    gaps_y = [-H.D / 2 - H.OVER + bw * (i + 1) for i in range(n - 1)]
    for i, y in enumerate(gaps_y):
        if abs(y) > H.D / 2 - H.T: continue
        cz.box(f'gap{i}', (H.W + 0.6, 0.024, 0.004), (0, y, zb + 0.035), sky, bevel=0, ol=0)
    # interior fill: a dim cool bounce so the room reads (storm light through windows)
    cz.light('fill', 'AREA', loc=(0, 0, 1.6), rot=(0, 0, 0), color='#9fb0c8', power=110, size=5.0)
    cz.light('win', 'AREA', loc=(0, -2.6, 1.6), rot=(-90, 0, 0), color='#b8c6d8', power=60, size=2.0)
    water = P.drop_mat()
    r = random.Random(3)
    srcs = []
    for y in gaps_y:
        if abs(y) > H.D / 2 - H.T - 0.1: continue
        for k in range(3):
            srcs.append((r.uniform(-3.4, 3.4), y, zb - 0.01))
    drops, hits = P.drips('drip', srcs, 0.1, F0, F1, water, every=(16, 30))
    wet = P.rain_mat('r1_splash2', strength=1.0, alpha=0.5)
    P.splash_at('dsp', hits, F0, F1, wet, size=0.9)
    # wet spots growing on the floor under the gaps
    spots = []
    for i, (x, y, z) in enumerate(srcs[::2]):
        a = T(156) + r.uniform(-0.5, 0.3); spots.append((x, y, r.uniform(0.12, 0.3), a, a + 1.2))
    P.puddles('fpud', spots, F0, F1, 0.102, mat=P.puddle_mat('r1_floorpud', color='#20160f', sheen='#7a8694', sheen_k=0.18, alpha=0.7))
    # outside: rain keeps falling (seen through the window)
    P.rain('rain', (0, 0, 0), (24, 24), F0, F1, n=4000, speed=11, top=12, hole=(-4.6, 4.6, -3.6, 3.6))
    # camera: low in the room, looking up at the board ceiling, slow drift + tilt
    P.fly([(T(156), (1.6, -1.9, 0.55), (-0.2, 0.6, 2.85), 16),
           (T(178), (1.0, -1.6, 0.6), (-0.4, 0.9, 2.0), 16),
           (T(195), (0.6, -1.6, 0.65), (-0.6, 0.8, 1.3), 18)], F0, F1, smooth=6, delay=1, n=8)
    return F0, F1
