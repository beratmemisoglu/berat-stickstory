# E19 "could slightly lift the slab off the tracks" 861-915: cutaway close at the platform floor - horseshoe
# electromagnets with lightning arcs, green arrows up, the platform rises off the navy rail; whip down at the end.
F0, F1 = 861, 915


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    def lift(tt):
        k = max(0.0, min(1.0, (tt - t(876)) / (t(900) - t(876)))); k = k * k * (3 - 2 * k)
        return (0, 0, 0.3 * k)
    P.scene_lift_close(F1, F0=F0, grid_keys=[(t(861), 0.75), (t(872), 0.6), (t(886), 0.0)], lift=lift)
    M.Flight([(t(861), (0.15, -16.6, 1.3), (0.15, 0, -0.85), 30), (t(900), (0, -16.5, 1.3), (0, 0, -0.85), 30),
              (t(915), (-0.25, -16.3, 1.3), (-0.25, 0, -0.95), 30)]).bake(F0, F1)
    return F0, F1
