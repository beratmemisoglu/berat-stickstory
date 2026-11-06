# Cemetery wrought-iron fence run (BELL): square iron posts with a cap plate + ball every ~1.5 m on a low stone curb
# (blocks with joints), between them panels of square pickets with spear finials, a bottom rail, two top rails with a
# row of iron curls (spiral scrolls) between them. gate=True: a double gate in the middle (1.3 m opening, taller posts
# with big balls, leaves whose pickets rise toward the middle, curls, hinge barrels, a ring latch) under an iron arch
# with the cut-out letters CEMETERY (real 3D letters between two arched bars) and a small cross on the apex; the curb
# stops at the opening (a flat threshold stone instead). Dark green-black iron with a little rust (seamless PNG from
# tex/make_gb_iron_fence.py, box-projected), weathered grey stone. All pickets / finials / rails / curls of a panel are
# ONE mesh; all posts one mesh; the arch + letters one mesh; each gate leaf one mesh.
# Floor prop: root = floor centre of the run (z = 0), the run lies along X from -length/2 to +length/2 (post centres),
# the fence plane is y = 0 (curb 0.3 m deep centred on it); the street / camera side is -Y, the graveyard +Y.
# Animate: <name>_gateL / <name>_gateR (pivots at the hinges, rotation_euler.z). TESTED: gateL +z / gateR -z swing the
# leaves toward +Y (inward, into the graveyard); kw gate_open=0..1 does that (85 deg at 1), negative values open out.
import math, os, random, subprocess
import bmesh, bpy
from mathutils import Matrix, Quaternion, Vector

META = {'size': (3.2, 0.32, 1.37), 'size_gate': (3.2, 0.43, 2.18), 'size_note': 'x = length + 0.2 (curb overhang)',
        'anchor': 'floor centre of the run; fence plane y = 0, posts centred on x = +-length/2; camera / street side = -Y',
        'animate': ['_gateL (rotation_euler.z: + = swings in toward +Y)', '_gateR (rotation_euler.z: - = swings in toward +Y)'],
        'params': "length=3.0 (post centre to post centre), gate=False (double gate + CEMETERY arch in the middle; needs "
                  "length >= 2.1), gate_open=0.0 (0..1 opens both leaves inward 85 deg; < 0 opens them outward toward -Y), "
                  "seed=1 (a leaning picket, stone shades), iron='#26302c', stone='#625e58'",
        'gate': 'opening x -0.65..0.65 (leaves 0.64 m each), gate posts at x +-0.73, arch apex 2.0 m',
        'heights': 'curb top 0.16, finial tips 1.13, post balls top 1.37; gate post balls 1.88, arch cross top 2.18'}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
CURB_H, CURB_D = 0.16, 0.30
P_W, P_TOP = 0.12, 1.18           # posts: width, body top
GO, GP_W, GP_TOP = 0.65, 0.16, 1.62   # gate: half opening, gate post width / body top
PICK, PSTEP = 0.024, 0.13


def _png(cz, kind, hexcol):
    out = os.path.join(TEX, f'gb_iron_fence_{kind}_{hexcol.lstrip("#").lower()}.png')
    if os.path.exists(out): return out
    py = cz.py()
    try:
        subprocess.run([py, os.path.join(TEX, 'make_gb_iron_fence.py'), kind, out, hexcol], timeout=90, check=True,
                       capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e:
        print('CZ gb_iron_fence: png failed', e)
    return out if os.path.exists(out) else None


# ---------------------------------------------------------------- bmesh pieces
def _box(bm, c, s, rz=0.0):
    res = bmesh.ops.create_cube(bm, size=1.0)
    R = Matrix.Rotation(rz, 3, 'Y')
    for v in res['verts']: v.co = Vector(c) + R @ Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))


def _ball(bm, c, r, segs=16, rings=10):
    res = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    for v in res['verts']: v.co += Vector(c)
    for f in {f for v in res['verts'] for f in v.link_faces}: f.smooth = True


