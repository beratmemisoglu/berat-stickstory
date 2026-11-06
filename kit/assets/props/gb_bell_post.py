# Safety-coffin bell post (BELL film, hero prop): a weathered square wooden post planted at the head of the grave, a
# short gallows arm toward +X with a diagonal brace, a tiny gabled hood over a chunky brass bell that hangs in an iron
# yoke under the arm end. The bell (+ crown loop, bands, glint) swings on <name>_bell, its clapper (rod + ball peeking
# under the lip, pull ring below) on <name>_clapper; a rusty iron pipe comes out of the ground at x 0.28 and a pale
# twine STRING runs from the pipe top up to the pull ring (<name>_string, origin at the pipe top, points +Z).
# Nails, worn paint (PNG), a hand-painted plaque "RING IF ALIVE", dirt clods at the post foot and around the pipe.
# Floor prop: root = post foot centre on the ground, front -Y. Graphics: tex/make_gb_grave.py (run once, cached).
import math, os, random, subprocess
import bmesh

BELL = (0.28, 0.0, 1.42)          # pivot (hanging point, the yoke pin)
FOOT = (0.28, 0.0, 0.15)          # pipe top = string origin
TOP_Z = 1.135                     # string top (in the pull ring) at swing 0
D_RING = BELL[2] - TOP_Z          # pivot -> string top distance (0.285)

META = {'size': (0.5, 0.3, 1.8), 'anchor': 'post foot centre on the ground (z = 0); arm toward +X; front -Y',
        'animate': ['_bell', '_clapper', '_string'],
        'bell_pivot': BELL, 'string_foot': FOOT, 'string_top': (0.28, 0.0, TOP_Z),
        'params': "swing=0.0 (deg: <name>_bell.rotation_euler.y; POSITIVE swings the bell's mouth toward -X = screen-left seen "
                  "from -Y, the crown tips right; tested at +25 and -20), clapper=0.0 (deg, <name>_clapper.rotation_euler.y, same sign: "
                  "+ moves the ball + pull ring toward -X), plaque=True. The pull ring hangs on the clapper, so the STRING must follow "
                  "both angles: string_pose(bell_deg, clapper_deg) in this module returns (rotation_euler.y in rad, scale.z) for "
                  "<name>_string (build does it for the kw; per frame when you animate: cz._PROPS['gb_bell_post'].string_pose; "
                  "outline 0 so scale.z is safe). pipe_depth=0.06 (m the pipe runs below z 0; e.g. 1.4 for a cross-section down to the coffin)."}


