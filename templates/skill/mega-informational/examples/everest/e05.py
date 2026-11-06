# E05 "Mount Everest" 73-100: low fast flight over snow ridges toward the Everest peak, an excavator arm and
# flung rock chunks cross the sky; ends whipping down into the dark trench (into E06).
F0, F1 = 73, 100


def build(ctx):
    import bpy, os, sys, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_elev=17, sun_rot=300, light_sat=1.15, exposure=-0.45, light_k=1.0)
    P.cool_fill()
    tm = P.terrain_mats(); pm = P.mats()
    pk = M.mountain_fn(peak_h=120, radius=95, seed=3, ridge=0.75, sharp=1.25)
    rg = M.range_fn(height=14, scale=30, seed=11)
    import numpy as np
    M.heightfield('ridges', 600, 420, lambda X, Y: pk(X - 0, Y - 110) + rg(X, Y) - 6 + 1.5 * M.fbm(X / 5, Y / 5, 21, 5, ridged=True), mat=P.snowy_mat())
    P.far_range('far', tm['peak'], inner=260, height=110, scale=100)
    # trench slot ahead (dark) the whip dives into
    cz.box('slot', (80, 10, 40), (0, 34, -16), pm['catdark'], bevel=0, ol=0)
    # an excavator arm crossing the top of frame + flung chunks
    e = P.excavator('exa', loc=(-12, 4, 14), rotz=-60, scale=1.0)
    P.dig(e, F0, F1, period=1.2, phase=0.2, swing=40)
    rnd = random.Random(5)
    ch = []
    for i in range(14):
        c = P.chunk(f'ch{i}', rnd.uniform(0.3, 1.0), seed=i, loc=(rnd.uniform(-30, 30), rnd.uniform(0, 60), 0))
        v = (rnd.uniform(-6, 6), rnd.uniform(-4, 4), rnd.uniform(14, 22)); p0 = tuple(c.location); off = rnd.uniform(0, 1.5)
        M.bake_path(c, F0, F1, pos=lambda t, p0=p0, v=v, off=off: (p0[0] + v[0] * (t - 2.4 + off), p0[1] + v[1] * (t - 2.4 + off),
                                                                    20 + v[2] * (t - 2.4 + off) - 4.9 * (t - 2.4 + off) ** 2),
                    rot=lambda t, i=i: (t * 300 + i * 20, t * 170, 0))
    t = lambda fr: (fr - 1) / 30
    # v2 from the reference curve: a hard decelerating push-in (73-76), a slow push (77-95), a whip right at 97-98.
    A, T0 = (-4, -20, 82), (0, 110, 62)
    far = lambda k: tuple(T0[i] + (A[i] - T0[i]) * k for i in range(3))
    M.Flight([(t(71.5), far(2.3), T0, 28),
              (t(73.5), far(1.35), T0, 28),
              (t(76.2), far(1.0), T0, 28),
              (t(96.4), far(0.89), T0, 28, 0, True),
              (t(98.7), far(0.89), (70, 100, 30), 28, 0, True),
              (t(101), far(0.89), (61, 100, 40), 28)], smooth=0.6).bake(F0, F1)
    return F0, F1
