# E32 "to America" 1746-1780: a celebrating crowd on the snow in front of the mountain, confetti, the flag on top.
F0, F1 = 1746, 1780


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from mathutils import Vector
    import cz, mega as M, common as C, props_d as P
    M.setup(F1, sun_elev=30, sun_rot=125, sun_power=4.2, light_k=0.9)   # round 3 light: shadows fall toward the lens-left like the reference
    mt = C.mats()
    t = lambda f: (f - 1) / 30
    snow = M.pbr('d_gsnow', '#f2f5fa', rough=0.6, img=C.T('snow.png'), scale=0.08, bump=0.2)
    cz.plane('ground', 900, 900, loc=(0, 0, 0), mat=snow, rot=(0, 0, 0), ol=0)
    sl = C.slab('slab', mt, z0=0); sl.location = (0, 330, -125); sl.scale = (8, 8, 8)
    snw = M.snow_rock('d_capsnow32', thresh=0.75, scale=0.06, img_rock=C.T('mountain_rock.png'), img_snow=C.T('snow.png'), snow_noise=0.25)
    cd = bpy.data.objects['slab_cap'].data; cd.materials.clear(); cd.materials.append(snw)
    for i, (x, y, hh, rr) in enumerate([(-130, 330, 52, 80), (140, 340, 58, 90), (-250, 380, 46, 90), (260, 390, 44, 90), (0, 460, 40, 160)]):
        M.heightfield('pk%d' % i, rr * 2, 140, M.mountain_fn(peak_h=hh, radius=rr, seed=20 + i, ridge=0.7, sharp=1.5), mat=snw, loc=(x, y, -2))
    bpy.context.view_layer.update()
    cap = bpy.data.objects['slab_cap']; mw = cap.matrix_world
    top = max((mw @ v.co for v in cap.data.vertices), key=lambda p: p.z)
    P.flag('flag', (top.x, top.y, top.z - 0.5), size=14, f0=F0, f1=F1)
    P.cloud('cl0', 60, (40, 180, 70)); P.cloud('cl1', 50, (-60, 220, 60))
    P.crowd2(170, ((-13, 7.5), (13, 34)), F0, F1, seed=7, heading=(-100, 100), speed=1.3, cheer=0.4)   # ref: people cross the frame both ways
    P.crowd(n=520, area=((-22, 26), (22, 75)), seed=8, f0=F0, f1=F1, kinds=14, walk=(0, 1.2))
    P.confetti(1500, ((-8, 6, 0), (8, 30, 16)), F0, F1, size=0.18, fall=1.6)
    # Round 3 (refcurve_d.py 1746 1780): one continuous slow pull-back at head height (zoom -0.4..-0.7 %/f) with a
    # slight drift right at the start and the end; the crowd walks away from the lens toward the mountain.
    M.Flight([(t(1740), (-1.4, -0.2, 1.54), (0.7, 60, 3.17), 24, 2.0),   # lead-in / run-out keys: moving through F0 and F1
              (t(1746), (-1.2, 0.0, 1.55), (0.6, 60, 3.2), 24, 1.5),
              (t(1756), (-0.9, 0.4, 1.57), (0.4, 60, 3.25), 24, 0.5),
              (t(1768), (-0.7, 0.8, 1.6), (0.2, 60, 3.3), 24, 0),
              (t(1780), (-0.2, 1.1, 1.62), (1.8, 60, 3.35), 24, 1.2),
              (t(1786), (0.0, 1.25, 1.63), (2.6, 60, 3.37), 24, 1.8)]).bake(F0, F1)
    return F0, F1
