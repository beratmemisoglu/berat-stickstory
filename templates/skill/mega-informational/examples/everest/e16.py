# E16 "and build a gigantic steel platform beneath it" 641-720: skim fast along the polished steel panels under the
# copper fin band, then front: green x-ray on the platform at "beneath it", pull back low over the tracks.
F0, F1 = 641, 720


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    mt, o = P.scene_lift(F1, F0=F0, legs=False, plat=True, rails_on=True, mach=False, zu=8.0, plat_h=5.0,
                         plat_xray=[(t(690), 0), (t(695), 1), (t(708), 1), (t(712), 0)])
    M.Flight([(t(641), (-5.3, -11.3, 5.5), (-9.4, -5.2, 6.5), 20), (t(645), (-5.3, -11.3, 5.5), (-9.3, -5.3, 6.5), 20),
              (t(651), (-5.4, -11.25, 5.5), (-7.7, -6.4, 6.5), 20), (t(688), (-5.6, -11.1, 5.5), (-7.6, -6.5, 6.5), 20, 0, True),
              (t(700), (-5.0, -24, 5.0), (-3.0, 0, 7.0), 20), (t(710), (-1.5, -52, 2.8), (0, 0, 9.5), 20), (t(720), (0, -58, 2.4), (0, 0, 9.5), 20)]).bake(F0, F1)
    return F0, F1
