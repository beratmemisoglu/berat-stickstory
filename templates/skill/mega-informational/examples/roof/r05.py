# R05 "So you tilt it and the water runs off" 196-268: the flat board roof pivots on its front edge into a slope
# (the side walls grow stone wedges under it), the puddles slide off, a sheet of water runs down and pours off the
# low edge.
F0, F1 = 196, 268


def build(ctx):
    import bpy, os, sys, math, random
    from mathutils import Matrix, Vector
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=30, sun_rot=245, storm=[(T(190), 0.85), (T(270), 0.7)])
    mt = P.mats(wet=True)
    P.ground(mt)
    hs = H.build('flat', mt)
    P.dress(hs, mt, 'flat', sunny=False)
    W, D, WALL, OVER = H.W, H.D, H.WALL, H.OVER
    ANG = 13.0
    ta, tb = T(206), T(230)                              # the tilt ("tilt" f212)
    tilt = lambda t: ANG * P.ss((t - ta) / (tb - ta))
    hinge = cz.empty('hinge', (0, -D / 2 - OVER, WALL + 0.03))
    bpy.context.view_layer.update()
    inv = hinge.matrix_world.inverted()
    for b in hs['boards']:
        mw = b.matrix_world.copy(); b.parent = hinge; b.matrix_parent_inverse = inv
    M.bake_path(hinge, F0, F1, rot=lambda t: (tilt(t), 0, 0))
    # stone wedges grow under the raised roof on both side walls + the back wall rises
    L = D + 2 * OVER
    for x, nm in ((-W / 2 + H.T / 2, 'wedgeL'), (W / 2 - H.T / 2, 'wedgeR')):
        rise = (D - 0.0) * math.tan(math.radians(ANG))
        verts = [(x - H.T / 2, -D / 2, 0), (x - H.T / 2, D / 2, 0), (x - H.T / 2, D / 2, 1),
                 (x + H.T / 2, -D / 2, 0), (x + H.T / 2, D / 2, 0), (x + H.T / 2, D / 2, 1)]
        faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
        wd = P.mesh(nm, verts, faces, mt['stone'], loc=(0, 0, WALL))
        ys = lambda t, rise=rise: max(0.001, math.tan(math.radians(tilt(t))) * (D / 2 + OVER + D / 2 - 0.0) - 0.0)
        M.bake_path(wd, F0, F1, scale=lambda t: (1, 1, max(0.001, math.tan(math.radians(tilt(t))) * (D + OVER) - 0.06)))
    back = cz.box('backrise', (W, H.T, 1.0), (0, D / 2 - H.T / 2, WALL), mt['stone'], bevel=0.02, ol=0, origin='bottom')
    M.bake_path(back, F0, F1, scale=lambda t: (1, 1, max(0.001, math.tan(math.radians(tilt(t))) * (D + OVER) - 0.06)))
    # the puddles from R03, on the boards, slide down to the low edge and thin out as it tilts
    r = random.Random(5)
    pm = P.puddle_mat()
    z_on = 0.066 - 0.03
    for i in range(18):
        x = r.uniform(-3.8, 3.8); y = r.uniform(-3.0, 3.0); rad = r.uniform(0.45, 1.0)
        v, fcs = P.blob(f'pd{i}', rad, seed=i + 3)
        ob = P.mesh(f'pd{i}', v, fcs, pm, parent=hinge)
        y_local = y + D / 2 + OVER
        def pos(t, x=x, yl=y_local):
            k = P.ss((t - ta - 0.15) / 0.9)
            return (x, yl * (1 - k), z_on + 0.001)
        def sc(t, i=i):
            k = P.ss((t - ta - 0.1) / 1.0)
            return (max(0.001, 1 - 0.55 * k), max(0.001, (1 - 0.8 * k) * 0.9 + 0.5 * k * (1 - k)), 1)
        M.bake_path(ob, F0, F1, pos=pos, scale=sc)
    # the running sheet of water on the boards (flows toward the low edge = local -y)
    fm = P.flow_mat('r1_sheet', F0, F1, speed=3.5, axis='Y', sign=1, alpha=0.5, stretch=(14, 2.2, 1.0), strength=0.08, streak=True)
    sheet = P.mesh('sheet', [(-W / 2 - OVER, 0.02, z_on + 0.004), (W / 2 + OVER, 0.02, z_on + 0.004), (W / 2 + OVER, L, z_on + 0.004), (-W / 2 - OVER, L, z_on + 0.004)], [(0, 1, 2, 3)], fm, parent=hinge)
    P.no_shadow(sheet)
    P.gate_keys(fm, [(T(F0), 0), (ta + 0.3, 0), (T(234), 1.0), (T(F1), 1.0)])
    # the curtain pouring off the low (front) edge
    cm = P.flow_mat('r1_curtain', F0, F1, speed=5.0, axis='Z', sign=1, alpha=0.85, stretch=(40, 40, 1.4), strength=0.3, streak=True)
    P.curtain('curtain', (-W / 2 - OVER, -D / 2 - OVER - 0.02, WALL + 0.05), (W / 2 + OVER, -D / 2 - OVER - 0.02, WALL + 0.05), (0, -0.9, 0), F0, F1, cm, drop=2.9, n=52, width=0.045)
    P.gate_keys(cm, [(T(F0), 0), (T(232), 0), (T(244), 1.0), (T(F1), 1.0)])
    P.splashes('gsp', lambda rr: (rr.uniform(-4.4, 4.4), -D / 2 - OVER - rr.uniform(0.3, 1.2), 0.02), F0, F1, n=70, life=5, size=1.0, f_on=238)
    P.rain('rain', (0, 0, 0), (26, 26), F0, F1, n=5000, speed=11, top=14, hole=(-4.5, 4.5, -3.5, 3.5))
    P.fly([(T(196), (-13.5, -6.5, 4.2), (0, -0.5, 2.8), 24),
           (T(228), (-12.0, -9.0, 3.6), (0, -1.0, 2.9), 25),
           (T(268), (-9.5, -11.8, 2.6), (0.5, -2.6, 2.2), 26)], F0, F1)
    return F0, F1
