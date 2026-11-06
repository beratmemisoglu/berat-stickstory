# Palace ruins for the rubble morning (backdrop pieces around the fallen hall):
#   kind='wall'  a red-stucco palace wall run of length w along X on a grey stone base, a yellow glazed-tile coping
#                (tile rolls + round end caps along the eave) on the spans still standing, `breaches` places where the
#                top broke away in a ragged V (bare brick core showing, cracks), a heap of bricks and stucco at the foot
#                of each breach
#   kind='hall'  a side hall that half collapsed: a stone terrace, a row of red columns (some snapped, pale splinters on
#                top), the hip roof slid down at a slant with one eave on the ground, a beam sticking out
# Floor prop: root at the floor centre (wall: the middle of the run); front -Y.
import math, random

META = {'size': (12.0, 1.2, 5.2), 'anchor': 'floor centre; front -Y (wall: centre of the run along X)', 'animate': [],
        'params': "kind='wall'|'hall', w=12.0 (wall length / hall width), h=4.5 (wall height), d=5.0 (hall depth), breaches=2, "
                  "tilt=18 (hall roof slant, deg), ol=0.016, stucco='assets/props/tex/out_stucco.png' (box-projected wall paint; None = plain red), seed=2"}


def _dark(h, k):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{int(x * k):02x}' for x in c)