def _spear(bm, x, z0, h=0.13, w=0.058, t=0.024, y=0.0, lean=0.0):
    """Diamond spear finial standing on z0 (a collar below it)."""
    _box(bm, (x, y, z0 - 0.004), (0.036, 0.034, 0.014))
    zm = z0 + 0.36 * h
    b = bm.verts.new((x, y, z0)); tp = bm.verts.new((x + lean * h, y, z0 + h))
    m = [bm.verts.new(p) for p in ((x - w / 2, y, zm), (x, y - t / 2, zm), (x + w / 2, y, zm), (x, y + t / 2, zm))]
    for k in range(4):
        a, c = m[k], m[(k + 1) % 4]
        bm.faces.new((b, c, a)); bm.faces.new((a, c, tp))


def _sweep(bm, pts, r, segs=6):
    """Round tube along the polyline pts (fan caps), smooth shaded."""
    pts = [Vector(p) for p in pts]; n = len(pts) - 1
    T = [(pts[min(n, i + 1)] - pts[max(0, i - 1)]).normalized() for i in range(n + 1)]
    ref = Vector((0, 1, 0)) if abs(T[0].y) < 0.9 else Vector((1, 0, 0))
    N = [T[0].cross(ref).normalized()]
    for i in range(1, n + 1):
        b = T[i - 1].cross(T[i]); nv = N[-1]
        if b.length > 1e-8:
            b.normalize(); nv = Quaternion(b, math.acos(max(-1.0, min(1.0, T[i - 1].dot(T[i]))))) @ nv
        N.append((nv - T[i] * nv.dot(T[i])).normalized())
    rings = []
    for i in range(n + 1):
        B = T[i].cross(N[i])
        rings.append([bm.verts.new(pts[i] + (N[i] * math.cos(2 * math.pi * j / segs) + B * math.sin(2 * math.pi * j / segs)) * r)
                      for j in range(segs)])
    fs = []
    for i in range(n):
        for j in range(segs):
            j2 = (j + 1) % segs
            fs.append(bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j])))
    c0, c1 = bm.verts.new(pts[0] - T[0] * r * 0.5), bm.verts.new(pts[-1] + T[-1] * r * 0.5)
    for j in range(segs):
        j2 = (j + 1) % segs
        fs.append(bm.faces.new((c0, rings[0][j2], rings[0][j]))); fs.append(bm.faces.new((rings[-1][j], rings[-1][j2], c1)))
    for f in fs: f.smooth = True


def _bar_path(bm, pts, h, d):
    """Flat bar (h tall in the XZ plane, d deep in Y) swept along the XZ polyline pts, capped."""
    pts = [Vector(p) for p in pts]; n = len(pts) - 1; quads = []
    for i in range(n + 1):
        tg = (pts[min(n, i + 1)] - pts[max(0, i - 1)]).normalized()
        nz = Vector((-tg.z, 0, tg.x))           # in-plane normal (points up for a left-to-right path)
        quads.append([bm.verts.new(pts[i] + nz * sz * h / 2 + Vector((0, sy * d / 2, 0))) for sz, sy in ((1, -1), (1, 1), (-1, 1), (-1, -1))])
    for i in range(n):
        a, b = quads[i], quads[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    bm.faces.new(quads[0][::-1]); bm.faces.new(quads[-1])


def _curl(bm, cx, cz, R, hand=1, y=0.0, r=0.0065, turns=1.15, start=-90.0):
    n = 26; pts = []
    for k in range(n):
        u = k / (n - 1); th = math.radians(start) + u * turns * 2 * math.pi
        rr = R * (1 - 0.74 * u)
        pts.append((cx + hand * rr * math.cos(th), y, cz + rr * math.sin(th)))
    _sweep(bm, pts, r, 6)


def _obj(cz, name, bm, mat, parent, ol, loc=(0, 0, 0)):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mat, smooth=False)
    return cz.place(o, loc=loc, parent=parent, outline_t=ol)


# ---------------------------------------------------------------- panels
Z_BOT, Z_R1, Z_R2, Z_FIN = 0.24, 0.85, 0.99, 1.0


