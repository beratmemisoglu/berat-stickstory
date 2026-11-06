# R27 "Congratulations, you have built a roof" 1926-2003 (golden-hour pull-out to the finished cottage, birds)
F0, F1 = 1926, 2003


def build(ctx):
    import os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    import r26
    R.world(F1, 'golden')
    sky = R.bpy.context.scene.world.node_tree.nodes.get('Sky Texture')
    mt = R.mats()
    P = R.cottage(mt)
    R.land(mt, n=40, avoid=[(5, 6.5, 4), (9, -1, 4), (12, -8, 4), (16, -15, 4), (20, -22, 4), (12.5, -14.5, 5)])
    r26.flashing(R, cz, mt)
    smoke = R.wisp_mat('r2_smoke', '#f0dcc8', strength=1.6, alpha=0.8, nscale=1.6)
    R.wisps('smoke', smoke, lambda i, r: (R.W / 2 - 1.2 + r.uniform(-0.15, 0.15), 1.1, R.WALL + R.RISE + 1.6), F0, F1, n=18, w=(0.7, 1.3), h=(1.6, 2.8), rise=(0.6, 1.0), face=(90, 0, 35), life=60)
    bm = M.pbr('r2_bird', '#1a1a1e', rough=0.6)
    for i in range(7):
        y0 = 2 + i * 0.7; z0 = 7.5 + (i % 3) * 0.5; x0 = 12 - i * 1.1
        R.bird(f'bird{i}', bm, F0, F1, lambda tt, x0=x0, y0=y0, z0=z0: (x0 - 4.0 * (tt - R.t(F0)), y0 + 0.8 * (tt - R.t(F0)) + 0.4 * math.sin(tt + x0), z0 + 0.3 * math.sin(tt * 2 + y0)), flap=3.0 + 0.3 * i, seed=i, size=1.5)
    R.flight([(1926, (5.2, -2.8, 6.4), (2.8, 1.1, 4.7), 24),
              (1950, (7.6, -7.0, 6.6), (1.8, 0.6, 4.1), 25),
              (1978, (11.0, -13.5, 7.0), (0.6, 0.0, 3.2), 27),
              (2003, (13.2, -17.5, 7.4), (0.0, 0.0, 2.7), 28)], F0, F1, whip_out=False, calm=1.0)
    R.warm_clouds()
    return F0, F1
