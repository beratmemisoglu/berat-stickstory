# Market stall: the little stands outside a city gate - four wooden posts, a plank counter with a darker front board,
# a striped cloth awning (alternating colour strips, sloping to the front) with a scalloped valance, a vertical shop sign
# on the front post (tex/make_out.py out_sign_<i>.png: tea / rice / wine / medicine), a red paper lantern at the front
# corner, sacks on the ground. kind sets the goods on the counter:
#   'fruit'   three wicker baskets heaped with oranges, red apples and green cabbages, a few loose fruits
#   'pottery' stacked bowls, round-bellied jars, a big glazed pot on the ground
#   'tea'     a teapot, cups on a tray, a stack of tea bricks; a bench in front
# lit=True: the lantern glows (+ a warm point light <name>_light when light=True).
# Floor prop: root at the floor centre under the counter; front -Y. ~2.4 x 1.8 x 2.5 m.
import math, random

META = {'size': (2.6, 1.9, 2.5), 'anchor': 'floor centre; front -Y', 'animate': ['_lantern (rotation: sway)', '_light (energy)'],
        'params': "kind='fruit'|'pottery'|'tea', cloth=('#c8402a', '#f0dca0') (awning strip colours), sign=0..3, lit=False, light=True, "
                  "power=40, seed=1"}

TEX = 'assets/props/tex/'


def _lathe(cz, name, prof, mat, parent, loc=(0, 0, 0), segs=16, ol=0.004):
    import bmesh
    bm = bmesh.new(); rings = []
    for r, z in prof:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for ra, rb in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat), loc, (0, 0, 0), None, parent, ol, 0.0)