def _panel(bm, x0, x1, rnd, rise=None, curls=True):
    """Pickets + finials + rails + curl row between x0 and x1 (inner faces). rise(x) -> extra picket height (gates)."""
    span = x1 - x0
    n = max(1, int(round(span / PSTEP)))
    step = span / n
    for zr, hh in ((Z_BOT, 0.04), (Z_R1, 0.032), (Z_R2, 0.04)):
        _box(bm, ((x0 + x1) / 2, 0, zr), (span + 0.02, 0.03, hh))
    xs = [x0 + step * (k + 0.5) for k in range(n)]
    lean_i = rnd.randrange(len(xs)) if (rnd.random() < 0.5 and rise is None) else -1
    for i, x in enumerate(xs):
        top = Z_FIN + (rise(x) if rise else 0.0)
        ln = 0.035 if i == lean_i else 0.0
        _box(bm, (x + ln * 0.5, 0, (0.14 + top) / 2), (PICK, PICK, top - 0.14), rz=ln)
        _spear(bm, x + ln * (top - 0.14) * 0.97, top - 0.004, lean=ln * 0.6)
    if curls:
        gaps = [(xs[i] + xs[i + 1]) / 2 for i in range(len(xs) - 1)]
        R = min(0.052, (step - PICK) / 2 - 0.002)
        for i, gx in enumerate(gaps):
            _curl(bm, gx, (Z_R1 + Z_R2) / 2 + 0.004, R, hand=1 if i % 2 else -1, start=-90 if i % 2 else 90)
    return xs


def build(cz, name='gb_iron_fence', length=3.0, gate=False, gate_open=0.0, seed=1, iron='#26302c', stone='#625e58'):
    rnd = random.Random(seed)
    L = max(0.6, float(length)); gate = bool(gate) and L >= 2.1
    root = cz.empty(name)
    ip, sp = _png(cz, 'iron', iron), _png(cz, 'stone', stone)
    im = cz.toon(name + '_iron', iron, img=ip, proj='box', proj_scale=2.0) if ip else cz.toon(name + '_iron', iron, tex='grain', tex_strength=0.08)
    sm = cz.toon(name + '_stone', stone, img=sp, proj='box', proj_scale=1.4) if sp else cz.toon(name + '_stone', stone, tex='grain', tex_strength=0.08)

    # ---- post positions (centres) and panel runs
    gp = GO + GP_W / 2
    if gate:
        runs = [(-L / 2, -gp), (gp, L / 2)]
    else:
        runs = [(-L / 2, L / 2)]
    posts = []
    for a, b in runs:
        if b - a < 0.25: continue
        n = max(1, math.ceil((b - a) / 1.5 - 1e-6))
        for k in range(n + 1):
            x = a + (b - a) * k / n
            if gate and abs(abs(x) - gp) < 1e-6: continue
            posts.append(x)
    posts = sorted(set(round(x, 5) for x in posts))

    # ---- curb (stone blocks with joints), threshold in the gate opening
    bm = bmesh.new()
    cut = (-GO, GO) if gate else None
    segs = [(-L / 2 - 0.1, cut[0]), (cut[1], L / 2 + 0.1)] if cut else [(-L / 2 - 0.1, L / 2 + 0.1)]
    for a, b in segs:
        nb = max(1, int(round((b - a) / 0.75))); w = (b - a) / nb
        for k in range(nb):
            h = CURB_H + rnd.uniform(-0.008, 0.008)
            _box(bm, (a + w * (k + 0.5), rnd.uniform(-0.004, 0.004), h / 2 - 0.02), (w - 0.012, CURB_D, h + 0.04))
    if gate:
        _box(bm, (0, 0, 0.015), (2 * GO + 0.02, CURB_D + 0.12, 0.07))
    _obj(cz, name + '_curb', bm, sm, root, 0.009)

    # ---- posts: body, cap plate, neck, ball
    bm = bmesh.new()
    for x in posts:
        _box(bm, (x, 0, (CURB_H - 0.02 + P_TOP) / 2), (P_W, P_W, P_TOP - CURB_H + 0.02))
        _box(bm, (x, 0, P_TOP + 0.015), (P_W + 0.04, P_W + 0.04, 0.03))
        _box(bm, (x, 0, P_TOP + 0.045), (0.05, 0.05, 0.04))
        _ball(bm, (x, 0, P_TOP + 0.06 + 0.06), 0.065)
    if gate:
        for sx in (-1, 1):
            x = sx * gp
            _box(bm, (x, 0, GP_TOP / 2), (GP_W, GP_W, GP_TOP))
            _box(bm, (x, 0, 0.12), (GP_W + 0.05, GP_W + 0.05, 0.24))          # plinth band
            _box(bm, (x, 0, GP_TOP + 0.02), (GP_W + 0.05, GP_W + 0.05, 0.04))
            _box(bm, (x, 0, GP_TOP + 0.06), (0.07, 0.07, 0.05))
            _ball(bm, (x, 0, GP_TOP + 0.085 + 0.085), 0.085)
            # hinge barrels on the opening side
            for zh in (0.3, 0.95):
                res = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.022, radius2=0.022, depth=0.1)
                for v in res['verts']: v.co += Vector((sx * (GO + 0.012), -0.02, zh))
    _obj(cz, name + '_posts', bm, im, root, 0.008)

    # ---- panels between neighbouring posts (not across the gate opening)
    bm = bmesh.new()
    allp = sorted(posts + ([-gp, gp] if gate else []))
    for a, b in zip(allp, allp[1:]):
        if gate and a < 0 < b: continue
        wa = GP_W if gate and abs(abs(a) - gp) < 1e-6 else P_W
        wb = GP_W if gate and abs(abs(b) - gp) < 1e-6 else P_W
        _panel(bm, a + wa / 2, b - wb / 2, rnd)
    if len(bm.verts): _obj(cz, name + '_panels', bm, im, root, 0.005)
    else: bm.free()

    if gate:
        _gate(cz, name, root, im, rnd, float(gate_open))
        _arch(cz, name, root, im, gp)
    return root


