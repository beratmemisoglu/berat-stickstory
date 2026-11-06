# R17 "The roof sags and pushes your walls apart" 1108-1172 (high 3/4: ridge dips, long walls lean out, cracks spread)
F0, F1 = 1108, 1172


def build(ctx):
    import os, sys, math, random
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import bpy, cz, mega as M, props_r2 as R
    R.world(F1, 'winter')
    mt = R.mats(winter=True)
    P = R.cottage(mt, snow=0.55)
    R.land(mt, winter=True)
    r = random.Random(3); cracks = []

    def crack(x, z, face, n=8, along='x'):
        segs = []
        for j in range(n):
            nx, nz = x + r.uniform(-0.2, 0.2), z - r.uniform(0.16, 0.3)
            L = math.hypot(nx - x, nz - z); ang = math.degrees(math.atan2(-(nz - z), nx - x))
            if along == 'x':
                b = cz.box(f'crk{len(cracks)}_{j}', (L + 0.02, 0.02, 0.04), ((x + nx) / 2, face, (z + nz) / 2), mt['dark'], rot=(0, ang, 0), bevel=0, ol=0)
            else:
                b = cz.box(f'crk{len(cracks)}_{j}', (0.02, L + 0.02, 0.04), (face, (x + nx) / 2, (z + nz) / 2), mt['dark'], rot=(-ang, 0, 0), bevel=0, ol=0)
            segs.append(b); x, z = nx, nz
        cracks.append(M.join(f'crack{len(cracks)}', segs))
    # cracks open from the top of the walls and spread down, one after another ("pushes" 1144 -> "apart" 1164)
    for x0 in (-3.2, -1.1, 1.2, 3.2):
        crack(x0, 2.75, -R.D / 2 - 0.006, n=r.randint(6, 9))
    for y0 in (-1.6, 1.4):
        crack(y0, 2.75, -R.W / 2 - 0.006, n=7, along='y')
    roof = [o for o in bpy.context.scene.objects if o.type == 'MESH' and (o.parent == P['root'] or (o.parent and o.parent.parent == P['root']))]
    roof += [o for o in P['extra']]
    lat, key = R.sag_rig(roof + P['snow'] + cracks, A=1.7, B=3.4)
    key.value = 0.0; key.keyframe_insert('value', frame=1116)
    key.value = 0.5; key.keyframe_insert('value', frame=1134)
    key.value = 1.0; key.keyframe_insert('value', frame=1164)
    # cracks grow downward: reveal each one in steps (scale from its top)
    for i, c in enumerate(cracks):
        R.show_from([c], 1142 + 3 * i, F0, F1)
    # red arrows lying in the picture plane: down over the ridge on "sags", sideways at both long walls on "apart"
    dn = R.arrow('arr_dn', mt['red'], (0.5, 0, R.WALL + R.RISE + 2.6), (0, 0, -1), 1.5, 0.09)
    R.pop(dn, 1121, F0, F1, out=1148)
    for i, (x, s) in enumerate(((-4.9, -1), (-4.9, 1), (0.0, -1))):
        a = R.arrow(f'arr_o{i}', mt['red'], (x, s * (R.D / 2 + 0.35), 2.1), (0.0, s, 0.0) if i < 2 else (0.5, -1, 0), 1.6, 0.09)
        R.pop(a, 1150 + 3 * i, F0, F1)
    # first half: high 3/4 (ridge dips); cut at 1143 to an end-on insert at the gable (walls splay, rafters push)
    R.flight([(1108, (-7.0, -8.2, 4.6), (0.0, 0.0, 2.4), 26),
              (1142, (-6.0, -9.0, 4.0), (0.3, 0.0, 2.3), 26),
              (1143, (-12.0, -0.8, 2.6), (0.0, 0.0, 2.6), 28),
              (1172, (-10.0, 0.4, 2.3), (0.0, 0.0, 2.7), 28)], F0, F1, cuts=[1143])
    M.visible(P['gables'][0], [(0, R.t(1143))], F0, F1)
    return F0, F1