def _strip(cz, name, xs, ztop, t, mat, parent, ol, z0=0.0, side_mat=None):
    """A wall as a heightfield along X: top heights ztop[i] at xs[i], thickness t (y -t/2..t/2), from z0 up."""
    import bmesh
    bm = bmesh.new()
    F = [bm.verts.new((x, -t / 2, z0)) for x in xs]; Ft = [bm.verts.new((x, -t / 2, z)) for x, z in zip(xs, ztop)]
    B = [bm.verts.new((x, t / 2, z0)) for x in xs]; Bt = [bm.verts.new((x, t / 2, z)) for x, z in zip(xs, ztop)]
    for i in range(len(xs) - 1):
        bm.faces.new((F[i], F[i + 1], Ft[i + 1], Ft[i]))
        bm.faces.new((B[i + 1], B[i], Bt[i], Bt[i + 1]))
        bm.faces.new((Ft[i], Ft[i + 1], Bt[i + 1], Bt[i])).material_index = 1 if side_mat else 0
        bm.faces.new((F[i + 1], F[i], B[i], B[i + 1]))
    bm.faces.new((F[0], Ft[0], Bt[0], B[0])); bm.faces.new((F[-1], B[-1], Bt[-1], Ft[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mat, smooth=False)
    if side_mat: o.data.materials.append(side_mat)
    return cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _heap(cz, name, loc, r, h, mat, parent, rnd, ol):
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=12, rings=7)
    for v in o.data.vertices:
        x, y, z = v.co; k = 0.8 + 0.35 * rnd.random()
        v.co = (x * r * k, y * r * 0.7 * k, max(z, 0.0) * h * k)
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def _roof(cz, name, parent, a, b, hr, ze, top, under, lift=0.35, flare=0.25, T=0.14, ol=0.016, nv=8):
    import bmesh
    S = min(a, b) * 0.9

    def prof(v): return hr * (0.3 * v + 0.7 * v * v)

    def point(patch, c, v, bottom):
        d = v * b
        if patch in 'FK':
            aa = a - d; x = max(-aa, min(aa, c)); s = aa - abs(x); y = -(b - d) if patch == 'F' else (b - d)
        else:
            bb = b - d; y = max(-bb, min(bb, c)); s = bb - abs(y); x = (a - d) if patch == 'R' else -(a - d)
        w = (1 - min(1.0, s / S)) ** 2
        z = prof(v) + lift * w * (1 - v) ** 1.5 - (T if bottom else 0.0)
        fl = flare * w * (1 - v) ** 2 / math.sqrt(2)
        x += fl * (1 if x > 1e-9 else -1 if x < -1e-9 else 0); y += fl * (1 if y > 1e-9 else -1 if y < -1e-9 else 0)
        return (x, y, ze + z)

    nx = max(6, int(a / 0.35)); ny = max(6, int(b / 0.35))
    csx = [-a + 2 * a * k / nx for k in range(nx + 1)]; csy = [-b + 2 * b * k / ny for k in range(ny + 1)]
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    for patch, cs in (('F', csx), ('K', csx), ('R', csy), ('L', csy)):
        Gt = [[bm.verts.new(point(patch, c, j / nv, False)) for c in cs] for j in range(nv + 1)]
        Gb = [[bm.verts.new(point(patch, c, j / nv, True)) for c in cs] for j in range(nv + 1)]
        for j in range(nv):
            for k in range(len(cs) - 1):
                f = bm.faces.new((Gt[j][k], Gt[j][k + 1], Gt[j + 1][k + 1], Gt[j + 1][k])); f.material_index = 0
                # UVs: u = metres along the eave, v = up the slope -> tile rows run eave -> ridge on every slope
                for lp, (kk, jj) in zip(f.loops, ((k, j), (k + 1, j), (k + 1, j + 1), (k, j + 1))):
                    lp[uvl].uv = (cs[kk], jj / nv * b * 1.3)
                bm.faces.new((Gb[j][k], Gb[j + 1][k], Gb[j + 1][k + 1], Gb[j][k + 1])).material_index = 1
        for k in range(len(cs) - 1):
            bm.faces.new((Gt[0][k], Gb[0][k], Gb[0][k + 1], Gt[0][k + 1])).material_index = 1
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-5, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, top, smooth=False); o.data.materials.append(under)
    return cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _wall(cz, name, root, w, h, breaches, ol, rnd, stucco=None):
    red = (cz.toon('out_ruin_stuccoimg', img=stucco, proj='box', proj_scale=0.25, lift=0.62) if stucco else
           cz.toon('out_ruin_stucco', '#a8342a', tex='grain', tex_scale=1.5, tex_strength=0.08))
    core = cz.toon('out_ruin_core', '#8a6a58', tex='grain', tex_scale=3.0, tex_strength=0.1)
    base = cz.toon('out_ruin_base', '#9d968a', tex='grain', tex_scale=1.0, tex_strength=0.07)
    gold = cz.toon('out_ruin_glaze', '#d6a032', tex='grain', tex_scale=2.0, tex_strength=0.06)
    gold2 = cz.toon('out_ruin_glaze2', '#b0802a')
    brick = cz.toon('out_ruin_brick', '#8f6a58', tex='grain', tex_scale=3.0, tex_strength=0.08)
    t = 0.9
    cz.box(name + '_base', (w + 0.2, t + 0.25, 0.55), (0, 0, 0.275), base, bevel=0.03, ol=ol, parent=root)
    # breach centres and half widths
    br = []
    for i in range(breaches):
        c = -w / 2 + w * (i + 0.5) / breaches + rnd.uniform(-0.15, 0.15) * w / breaches
        br.append((c, rnd.uniform(1.0, 1.8), rnd.uniform(0.35, 0.65)))
    n = int(w / 0.12)
    xs = [-w / 2 + w * i / n for i in range(n + 1)]
    zt = []
    for x in xs:
        z = h
        for c, hw, depth in br:
            u = abs(x - c) / hw
            if u < 1: z = min(z, h - (h - 0.55) * depth * (1 - u) ** 0.8 - rnd.uniform(0, 0.18))
        zt.append(z)
    _strip(cz, name + '_body', xs, zt, t, red, root, ol, z0=0.55, side_mat=core)
    # coping on the intact spans: a slab, tile rolls across it, round end caps along the front eave
    spans, cur = [], None
    for x, z in zip(xs, zt):
        if z >= h - 1e-6:
            cur = [x, x] if cur is None else [cur[0], x]
        elif cur is not None: spans.append(cur); cur = None
    if cur: spans.append(cur)
    for k, (a, b) in enumerate(spans):
        if b - a < 0.6: continue
        g = cz.empty(f'{name}_cope{k}', ((a + b) / 2, 0, h), parent=root)
        L = b - a
        cz.box(f'{name}_cope{k}_slab', (L, t + 0.5, 0.16), (0, 0, 0.08), gold2, bevel=0.02, ol=ol * 0.8, parent=g)
        cz.box(f'{name}_cope{k}_ridge', (L, 0.22, 0.26), (0, 0, 0.29), gold, bevel=0.04, ol=ol * 0.8, parent=g)
        m = int(L / 0.32)
        for i in range(m):
            x = -L / 2 + 0.16 + i * (L - 0.32) / max(1, m - 1)
            cz.cyl(f'{name}_cope{k}_roll{i}', 0.065, t + 0.5, (x, (t + 0.5) / 2, 0.17), gold, rot=(90, 0, 0), verts=8, ol=0.0, parent=g)
            cz.cyl(f'{name}_cope{k}_cap{i}', 0.075, 0.05, (x, -(t + 0.5) / 2 - 0.02, 0.06), gold, rot=(90, 0, 0), verts=12, ol=ol * 0.5, parent=g)
    # heaps of fallen brick and stucco at each breach (in front), with a few loose bricks
    for i, (c, hw, depth) in enumerate(br):
        _heap(cz, f'{name}_heap{i}', (c, -0.7, 0.0), hw * 0.8, 0.5 + depth * 0.5, core, root, rnd, ol)
        for j in range(7):
            cz.box(f'{name}_hb{i}_{j}', (0.25, 0.12, 0.07), (c + rnd.uniform(-hw, hw), -0.6 - rnd.uniform(0.2, 1.3), 0.03 + rnd.uniform(0, 0.25)),
                   brick, rot=(rnd.uniform(-25, 25), rnd.uniform(-25, 25), rnd.uniform(0, 180)), bevel=0.008, ol=0.005, parent=root)
        for j in range(3):   # broken stucco slabs leaning on the heap
            cz.box(f'{name}_slab{i}_{j}', (rnd.uniform(0.4, 0.8), 0.1, rnd.uniform(0.3, 0.6)), (c + rnd.uniform(-hw, hw) * 0.7, -0.75 - rnd.uniform(0, 0.4), 0.25),
                   red, rot=(rnd.uniform(-50, -20), rnd.uniform(-15, 15), rnd.uniform(-20, 20)), bevel=0.01, ol=ol * 0.6, parent=root)
    # cracks running down the standing stucco
    crack = cz.toon('out_ruin_crack', '#3a1a14')
    for i in range(int(w / 3)):
        x = rnd.uniform(-w / 2 + 0.5, w / 2 - 0.5); z = rnd.uniform(1.8, h - 0.4)
        for j in range(4):
            L = rnd.uniform(0.25, 0.5); a = rnd.uniform(-35, 35)
            cz.box(f'{name}_crack{i}_{j}', (0.035, 0.01, L), (x, -t / 2 - 0.004, z - L / 2), crack, rot=(0, a, 0), bevel=0, ol=0.0, parent=root)
            x += math.sin(math.radians(a)) * L * 0.9; z -= math.cos(math.radians(a)) * L * 0.9


