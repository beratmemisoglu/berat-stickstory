# Skyline pieces: chunky ancient-Chinese buildings for the distant layers of the outdoor sets (the city behind the gate
# wall, the city seen from the hill, the palace precinct around the rubble). Built for 10-25 m away: big shapes, thick
# ink (ol 0.02-0.03 m so cam.bake's constant-width lines stay visible), few parts.
#   kind='hall'    a hall on a stone terrace: wall body, a row of red columns along the front, lattice window panels,
#                  a hip roof with a concave profile and upturned corners (eaves=2: a second smaller roof above a short
#                  upper storey), a ridge with curled end ornaments
#   kind='pagoda'  a tiered pagoda: storeys shrinking upward, a roof per storey, a spire of discs and a pole
#   kind='house'   a small whitewashed house with a grey roof, a door and a window
#   kind='wall'    a city wall run along +X (length w): brick body (city_gate_brick.png box-projected), merlons, a stone
#                  coping, a watch tower every `towers` metres
# lit=True: windows / lattice panels glow warm (night); otherwise they are dark paper panels.
# Floor prop: root at the floor centre (wall: the middle of the run), front -Y.
import math

META = {'size': (8.0, 6.0, 7.0), 'anchor': 'floor centre; front -Y (wall: centre of the run, the run along X)',
        'animate': [],
        'params': "kind='hall'|'pagoda'|'house'|'wall', w=6.0 (width / run length), d=4.0 (depth), h=3.0 (body height), "
                  "eaves=1|2 (hall), tiers=5 (pagoda), roof='#d6a032', wall='#a8342a', lit=False, ol=0.022, towers=12.0 (wall), "
                  "terrace=True (hall), haze=None|(hex, k) (aerial perspective: every colour mixed k toward hex, lit windows excepted; near roofs get "
                  "tex/out_rooftile.png tile rows unless hazed), seed=1"}


def _roof(cz, name, parent, a, b, hr, ze, top, under, lift=0.35, flare=0.25, T=0.12, ol=0.02, nv=8):
    """Hip roof over half sizes (a, b) at eave height ze, ridge hr above it: concave profile, the corners curl up by `lift`
    and flare out by `flare`. One closed mesh (top, underside, eave rim)."""
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
        x += fl * (1 if x > 1e-9 else -1 if x < -1e-9 else 0)
        y += fl * (1 if y > 1e-9 else -1 if y < -1e-9 else 0)
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
    o = cz._mesh_obj(name, bm, top, smooth=False)
    o.data.materials.append(under)
    return cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _ridge(cz, name, parent, half, z, s, mat, ol):
    cz.box(name, (2 * half + 0.1 * s, 0.16 * s, 0.2 * s), (0, 0, z + 0.06 * s), mat, bevel=0.02 * s, ol=ol, parent=parent)
    for sx in (-1, 1):   # curled end ornaments
        cz.cyl(f'{name}_end{sx}', 0.09 * s, 0.32 * s, (sx * (half + 0.05 * s), 0, z + 0.05 * s), mat, rot=(0, -sx * 20, 0),
               verts=10, ol=ol, parent=parent, r2=0.05 * s)


HAZE = None       # set per build: (hex, k) - every colour is mixed k of the way toward the haze colour (aerial perspective)


