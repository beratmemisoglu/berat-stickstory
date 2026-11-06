# S02 (2.5-5.0 s): at the desk, Max sits on his chair (sitting is checked every frame), looks at the screen, is
# surprised, then laughs.
import os, sys

F0, F1 = 76, 150


def build(ctx):
    cz, cam = ctx.cz, ctx.cam
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import common, cast
    cz.setup(F1, world='#2a2622', world_strength=0.6)
    common.office()
    m = cast.max_()
    m.place(-1, 0.42, 0.45, 0)          # root a little behind the seat centre (sitting finds the cushion every frame)
    m.sit(-1, dur=0.01)
    m.face(-1, 'neutral'); m.look(-1, 0.0, 0.3)
    m.face(3.1, 'surprised'); m.look(3.1, 0.0, -0.1)
    m.face(3.9, 'laugh')
    m.bake(F0, F1)
    c = cam.Cam(lens=35, fstop=3.5)
    c.frame(2.5, (0.9, -1.6, 1.25), (0.45, 0.45, 1.05), lens=35, focus=(0.42, 0.42, 1.1), fly=0, creep=0.0019)
    c.bake(F0, F1)
    return F0, F1
