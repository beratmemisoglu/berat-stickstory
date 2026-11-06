# E10 "with Everest still attached" 311-375: out of the whip the camera faces the cap (green flash on "Everest"),
# the snowy summit on the dark slab, then pulls back and up: the slab glows green, a ring of red-hot drill rigs round
# its base, a sea of clouds round the pit, fly out to a high wide.
F0, F1 = 311, 375


def build(ctx):
    import bpy, os, sys, math
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import cz, mega as M, common as C, props_a as P
    M.setup(F1 + 2, sun_elev=30, sun_rot=300, light_k=0.8, exposure=-0.35)
    mt = C.mats(); pm = P.mats()
    root = C.slab('slab', mt)
    body = bpy.data.objects['slab_body']; cap = bpy.data.objects['slab_cap']
    C.snow_range('range', mt, hole=42)
    M.heightfield('pit', 100, 4, lambda X, Y: X * 0, mat=mt['ground'], loc=(0, 0, -0.2))
    body.data.materials.clear(); body.data.materials.append(P.pit_basalt())
    t = lambda fr: (fr - 1) / 30
    # green x-ray overlays: the cap on "Everest", the whole slab on "still attached"
    gcap = M.xray('a_gcap', alpha=0.7)
    gbody = M.xray('a_gbody', alpha=0.5)
    for src, mat, nm in ((cap, gcap, 'gcap'), (body, gbody, 'gbody')):
        o = src.copy(); o.data = src.data.copy(); o.name = nm
        o.data.materials.clear(); o.data.materials.append(mat)
        bpy.context.scene.collection.objects.link(o); o.parent = src.parent
        o.scale = (1.015, 1.015, 1.004)
    M.xray_fade(gcap, [(t(313), 0.0), (t(316), 1.0), (t(328), 1.0), (t(332), 0.0)])
    M.xray_fade(gbody, [(t(343), 0.0), (t(347), 1.0), (t(368), 1.0), (t(372), 0.0)])
    # enrich target e10_0350: a bright grid of lines over the green slab (rings + verticals) fading with it
    gl = M.xray('a_ggrid', alpha=1.0, strength=1.4)
    parts = [cz.cyl(f'gr{k}', 11.1, 0.1, (0, 0, 0.6 + k * 1.55), gl, verts=96, ol=0) for k in range(10)]
    for k in range(28):
        a = 2 * math.pi * k / 28
        parts.append(cz.box(f'gv{k}', (0.09, 0.09, 15.4), (10.9 * math.cos(a), 10.9 * math.sin(a), 8.0), gl, rot=(0, 0, math.degrees(a)), bevel=0, ol=0))
    M.join('greengrid', parts)
    M.xray_fade(gl, [(t(343), 0.0), (t(347), 1.0), (t(368), 1.0), (t(372), 0.0)])
    # ring of red-hot drill rigs at the base, beams into the cut line
    hot = M.pbr('a_redhot', '#5a1a10', rough=0.4, metal=0.6, emit='#ff2200', emit_strength=1.2)
    n, rr, sc = 22, 13.2, 0.17
    cz.cyl('cut', 10.25, 0.18, (0, 0, 0.32), M.emit('a_cut2', '#ff4a10', 1.5), verts=128, ol=0)
    for i in range(n):
        a = 2 * math.pi * i / n
        rig = P.drill_rig(f'rig{i}', loc=(rr * math.cos(a), rr * math.sin(a), 0.42), rot=(0, 0, math.degrees(a) + 180), scale=sc, glow=True)
        for ch in rig.children:
            if ch.type == 'MESH' and ch.name.endswith('_m'):
                ch.data.materials.clear(); ch.data.materials.append(hot)
        P.beam(f'bm{i}', length=(rr - 10) / sc - 5.4, r=0.25, loc=(5.65, 0, 0), parent=rig)
    # sea of clouds round the pit
    import random
    rnd = random.Random(7); cm = P.cloud_mat(strength=0.7)
    k = 0
    while k < 40:
        x, y = rnd.uniform(-90, 90), rnd.uniform(-90, 90)
        if math.hypot(x, y) < 22: continue
        w = rnd.uniform(25, 55)
        cz.plane(f'cl{k}', w, w * 0.56, (x, y, rnd.uniform(1.5, 5)), cm, rot=(0, 0, rnd.uniform(0, 360)), ol=0); k += 1
    P.cloud_banks('cb', (0, 0), 36, 0.0, n=18, size=(18, 34), seed=5, f0=F0, f1=F1, layers=3, avoid=16)
    # v2 camera matched to the reference curve: near-still slow pull-back on the cap (311-337), a down-tilt whip
    # into the high wide at 339 (hard cut inside the blur), slow pull-back, tilt-down whip out at 371-375.
    tc = t(339)
    M.Flight([(t(309), (-2.2, -39.4, 23.8), (0.0, 0, 15.2), 24),
              (t(338.2), (-2.4, -41.3, 24.6), (-0.3, 0, 15.0), 24, 0, True),
              (t(340.2), (-7.6, -34.6, 44.6), (0.0, 0, 8.7), 24, 0, True),
              (t(342), (-7.8, -35.2, 45.4), (0, 0, 8.4), 24),
              (t(370.5), (-8.3, -37.2, 47.4), (0, 0, 8.0), 24),
              (t(375), (-8.4, -37.5, 47.7), (0, 0, 1.0), 24)], smooth=0.6).bake(F0, F1)
    return F0, F1
