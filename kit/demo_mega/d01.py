# The 3D Informational demo, shot 1 (0-2.5 s): a pitted rock column on snowy ground, the camera pushing in and rising
# (the smoke scenario's sample: quick to build, the real look).
F0, F1 = 1, 75


def build(ctx):
    import cz, mega as M
    M.setup(F1, sun_elev=26, sun_rot=300)
    rock = M.rock('d_rock', scale=0.5, bump=1.4, img=M.TEX + '/basalt.png')
    snow = M.snow_rock('d_snow', thresh=0.78, scale=0.25, img_rock=M.TEX + '/mountain_rock.png', img_snow=M.TEX + '/snow.png')
    M.column('slab', 10, 16, mat=rock, rough=0.05, seed=3, taper=-0.1)
    M.heightfield('ground', 300, 140, M.range_fn(height=18, scale=30, seed=5), mat=snow, loc=(0, 0, -1))
    t = lambda f: (f - 1) / 30
    M.Flight([(t(1), (0, -46, 12), (0, 0, 10), 24), (t(75), (-8, -34, 22), (0, 0, 12), 24)]).bake(F0, F1)
    return F0, F1
