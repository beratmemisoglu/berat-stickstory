# R18 "So you tie the bottom of every pair of rafters together into a triangle" 1173-1286 (attic cutaway, ties snap in)
F0, F1 = 1173, 1286


def build(ctx):
    import os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import bpy, cz, mega as M, props_r2 as R
    R.world(F1, 'winter')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.55, ties=True)
    R.land(mt, winter=True)
    k = lambda tt, a, b: cz.clamp(((tt * 30 + 1) - a) / (b - a))
    # cutaway: the front slope's deck, shingles and snow are lifted off so the rafters read
    R.hide([o for o in P['deck'] if o.name.startswith('decka')] + [o for o in P['shingle_rows'] if o.name.startswith('shrowa')] + [o for o in P['extra'] if o.name == 'underlaya'] + [P['snow'][0], P['gables'][0]])
    # rafters flash on "rafters" (1226)
    raf = M.xray('r2_x_raf', color='#9dffb0', alpha=0.4, strength=1.0)
    R.xcopy(P['rafters'], raf, 1.02); R.xfade(raf, 1226, hold=10, off=8, peak=0.7)
    # ties drop in and snap at the rafter feet one by one: "tie" (1184) .. "together" (1238)
    for i, tie in enumerate(P['myties']):
        fa = 1186 + i * 6
        x0 = tie.location.x
        M.bake_path(tie, F0, F1, pos=lambda tt, fa=fa, x0=x0: (x0, 0, R.WALL + 0.17 + 1.6 * (1 - cz.in_cubic(k(tt, fa, fa + 7))) - 0.03 * math.sin(math.pi * k(tt, fa + 7, fa + 11))))
        R.show_from([tie], fa - 1, F0, F1)
    # each rafter pair + its tie lights up as one green triangle: "into a triangle" (1256-1266), sweeping along
    for i in range(9):
        xm = M.xray(f'r2_x_tri{i}')
        tri = [o for o in P['rafters'] if o.name.startswith(f'rafter{i}')] + [P['myties'][i]]
        R.xcopy(tri, xm, 1.06)
        R.xfade(xm, 1258 + i * 2, hold=None)
    R.flight([(1173, (-9.0, -7.0, 6.2), (0.0, 0.0, 3.4), 24),
              (1230, (-7.5, -8.0, 6.0), (0.0, 0.0, 3.4), 24),
              (1286, (-6.0, -9.0, 5.6), (0.0, 0.0, 3.4), 24)], F0, F1)
    return F0, F1
