# E09 "a slab of crust" 286-310: facing the slab, the ring of drill rigs fires into its base, sparks spraying, the
# cut line glowing round it; the camera pulls back and rises, then whips up the slab side (into E10).
F0, F1 = 286, 310


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_rot=320, sun_elev=24, sun_power=4.5, light_k=0.6, exposure=-0.3)
    mt = C.mats()
    R, n = 40.0, 28
    rr = R + 30
    S = P.slab_base(R=R, Hs=52, n=n, rig_scale=1.6, mt=mt, ring_r=rr, f0=F0, f1=F1)
    P.far_range('far', P.terrain_mats()['peak'], size=2400, inner=420, height=160, scale=140, z=0)
    t = lambda fr: (fr - 1) / 30
    # v2: the reference holds almost still here (slow pull-back, a slight drift left) and whips UP at 310.
    M.Flight([(t(284.5), (-4, -(rr + 34), 18), (-4, 0, 13), 20),
              (t(286.4), (0, -(rr + 34), 18), (0, 0, 13), 20, 0, True),
              (t(309.9), (-0.4, -(rr + 35.2), 18.3), (-0.5, 0, 13.2), 20, 0, True),
              (t(311.0), (-0.4, -(rr + 35.2), 18.3), (-0.5, 0, 40), 20)], smooth=0.5).bake(F0, F1)
    return F0, F1
