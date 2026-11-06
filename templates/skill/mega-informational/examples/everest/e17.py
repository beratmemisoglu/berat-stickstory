# E17 "With cooling systems and powerful electromagnets" 721-830: down into the platform: the hall of copper-coil
# electromagnets, red/blue pipes, cooling fans, grid ceiling of lights; green x-ray coolant pipes.
F0, F1 = 721, 830


def build(ctx):
    import os, sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import mega as M, props_b as P
    t = lambda f: (f - 1) / 30
    mt, mags = P.scene_hall(F1, F0=F0, xray_keys=[(t(721), 0.9), (t(760), 0.9), (t(772), 0.0), (t(795), 0.0), (t(803), 1.0)])
    th = P.thermo('therm_hot', mt, (-32, -17, 8.0), hot=True, size=0.8, rot=(-45, 0, -75))
    tc = P.thermo('therm_cold', mt, (-30, -17.5, 6.2), hot=False, size=0.8, rot=(-40, 0, -100))
    M.visible(th, [(0, t(745))], F0, F1); M.visible(tc, [(t(745), t(768))], F0, F1)
    # aisle y = -18 (rows at -27 and -9); magnets row at y = -9 seen across the aisle
    cam = M.Flight([(t(721), (-44, -18, 13), (-32, -18, 0), 18), (t(755), (-42.8, -18, 12.0), (-31, -18, 0.3), 18),
              (t(758.9), (-42.7, -18, 11.9), (-31, -11, 1.0), 18),
              (t(759), (-36, -18.5, 4), (-16, -15, 4.5), 18), (t(765), (-36, -18.5, 4), (-16, -9, 5), 18, 0),
              (t(810), (-28, -18.5, 4), (-8, -9.5, 6.5), 18, -12), (t(825), (-28.5, -18.5, 4), (-8.5, -7.5, 6.8), 18, -13),
              (t(830), (-28.5, -18.5, 4), (-8.5, -7.3, 6.8), 18, -13)], cuts=[t(759)]).bake(F0, F1)
    return F0, F1