def _gate(cz, name, root, im, rnd, gate_open):
    W = GO - 0.008              # leaf width from the hinge to the meeting stile
    for side, sx in (('L', -1), ('R', 1)):
        piv = cz.empty(f'{name}_gate{side}', (sx * GO, 0, 0), parent=root)
        bm = bmesh.new()
        d = -sx                 # leaf extends from the hinge toward the middle (local +X for L, -X for R)
        # stiles
        for xl in (0.03, W - 0.022):
            _box(bm, (d * xl, 0, (0.08 + 1.08) / 2), (0.036, 0.036, 1.0))
        x0, x1 = sorted((d * 0.05, d * (W - 0.042)))

        def rise(x): return 0.2 * (abs(x) / W) ** 1.6
        for zr, hh in ((0.12, 0.04), (Z_R1, 0.032), (Z_R2, 0.04)):
            _box(bm, (d * W / 2, 0, zr), (W - 0.01, 0.03, hh))
        n = 5; step = (x1 - x0) / n
        xs = [x0 + step * (k + 0.5) for k in range(n)]
        for x in xs:
            top = Z_FIN + rise(x) + 0.04
            _box(bm, (x, 0, (0.1 + top) / 2), (PICK, PICK, top - 0.1))
            _spear(bm, x, top - 0.004)
        _spear(bm, d * (W - 0.022), 1.08, h=0.12)
        _spear(bm, d * 0.03, 1.08, h=0.12)
        for i in range(n - 1):
            gx = (xs[i] + xs[i + 1]) / 2
            _curl(bm, gx, (Z_R1 + Z_R2) / 2 + 0.004, min(0.052, (abs(step) - PICK) / 2 - 0.002), hand=1 if i % 2 else -1,
                  start=-90 if i % 2 else 90)
        # lower panel: a big double scroll between the bottom rail and rail 1
        for k in (-1, 1):
            _curl(bm, d * W / 2 + k * 0.1, 0.42, 0.1, hand=k, start=90, turns=1.25, r=0.008)
        # latch ring on the meeting stile (right leaf only) + hinge straps
        if side == 'R':
            ring = [(d * (W - 0.03) - 0.0 + 0.05 * math.cos(a) * d, -0.03, 0.62 + 0.05 * math.sin(a))
                    for a in [k / 20 * 2 * math.pi for k in range(21)]]
            _sweep(bm, ring, 0.007, 6)
        for zh in (0.3, 0.95):
            _box(bm, (d * 0.1, -0.019, zh), (0.18, 0.006, 0.03))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = cz._mesh_obj(f'{name}_leaf{side}', bm, im, smooth=False)
        cz.place(o, parent=piv, outline_t=0.005)
        # TESTED: L +z and R -z swing the leaves toward +Y (inward)
        piv.rotation_euler.z = math.radians(85.0 * gate_open) * (1 if side == 'L' else -1)


