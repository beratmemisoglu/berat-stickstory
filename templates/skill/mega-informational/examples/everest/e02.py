# E02 "Carve a / massive trench" 8-52: low on the snow beside giant yellow excavators digging a deep trench
# (trench on the left, machines on its right rim); buckets swing past the lens; ends whipping into the ring top-down.
F0, F1 = 8, 52


def build(ctx):
    import bpy, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_elev=24, sun_rot=250, light_sat=1.15, exposure=-0.45, light_k=1.0)
    P.cool_fill()
    mt = C.mats(); pm = P.mats()
    P.trench_ground('ground', P.terrain_mats()['trench'], size=(360, 360), res=(360, 360), width=11, depth=22, angle=0, hills=3, bank=7)
    P.far_range('far', mt['snow'], inner=170, height=110, scale=90)
    for i, (y, sw) in enumerate([(-10, 0.1), (6, 0.35), (21, 0.6), (36, 0.15), (51, 0.8), (66, 0.4)]):
        e = P.excavator(f'ex{i}', loc=(8.8, y, 0.0), rotz=90 + (i % 2) * 8)
        P.dig(e, F0, F1, period=1.7 + 0.12 * i, phase=sw, swing=-28)
    t = lambda fr: (fr - 1) / 30
    # v2 from the reference curve: the pull-back carried in from E01 decelerates (8-12), a steady yaw right with a
    # bank (13-28), a slow pull-back (29-46), a whip out at 52.
    M.Flight([(t(8.0), (9.0, -13.5, 1.9), (8, -8, 8.5), 20),
              (t(12.4), (12, -24, 3.0), (8, -10, 9), 20),
              (t(28.5), (12.4, -24.2, 3.1), (11.6, -9.7, 8.6), 20, -10),
              (t(46.5), (12.5, -26.4, 3.0), (11.6, -9.7, 8.6), 20, -10, True),
              (t(51.2), (12.5, -26.5, 3.0), (11.7, -9.7, 8.6), 20, -10, True),
              (t(53.5), (12.5, -26.5, 3.0), (-20, -14, 4), 20, -10)], smooth=0.8).bake(F0, F1)
    return F0, F1