def string_pose(bell_deg, clapper_deg=0.0):
    """(rotation_euler.y [rad], scale.z) of <name>_string so its top stays in the pull ring."""
    b, c = math.radians(bell_deg), math.radians(clapper_deg)
    d1, d2 = 0.04, D_RING - 0.04                    # bell pivot -> clapper pivot, clapper pivot -> string top
    px, pz = -d2 * math.sin(c), -d1 - d2 * math.cos(c)
    X = px * math.cos(b) + pz * math.sin(b); Z = -px * math.sin(b) + pz * math.cos(b)
    vx, vz = BELL[0] + X - FOOT[0], BELL[2] + Z - FOOT[2]
    return math.atan2(vx, vz), math.hypot(vx, vz) / (TOP_Z - FOOT[2])

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _tex(cz, n):
    p = os.path.join(TEX, n)
    if not os.path.exists(p):
        py = cz.py()
        try:
            subprocess.run([py, os.path.join(TEX, 'make_gb_grave.py'), 'static'], timeout=120, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e:
            print('CZ gb_bell_post: png failed', e)
    return p if os.path.exists(p) else None


def _rev(cz, name, prof, segs, mats, inner_from, loc, parent, ol):
    """Lathe: prof = [(r, z), ...] top centre -> outer -> lip -> inner -> back to the axis; faces from index
    inner_from on get material 1 (the dark inside)."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r < 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        mi = 1 if k >= inner_from else 0
        for i in range(segs):
            if len(a) == 1: f = bm.faces.new((a[0], b[i], b[(i + 1) % segs]))
            elif len(b) == 1: f = bm.faces.new((a[i], b[0], a[(i + 1) % segs]))
            else: f = bm.faces.new((a[i], b[i], b[(i + 1) % segs], a[(i + 1) % segs]))
            f.material_index = mi
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mats[0], smooth=True)
    o.data.materials.append(mats[1])
    return cz.place(o, loc, parent=parent, outline_t=ol)


def _torus(cz, name, R, r, loc, mat, parent, axis='Y', ol=0.0, segs=24, rsegs=10):
    bm = bmesh.new(); rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs; ring = []
        for j in range(rsegs):
            b = 2 * math.pi * j / rsegs
            rr = R + r * math.cos(b); h = r * math.sin(b)
            x, y, z = rr * math.cos(a), h, rr * math.sin(a)          # ring in XZ (axis Y)
            if axis == 'Z': x, y, z = rr * math.cos(a), rr * math.sin(a), h
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    for i in range(segs):
        a, b = rings[i], rings[(i + 1) % segs]
        for j in range(rsegs): bm.faces.new((a[j], b[j], b[(j + 1) % rsegs], a[(j + 1) % rsegs]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), loc, parent=parent, outline_t=ol)


def _clod(cz, name, loc, size, mat, parent, rnd, ol=0.004):
    sx, sy, sz = size
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=8, rings=5)
    for v in o.data.vertices:
        x, y, z = v.co; k = 0.78 + 0.35 * rnd.random()
        v.co = (x * k * sx, y * k * sy, max(z * k * sz, -0.01 - loc[2]))
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def build(cz, name='gb_bell_post', swing=0.0, clapper=0.0, plaque=True, pipe_depth=0.06):
    root = cz.empty(name)
    rnd = random.Random(7)
    pv_png, ph_png = _tex(cz, 'gb_bell_post_wood_v.png'), _tex(cz, 'gb_bell_post_wood_h.png')
    wv = cz.toon(name + '_woodv', '#685646', img=pv_png, proj='box', proj_scale=2.2, tex='grain', tex_strength=0.04) if pv_png else cz.toon(name + '_woodv', '#685646', tex='wood')
    wh = cz.toon(name + '_woodh', '#685646', img=ph_png, proj='box', proj_scale=2.2, tex='grain', tex_strength=0.04) if ph_png else cz.toon(name + '_woodh', '#685646', tex='wood')
    iron = cz.toon(name + '_iron', '#34302e', tex='grain', tex_strength=0.06)
    brass = cz.toon(name + '_brass', '#8c5c17', tex='grain', tex_strength=0.08)
    brass_in = cz.toon(name + '_brassin', '#3a260e', tex='grain', tex_strength=0.05)
    brass_hi = cz.toon(name + '_brasshi', '#c49432', tex='grain', tex_strength=0.05)
    rust = cz.toon(name + '_rust', '#5e3524', tex='grain', tex_strength=0.12, pattern=('speckle', 1.6, '#9a5428'))
    twine = cz.toon(name + '_twine', '#c9b483', tex='grain', tex_strength=0.06)
    dirt = cz.toon(name + '_dirt', '#4a3431', tex='grain', tex_strength=0.12, pattern=('speckle', 1.2, '#2e2224'))
    nailm = cz.toon(name + '_nail', '#2c2a2a')

    # ---- post, arm, brace
    cz.box(name + '_post', (0.09, 0.09, 1.70), (0, 0, 1.70 / 2 - 0.08), wv, bevel=0.008, ol=0.009, parent=root)
    cz.box(name + '_postcap', (0.105, 0.105, 0.025), (0, 0, 1.632), wh, bevel=0.006, ol=0.006, parent=root)
    cz.box(name + '_arm', (0.42, 0.07, 0.07), (0.17, 0, 1.565), wh, bevel=0.007, ol=0.008, parent=root)
    a = 44.0
    cz.box(name + '_brace', (0.30, 0.05, 0.045), (0.128, 0, 1.44), wh, rot=(0, -a, 0), bevel=0.005, ol=0.007, parent=root)
    for i, (x, y, z) in enumerate([(0.0, -0.046, 1.548), (0.0, -0.046, 1.582), (0.22, -0.036, 1.565), (0.215, -0.026, 1.505),
                                   (0.048, -0.026, 1.355), (0.0, -0.046, 1.36)]):
        cz.cyl(f'{name}_nail{i}', 0.0085, 0.006, (x, y + 0.004, z), nailm, rot=(90, 0, 0), verts=10, ol=0, parent=root)
    # ---- hood: two boards on a king post, a ridge cap
    rz, sl, bw = 1.73, 32.0, 0.225
    ca, sa = math.cos(math.radians(sl)), math.sin(math.radians(sl))
    for k, s in (('l', -1), ('r', 1)):
        cx = BELL[0] + s * (bw / 2) * ca
        cz.box(f'{name}_roof_{k}', (bw, 0.27, 0.022), (cx - s * 0.011 * sa * 0, 0, rz - (bw / 2) * sa + 0.011 * ca), wh,
               rot=(0, s * sl, 0), bevel=0.005, ol=0.008, parent=root)
    cz.box(name + '_ridge', (0.045, 0.285, 0.03), (BELL[0], 0, rz + 0.022), wh, bevel=0.006, ol=0.006, parent=root)
    cz.box(name + '_kingpost', (0.035, 0.035, rz - 1.60), (BELL[0], 0, 1.60 + (rz - 1.60) / 2), wv, bevel=0.004, ol=0.005, parent=root)
    # ---- iron yoke + pin under the arm end
    for k, y in (('f', -0.024), ('b', 0.024)):
        cz.box(f'{name}_yoke_{k}', (0.032, 0.008, 0.13), (BELL[0], y, 1.47), iron, bevel=0.002, ol=0.003, parent=root)
        cz.cyl(f'{name}_pinhead_{k}', 0.0095, 0.006, (BELL[0], y + (0.007 if y > 0 else -0.001), BELL[2]), iron, rot=(90, 0, 0), verts=12, ol=0, parent=root)
    cz.cyl(name + '_pin', 0.0055, 0.06, (BELL[0], 0.03, BELL[2]), iron, rot=(90, 0, 0), verts=12, ol=0, parent=root)
    cz.box(name + '_strap', (0.06, 0.075, 0.008), (BELL[0], 0, 1.534), iron, bevel=0.002, ol=0.003, parent=root)

    # ---- the bell on its pivot
    bp = cz.empty(name + '_bell', BELL, parent=root)
    bp.rotation_euler = (0, math.radians(swing), 0)
    _torus(cz, name + '_crown', 0.017, 0.0058, (0, 0, 0), brass, bp, ol=0.003, segs=20, rsegs=8)
    prof = [(0.0, -0.018), (0.024, -0.019), (0.037, -0.024), (0.046, -0.034), (0.050, -0.05), (0.053, -0.08), (0.057, -0.11),
            (0.064, -0.14), (0.074, -0.165), (0.084, -0.183), (0.088, -0.193), (0.085, -0.199),
            (0.075, -0.195), (0.067, -0.181), (0.058, -0.15), (0.051, -0.11), (0.046, -0.07), (0.039, -0.046), (0.0, -0.04)]
    _rev(cz, name + '_bellbody', prof, 36, (brass, brass_in), 11, (0, 0, 0), bp, 0.005)
    _torus(cz, name + '_band_lo', 0.0705, 0.0042, (0, 0, -0.158), brass_hi, bp, axis='Z', ol=0, segs=36, rsegs=6)
    _torus(cz, name + '_band_hi', 0.047, 0.0035, (0, 0, -0.036), brass_hi, bp, axis='Z', ol=0, segs=30, rsegs=6)
    # glint: a soft bright stroke on the front-left shoulder (follows the profile slant)
    gl = cz.sphere(name + '_glint', 1.0, (0, 0, 0), cz.glow(name + '_glintm', '#fff1c2', 1.6), ol=0, parent=bp, segs=12, rings=8)
    ang = math.radians(-118)
    for v in gl.data.vertices:
        x, y, z = v.co; x, y, z = x * 0.006, y * 0.003, z * 0.026
        t = math.radians(-18); x, z = x * math.cos(t) + z * math.sin(t), -x * math.sin(t) + z * math.cos(t)
        r0 = 0.0575
        v.co = (r0 * math.cos(ang) + x * math.cos(ang) - y * math.sin(ang), r0 * math.sin(ang) + x * math.sin(ang) + y * math.cos(ang), -0.105 + z)
    gl.data.update()
    # clapper (pivot at the crown inside the bell) + pull ring
    cp = cz.empty(name + '_clapper', (0, 0, -0.04), parent=bp)
    cp.rotation_euler = (0, math.radians(clapper), 0)
    cz.cyl(name + '_clap_rod', 0.0055, 0.165, (0, 0, -0.165), iron, verts=10, ol=0, parent=cp)
    cz.sphere(name + '_clap_ball', 0.021, (0, 0, -0.157), iron, ol=0.003, parent=cp, segs=16, rings=10)
    cz.cyl(name + '_clap_link', 0.0038, 0.036, (0, 0, -0.209), iron, verts=8, ol=0, parent=cp)
    _torus(cz, name + '_pullring', 0.022, 0.0046, (0, 0, -0.227), brass_hi, cp, ol=0.002, segs=20, rsegs=8)

    # ---- pipe + string
    pl = FOOT[2] + max(0.06, float(pipe_depth))      # pipe_depth: how far it runs underground (a cross-section shot: down to the coffin lid)
    cz.cyl(name + '_pipe', 0.02, pl, (FOOT[0], 0, FOOT[2] - pl), rust, verts=20, ol=0.005, parent=root)
    cz.cyl(name + '_pipecollar', 0.026, 0.026, (FOOT[0], 0, FOOT[2] - 0.03), rust, verts=20, bevel=0.003, ol=0.004, parent=root)
    cz.cyl(name + '_pipehole', 0.0145, 0.002, (FOOT[0], 0, FOOT[2] - 0.0005), cz.toon(name + '_hole', '#140e0c'), verts=16, ol=0, parent=root)
    S = TOP_Z - FOOT[2]
    st = cz.empty(name + '_string', FOOT, parent=root)
    cz.cyl(name + '_twine', 0.003, S, (0, 0, -0.004), twine, verts=8, ol=0, parent=st)
    cz.sphere(name + '_knot', 0.0065, (0, 0, S), twine, ol=0, parent=st, segs=10, rings=6)
    if abs(swing) > 1e-6 or abs(clapper) > 1e-6:   # follow the pull ring
        ry, sz = string_pose(swing, clapper)
        st.rotation_euler = (0, ry, 0); st.scale = (1, 1, sz)

    # ---- plaque
    if plaque:
        pq = cz.empty(name + '_plaque', (0, -0.045, 0.96), parent=root)
        pq.rotation_euler = (0, math.radians(3.5), 0)
        cz.box(name + '_plaqueboard', (0.27, 0.02, 0.175), (0, -0.01, 0), wh, bevel=0.005, ol=0.006, parent=pq)
        png = _tex(cz, 'gb_bell_post_plaque.png')
        if png:
            cz.plane(name + '_plaquepaint', 0.258, 0.162, (0, -0.0215, 0), cz.toon(name + '_plaquem', img=png, lift=0.55), parent=pq)
        for i, x in enumerate((-0.118, 0.118)):
            cz.cyl(f'{name}_pqnail{i}', 0.0075, 0.005, (x, -0.0205, 0.062 * (1 if i else -1) * 0), nailm, rot=(90, 0, 0), verts=10, ol=0, parent=pq)
            cz.box(f'{name}_pqrust{i}', (0.004, 0.0012, 0.03), (x + 0.002, -0.0222, -0.02), cz.toon(name + '_rstreak', '#5a3a2a'), bevel=0, ol=0, parent=pq)

    # ---- ground: dirt collar at the post foot and around the pipe
    for i in range(9):
        a2 = i / 9 * 2 * math.pi + rnd.uniform(-0.3, 0.3); r = rnd.uniform(0.07, 0.12)
        _clod(cz, f'{name}_clod{i}', (r * math.cos(a2), r * math.sin(a2), 0.0), (rnd.uniform(0.03, 0.05), rnd.uniform(0.03, 0.05), rnd.uniform(0.02, 0.035)), dirt, root, rnd)
    for i in range(5):
        a2 = i / 5 * 2 * math.pi + rnd.uniform(-0.3, 0.3); r = rnd.uniform(0.04, 0.06)
        _clod(cz, f'{name}_pclod{i}', (FOOT[0] + r * math.cos(a2), r * math.sin(a2), 0.0), (rnd.uniform(0.02, 0.03), rnd.uniform(0.02, 0.03), rnd.uniform(0.015, 0.025)), dirt, root, rnd)
    return root