def _arc(a, zs, za, n=28):
    """Circle arc through (-a, zs), (0, za), (a, zs): list of (x, z) and z(x)."""
    h = za - zs; R = (a * a + h * h) / (2 * h); zc = za - R

    def zf(x): return zc + math.sqrt(max(0.0, R * R - x * x))
    return [(-a + 2 * a * k / n, zf(-a + 2 * a * k / n)) for k in range(n + 1)], zf


def _arch(cz, name, root, im, gp):
    a = gp - GP_W / 2 + 0.005
    lo_pts, zlo = _arc(a, 1.40, 1.70)
    hi_pts, zhi = _arc(a, 1.60, 1.93)
    bm = bmesh.new()
    _bar_path(bm, [(x, 0, z) for x, z in lo_pts], 0.045, 0.034)
    _bar_path(bm, [(x, 0, z) for x, z in hi_pts], 0.05, 0.034)
    # end ties into the posts + spandrel curls below the low bar
    for sx in (-1, 1):
        _box(bm, (sx * (a - 0.02), 0, 1.5), (0.04, 0.034, 0.26))
        # spandrel curl: its outer turn touches the post and hangs from the low bar (v1 floated in the air)
        R = 0.085; cx = sx * (a - R - 0.004); czc = zlo(cx) - 0.0225 - R + 0.006
        _curl(bm, cx, czc, R, hand=-sx, start=90, turns=1.2, r=0.0075)
    # a small cross on the apex
    _box(bm, (0, 0, 1.93 + 0.13), (0.03, 0.03, 0.24))
    _box(bm, (0, 0, 1.93 + 0.165), (0.13, 0.03, 0.03))
    # letters: real 3D text, converted to mesh, laid out along the middle of the band, tilted with it
    word = 'CEMETERY'; size = 0.185; ex = 0.011
    dg = bpy.context.evaluated_depsgraph_get()
    metas = []
    for i, ch in enumerate(word):
        t = cz.text(f'{name}_tmp{i}', ch, size=size, loc=(0, 0, 0), mat=im, rot=(0, 0, 0), extrude=ex)
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(t.evaluated_get(dg))
        xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
        metas.append((me, min(xs), max(xs), min(ys), max(ys)))
        cu = t.data; bpy.data.objects.remove(t); bpy.data.curves.remove(cu)
    gap = 0.011
    widths = [m[2] - m[1] for m in metas]
    tot = sum(widths) + gap * (len(word) - 1)
    x = -tot / 2
    for (me, x0, x1, y0, y1), w in zip(metas, widths):
        cx = x + w / 2; x += w + gap
        zc = (zlo(cx) + zhi(cx)) / 2
        e = 0.002; slope = ((zlo(cx + e) + zhi(cx + e)) - (zlo(cx - e) + zhi(cx - e))) / (4 * e)
        tilt = math.atan(-slope)
        M = (Matrix.Translation((cx, 0, zc)) @ Matrix.Rotation(tilt, 4, 'Y') @ Matrix.Rotation(math.radians(90), 4, 'X')
             @ Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, 0)))
        me.transform(M)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    _obj(cz, name + '_arch', bm, im, root, 0.005)
