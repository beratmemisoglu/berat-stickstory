# R24 "And those pretty icicles are not a sign of winter" 1753-1810 (close: icicles along the eave sparkling)
F0, F1 = 1753, 1810


def build(ctx):
    import os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, props_r2 as R
    R.world(F1, 'winter')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.4)
    R.land(mt, winter=True)
    ic = R.icicles('icic', mt['ice'], -R.W / 2 - R.OVER, R.W / 2 + R.OVER, -(R.EY + 0.12), P['gutter_z'] - 0.08, n=90, lmax=0.9, seed=11)
    # sparkles: tiny star glints that blink on the icicles
    glint = M.emit('r2_glint', '#ffffff', 40.0)
    rr = random.Random(3)
    for i in range(26):
        x = rr.uniform(-1.5, 4.4); z = P['gutter_z'] - rr.uniform(0.15, 0.7)
        g = R.mesh(f'gl{i}', [(-0.06, 0, 0), (0.06, 0, 0), (0, 0, 0.003), (0, 0, -0.06), (0, 0, 0.06), (0.003, 0, 0)], [(0, 2, 1), (3, 5, 4)], glint)
        g.location = (x, -(R.EY + 0.2), z)
        fa = rr.uniform(1753, 1805); ln = rr.uniform(4, 8)
        M.bake_path(g, F0, F1, scale=lambda tt, fa=fa, ln=ln: max(0.001, math.sin(math.pi * cz.clamp(((tt * 30 + 1) - fa) / ln)) * 1.6),
                    rot=lambda tt, fa=fa: (0, ((tt * 30 + 1) - fa) * 6, 0))
    R.flight([(1753, (5.6, -6.0, 1.4), (1.0, -3.6, 2.2), 30),
              (1810, (3.2, -6.3, 1.5), (-0.5, -3.6, 2.25), 30)], F0, F1)
    return F0, F1