def _hall(cz, name, root, w, d, tilt, ol, rnd):
    stone = cz.toon('out_ruin_terrace', '#c4b8a0', tex='grain', tex_scale=0.8, tex_strength=0.07)
    stone2 = cz.toon('out_ruin_terrace2', '#9a8f7c', tex='grain', tex_strength=0.06)
    col = cz.toon('out_ruin_column', '#9a221c', tex='grain', tex_strength=0.05)
    pale = cz.toon('out_ruin_splinter', '#e2c48c', tex='wood', tex_scale=3.0, tex_strength=0.06)
    # tile rows on the roof's own UVs (box-projected ones on the slid, tilted roof read as diagonal hazard stripes)
    roof = cz.toon('out_ruin_roofuv', img='assets/props/tex/out_rooftile.png', tint='#d6a032', lift=0.62)
    under = cz.toon('out_ruin_under', '#3a2a24')
    teal = cz.toon('out_ruin_teal', '#2b6a5c', tex='grain', tex_strength=0.04)
    cz.box(name + '_terrace', (w + 1.2, d + 1.2, 0.6), (0, 0, 0.3), stone, bevel=0.04, ol=ol, parent=root)
    cz.box(name + '_lip', (w + 1.35, d + 1.35, 0.12), (0, 0, 0.54), stone2, bevel=0.02, ol=ol, parent=root)
    n = max(3, int(w / 1.4))
    # the roof slid forward: its front eave rests on the terrace lip, it slopes up (tilt) over the snapped front row onto
    # the back row of columns; columns that stuck out end in pale splinters
    yp, zp = -d / 2 - 0.55, 0.6
    tt = math.tan(math.radians(tilt))
    for i in range(n + 1):
        x = -w / 2 + w * i / n
        for j, y in enumerate((-d / 2, d / 2)):
            roof_z = zp + (y - yp) * tt - 0.25          # the roof's underside above this column
            hh = (rnd.uniform(0.15, 0.35) if j == 0 else min(roof_z - 0.6, rnd.uniform(1.4, 2.6))) if (i % 3) else rnd.uniform(0.15, 0.3)
            cz.cyl(f'{name}_col{i}_{j}', 0.2, hh, (x, y, 0.6), col, verts=14, ol=ol * 0.8, parent=root)
            cz.cyl(f'{name}_sp{i}_{j}', 0.17, 0.22, (x, y, 0.6 + hh), pale, verts=6, ol=0.004, parent=root, r2=0.03)
    pv = cz.empty(name + '_roofpv', (0, yp, zp), parent=root)
    pv.rotation_euler = (math.radians(tilt), 0, math.radians(rnd.uniform(-4, 4)))
    a, b = w / 2 + 0.9, d / 2 + 0.9
    _roof(cz, name + '_roof', pv, a, b, 1.6, 0.0, roof, under, ol=ol)
    for o in (cz.find(name + '_roof'),):
        o.location = (0, b, 0.15)
    cz.box(name + '_ridge', (2 * (a - b) + 0.2, 0.18, 0.22), (0, b, 0.15 + 1.66), cz.toon('out_ruin_ridge', '#a8782a'), bevel=0.02, ol=ol, parent=pv)
    cz.box(name + '_beam', (0.3, 2.6, 0.3), (w / 2 - 0.4, -d / 2 - 0.6, 1.4), teal, rot=(28, 6, 12), bevel=0.02, ol=ol, parent=root)


def build(cz, name='out_ruin', kind='wall', w=12.0, h=4.5, d=5.0, breaches=2, tilt=18.0, ol=0.016, stucco='assets/props/tex/out_stucco.png', seed=2):
    rnd = random.Random(seed)
    root = cz.empty(name)
    if kind == 'hall': _hall(cz, name, root, w, d, tilt, ol, rnd)
    else: _wall(cz, name, root, w, h, breaches, ol, rnd, stucco=stucco)
    return root
