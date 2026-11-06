# E08 "thermal drills / to separate" 229-285: side-on, a drill rig (right) fires a red-white plasma beam into the
# dark rock (left); the camera slides along the beam, then swings round behind the rigs to face the slab base with
# every rig firing and sparks spraying (into E09).
F0, F1 = 229, 285


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
    hero = 21          # the rig at angle 270 (y = -rr), firing +Y
    for i, b in enumerate(S['beams']):
        on = t(231) if i == hero else t(244) + 0.04 * ((i - hero) % n)
        M.bake_path(b, F0, F1, scale=lambda tt, on=on: (min(1, max(0.001, (tt - on) / 0.12)), 1, 1))
    for i, s in enumerate(S['sprays']):
        on = t(234) if i == hero else t(248) + 0.04 * ((i - hero) % n)
        M.visible(s, [(on, 99)], F0, F1)
    yb = -(R + 8)                     # along the hero beam
    # v2 from the reference curve: near-still close-up on the beam hitting the rock, a fast pull-back (248-250),
    # a push-in with a pan along the beam (254-263), a second push (269-270), a pan back (275-279), then a fast
    # pull-back out to the slab-base wide (281-285) that E09 starts from.
    H = lambda *k: k + (True,)
    # round 3, matched BY EYE on 1-frame strips (the tracker fails on the dark rock): close-up on the beam hitting
    # the rock (229-246), pull back + right to the rig and the open sky (247-254), a fast lateral move past the rig
    # (255-269), then outside the ring low on the ground: the slab wall above, the row of rigs firing (270-285).
    M.Flight([(t(228), (-3.5, -43, 3.2), (3.4, -38.5, 2.8), 20),
              (t(246), (-3.7, -43.6, 3.25), (3.2, -38.8, 2.8), 20),
              (t(254), (-9, -52, 4.6), (4, -40, 4.2), 20),
              (t(262), (6, -64, 9.0), (-6, -40, 5.0), 20),
              (t(270), (9.2, -81.5, 4.2), (-6, -40, 6.0), 20),
              (t(286), (9.4, -80.5, 4.3), (-6, -40, 6.6), 20)], smooth=1.5).bake(F0, F1)
    return F0, F1
