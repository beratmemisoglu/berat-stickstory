# E06 "cutting miles down / into the earth / beneath it" 101-188: from above, the trench slot cut into the cliff
# fills with GREEN x-ray, the camera drops to the dark pit floor in front of the cliff; the green column grows down
# the slot with a measuring line counting 3,248 ft -> 42,581 ft; green rock chunks tumble out; excavators on top.
F0, F1 = 101, 188


def build(ctx):
    import bpy, os, sys, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_elev=28, sun_rot=255, sun_power=4.2, exposure=-0.35, light_k=0.9)
    mt = C.mats(); pm = P.mats()
    w, Hc = 14.0, 46.0
    P.cliff_slot(w, Hc, mt=mt, wb=3.0); P.cliff_dress(w, Hc)
    t = lambda fr: (fr - 1) / 30
    dep = lambda tt: 4 + (Hc - 4) * min(1, max(0, (tt - t(104)) / (t(176) - t(104)))) ** 0.9
    gv = cz.box('green', (w - 0.6, 36, 1.0), (0, 22, Hc + 0.6), pm['gx'], bevel=0, ol=0, origin='top')
    for v in gv.data.vertices:
        if v.co.z < -0.5: v.co.x *= 3.0 / w
    M.bake_path(gv, F0, F1, scale=lambda tt: (1, 1, dep(tt)))
    M.xray_fade(pm['gx'], [(t(101), 0.2), (t(106), 1.0)])
    P.dimension('dim', (w / 2 - 1.6, 3.4, Hc + 0.6), lambda tt: dep(tt), F0, F1, [(t(106), 3248), (t(182), 42581)], size=1.0)
    for i, x in enumerate((-w / 2 - 6, w / 2 + 6)):
        e = P.excavator(f'ex{i}', loc=(x, 6 + 10 * i, Hc + 0.8), rotz=(-90 if i == 0 else 90), scale=1.2)
        P.dig(e, F0, F1, period=1.6 + 0.3 * i, phase=0.3 * i, swing=20 * (1 if i == 0 else -1))
    rnd = random.Random(4); ch = []
    for i in range(22):
        ch.append(P.chunk(f'gc{i}', rnd.uniform(0.4, 1.2), mat=pm['gx'], seed=i, loc=(rnd.uniform(-w / 2 + 1.5, w / 2 - 1.5), rnd.uniform(-3, 2), 0)))
    P.falling(ch, F0, F1, Hc - 4, -1, speed=(5, 9))
    # v2 camera from the reference curve: three takes joined by hard cuts (105, 160), each a slow push-in.
    c1, c2 = t(105), t(160)
    M.Flight([(t(100), (5, -20, Hc + 30), (0, 14, Hc - 6), 20),
              (t(103.9), (4.8, -20.3, Hc + 29.6), (0, 14, Hc - 6), 20, 0, True),
              (t(104.95), (4.7, -20.4, Hc + 29.5), (14, 14, Hc - 6), 20),
              (c1, (0, -26, 8), (-12, 4, 30), 20),
              (t(106.6), (0, -26, 8), (0, 4, 30), 20, 0, True),
              (t(159.0), (0, -23, 6.5), (0, 5, 29.5), 20, 0, True),
              (t(159.95), (0, -23, 6.5), (10, 5, 29.5), 20),
              (c2, (0, -60, 7), (-20, 0, 24), 20),
              (t(161.6), (0, -60, 7), (0, 0, 24), 20, 0, True),
              (t(189), (0, -58, 7.1), (0, 0, 24.2), 20)], cuts=[c1, c2], smooth=0.6).bake(F0, F1)
    return F0, F1
