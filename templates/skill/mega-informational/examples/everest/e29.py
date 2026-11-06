# E29 "until finally the slab is anchored near Alaska" 1591-1665: the slab sails up to a snowy coast, green anchor cables.
F0, F1 = 1591, 1665


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from mathutils import Vector
    import cz, mega as M, common as C, props_d as P
    M.setup(F1, sun_elev=22, sun_rot=115, sun_power=4.4, light_k=0.85)   # round 3 light: sun from the right like the reference
    mt = C.mats(); md = P.mats_d()
    t = lambda f: (f - 1) / 30
    sl = C.slab('slab', mt, z0=-5, rock='#2e2f33')
    for c in sl.children: c.location.z += 11
    bd = cz.cyl('band2', C.R * 1.04, 1.2, loc=(0, 0, 10.6), mat=md['copper'], verts=96, ol=0); bd.parent = sl
    sk = P.skirt(md, z=0.0); bpy.data.objects.remove(bpy.data.objects['band'])
    sk.parent = sl; sk.location = (0, 0, 5.0)
    # grey ribbed lower body under the copper band
    rib = M.steel('d_rib', '#9a9ea6', rough=0.3, panels=0.9, panel_scale=3, img=C.T('steel_panels.png'), scale=0.35)   # enrich e29_1620: riveted steel panels
    lb = cz.cyl('lower', C.R * 1.0, 6.4, loc=(0, 0, 4.4), mat=rib, verts=96, ol=0); lb.parent = sl
    wk = cz.empty('wakeroot', (0, 0, 5.0)); wk.parent = sl; wk.rotation_euler = (0, 0, math.radians(-118))
    P.wake(wk, C.R, length=60, width=18, z=0.12)
    P0, P1 = Vector((26, -14, 0)), Vector((0, 0, 0))
    S = lambda tt: P0.lerp(P1, cz.smooth(cz.clamp((tt - t(1591)) / (t(1645) - t(1591)))))
    M.bake_path(sl, F0, F1, pos=lambda tt: S(tt) + Vector((0, 0, -5)))
    sea = M.ocean('sea', size=500, res=9, wave=0.5, mat=M.water('d_sea', '#082c3c', rough=0.14), f0=F0, f1=F1)
    land = P.coast('coast', size=420, res=320, seed=11, sea_y=12.0, h=7, img=True)
    land.rotation_euler = (0, 0, math.radians(90)); land.location = (-2, 40, 0)
    # green anchor cables: slab rim -> coast, on "near Alaska"
    cab = M.xray('d_cab', '#5cff4a', alpha=0.85, strength=3)
    M.xray_fade(cab, [(t(1641), 0), (t(1648), 1)])
    for k in range(7):
        a = math.radians(150 + k * 12)
        p0 = Vector((C.R * math.cos(a), C.R * math.sin(a), 15 + k * 0.4))
        p1 = Vector((-30 - k * 3, -10 + k * 7, 4 + (k % 3)))
        cu = bpy.data.curves.new('cab%d' % k, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.18; cu.bevel_resolution = 2
        sp = cu.splines.new('BEZIER'); sp.bezier_points.add(2)
        for bp, p in zip(sp.bezier_points, (p0, p0.lerp(p1, 0.5) + Vector((0, 0, -5)), p1)):
            bp.co = p; bp.handle_left_type = bp.handle_right_type = 'AUTO'

        ob = bpy.data.objects.new('cab%d' % k, cu); bpy.context.scene.collection.objects.link(ob); cu.materials.append(cab)
        M.visible(ob, [(t(1641), t(F1 + 2))], F0, F1)
    # sun-lit clouds on the horizon
    for i, (x, y, z, w) in enumerate([(-60, 260, 18, 70), (80, 300, 24, 90), (-160, 240, 14, 60), (40, 200, 34, 110), (150, 240, 26, 80)]):   # enrich: big cumulus behind the coast
        P.cloud('cl%d' % i, w, (x, y, z))
    keys = []
    def K(f, off, toff, lens, roll=0):
        s = S(t(f)); keys.append((t(f), s + Vector(off), s + Vector(toff), lens, roll))
    # Round 3 camera from the reference curve (refcurve_d.py 1591 1665): A 1591-1600 low by the slab, a slow drift;
    # cut 1601; B 1601-1639 the aerial pulls back (zoom -0.2..-0.8 %/f) and turns left 1613-1628 (content moves
    # right), nearly still 1631-1639; cut 1640; C 1640-1665 over the coast: push in to 1648, then pull back + turn
    # right with a negative roll, settling at the end.
    K(1591, (12, -62, 5), (-1, 0, 15), 22, 2)
    K(1596, (12, -63, 6.5), (-1.5, 0, 14), 22, 2)
    K(1610, (13, -76, 40), (-4, 0, 6), 24, 2)
    K(1616, (13.5, -79, 42), (-5, 0, 6), 24, 2)
    K(1628, (18, -88, 47), (-14, 2, 6), 24, 2)
    K(1639.9, (18, -89, 47.5), (-15, 2, 6), 24, 2)
    K(1640, (-12, 26, 30), (-26, -10, 14), 22, -6)
    K(1648, (-13, 21, 28), (-27, -12, 13.8), 22, -6)
    K(1658, (-14, 25, 30), (-34, -18, 13.5), 22, -12)
    K(1665, (-14, 25.3, 30.2), (-35, -19, 13.5), 22, -13)
    M.Flight(keys, cuts=[t(1640)]).bake(F0, F1)
    return F0, F1
