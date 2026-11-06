# Palace bits for the rubble morning - things thrown about by the quake, chunky and inked:
#   kind='column'  a fallen red-lacquer column lying on its side: gold bands, a pale splintered break at one end, a
#                  crack; length L
#   kind='table'   a low red lacquer table upside down, legs in the air, one leg snapped off beside it, a spilled
#                  wine cup and a plate
#   kind='screen'  a folding screen fallen flat-ish: four painted panels (cranes-and-cloud motif in simple shapes) at
#                  broken angles, one panel torn
#   kind='burner'  a big bronze incense burner (round belly, two loop handles, three legs) tipped on its side, its ash
#                  spilled in a grey fan
# Floor prop: root at the floor centre of the piece; front -Y.
import math, random

META = {'size': (3.5, 0.6, 0.6), 'anchor': 'floor centre of the piece',
        'animate': [], 'params': "kind='column'|'table'|'screen'|'burner', L=3.5 (column length), seed=1"}


def _lathe(cz, name, prof, mat, parent, loc=(0, 0, 0), rot=(0, 0, 0), segs=20, ol=0.005):
    import bmesh
    bm = bmesh.new(); rings = []
    for r, z in prof:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for ra, rb in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat), loc, rot, None, parent, ol, 0.0)


def build(cz, name='out_palace_bits', kind='column', L=3.5, seed=1):
    rnd = random.Random(seed)
    root = cz.empty(name)
    red = cz.toon('out_palace_bits_lacquer', '#9a221c', tex='grain', tex_strength=0.05)
    gold = cz.toon('out_palace_bits_gold', '#d0a23a', tex='grain', tex_strength=0.05)
    pale = cz.toon('out_palace_bits_splinter', '#e2c48c', tex='wood', tex_scale=3.0, tex_strength=0.06)
    dark = cz.toon('out_palace_bits_dark', '#2e2a26')
    if kind == 'column':
        R = 0.23
        cz.cyl(name + '_shaft', R, L, (-L / 2, 0, R), red, rot=(0, 90, 0), verts=20, ol=0.008, parent=root)
        for k, u in enumerate((0.12, 0.17, 0.9)):
            cz.cyl(f'{name}_band{k}', R + 0.012, 0.07 if k != 1 else 0.035, (-L / 2 + u * L, 0, R), gold, rot=(0, 90, 0), verts=20, ol=0.004, parent=root)
        for j in range(5):    # splintered break at the +X end
            a = j / 5 * 2 * math.pi
            cz.cyl(f'{name}_sp{j}', 0.07, rnd.uniform(0.12, 0.28), (L / 2 - 0.02, math.cos(a) * R * 0.55, R + math.sin(a) * R * 0.55), pale,
                   rot=(0, 90 + rnd.uniform(-10, 10), rnd.uniform(-10, 10)), verts=5, ol=0.003, parent=root, r2=0.01)
        cz.cyl(name + '_core', R * 0.96, 0.02, (L / 2 - 0.01, 0, R), pale, rot=(0, 90, 0), verts=20, ol=0.0, parent=root)
        for j in range(3):   # a crack along the top
            cz.box(f'{name}_crack{j}', (0.4, 0.025, 0.01), (-0.6 + j * 0.42, 0.04 * (-1) ** j, 2 * R + 0.002), dark, rot=(0, 0, 14 * (-1) ** j),
                   bevel=0, ol=0.0, parent=root)
    elif kind == 'table':
        top = cz.toon('out_palace_bits_tabletop', '#7a2a1c', tex='wood', tex_strength=0.05)
        cz.box(name + '_top', (1.3, 0.75, 0.06), (0, 0, 0.03), top, bevel=0.012, ol=0.006, parent=root)
        cz.box(name + '_apron', (1.18, 0.63, 0.1), (0, 0, 0.11), red, bevel=0.01, ol=0.005, parent=root)
        for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
            if i == 2:   # the snapped leg lies beside the table
                cz.box(f'{name}_leg{i}', (0.08, 0.08, 0.42), (0.95, 0.55, 0.04), red, rot=(0, 90, 30), bevel=0.01, ol=0.005, parent=root)
                cz.cyl(f'{name}_legstub', 0.045, 0.08, (sx * 0.55, sy * 0.28, 0.16), pale, verts=6, ol=0.003, parent=root)
                continue
            cz.box(f'{name}_leg{i}', (0.08, 0.08, 0.42), (sx * 0.55, sy * 0.28, 0.37), red, bevel=0.01, ol=0.005, parent=root)
            cz.sphere(f'{name}_foot{i}', 0.05, (sx * 0.55, sy * 0.28, 0.6), gold, ol=0.003, parent=root, segs=10, rings=6)
        cup = cz.toon('out_palace_bits_cup', '#d0a23a')
        _lathe(cz, name + '_cup', [(0.0, 0.0), (0.03, 0.0), (0.06, 0.05), (0.065, 0.07), (0.0, 0.07)], cup, root, loc=(-0.85, -0.5, 0.06), rot=(90, 0, 40))
        cz.cyl(name + '_wine', 0.18, 0.004, (-1.0, -0.7, 0.002), cz.toon('out_palace_bits_wine', '#6a1a2a'), verts=18, ol=0.0, parent=root)
        cz.cyl(name + '_plate', 0.16, 0.025, (0.75, -0.6, 0.0), cz.toon('out_palace_bits_plate', '#e8e2d0'), rot=(8, -6, 0), verts=20, ol=0.004, parent=root)
    elif kind == 'screen':
        frame = cz.toon('out_palace_bits_frame', '#3a1a14', tex='wood', tex_strength=0.06)
        silk = cz.toon('out_palace_bits_silk', '#f0e2c0', tex='paper', tex_strength=0.04)
        crane = cz.toon('out_palace_bits_crane', '#f8f4ea')
        cloud = cz.toon('out_palace_bits_cloud', '#3a8a8a')
        W, H = 0.6, 1.5
        x = -1.2
        for i in range(4):
            pv = cz.empty(f'{name}_panel{i}', (x, 0, 0.0), parent=root)
            ang = (8, -14, 22, -6)[i]; lift = (0.0, 0.15, 0.32, 0.05)[i]
            pv.rotation_euler = (math.radians(-90 + 8 + lift * 30), 0, math.radians(ang))
            cz.box(f'{name}_panel{i}_frame', (W, 0.04, H), (W / 2, 0, H / 2), frame, bevel=0.01, ol=0.005, parent=pv)
            cz.box(f'{name}_panel{i}_silk', (W - 0.1, 0.045, H - 0.12), (W / 2, 0, H / 2), silk if i != 2 else cz.toon('out_palace_bits_torn', '#c8b090'),
                   bevel=0.0, ol=0.0, parent=pv)
            # cloud scrolls + a crane (body, neck, wing) on the panel's face (-Y side)
            for k in range(2):
                cz.cyl(f'{name}_panel{i}_cloud{k}', 0.08, 0.01, (0.18 + k * 0.22, -0.026, 0.35 + 0.6 * ((i + k) % 2)), cloud, rot=(90, 0, 0), verts=14,
                       ol=0.0, parent=pv)
            if i % 2 == 0:
                cz.sphere(f'{name}_panel{i}_crane', 0.07, (0.3, -0.03, 0.95), crane, ol=0.003, parent=pv, segs=10, rings=6)
                cz.box(f'{name}_panel{i}_neck', (0.02, 0.01, 0.16), (0.36, -0.03, 1.06), crane, rot=(0, 25, 0), bevel=0, ol=0.002, parent=pv)
                cz.box(f'{name}_panel{i}_wing', (0.2, 0.01, 0.05), (0.24, -0.03, 1.0), crane, rot=(0, -30, 0), bevel=0, ol=0.002, parent=pv)
            x += W * math.cos(math.radians(ang)) + 0.02
    else:   # burner
        bronze = cz.toon('out_palace_bits_bronze', '#9a6a32', tex='grain', tex_scale=2.0, tex_strength=0.07)
        patina = cz.toon('out_palace_bits_patina', '#5f8f72')
        pv = cz.empty(name + '_body', (0, 0, 0.42), parent=root)
        pv.rotation_euler = (math.radians(78), 0, math.radians(20))
        _lathe(cz, name + '_belly', [(0.0, -0.3), (0.22, -0.3), (0.42, -0.12), (0.44, 0.08), (0.36, 0.24), (0.38, 0.3), (0.0, 0.3)], bronze, pv, segs=24, ol=0.007)
        cz.cyl(name + '_band', 0.445, 0.06, (0, 0, -0.02), patina, verts=24, ol=0.004, parent=pv)
        for s in (-1, 1):
            o = _lathe(cz, f'{name}_handle{s}', [(0.1 + 0.025 * math.cos(2 * math.pi * i / 10), 0.025 * math.sin(2 * math.pi * i / 10)) for i in range(10)],
                       bronze, pv, loc=(s * 0.36, 0, 0.4), rot=(0, 0, 0), segs=16, ol=0.004)
            o.rotation_euler = (math.radians(90), 0, 0)
        for k in range(3):
            a = k / 3 * 2 * math.pi
            cz.cyl(f'{name}_leg{k}', 0.06, 0.3, (math.cos(a) * 0.25, math.sin(a) * 0.25, -0.58), bronze, verts=10, ol=0.004, parent=pv, r2=0.04)
        ash = cz.toon('out_palace_bits_ash', '#8a8480', tex='grain', tex_strength=0.08)
        o = cz.sphere(name + '_ash', 1.0, (0.25, -0.6, 0.0), ash, ol=0.004, parent=root, segs=14, rings=7)
        for v in o.data.vertices: v.co = (v.co.x * 0.55, v.co.y * 0.4, max(v.co.z, 0) * 0.06)
        o.data.update()
        for k in range(4):   # spilled incense sticks
            cz.cyl(f'{name}_stick{k}', 0.008, 0.3, (0.1 + k * 0.1, -0.5 - k * 0.05, 0.01), cz.toon('out_palace_bits_stick', '#b84a2a'),
                   rot=(0, 90, 20 + k * 25), verts=5, ol=0.0, parent=root)
    return root
