# E07 "Then use giant thermal drills" 189-228: in front of the trench slot, copper thermal drill rigs come down it on
# cables, stacked one above the other, and land at the base; the camera pushes in and slides right, ending close on
# the cliff (into E08).
F0, F1 = 189, 228


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_elev=28, sun_rot=255, sun_power=4.2, exposure=-0.35, light_k=0.9)
    mt = C.mats(); pm = P.mats()
    w, Hc = 14.0, 46.0
    P.cliff_slot(w, Hc, mt=mt); P.cliff_dress(w, Hc)
    t = lambda fr: (fr - 1) / 30
    for i in range(6):
        z0 = 26 + i * 7.5
        land = 2.4 + i * 3.4
        rig = P.drill_rig(f'rig{i}', loc=(0, 3 + i * 1.5, z0), rot=(0, 0, 180), scale=1.2, cable=90)
        v = 6.0
        M.bake_path(rig, F0, F1, pos=lambda tt, z0=z0, land=land, v=v, i=i: (0.3 * math.sin(tt * 1.3 + i), 3 + i * 1.5,
                    max(land, z0 - v * (tt - t(189)) * (1 - 0.04 * i))))
    # v2 from the reference curve: settle out of the whip (189-190), hold while the rigs come down, a push-in with
    # a yaw left at 212-222, hold.
    M.Flight([(t(188), (0, -40, 10), (-3, 0, 26), 20),
              (t(190.2), (0, -40, 10), (0, 0, 26), 20, 0, True),
              (t(211.5), (0.2, -39.6, 10), (0, 0, 26), 20, 0, True),
              (t(222.5), (3, -16, 8), (-11, 6, 36), 20, 0, True),
              (t(229), (3.1, -15.8, 8), (-11.2, 6, 36), 20)], smooth=0.8).bake(F0, F1)
    return F0, F1
