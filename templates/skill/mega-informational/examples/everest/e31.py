# E31 "permanently bringing Mount Everest" 1691-1745: Everest on its slab off the Alaska coast, an eagle flies past the
# lens, then up to the summit with a US flag.
F0, F1 = 1691, 1745


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from mathutils import Vector
    import cz, mega as M, common as C, props_d as P
    M.setup(F1, sun_elev=20, sun_rot=105, sun_power=4.6, light_k=0.8)   # round 3 light: low hard sun from the right, less sky fill (crisp shadowed faces)
    mt = C.mats(); md = P.mats_d()
    t = lambda f: (f - 1) / 30
    sl = C.slab('slab', mt, z0=-9, rock='#2e2f33')
    bpy.data.objects['slab_cap'].scale = (1, 1, 1.25); M.displace(bpy.data.objects['slab_cap'], strength=0.5, scale=0.9)
    snw = M.snow_rock('d_capsnow', thresh=0.42, scale=0.3, img_rock=C.T('mountain_rock.png'), img_snow=C.T('snow.png'), snow_noise=0.25)
    cd = bpy.data.objects['slab_cap'].data; cd.materials.clear(); cd.materials.append(snw)
    bpy.context.view_layer.update()
    M.ocean('sea', size=500, res=9, wave=0.5, mat=M.water('d_sea31', '#062838', rough=0.2), f0=F0, f1=F1)
    land = P.coast('coast', size=520, res=320, seed=13, sea_y=26.0, h=6, img=True)
    land.location = (0, 0, 0)
    for i, (x, y, z, w) in enumerate([(-90, 260, 16, 80), (60, 300, 20, 90), (180, 280, 14, 70)]):
        P.cloud('cl%d' % i, w, (x, y, z))
    # summit = highest vertex of the cap
    cap = bpy.data.objects['slab_cap']
    mw = cap.matrix_world
    top = max((mw @ v.co for v in cap.data.vertices), key=lambda p: p.z)
    P.flag('flag', (top.x, top.y, top.z - 0.1), size=1.6, f0=F0, f1=F1)
    # eagle flies past the lens
    eg, rig = P.eagle2('eagle')
    eg.scale = (1.9,) * 3
    E0, T0 = Vector((7, -60, 31)), Vector((0, 0, 3)); fw = (T0 - E0).normalized(); rt = fw.cross(Vector((0, 0, 1))).normalized(); up = rt.cross(fw)
    CK = [(t(1689), -3.4, 4.2, 24), (t(1707), 0.1, 2.4, 10), (t(1718), 0.9, 0.9, 2.8)]
    def epos(tt):
        i = 0 if tt < CK[1][0] else 1
        k = cz.clamp((tt - CK[i][0]) / (CK[i + 1][0] - CK[i][0]))
        u, v, d = [cz.lerp(CK[i][j], CK[i + 1][j], k) for j in (1, 2, 3)]
        e, tg, _, _ = FL.at(tt); f = (tg - e).normalized(); r = f.cross(Vector((0, 0, 1))).normalized(); w = r.cross(f)
        return e + f * d + r * u + w * v

    # Round 3 (refcurve_d.py 1691 1745): a slow pull-back 1691-1720, a turn right 1721-1725 into the cut at 1726, a
    # push-in on the summit 1727-1731, calm drift back, then the whip out 1741-1745 (content right + up, roll +).
    T = Vector((top.x, top.y, top.z))
    FL = M.Flight([(t(1691), (7, -58, 30), (0, 0, 3), 28),
              (t(1713), (7.3, -60.5, 31), (0, 0, 3), 28),
              (t(1720), (7.5, -62, 31.5), (0.3, 0, 3), 28),
              (t(1725.9), (7.6, -62.5, 31.7), (3, 0, 3.6), 28, -4),
              (t(1726), T + Vector((4, -31, -6.5)), T + Vector((0, 0, -2)), 28),
              (t(1730), T + Vector((4, -27.0, -5.5)), T + Vector((0, 0, -2)), 28),
              (t(1738), T + Vector((4, -27.1, -5.3)), T + Vector((0, 0, -2)), 28),
              (t(1741), T + Vector((4, -27.3, -5.2)), T + Vector((-0.3, 0, -2)), 28),
              (t(1745), T + Vector((4, -27.6, -5.0)), T + Vector((-1.6, 0, -1.6)), 28, 2)], cuts=[t(1726)])
    FL.bake(F0, F1)
    M.bake_path(eg, F0, F1, pos=epos, rot=lambda tt: (-5, 8, -30))
    P.beat(rig, F0, F1, hz=1.6, amp=40, base=10)
    M.visible(eg, [(t(F0 - 2), t(1726))], F0, F1)
    return F0, F1
