# R13 "But now all that water pours off the edge and digs a trench along your walls" 706-822: heavy rain; a curtain
# of water pours off the shingle eave ("pours" f755), splashes on the ground, and the ground along the front wall
# erodes into a muddy trench ("digs" f784, "trench" f793) with brown water running in it.
F0, F1 = 706, 822


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=30, sun_rot=245, storm=[(T(700), 0.9), (T(830), 1.0)])
    mt = P.mats(wet=True)
    x0, x1, ym, half = -H.W / 2 - 0.6, H.W / 2 + 0.6, -4.6, 0.75
    G = P.ground(mt, trench=(x0, x1, ym - half - 0.25, ym + half + 0.25))
    hs = H.build('shingles', mt)
    P.dress(hs, mt, 'shingles', sunny=False)
    ez = 2.6; ey = -3.66
    cm = P.flow_mat('r1_curtain13', F0, F1, speed=5.5, axis='Z', sign=1, alpha=0.85, stretch=(60, 60, 1.2), strength=0.25, streak=True)
    P.curtain('curtain', (-H.W / 2 - H.OVER, ey, ez), (H.W / 2 + H.OVER, ey, ez), (0, -1.3, 0), F0, F1, cm, drop=2.7, n=55, width=0.04)
    P.gate_keys(cm, [(T(F0), 0.45), (T(748), 0.6), (T(758), 1.0), (T(F1), 1.0)])
    P.splashes('gsp', lambda rr: (rr.uniform(-4.5, 4.5), ym + rr.uniform(-0.35, 0.35), 0.0), F0, F1, n=110, life=5, size=0.7, mat=P.rain_mat('r1_splash13', strength=0.6, alpha=0.3))
    tr = P.trench('trench', F0, F1, T(762), T(805), x0=x0, x1=x1, y_mid=ym, half=half, depth=0.95)
    P.rain('rain', (0, 0, 0), (28, 28), F0, F1, n=7000, speed=11, top=14, hole=(-4.6, 4.6, -3.6, 3.6))
    P.fly([(T(706), (-8.5, -10.5, 4.6), (0.0, -3.4, 2.6), 24),
           (T(750), (-6.8, -8.6, 2.6), (0.0, -3.7, 1.9), 24),
           (T(785), (-5.6, -6.1, 1.1), (-1.0, -4.6, -0.5), 24),
           (T(822), (-3.2, -5.9, 0.75), (1.5, -4.6, -0.55), 23)], F0, F1)
    return F0, F1
