# E03 "around" 53-58: whip blur - the camera swings up from the trench rim to straight above the ring.
F0, F1 = 53, 58


def build(ctx):
    import bpy, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_elev=30, sun_rot=250, light_sat=1.15, exposure=-0.45, light_k=1.0)
    P.cool_fill()
    P.ring_scene(F0, F1)
    t = lambda fr: (fr - 1) / 30
    P.ring_flight(F0, F1)
    return F0, F1