def _mix(a, b, k):
    a, b = a.lstrip('#'), b.lstrip('#')
    ca = [int(a[i:i + 2], 16) for i in (0, 2, 4)]; cb = [int(b[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{int(round(x + (y - x) * k)):02x}' for x, y in zip(ca, cb))


def _c(h):
    return _mix(h, HAZE[0], HAZE[1]) if HAZE else h


def _mats(cz, name, roof, wall, lit):
    # materials are shared by colour (every instance with the same colours and haze reuses them)
    hz = f'_h{HAZE[0]}{HAZE[1]}' if HAZE else ''

    def T(nm, col, **kw): return cz.toon(f'out_skyline_{nm}{col}{hz}', _c(col), **kw)
    # near roofs get barrel-tile rows (tex/out_rooftile.png on the roof's own UVs, tinted); hazed far ones stay plain
    roofm = (T('roof', roof, tex='grain', tex_scale=1.5, tex_strength=0.06) if HAZE else
             cz.toon(f'out_skyline_roofuv{roof}', img='assets/props/tex/out_rooftile.png', tint=roof, lift=0.62))
    return dict(roof=roofm,
                under=T('under', '#3a2a24'),
                ridge=T('ridge', _dark(roof, 0.8)),
                wall=T('wall', wall, tex='grain', tex_scale=1.2, tex_strength=0.06),
                col=T('column', '#9a221c', tex='grain', tex_strength=0.04),
                stone=T('stone', '#c4b8a0', tex='grain', tex_scale=0.8, tex_strength=0.07),
                stone2=T('stone2', '#9a8f7c', tex='grain', tex_strength=0.06),
                win=(cz.glow('out_skyline_winlit', '#ffc46a', 2.2) if lit else T('win', '#3a2c26')),
                lat=T('lattice', '#5a1a14'),
                teal=T('teal', '#2b6a5c', tex='grain', tex_strength=0.04),
                gold=T('gold', '#d6a032'))


def _dark(h, k):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{int(x * k):02x}' for x in c)


def _hall(cz, name, root, w, d, h, eaves, roof, wall, lit, ol, terrace, s=1.0):
    M = _mats(cz, name, roof, wall, lit)
    z = 0.0
    if terrace:
        th = 0.6 * s
        cz.box(name + '_terrace', (w + 1.4 * s, d + 1.4 * s, th), (0, 0, th / 2), M['stone'], bevel=0.04 * s, ol=ol, parent=root)
        cz.box(name + '_terrace_lip', (w + 1.55 * s, d + 1.55 * s, 0.12 * s), (0, 0, th - 0.06 * s), M['stone2'], bevel=0.02 * s, ol=ol, parent=root)
        cz.box(name + '_steps', (1.4 * s, 0.7 * s, th * 0.7), (0, -(d / 2 + 0.7 * s + 0.35 * s), th * 0.35), M['stone2'], bevel=0.02 * s, ol=ol, parent=root)
        z = th
    cz.box(name + '_body', (w, d, h), (0, 0, z + h / 2), M['wall'], bevel=0.03 * s, ol=ol, parent=root)
    # columns along the front + lattice panels between them (or glowing at night)
    n = max(2, int(round(w / (1.1 * s))))
    for i in range(n + 1):
        x = -w / 2 + w * i / n
        cz.cyl(f'{name}_col{i}', 0.13 * s, h, (x, -d / 2 - 0.16 * s, z), M['col'], verts=10, ol=ol * 0.8, parent=root)
        if i < n:
            xm = x + w / n / 2
            cz.box(f'{name}_win{i}', (w / n * 0.62, 0.02, h * 0.5), (xm, -d / 2 - 0.012, z + h * 0.52), M['win'], bevel=0, ol=0.0, parent=root)
            for k in range(3):
                cz.box(f'{name}_lat{i}_{k}', (0.035 * s, 0.03, h * 0.5), (xm - w / n * 0.31 + (k + 1) * w / n * 0.155, -d / 2 - 0.03, z + h * 0.52),
                       M['lat'], bevel=0, ol=0.0, parent=root)
    cz.box(name + '_beam', (w + 0.4 * s, d + 0.5 * s, 0.25 * s), (0, -0.05 * s, z + h + 0.12 * s), M['teal'], bevel=0.02 * s, ol=ol, parent=root)
    ze = z + h + 0.2 * s
    a, b = w / 2 + 0.9 * s, d / 2 + 0.95 * s
    if eaves == 2:
        _roof(cz, name + '_roof0', root, a, b, 0.75 * s, ze, M['roof'], M['under'], lift=0.4 * s, flare=0.3 * s, T=0.14 * s, ol=ol)
        h2 = 1.0 * s
        cz.box(name + '_upper', (w * 0.72, d * 0.62, h2 + 0.6 * s), (0, 0, ze + 0.25 * s + h2 / 2), M['wall'], bevel=0.03 * s, ol=ol, parent=root)
        if lit:
            for i in range(3):
                cz.box(f'{name}_uwin{i}', (w * 0.12, 0.02, h2 * 0.45), (-w * 0.22 + i * w * 0.22, -d * 0.31 - 0.012, ze + 0.35 * s + h2 * 0.5), M['win'],
                       bevel=0, ol=0.0, parent=root)
        ze2 = ze + 0.25 * s + h2 + 0.3 * s
        a2, b2 = w * 0.36 + 0.8 * s, d * 0.31 + 0.85 * s
        _roof(cz, name + '_roof1', root, a2, b2, 1.4 * s, ze2, M['roof'], M['under'], lift=0.4 * s, flare=0.28 * s, T=0.14 * s, ol=ol)
        _ridge(cz, name + '_ridge', root, a2 - b2, ze2 + 1.4 * s, s, M['ridge'], ol)
        return ze2 + 1.7 * s
    _roof(cz, name + '_roof', root, a, b, 1.5 * s, ze, M['roof'], M['under'], lift=0.42 * s, flare=0.3 * s, T=0.14 * s, ol=ol)
    _ridge(cz, name + '_ridge', root, a - b, ze + 1.5 * s, s, M['ridge'], ol)
    return ze + 1.8 * s


def _pagoda(cz, name, root, w, tiers, roof, wall, lit, ol):
    M = _mats(cz, name, roof, wall, lit)
    s = w / 3.0
    cz.box(name + '_base', (w + 0.6 * s, w + 0.6 * s, 0.5 * s), (0, 0, 0.25 * s), M['stone'], bevel=0.03 * s, ol=ol, parent=root)
    z = 0.5 * s
    for t in range(tiers):
        k = 1 - t * 0.12
        bw = w * k; bh = (1.5 if t == 0 else 1.0) * s
        cz.box(f'{name}_story{t}', (bw, bw, bh), (0, 0, z + bh / 2), M['wall'], bevel=0.03 * s, ol=ol, parent=root)
        cz.box(f'{name}_door{t}', (bw * 0.28, 0.02, bh * 0.55), (0, -bw / 2 - 0.011, z + bh * 0.42), M['win'], bevel=0, ol=0.0, parent=root)
        z += bh
        a = bw / 2 + 0.7 * s * k
        _roof(cz, f'{name}_roof{t}', root, a, a, 0.55 * s * k, z, M['roof'], M['under'], lift=0.35 * s * k, flare=0.25 * s * k, T=0.12 * s, ol=ol)
        z += 0.45 * s * k
    for i, (r, hh) in enumerate(((0.32, 0.18), (0.24, 0.16), (0.18, 0.14), (0.13, 0.12))):
        cz.cyl(f'{name}_disc{i}', r * s, hh * s, (0, 0, z), M['ridge'], verts=14, ol=ol * 0.7, parent=root); z += hh * s
    cz.cyl(name + '_pole', 0.05 * s, 1.0 * s, (0, 0, z), M['ridge'], verts=8, ol=ol * 0.6, parent=root)
    cz.sphere(name + '_pearl', 0.11 * s, (0, 0, z + 1.05 * s), _mats(cz, name, roof, wall, lit)['gold'], ol=ol * 0.6, parent=root, segs=12, rings=8)
    return z + 1.2 * s


def _house(cz, name, root, w, d, h, roof, wall, lit, ol, rnd):
    M = _mats(cz, name, roof, wall, lit)
    cz.box(name + '_body', (w, d, h), (0, 0, h / 2), M['wall'], bevel=0.03, ol=ol, parent=root)
    cz.box(name + '_plinth', (w + 0.08, d + 0.08, 0.3), (0, 0, 0.15), M['stone2'], bevel=0.02, ol=ol * 0.8, parent=root)
    cz.box(name + '_door', (w * 0.22, 0.02, h * 0.62), (-w * 0.18, -d / 2 - 0.011, h * 0.31 + 0.05), cz.toon('out_skyline_door' + _c('#5a3a26'), _c('#5a3a26')), bevel=0, ol=0.0, parent=root)
    cz.box(name + '_win', (w * 0.2, 0.02, h * 0.24), (w * 0.22, -d / 2 - 0.011, h * 0.6), M['win'], bevel=0, ol=0.0, parent=root)
    a, b = w / 2 + 0.35, d / 2 + 0.4
    _roof(cz, name + '_roof', root, a, b, 0.9, h, M['roof'], M['under'], lift=0.18, flare=0.12, T=0.1, ol=ol)
    _ridge(cz, name + '_ridge', root, a - b, h + 0.9, 0.7, M['ridge'], ol)
    return h + 1.1


def _wallrun(cz, name, root, w, h, d, towers, roof, lit, ol):
    brick = (cz.toon('out_skyline_brickh' + _c('#9a7a62'), _c('#9a7a62'), tex='grain', tex_strength=0.06) if HAZE else
             cz.toon('out_skyline_brick', img='assets/props/tex/city_gate_brick.png', proj='box', proj_scale=0.5, lift=0.6))
    M = _mats(cz, name, roof, '#a8342a', lit)
    cz.box(name + '_body', (w, d, h), (0, 0, h / 2), brick, bevel=0.03, ol=ol, parent=root)
    cz.box(name + '_coping', (w, d + 0.1, 0.14), (0, 0, h + 0.07), M['stone'], bevel=0.02, ol=ol * 0.8, parent=root)
    n = int(w / 1.05)
    for i in range(n):
        x = -w / 2 + 0.5 + i * (w - 1.0) / max(1, n - 1)
        cz.box(f'{name}_merlon{i}', (0.62, 0.42, 0.6), (x, -d / 2 + 0.21, h + 0.44), brick, bevel=0.03, ol=ol * 0.8, parent=root)
    nt = max(0, int(w / towers))
    for i in range(nt):
        x = -w / 2 + towers * (i + 0.5)
        tw = 2.6
        cz.box(f'{name}_tower{i}', (tw, d + 0.6, h + 1.0), (x, 0, (h + 1.0) / 2), brick, bevel=0.03, ol=ol, parent=root)
        tr = cz.empty(f'{name}_tower{i}_top', (x, 0, h + 1.0), parent=root)
        cz.box(f'{name}_tower{i}_hut', (tw * 0.8, d * 0.7, 1.4), (0, 0, 0.7), M['wall'], bevel=0.03, ol=ol, parent=tr)
        cz.box(f'{name}_tower{i}_win', (0.5, 0.02, 0.5), (0, -d * 0.35 - 0.012, 0.75), M['win'], bevel=0, ol=0.0, parent=tr)
        _roof(cz, f'{name}_tower{i}_roof', tr, tw * 0.4 + 0.6, d * 0.35 + 0.6, 0.9, 1.4, M['roof'], M['under'], lift=0.3, flare=0.2, T=0.1, ol=ol)
    return h + 2.0


def build(cz, name='out_skyline', kind='hall', w=6.0, d=4.0, h=3.0, eaves=1, tiers=5, roof='#d6a032', wall='#a8342a', lit=False,
          ol=0.022, towers=12.0, terrace=True, haze=None, seed=1):
    import random
    global HAZE
    HAZE = tuple(haze) if haze else None
    rnd = random.Random(seed)
    root = cz.empty(name)
    if kind == 'pagoda': top = _pagoda(cz, name, root, w, tiers, roof, wall, lit, ol)
    elif kind == 'house': top = _house(cz, name, root, w, d, h, roof, wall, lit, ol, rnd)
    elif kind == 'wall': top = _wallrun(cz, name, root, w, h, d, towers, roof, lit, ol)
    else: top = _hall(cz, name, root, w, d, h, eaves, roof, wall, lit, ol, terrace)
    root['top'] = top
    return root
