# 1800s headstone (BELL film graveyard), chunky toy proportions, grey-blue / violet painted stone (chips, cracks,
# lichen speckle in the box-projected PNG), engraved text as an alpha decal (carved look: dark letters with a lit lower
# lip, 1.5 mm proud, no outline), green moss patches (alpha decals) + moss clods at the foot.
#   style 0 rounded-top slab on a plinth | 1 stone cross on a stepped base (text on the base) | 2 small obelisk
#   (plinth, die with the text, tapered shaft + pyramid tip as ONE mesh) | 3 slab with a carved scroll top (ogee crest +
#   two volute rolls with carved spirals) | 4 crude leaning wooden cross marker (weathered planks, painted name).
#   tilt=deg (crooked lean, direction from seed), seed, lines=None (default: an invented name + 18xx dates; the hero
#   grave: lines=['HORACE','BRIGGS','1832 - 1879','REST EASY']), moss=True.
# Floor prop: root = floor centre, face toward -Y. Graphics: tex/make_gb_grave.py (text decals cached by content).
import hashlib, math, os, random, subprocess
import bmesh

META = {'size': (0.64, 0.26, 0.95), 'anchor': 'floor centre, the inscribed face toward -Y', 'animate': ['_tilt'],
        'params': "style=0..4, tilt=0.0 (deg), seed=0, lines=None|[str,...], moss=True, color=None (stone hex tint). "
                  "Heights: 0 slab 0.89, 1 cross 0.90, 2 obelisk 0.97, 3 scroll slab 0.86, 4 wooden cross 0.85. "
                  "The lean is the empty <name>_tilt (rotation about X/Y at the foot)."}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
FIRST = ['EZRA', 'MABEL', 'JEB', 'OTIS', 'HETTY', 'AMOS', 'CLEM', 'DORCAS', 'SILAS', 'PRUDENCE', 'ELIAS', 'MINNIE', 'ABNER', 'TILLY']
LAST = ['PLUMB', 'HOGG', 'FINCH', 'MUDD', 'CRUMB', 'BOGGS', 'PICKETT', 'STUBBS', 'GRIMSBY', 'TUCKER', 'WOOLEY', 'PENNYWORTH']
EPI = ['R.I.P.', 'AT REST', 'GONE AHEAD', 'BELOVED', 'ASLEEP']


def _py(cz):
    py = cz.py()
    return py


def _run(cz, *args):
    try:
        subprocess.run([_py(cz), os.path.join(TEX, 'make_gb_grave.py'), *args], timeout=120, check=True, capture_output=True,
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e:
        print('CZ gb_headstone: png failed', e)


def _tex(cz, n):
    p = os.path.join(TEX, n)
    if not os.path.exists(p): _run(cz, 'static')
    return p if os.path.exists(p) else None


def _decal(cz, lines, mode, size):
    key = hashlib.sha1(f"{'|'.join(lines)}|{mode}|{size}".encode('utf8')).hexdigest()[:10]
    p = cz.gen_path(TEX, f'gb_headstone_txt_{key}.png')
    if not os.path.exists(p): _run(cz, mode, p, '|'.join(lines), size)
    return (p if os.path.exists(p) else None), key


def _prism_xz(cz, name, pts, depth, mat, parent, ol=0.008, bevel=0.01, y0=None):
    """2-D outline in X/Z extruded along -Y (front face at y = -depth/2)."""
    area = sum(x0 * y1 - x1 * y0_ for (x0, y0_), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    if area < 0: pts = pts[::-1]
    n = len(pts)
    o = cz.cyl(name, 1.0, depth, (0, depth / 2 if y0 is None else y0, 0), mat, rot=(90, 0, 0), verts=n, ol=ol, parent=parent, bevel=bevel)
    vs = o.data.vertices
    a0 = math.atan2(vs[0].co.y, vs[0].co.x); step = 2 * math.pi / n
    for v in vs:
        k = int(round(((math.atan2(v.co.y, v.co.x) - a0) % (2 * math.pi)) / step)) % n
        v.co.x, v.co.y = pts[k]
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def _lathe4(cz, name, prof, mat, parent, loc, ol=0.008):
    """Square (4-sided, faces on the axes) lathe: prof = [(half_width, z), ...] bottom -> top, last half_width 0 = apex."""
    bm = bmesh.new(); rings = []
    for w, z in prof:
        if w < 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((sx * w, sy * w, z)) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))])
    bm.faces.new(rings[0][::-1])
    for a, b in zip(rings, rings[1:]):
        if len(b) == 1:
            for i in range(4): bm.faces.new((a[i], a[(i + 1) % 4], b[0]))
        else:
            for i in range(4): bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=False), loc, parent=parent, outline_t=ol, bevel=0.006)


