# E04 "around Mount Everest" 59-72: top-down on the ring trench round the mountain, ~10 excavators on the rim,
# the camera rotates and descends, then whips forward toward the horizon (into E05).
F0, F1 = 59, 72


def build(ctx):
    import bpy, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_elev=30, sun_rot=250, light_sat=1.15, exposure=-0.45, light_k=1.0)
    P.cool_fill()
    P.ring_scene(F0, F1)
    t = lambda fr: (fr - 1) / 30
    import math
    orb = lambda a, r, z: (r * math.sin(math.radians(a)), -r * math.cos(math.radians(a)), z)
    P.ring_flight(F0, F1)
    return F0, F1
