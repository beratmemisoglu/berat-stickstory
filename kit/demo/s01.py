# S01 (0.0-2.5 s): Max walks in from the left to his desk, turns to us and waves with a big smile.
import os, sys

F0, F1 = 1, 80


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import common, cast
    cz.setup(F1, world='#2a2622', world_strength=0.6)
    common.office()
    m = cast.max_()
    m.place(-1, -2.4, 0.1, 90); m.face(-1, 'neutral')
    m.walk(0.05, 1.3, [(-2.4, 0.1), (-0.2, 0.1)])
    m.turn(1.35, 0, 0.25); m.face(1.4, 'smile')
    m.pose(1.6, 'point', dur=0.2); m.face(1.75, 'grin'); m.pose(2.3, 'rest', dur=0.25)
    m.bake(F0, F1)
    c = cam.Cam(lens=28, fstop=4.5)
    c.frame(0.0, (-0.9, -3.6, 1.15), (-0.9, 0.4, 0.95), lens=26, focus=(-1.0, 0.1, 1.0), fly=0, creep=0.0019)
    c.frame(1.5, (-0.3, -3.0, 1.1), (-0.2, 0.4, 1.0), lens=30, focus=(-0.2, 0.1, 1.0), fly=14, creep=0.0019)
    c.bake(F0, F1)
    return F0, F1