def build(cz, name='out_stall', kind='fruit', cloth=('#c8402a', '#f0dca0'), sign=0, lit=False, light=True, power=40.0, seed=1):
    rnd = random.Random(seed)
    root = cz.empty(name)
    wood = cz.toon('out_stall_wood', '#8a5a3a', tex='wood', tex_scale=3.0, tex_strength=0.08)
    wood2 = cz.toon('out_stall_wood2', '#5e3f2b', tex='wood', tex_scale=3.0, tex_strength=0.08)
    c1 = cz.toon(f'out_stall_cloth{cloth[0]}', cloth[0], tex='grain', tex_strength=0.04)
    c2 = cz.toon(f'out_stall_cloth{cloth[1]}', cloth[1], tex='grain', tex_strength=0.04)
    W, D = 2.2, 1.3
    yf, yb = -D / 2, D / 2
    for i, (x, y, h) in enumerate(((-W / 2, yf, 2.0), (W / 2, yf, 2.0), (-W / 2, yb, 2.35), (W / 2, yb, 2.35))):
        cz.cyl(f'{name}_post{i}', 0.05, h, (x, y, 0), wood2, verts=10, ol=0.005, parent=root)
    cz.box(name + '_counter', (W - 0.1, 0.75, 0.08), (0, -0.15, 0.8), wood, bevel=0.01, ol=0.005, parent=root)
    cz.box(name + '_front', (W - 0.1, 0.05, 0.76), (0, -0.5, 0.39), wood2, bevel=0.008, ol=0.005, parent=root)
    for k in range(3):
        cz.box(f'{name}_plank{k}', (W - 0.14, 0.012, 0.03), (0, -0.53, 0.18 + k * 0.22), wood, bevel=0, ol=0.0, parent=root)
    cz.box(name + '_shelf', (W - 0.1, 0.5, 0.05), (0, 0.35, 0.35), wood, bevel=0.008, ol=0.004, parent=root)
    # awning: strips across X sloping from the back (z 2.35) to the front (z 1.98), overhanging the front by 0.35 m
    n = 7; aw = W + 0.3
    y0, y1, z0, z1 = yb + 0.1, yf - 0.35, 2.36, 1.93
    L = math.hypot(y0 - y1, z0 - z1); ang = math.degrees(math.atan2(z0 - z1, y0 - y1))
    for i in range(n):
        x = -aw / 2 + aw * (i + 0.5) / n
        cz.box(f'{name}_strip{i}', (aw / n + 0.002, L, 0.03), (x, (y0 + y1) / 2, (z0 + z1) / 2), c1 if i % 2 == 0 else c2,
               rot=(ang, 0, 0), bevel=0.004, ol=0.005, parent=root)
        cz.cyl(f'{name}_scallop{i}', aw / n / 2, 0.02, (x, y1 - 0.01, z1 - 0.005), c2 if i % 2 == 0 else c1, rot=(90, 0, 0), verts=16, ol=0.004,
               parent=root)
    # the sign on the front-right post
    sm = cz.toon(f'out_stall_sign{sign}', img=TEX + f'out_sign_{sign % 4}.png', lift=0.66)
    cz.box(name + '_signboard', (0.3, 0.04, 0.58), (W / 2 + 0.2, yf, 1.35), wood2, bevel=0.008, ol=0.005, parent=root)
    cz.plane(name + '_signface', 0.26, 0.52, (W / 2 + 0.2, yf - 0.0215, 1.35), sm, parent=root)
    cz.box(name + '_signarm', (0.25, 0.03, 0.03), (W / 2 + 0.1, yf, 1.66), wood2, bevel=0, ol=0.003, parent=root)
    # paper lantern at the front-left corner of the awning
    lp = cz.empty(name + '_lantern', (-W / 2 - 0.05, yf - 0.3, 1.95), parent=root)
    silk = cz.glow('out_stall_lanternlit', '#ff7a4a', 2.2) if lit else cz.toon('out_stall_lanternm', '#c8291b', tex='grain', tex_strength=0.04)
    gold = cz.toon('out_stall_gold', '#d0a23a')
    cz.cyl(name + '_lcord', 0.006, 0.2, (0, 0, -0.2), cz.toon('out_stall_cord', '#3a2a20'), verts=6, ol=0.0, parent=lp)
    body = cz.sphere(name + '_lbody', 1.0, (0, 0, -0.38), silk, ol=0.005, parent=lp, segs=16, rings=10)
    for v in body.data.vertices: v.co = (v.co.x * 0.16, v.co.y * 0.16, v.co.z * 0.19)
    body.data.update()
    for z in (-0.2, -0.56):
        cz.cyl(f'{name}_lcap{z}', 0.07, 0.035, (0, 0, z - 0.017), gold, verts=12, ol=0.003, parent=lp)
    cz.cyl(name + '_ltassel', 0.02, 0.14, (0, 0, -0.72), cz.toon('out_stall_tassel', '#c8291b'), verts=8, ol=0.002, parent=lp)
    if lit and light:
        Lg = cz.light(name + '_light', 'POINT', (-W / 2 - 0.05, yf - 0.3, 1.57), color='#ff9a5a', power=power, size=0.1, shadow=False)
        Lg.parent = root
    # goods
    zc = 0.84
    if kind == 'fruit':
        wick = cz.toon('out_stall_wicker', '#b08a55', tex='grain', tex_scale=6.0, tex_strength=0.1)
        dark = cz.toon('out_stall_dark', '#3a2a20')
        for j, (x, fc, fr) in enumerate(((-0.65, '#e8862a', 0.05), (0.0, '#c83a2a', 0.05), (0.65, '#6aa04a', 0.085))):
            cz.cyl(f'{name}_basket{j}', 0.27, 0.14, (x, -0.2, zc), wick, verts=18, ol=0.005, parent=root, r2=0.3)
            fm = cz.toon(f'out_stall_fruit{fc}', fc, tex='grain', tex_strength=0.04)
            cnt = 0
            for ring, (rr, zz) in enumerate(((0.18, 0.14), (0.09, 0.2), (0.0, 0.25))):
                m = 1 if rr == 0 else int(2 * math.pi * rr / (fr * 2.1))
                for q in range(m):
                    a = q / max(1, m) * 2 * math.pi + ring
                    cz.sphere(f'{name}_fr{j}_{cnt}', fr, (x + math.cos(a) * rr, -0.2 + math.sin(a) * rr, zc + zz), fm, ol=0.003, parent=root,
                              segs=10, rings=6); cnt += 1
        for q in range(3):
            cz.sphere(f'{name}_loose{q}', 0.05, (rnd.uniform(-0.9, 0.9), -0.45, zc + 0.05), cz.toon('out_stall_fruit#e8862a', '#e8862a'), ol=0.003,
                      parent=root, segs=10, rings=6)
    elif kind == 'pottery':
        glaze = [cz.toon(f'out_stall_glaze{c}', c, tex='grain', tex_strength=0.04) for c in ('#2a6a8a', '#b0603a', '#e8dcc4', '#3a7a5a')]
        for j in range(4):
            x = -0.75 + j * 0.5
            _lathe(cz, f'{name}_jar{j}', [(0.0, 0.0), (0.1, 0.0), (0.15, 0.1), (0.13, 0.22), (0.07, 0.28), (0.08, 0.31), (0.0, 0.31)],
                   glaze[j % 4], root, loc=(x, -0.2, zc), segs=16)
        for k in range(4):
            cz.cyl(f'{name}_bowl{k}', 0.14, 0.05, (0.75, 0.0, zc + k * 0.05), glaze[(k + 1) % 4], verts=16, ol=0.003, parent=root, r2=0.17)
        _lathe(cz, name + '_bigpot', [(0.0, 0.0), (0.18, 0.0), (0.3, 0.2), (0.27, 0.45), (0.16, 0.55), (0.18, 0.6), (0.0, 0.6)], glaze[0], root,
               loc=(-W / 2 + 0.1, -0.95, 0), segs=20, ol=0.005)
    else:   # tea
        tea = cz.toon('out_stall_teapot', '#3a6a5a', tex='grain', tex_strength=0.04)
        cup = cz.toon('out_stall_cup', '#efe6cf')
        _lathe(cz, name + '_teapot', [(0.0, 0.0), (0.08, 0.0), (0.12, 0.07), (0.1, 0.14), (0.05, 0.17), (0.0, 0.2)], tea, root, loc=(-0.4, -0.2, zc))
        cz.cyl(name + '_spout', 0.02, 0.12, (-0.28, -0.2, zc + 0.06), tea, rot=(0, 55, 0), verts=8, ol=0.003, parent=root, r2=0.012)
        cz.box(name + '_tray', (0.5, 0.32, 0.03), (0.25, -0.2, zc + 0.015), wood2, bevel=0.005, ol=0.004, parent=root)
        for q in range(6):
            cz.cyl(f'{name}_cup{q}', 0.04, 0.05, (0.07 + (q % 3) * 0.13, -0.28 + (q // 3) * 0.16, zc + 0.03), cup, verts=12, ol=0.003, parent=root, r2=0.045)
        for q in range(4):
            cz.box(f'{name}_brick{q}', (0.2, 0.14, 0.04), (0.75, 0.05, zc + 0.02 + q * 0.042), cz.toon('out_stall_teabrick', '#6a4a30'), bevel=0.005, ol=0.003, parent=root)
        cz.box(name + '_bench', (1.4, 0.32, 0.06), (0, -1.15, 0.42), wood, bevel=0.01, ol=0.005, parent=root)
        for sx in (-1, 1):
            cz.box(f'{name}_benchleg{sx}', (0.06, 0.28, 0.4), (sx * 0.6, -1.15, 0.2), wood2, bevel=0.005, ol=0.004, parent=root)
    # sacks on the ground by the counter
    sack = cz.toon('out_stall_sack', '#d8c49a', tex='paper', tex_strength=0.05)
    for q in range(2):
        x = W / 2 - 0.3 - q * 0.42
        o = cz.capsule(f'{name}_sack{q}', 0.18, 0.5, (x, -0.95, 0), sack, ol=0.005, parent=root)
        cz.cyl(f'{name}_sacktie{q}', 0.06, 0.05, (x, -0.95, 0.42), cz.toon('out_stall_cord', '#3a2a20'), verts=10, ol=0.003, parent=root)
    return root