def _clod(cz, name, loc, size, mat, parent, rnd, ol=0.004):
    sx, sy, sz = size
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=8, rings=5)
    for v in o.data.vertices:
        x, y, z = v.co; k = 0.78 + 0.35 * rnd.random()
        v.co = (x * k * sx, y * k * sy, max(z * k * sz, -0.01 - loc[2]))
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def _text_plane(cz, name, lines, mode, size_px, w, loc, parent, rot=(90, 0, 0)):
    png, key = _decal(cz, lines, mode, size_px)
    if not png: return None
    W, H = [int(v) for v in size_px.split('x')]
    return cz.plane(name, w, w * H / W, loc, cz.toon(f'{name}_m{key}', img=png, alpha_clip=True, lift=0.6), rot=rot, parent=parent)


def build(cz, name='gb_headstone', style=0, tilt=0.0, seed=0, lines=None, moss=True, color=None):
    root = cz.empty(name)
    rnd = random.Random(seed * 7 + int(style))
    style = int(style) % 5
    if lines is None:
        f, l = rnd.choice(FIRST), rnd.choice(LAST); b = rnd.randint(1790, 1840); d = min(1878, b + rnd.randint(18, 78))
        lines = [f, l, f'{b} - {d}', rnd.choice(EPI)] if style in (0, 3) else [f'{f} {l}', f'{b} - {d}']
    lines = [str(s) for s in lines]
    tints = ['#e6e8ff', '#f0e6ff', '#e4eef0', '#ece8f4']
    sp = _tex(cz, 'gb_headstone_stone.png')
    stone = cz.toon(f'{name}_stone', '#5f6079', img=sp, proj='box', proj_scale=2.4, tint=color or tints[seed % 4], tex='grain', tex_strength=0.05) if sp \
        else cz.toon(f'{name}_stone', color or '#5f6079', tex='grain', tex_strength=0.08)
    stone2 = cz.toon(f'{name}_stone2', '#55566e', img=sp, proj='box', proj_scale=3.1, tint='#d8d8ee', tex='grain', tex_strength=0.06) if sp else stone
    mp = _tex(cz, 'gb_headstone_moss.png')
    mossm = cz.toon(name + '_mossm', img=mp, alpha_clip=True, lift=0.6) if mp else None
    mossm_top = cz.toon(name + '_mossm_t', img=mp, alpha_clip=True, lift=0.6, scale=(1, -1)) if mp else None
    mossc = cz.toon(name + '_mossc', '#3f5f28', tex='grain', tex_strength=0.14)
    dirt = cz.toon(name + '_dirt', '#4a3431', tex='grain', tex_strength=0.12)

    # lean: the stone tips about its foot; sink the base so the low edge stays in the ground
    lean = float(tilt) + (7.0 if style == 4 else 0.0)
    ph = rnd.uniform(0, 2 * math.pi) if style != 4 else math.radians(rnd.choice((20, 160)))
    tp = cz.empty(name + '_tilt', (0, 0, -0.012 - 0.12 * abs(math.sin(math.radians(lean)))), parent=root)
    tp.rotation_euler = (math.radians(lean * math.sin(ph)), math.radians(lean * math.cos(ph)), 0)

    def plinth(w, d, h, z0=0.0, nm='plinth'):
        cz.box(f'{name}_{nm}', (w, d, h), (0, 0, z0 + h / 2), stone2, bevel=0.012, ol=0.009, parent=tp)

    front_moss = []        # (x, z, w, front_y) bottom moss patches
    if style == 0:
        W, D, Hs, zb = 0.52, 0.13, 0.80, 0.09
        plinth(0.64, 0.24, zb)
        R = W / 2; zs = zb + Hs - R
        pts = [(-W / 2, zb - 0.01), (W / 2, zb - 0.01)] + [(R * math.cos(a), zs + R * math.sin(a)) for a in [i / 16 * math.pi for i in range(17)]]
        pts = [(-W / 2, zb - 0.01), (W / 2, zb - 0.01)] + [(R * math.cos(i / 16 * math.pi), zs + R * math.sin(i / 16 * math.pi)) for i in range(17)]
        _prism_xz(cz, name + '_slab', pts, D, stone, tp, ol=0.009, bevel=0.012)
        _text_plane(cz, name + '_text', lines, 'engrave', '600x600', 0.42, (0, -D / 2 - 0.0015, zb + 0.40), tp)
        front_moss = [(-0.08, zb, 0.40, 0.2, -D / 2), (0.05, 0.0, 0.56, 0.095, -0.12)]
        top = (-0.12, zs + 0.19, -D / 2, 0.14)
    elif style == 1:
        zb = 0.24
        plinth(0.56, 0.30, 0.08, 0.0, 'plinth')
        plinth(0.46, 0.24, zb - 0.08, 0.08, 'base')
        sw, aw, ah, az, Hc = 0.13, 0.48, 0.13, zb + 0.46, 0.66
        x1, x2 = sw / 2, aw / 2
        pts = [(-x1, zb - 0.01), (x1, zb - 0.01), (x1, az - ah / 2), (x2, az - ah / 2), (x2, az + ah / 2), (x1, az + ah / 2),
               (x1, zb + Hc), (-x1, zb + Hc), (-x1, az + ah / 2), (-x2, az + ah / 2), (-x2, az - ah / 2), (-x1, az - ah / 2)]
        _prism_xz(cz, name + '_cross', pts, 0.11, stone, tp, ol=0.009, bevel=0.01)
        _text_plane(cz, name + '_text', lines, 'engrave', '600x260', 0.40, (0, -0.12 - 0.0015, 0.08 + (zb - 0.08) / 2), tp)
        front_moss = [(0.1, 0.0, 0.5, 0.085, -0.15)]
        top = (-x2 + 0.07, az + ah / 2 - 0.005, -0.055, 0.11)
    elif style == 2:
        plinth(0.40, 0.40, 0.08, 0.0)
        cz.box(name + '_die', (0.30, 0.30, 0.28), (0, 0, 0.08 + 0.14), stone, bevel=0.01, ol=0.009, parent=tp)
        cz.box(name + '_diecap', (0.34, 0.34, 0.035), (0, 0, 0.36 + 0.0175), stone2, bevel=0.008, ol=0.008, parent=tp)
        _lathe4(cz, name + '_shaft', [(0.10, 0.0), (0.066, 0.50), (0.0, 0.58)], stone, tp, (0, 0, 0.395))
        _text_plane(cz, name + '_text', lines, 'engrave', '600x600', 0.25, (0, -0.15 - 0.0015, 0.08 + 0.14), tp)
        front_moss = [(0.04, 0.0, 0.40, 0.085, -0.20)]
        top = None
    elif style == 3:
        W, D, zb, zs, crest = 0.56, 0.14, 0.09, 0.62, 0.15
        plinth(0.68, 0.25, zb)
        def zt(x):
            t = abs(x) / (W / 2)
            return zs + crest * (0.5 + 0.5 * math.cos(math.pi * min(1.0, t * 1.1))) - 0.035 * math.sin(math.pi * min(1.0, t)) ** 2
        xs = [W / 2 - i * W / 24 for i in range(25)]
        pts = [(-W / 2, zb - 0.01), (W / 2, zb - 0.01)] + [(x, zt(x)) for x in xs]
        _prism_xz(cz, name + '_slab', pts, D, stone, tp, ol=0.009, bevel=0.01)
        rr = 0.068
        scp = _tex(cz, 'gb_headstone_scroll.png')
        for k, s in (('l', -1), ('r', 1)):
            cx, czz = s * (W / 2 - rr * 0.75), zs - 0.005
            cz.cyl(f'{name}_roll_{k}', rr, D + 0.024, (cx, D / 2 + 0.012, czz), stone2, rot=(90, 0, 0), verts=28, bevel=0.008, ol=0.008, parent=tp)
            if scp:
                cz.plane(f'{name}_spiral_{k}', rr * 1.7, rr * 1.7, (cx, -D / 2 - 0.012 - 0.0015, czz),
                         cz.toon(name + '_spiralm', img=scp, alpha_clip=True, lift=0.6), parent=tp)
        _text_plane(cz, name + '_text', lines, 'engrave', '600x600', 0.40, (0, -D / 2 - 0.0015, zb + 0.29), tp)
        front_moss = [(0.07, zb, 0.44, 0.16, -D / 2), (-0.06, 0.0, 0.6, 0.095, -0.125)]
        top = (0.13, zt(0.13) - 0.01, -D / 2, 0.12)
    else:   # 4 crude wooden cross
        wv, wh = _tex(cz, 'gb_bell_post_wood_v.png'), _tex(cz, 'gb_bell_post_wood_h.png')
        woodv = cz.toon(name + '_woodv', '#5a4a3c', img=wv, proj='box', proj_scale=2.4, tint='#cfc6c0') if wv else cz.toon(name + '_woodv', '#5a4a3c', tex='wood')
        woodh = cz.toon(name + '_woodh', '#5a4a3c', img=wh, proj='box', proj_scale=2.4, tint='#cfc6c0') if wh else woodv
        cz.box(name + '_stem', (0.08, 0.04, 0.98), (0, 0, 0.98 / 2 - 0.12), woodv, rot=(0, 1.5, 0), bevel=0.006, ol=0.008, parent=tp)
        cz.box(name + '_bar', (0.44, 0.034, 0.115), (0.01, -0.037, 0.62), woodh, rot=(0, -4, 0), bevel=0.006, ol=0.008, parent=tp)
        cz.box(name + '_stemtip', (0.05, 0.03, 0.05), (0, 0, 0.86), woodv, rot=(0, 45, 0), bevel=0.004, ol=0.006, parent=tp)
        nm = cz.toon(name + '_nail', '#2a2624')
        for i, (x, z) in enumerate(((-0.012, 0.645), (0.014, 0.6))):
            cz.cyl(f'{name}_nail{i}', 0.007, 0.004, (x, -0.0545, z), nm, rot=(90, 0, 0), verts=8, ol=0, parent=tp)
        pe = cz.empty(name + '_paint', (0.01, -0.0545 - 0.0015, 0.62), parent=tp); pe.rotation_euler = (0, math.radians(-4), 0)
        _text_plane(cz, name + '_text', [' '.join(lines[:2]) if len(lines) > 2 else lines[0]] + ([lines[2] if len(lines) > 2 else lines[-1]] if len(lines) > 1 else []),
                    'painted', '700x180', 0.40, (0, 0, 0), pe)
        moss = False
        top = None
        for i in range(6):   # a little mound where it was stuck in
            a = i / 6 * 2 * math.pi
            _clod(cz, f'{name}_clod{i}', (0.06 * math.cos(a), 0.05 * math.sin(a), 0), (0.035, 0.035, 0.03), dirt, root, rnd)

    if moss and mossm:
        for i, (x, z, w, h, fy) in enumerate(front_moss):
            cz.plane(f'{name}_moss{i}', w, h, (x, fy - 0.0028 - 0.0008 * i, z + h / 2), mossm, parent=tp)
        if top:
            cz.plane(name + '_mosstop', top[3], top[3] / 2, (top[0], top[2] - 0.003, top[1] - top[3] / 4), mossm_top, parent=tp)
        for i in range(5):
            a = rnd.uniform(0, 2 * math.pi)
            _clod(cz, f'{name}_mossclod{i}', (0.3 * math.cos(a), 0.15 * math.sin(a) - 0.02, 0), (rnd.uniform(0.03, 0.06), rnd.uniform(0.025, 0.04), rnd.uniform(0.018, 0.03)), mossc, root, rnd)
    return root
