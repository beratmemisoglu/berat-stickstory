# E28 "It would need to be powered by thousands of nuclear reactors" 1496-1590: steel truss hall of white reactors.
F0, F1 = 1496, 1590


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_d as P
    M.setup(F1, sun_elev=60, sun_rot=200, sun_power=4.4, exposure=0.9)
    md = P.mats_d()
    NX, BAY, LH, LV, RS = 12, 7.0, 4.4, 7, 0.55
    for n in bpy.context.scene.world.node_tree.nodes:
        if n.type == 'BACKGROUND': n.inputs[1].default_value *= 0.18   # enrich e28: dark industrial interior, the sun + floors carry the light
    TOP = LV * LH
    h = P.hall(md, nx=NX, ny=NX, levels=LV, bay=BAY, lh=LH, rs=RS, per4=True)
    t = lambda f: (f - 1) / 30
    # cave ceiling: dark rock vault above the hall
    cv = cz.plane('cave', 160, 160, loc=(0, 0, TOP + 14), mat=C.mats()['rock'], rot=(180, 0, 0), ol=0)
    sub = cv.modifiers.new('s', 'SUBSURF'); sub.subdivision_type = 'SIMPLE'; sub.levels = sub.render_levels = 7
    M.displace(cv, strength=10, scale=6)
    # hazard hatch ring the opening frames pass over
    hz = M.pbr('d_haz', '#e8c020', rough=0.4, img=C.T('hazard.png'), scale=0.6)
    P.lathe('hatch', [(3.0, 0), (3.6, 0), (3.6, 0.35), (3.0, 0.35)], hz, 64, loc=(3.5, -44.5, TOP - 14.6))
    # phase 2 roof: triangulated dark truss under the roof slab
    roof = bpy.data.objects['roof']
    tri = []
    half = NX * BAY / 2
    for i in range(-NX // 2, NX // 2):
        x = i * BAY
        tri.append(P.beam('rt', (x, -half, TOP - 0.7), (x + BAY * 2, half, TOP - 0.7), 0.5, md['trussd']))
        tri.append(P.beam('rt', (x + BAY * 2, -half, TOP - 0.7), (x, half, TOP - 0.7), 0.5, md['trussd']))
        tri.append(P.beam('rt', (-half, x, TOP - 0.9), (half, x, TOP - 0.9), 0.6, md['trussd']))
    rt = M.join('rooftruss', tri)
    pass
    # x-ray: the top-level reactors around the camera turn green on "reactors"
    xr = M.xray('d_xray'); M.xray_fade(xr, [(t(1558), 0), (t(1568), 1)])
    src = bpy.data.objects['reactor']
    xsrc = src.copy(); xsrc.data = src.data.copy(); bpy.context.scene.collection.objects.link(xsrc)
    xsrc.data.materials.clear(); xsrc.data.materials.append(xr); xsrc.location = (0, 0, -500)
    zl = (LV - 2) * LH
    for o in h['reactors']:
        if abs(o.location.z - zl) < 0.5 and -15 < o.location.x < 15 and -22 < o.location.y < 10:
            g = P.instance(xsrc, o.location, 0, RS * 1.05); M.visible(g, [(t(1558), t(F1 + 2))], F0, F1)
    M.ocean('sea', size=1200, res=8, wave=0.4, mat=M.water('d_sea28', '#0b3446', rough=0.12), f0=F0, f1=F1).location = (0, 0, -2)
    # Round 3 camera, matched to the reference curve (refcurve_d.py 1496 1590): 1496-1543 a continuous pull-back +
    # rise (content shrinks ~2.5 -> 0.3 %/f and drifts down = tilt up), 1544-1548 a fast push-in into the cut (zoom
    # +10 %/f), cut at 1549; 1549-1590 an accelerating left pan with positive roll (content moves right 0.5 -> 2.5 %/f),
    # the whip at 1577-1583 out toward the sea.
    # clear an open bay around the phase-2 camera path on the top level (the reference camera floats over open floor
    # with the reactors 5+ m away - close ones made the pan curve spike)
    for o in list(bpy.data.objects):
        if o.data is not None and o.type == 'MESH' and abs(o.location.z - zl) < 0.6 and -1 < o.location.x < 8 and -44 < o.location.y < -33 \
                and o.name.split('.')[0] in ('reactor', 'tank', 'steam'):
            bpy.data.objects.remove(o)
    Fl = M.Flight([
        (t(1496), (3.5, -45.5, TOP - 12.2), (3.5, 0, TOP - 8.0), 20, -1),
        (t(1508), (3.5, -50.5, TOP - 9.5), (3.5, 0, TOP - 5.6), 20, -0.5),
        (t(1522), (3.5, -54.5, TOP - 7.0), (3.5, 0, TOP - 3.4), 20, 0),
        (t(1536), (3.5, -56.5, TOP - 6.0), (3.5, 0, TOP - 1.6), 20, 0),
        (t(1543.5), (3.5, -57.2, zl + 3.8), (3.5, 0, zl + 4.2), 20, 0, True),
        (t(1548.5), (3.5, -44, zl + 3.6), (3.5, 0, zl + 3.6), 20, 0),
        (t(1551), (3.5, -39.4, zl + 3.45), (3.4, 0, zl + 2.2), 19, 0),
        (t(1560), (3.5, -38.5, zl + 3.4), (2.4, 0, zl + 0.8), 18, 1),
        (t(1568), (3.5, -38.2, zl + 3.4), (0.2, 0, zl + 0.2), 18, 2),
        (t(1576), (3.5, -38.0, zl + 3.4), (-2.0, 0, zl), 18, 4),
        (t(1584), (3.5, -37.2, zl + 3.4), (-4.5, 0, zl), 18, 8),
        (t(1590), (3.5, -37.2, zl + 3.4), (-10, 0, zl), 18, 13)])
    Fl.bake(F0, F1)
    return F0, F1
