# The 3D Informational demo, shot 2 (2.5-5 s): a steel platform glows green X-ray on "office" (the smoke's voice), the
# camera orbits.
F0, F1 = 76, 150


def build(ctx):
    import cz, mega as M
    M.setup(F1, sun_elev=30, sun_rot=210)
    steel = M.steel('d_steel', panels=0.9, panel_scale=3.0, img=M.TEX + '/steel_panels.png', scale=0.25)
    ground = M.pbr('d_ground', '#2a2c33', rough=0.9, img=M.TEX + '/dirt_dark.png', scale=0.2, bump=0.4)
    cz.cyl('platform', 10, 6, (0, 0, 0), steel, verts=96, ol=0)
    xr = M.xray('d_xray')
    cz.cyl('platform_xray', 10.3, 6.3, (0, 0, -0.15), xr, verts=96, ol=0)
    M.xray_fade(xr, [(2.5, 0.0), (3.6, 0.0), (3.9, 1.0), (4.8, 0.0)])
    M.heightfield('ground', 200, 4, lambda X, Y: X * 0, mat=ground, loc=(0, 0, -0.05))
    t = lambda f: (f - 1) / 30
    M.Flight([(t(76), (30, -30, 14), (0, 0, 3), 26), (t(113), (0, -40, 16), (0, 0, 3), 26), (t(150), (-30, -30, 18), (0, 0, 3), 26)]).bake(F0, F1)
    return F0, F1
