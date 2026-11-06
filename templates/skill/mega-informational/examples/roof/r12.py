# R12 "This is underlayment" 669-705: the unrolled sheet flashes green x-ray on "underlayment" (f690); the floating
# shingle rows drop back on, bottom row first.
F0, F1 = 669, 705


def build(ctx):
    import bpy, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=33, sun_rot=230, storm=[(T(660), 0.25), (T(710), 0.25)])
    mt = P.mats()
    P.ground(mt)
    hs = H.build('shingles', mt)
    P.dress(hs, mt, 'shingles', sunny=False)
    P.lift_rows(hs['shingle_rows'][:16], F0, F1, t_up=(T(600), T(601)), t_down=(T(691), T(699)), h=16, spread=0.2, stagger=0.012, slide=0.0)
    m = P.membrane_roll('memb', -1, F0, F1, T(600), T(601), mt['membrane'])
    xm = M.xray('r1_xr_underlay')
    P.xray_over([m['sheet']], xm, grow=1.0)
    m['sheet'].children[0].location = (0, 0, 0.01)
    tw = T(690)
    M.xray_fade(xm, [(T(F0), 0), (tw - 0.12, 0), (tw + 0.03, 1.0), (tw + 0.5, 0.9), (T(F1), 0.6)])
    P.fly([(T(669), (-3.5, -9.4, 7.6), (0.6, -1.8, 3.1), 25),
           (T(705), (0.5, -10.5, 6.2), (1.0, -1.6, 3.0), 25)], F0, F1)
    return F0, F1
