# R10 "But a strong wind drives the rain up underneath them" 521-610: storm again; gusts bend the trees and blow leaves
# across, rain is driven sideways; at the gable-end section the shingle edges flutter up and a film of water creeps
# up the deck UNDER the shingles.
F0, F1 = 521, 610


def build(ctx):
    import bpy, os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=30, sun_rot=245, storm=[(T(515), 0.6), (T(545), 1.0)])
    mt = P.mats(wet=True)
    G = P.ground(mt)
    hs = H.build('shingles', mt)
    P.dress(hs, mt, 'shingles', sunny=False)
    gust = lambda t: P.ss((t - T(540)) / 0.5) * (0.85 + 0.15 * math.sin(t * 5))
    P.bend_trees(G['trees'], F0, F1, gust)
    P.leaves(160, (0, 0, 0), F0, F1, wind=(11, 1.5, 0.6), seed=4)
    # wind-driven rain: steep diagonal streaks blowing toward +y (up the front slope)
    P.rain('rain', (0, 0, 0), (30, 30), F0, F1, n=7000, speed=9, wind=(3.0, 8.0), top=14, length=0.7)
    # the front rows' lower edges flutter up in the gusts (rotate about each row's centre line)
    rows = hs['shingle_rows'][:16]
    cut = cz.box('cutter', (4.0, 6.0, 5.0), (H.W / 2 + 0.2 + 2.0 - 1.6, -2.5, 4.0), mt['stone'], bevel=0, ol=0); cut.hide_render = True; cut.display_type = 'WIRE'
    for rw in rows:
        bo = rw.modifiers.new('cut', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.object = cut; bo.solver = 'FLOAT'
    for i, rw in enumerate(rows):
        r0 = [math.degrees(a) for a in rw.rotation_euler]
        ph = i * 0.9
        M.bake_path(rw, F0, F1, rot=lambda t, r0=r0, ph=ph: (r0[0] - gust(t) * (4 + 3 * math.sin(t * 23 + ph) + 2 * math.sin(t * 37 + ph)), r0[1], r0[2]))
    # water creeping up the deck under the shingles (between deck and shingles), from the eave toward the ridge
    down, across, nrm = P.slope_basis(-1)
    wm = P.flow_mat('r1_under', F0, F1, speed=1.6, axis='Z', sign=-1, alpha=0.85, stretch=(10, 10, 4), strength=0.18, color=(0.2, 0.42, 0.7))
    e = P.slope_point(-1, 1.0, 0, 0.012)
    piv = cz.empty('upiv', tuple(e))
    from mathutils import Matrix
    piv.rotation_euler = Matrix((across, -down, nrm)).transposed().to_euler()
    film = P.mesh('underfilm', [(-H.W / 2 - H.OVER, 0, 0), (H.W / 2 + H.OVER, 0, 0), (H.W / 2 + H.OVER, 1, 0), (-H.W / 2 - H.OVER, 1, 0)], [(0, 1, 2, 3)], wm, parent=piv)
    P.no_shadow(film)
    M.bake_path(film, F0, F1, scale=lambda t: (1, max(0.002, 2.6 * P.ss((t - T(580)) / 0.9)), 1))
    P.fly([(T(521), (-15.0, -14.0, 5.0), (0, 0, 3.0), 24),
           (T(550), (-4.0, -19.0, 5.2), (0.5, -1.0, 3.0), 25),
           (T(570), (8.5, -14.5, 4.6), (3.0, -2.0, 3.0), 26),
           (T(588), (7.4, -7.0, 3.3), (4.4, -2.6, 2.9), 27),
           (T(610), (6.4, -4.8, 3.0), (4.5, -2.2, 3.0), 28)], F0, F1, smooth=4)
    return F0, F1
