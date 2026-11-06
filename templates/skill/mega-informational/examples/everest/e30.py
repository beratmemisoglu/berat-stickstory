# E30 "near Alaska" 1666-1690: map-like aerial, big 3D ALASKA letters on the terrain, the slab below like a moon.
F0, F1 = 1666, 1690


def build(ctx):
    import bpy, os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_d as P
    M.setup(F1, sun_elev=40, sun_rot=150, sun_power=3.4)
    mt = C.mats(); md = P.mats_d()
    t = lambda f: (f - 1) / 30
    P.map_terrain('map', size=400, res=400, sea_rows=0.33, green=0.7)
    sea = cz.plane('sea', 900, 900, loc=(0, 0, -0.6), mat=M.water('d_sea30', '#051a2a', rough=0.1), rot=(0, 0, 0), ol=0)
    sl = C.slab('slab', mt, z0=-8); sl.location = (-14, -90, -8)
    let = M.pbr('d_letters', '#dcd8f6', rough=0.35)
    tx = M.text3d('alaska', 'ALASKA', 17, (-12, -40, 19), rot=(48, 0, 3), mat=let, extrude=3.5)
    rnd = random.Random(5)
    for i in range(34):   # cloud cards along the coast (y ~ -67) + a few inland
        cx = rnd.uniform(-110, 90); cy = -67 + 12 * math.sin(cx / 23.0) + rnd.uniform(-10, 8) if i < 28 else rnd.uniform(-50, 40)
        P.cloud('cc%d' % i, rnd.uniform(22, 40), (cx, cy, rnd.uniform(8, 15)), rot=(0, 0, rnd.uniform(0, 360)))
    for i in range(0):
        P.cloud('cl%d' % i, rnd.uniform(25, 50), (rnd.uniform(-90, 90), rnd.uniform(-130, 0), rnd.uniform(14, 26)), rot=(0, 0, rnd.uniform(0, 360)))
    # Round 3: the reference turns while it drifts: content moves left ~2 %/f with a -0.9 deg/f roll (1666-1683) and a
    # slow push (+0.4..1.4 %/f), settling 1687-1690.
    M.Flight([(t(1660), (-41, -161, 188), (-39, -62, 0), 28, 5),   # lead-in key: the move is already running at F0
              (t(1666), (-30, -160, 185), (-28, -62, 0), 28, 0),
              (t(1675), (-14, -158, 180), (-12, -62, 0), 28, -8),
              (t(1684), (2, -152, 170), (4, -60, 0), 28, -16),
              (t(1690), (4, -150, 168), (6, -60, 0), 28, -17),
              (t(1696), (6, -148, 166), (8, -60, 0), 28, -18)]).bake(F0, F1)
    return F0, F1
