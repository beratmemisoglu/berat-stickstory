# E11 "Wrap the mountain" 376-400: low over the Everest cap toward the peak, red tower crane right, the net above.
F0, F1 = 376, 400


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    P.scene_wrap(F1, net_drop=[(0, 14.0), (392 / 30, 14.0), (420 / 30, 0.0)], side=False)
    t = lambda f: (f - 1) / 30
    M.Flight([(t(376), (2.0, -18.1, 21.5), (0.1, 2, 21.0), 27), (t(389), (2.0, -18.1, 21.5), (-0.1, 2, 21.0), 27),
              (t(395), (2.0, -20, 21.8), (0, 2, 21.0), 27), (t(400), (3, -27, 23), (0.5, 1, 20.5), 27)]).bake(F0, F1)
    return F0, F1
