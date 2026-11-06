# R11 "So you roll out a waterproof sheet below" 611-668: exploded section: the front shingle rows float up off the
# deck, fanning apart, and a dark roll of membrane unrolls from the ridge down the board deck to the eave.
F0, F1 = 611, 668


def build(ctx):
    import bpy, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house as H, props_r1 as P
    T = P.T
    P.world(F1, sun_elev=33, sun_rot=230, storm=[(T(600), 0.35), (T(670), 0.25)])
    mt = P.mats()
    P.ground(mt)
    hs = H.build('shingles', mt)
    P.dress(hs, mt, 'shingles', sunny=False)
    rows = hs['shingle_rows'][:16]
    P.lift_rows(rows, F0, F1, t_up=(T(612), T(624)), h=16, spread=0.2, stagger=0.02, slide=0.0)
    for rw in rows: M.visible(rw, [(0, T(636))], F0, F1, children=False)
    P.membrane_roll('memb', -1, F0, F1, T(622), T(656), mt['membrane'])
    P.fly([(T(611), (-9.5, -11.5, 6.5), (0, -1.4, 3.6), 25),
           (T(640), (-7.5, -10.0, 7.5), (0, -1.6, 3.4), 25),
           (T(668), (-4.5, -9.5, 7.8), (0.4, -1.8, 3.2), 25)], F0, F1)
    return F0, F1
