# Director's check of house.py stages: one frame per stage side by side (--frames 1..5 = walls..full).
F0, F1 = 1, 5


def build(ctx):
    import bpy, os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, house
    M.setup(F1, sun_elev=35, sun_rot=210, mb=0)
    mt = house.mats()
    M.heightfield('pad', 400, 4, lambda X, Y: X * 0, mat=mt['grass'])
    stages = ['walls', 'flat', 'gable', 'shingles', 'full']
    roots = []
    for i, s in enumerate(stages):
        P = house.build(s, mt, loc=(i * 30, 0, 0))
        roots.append(P['root'])
    for i, r in enumerate(roots):
        for f in range(1, 6):
            pass
    cam = M.Flight([((f - 1) / 30, (i * 30 + 9, -13, 7), (i * 30, 0, 2.6), 28) for i, f in enumerate(range(1, 6))], ease='linear')
    cam.bake(F0, F1)
    return F0, F1
