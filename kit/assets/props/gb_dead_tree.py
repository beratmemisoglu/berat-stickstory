# Dead tree (BELL, the graveyard): a gnarled leafless tree. A twisted trunk (spiralling bark ridges, root flare, four
# roots sprawling on the ground, a knot hollow facing the camera: a dark dent ringed by a bark lip, a broken stub),
# four main limbs reaching up and out, each forking into crooked branches -> twigs -> fine twigs (4 levels), every one a
# tapered tube along a bent path. Painted dark grey-brown bark (seamless PNG from tex/make_gb_dead_tree.py, UV-mapped
# along each branch so the fissures follow the wood). Tubes of one level are ONE mesh (4 meshes in all), outlines
# 10 mm on the trunk / limbs / roots, 6 mm on branches, 3 mm on twigs. crow=True: a black crow (yellow beak, pale
# eyes) sitting on a main limb, in profile, turned 25 deg toward the camera.
# Floor prop: root at the trunk base on the floor (roots dip 4 cm below z = 0); height 3.6 m * size (exact: the tree is
# scaled to it), ~4.3 x 1.7 m spread (seed 3). mirror=True flips it left-right.
# Animate: <name>_crow (empty at the crow's feet: rotation_euler.z turns it, location hops it; its forward is local +X).
import hashlib, math, os, random, subprocess
import bmesh
from mathutils import Matrix, Quaternion, Vector

META = {'size': (4.3, 1.7, 3.6), 'anchor': 'floor centre at the trunk base (roots dip 0.04 m below z = 0)',
        'animate': ['_crow (empty at the crow\'s feet; rotation_euler.z / location; forward = local +X)'],
        'params': "size=1.0 (uniform; height = 3.6 m * size), seed=3 (branch layout), mirror=False (flip left-right), "
                  "crow=False (black crow on a main limb), bark='#4d4239'",
        'hollow': 'knot hollow on the trunk at ~0.95 m * size facing -Y', 'crow_at': 'META is static: find <name>_crow for the spot'}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
TILE = 0.5          # bark tile size in metres (around and along)


def _bark_png(cz, hexcol):
    out = cz.gen_path(TEX, f'gb_dead_tree_bark_{hexcol.lstrip("#").lower()}.png')
    if os.path.exists(out): return out
    py = cz.py()
    try:
        subprocess.run([py, os.path.join(TEX, 'make_gb_dead_tree.py'), out, hexcol], timeout=90, check=True,
                       capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e:
        print('CZ gb_dead_tree: png failed', e)
    return out if os.path.exists(out) else None


def _cr(a, b, c, d, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)


def _path(pts, n):
    P = [pts[0]] + list(pts) + [pts[-1]]; seg = len(pts) - 1
    S = []
    for i in range(n + 1):
        u = i / n * seg; j = min(seg - 1, int(u)); k = u - j
        S.append(_cr(P[j], P[j + 1], P[j + 2], P[j + 3], k))
    return S


def _frames(S):
    n = len(S) - 1
    T = [(S[min(n, i + 1)] - S[max(0, i - 1)]).normalized() for i in range(n + 1)]
    ref = Vector((0, 0, 1)) if abs(T[0].z) < 0.9 else Vector((1, 0, 0))
    N = [T[0].cross(ref).normalized()]
    for i in range(1, n + 1):
        b = T[i - 1].cross(T[i]); nv = N[-1]
        if b.length > 1e-8:
            b.normalize(); nv = Quaternion(b, math.acos(max(-1.0, min(1.0, T[i - 1].dot(T[i]))))) @ nv
        N.append((nv - T[i] * nv.dot(T[i])).normalized())
    L = [0.0]
    for i in range(1, n + 1): L.append(L[-1] + (S[i] - S[i - 1]).length)
    return T, N, L


def _tube(bm, uvl, S, rad, segs, ridges=0, amp=0.0, twist=0.0, dent=None, tip=0.8):
    """Closed tapered tube along the sampled curve S (base cap + pointed tip), UVs: u around, v along (TILE m)."""
    T, N, L = _frames(S); tot = max(1e-6, L[-1]); n = len(S) - 1
    uu = max(1, round(2 * math.pi * rad(0.0) / TILE))
    rings = []
    for i in range(n + 1):
        t = L[i] / tot; B = T[i].cross(N[i]); r = rad(t); ring = []
        for j in range(segs):
            th = 2 * math.pi * j / segs
            rr = r * (1 + amp * math.sin(ridges * th + twist * 2 * math.pi * t))
            if dent: rr -= dent(i, th, rr)
            ring.append(bm.verts.new(S[i] + (N[i] * math.cos(th) + B * math.sin(th)) * rr))
        rings.append(ring)
    for i in range(n):
        for j in range(segs):
            j2 = (j + 1) % segs
            f = bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
            u0, u1 = j / segs * uu, (j + 1) / segs * uu; v0, v1 = L[i] / TILE, L[i + 1] / TILE
            for lp, uv in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))): lp[uvl].uv = uv
            if dent and dent(i + 0.5, 2 * math.pi * (j + 0.5) / segs, None, face=True): f.material_index = 1
    c0 = bm.verts.new(S[0] - T[0] * rad(0.0) * 0.3)
    c1 = bm.verts.new(S[-1] + T[-1] * rad(1.0) * tip)
    for j in range(segs):
        j2 = (j + 1) % segs
        f = bm.faces.new((c0, rings[0][j2], rings[0][j]))
        for lp in f.loops: lp[uvl].uv = (j / segs * uu, 0.0)
        f = bm.faces.new((rings[-1][j], rings[-1][j2], c1))
        for lp in f.loops: lp[uvl].uv = (j / segs * uu, L[-1] / TILE)
    return S, T, N, L


def _loop_tube(bm, uvl, P, outward, r, segs=8):
    """Closed ring tube through the closed point list P; outward(k) = the surface normal at P[k]."""
    K = len(P); rings = []
    for k in range(K):
        Tk = (P[(k + 1) % K] - P[k - 1]).normalized(); Nk = outward(k); Nk = (Nk - Tk * Nk.dot(Tk)).normalized()
        Bk = Tk.cross(Nk); rk = r(k)
        rings.append([bm.verts.new(P[k] + (Nk * math.cos(2 * math.pi * j / segs) + Bk * math.sin(2 * math.pi * j / segs)) * rk)
                      for j in range(segs)])
    for k in range(K):
        a, b = rings[k], rings[(k + 1) % K]
        for j in range(segs):
            j2 = (j + 1) % segs
            f = bm.faces.new((a[j], a[j2], b[j2], b[j]))
            for lp, uv in zip(f.loops, ((j / segs, k / K), ((j + 1) / segs, k / K), ((j + 1) / segs, (k + 1) / K), (j / segs, (k + 1) / K))):
                lp[uvl].uv = uv


def _obj(cz, name, bm, mats, parent, ol):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mats[0], smooth=True)
    for m in mats[1:]: o.data.materials.append(m)
    return cz.place(o, parent=parent, outline_t=ol)


def build(cz, name='gb_dead_tree', size=1.0, seed=3, mirror=False, crow=False, bark='#4d4239'):
    rnd = random.Random(seed)
    s = float(size); fx = -1.0 if mirror else 1.0
    root = cz.empty(name)
    png = _bark_png(cz, bark)
    bm_ = cz.toon(name + '_bark', bark, img=png) if png else cz.toon(name + '_bark', bark, tex='wood', tex_scale=2.5, tex_strength=0.12)
    holm = cz.toon(name + '_hollow', '#1a1310', lift=0.9)

    def J(a): return rnd.uniform(-a, a)

    # ---------------------------------------------------------------- layout (unscaled, then fitted to 3.6 m)
    tubes = []    # dicts: pts, r0, r1, group, segs, n, kind
    trunk = [Vector(p) for p in ((0, 0, -0.06), (0.05 + J(0.03), 0, 0.45), (-0.1 + J(0.05), 0.03, 1.0),
                                  (0.1 + J(0.05), -0.02, 1.55), (0.0 + J(0.05), 0.02, 2.0), (-0.1 + J(0.05), 0.0, 2.38))]
    TR0 = 0.23
    def trad(t): return TR0 * (1 - 0.6 * t) + 0.17 * max(0.0, 1 - t / 0.09) ** 2
    tubes.append(dict(pts=trunk, rad=trad, group=0, segs=28, n=80, kind='trunk'))

    def crooked(p0, d0, length, nseg, crook, up):
        pts = [p0.copy()]; d = d0.normalized(); p = p0.copy()
        for k in range(nseg):
            rv = Vector((J(1), J(1) * 0.55, J(1)))
            d = (d + rv * crook + Vector((0, 0, up))).normalized()
            p = p + d * (length / nseg); pts.append(p.copy())
        return pts

    def at(S, t):
        i = min(len(S) - 2, int(t * (len(S) - 1)))
        return S[i], (S[i + 1] - S[i]).normalized()

    trunkS = _path(trunk, 80)
    # (t on the trunk, direction, length, radius vs the trunk there, upward drift per step)
    limbs = [(0.55, (-1.0, -0.15, 0.32), 1.75, 0.66, 0.05), (0.72, (1.0, 0.1, 0.38), 1.8, 0.66, 0.05),
             (0.985, (-0.12, 0.1, 1.0), 1.0, 0.95, 0.08), (0.86, (0.55, -0.55, 0.62), 1.25, 0.6, 0.06)]
    for (t, d, ln, rk, up) in limbs:
        p, _ = at(trunkS, t)
        d = Vector(d) + Vector((J(0.12), J(0.1), J(0.12)))
        r0 = trad(t) * rk
        pts = crooked(p, d, ln * (1 + J(0.1)), 5, 0.45, up)
        tubes.append(dict(pts=pts, rad=(lambda r0: lambda u: r0 * (1 - 0.7 * u))(r0), group=0, segs=14, n=26, kind='limb',
                          r0=r0, len=ln))
    # broken stub low on the trunk (blunt end)
    p, _ = at(trunkS, 0.4)
    stub = crooked(p, Vector((0.9, -0.35, 0.25)), 0.42, 2, 0.2, 0.0)
    tubes.append(dict(pts=stub, rad=lambda u: 0.075 * (1 - 0.25 * u), group=0, segs=12, n=8, kind='stub', tip=0.15))
    # splinters on the broken end (a sawn-off look otherwise)
    se, sd = stub[-1], (stub[-1] - stub[-2]).normalized()
    for k in range(4):
        a = 2 * math.pi * k / 4 + J(0.4)
        off = Vector((0, math.cos(a), math.sin(a))) * 0.035
        d = sd + off * 4 + Vector((J(0.3), J(0.3), J(0.3)))
        p0 = se - sd * 0.03 + off
        tubes.append(dict(pts=[p0, p0 + d.normalized() * rnd.uniform(0.07, 0.12)], rad=lambda u: 0.022 * (1 - 0.85 * u),
                          group=1, segs=6, n=3, kind='splinter', tip=0.5))
    # roots
    for k, (ax, ay) in enumerate(((0.75, -0.3), (-0.62, -0.42), (-0.35, 0.55), (0.45, 0.5))):
        rp = [Vector((0, 0, 0.32)), Vector((ax * 0.42, ay * 0.42, 0.11)), Vector((ax, ay, -0.04))]
        tubes.append(dict(pts=rp, rad=lambda u: 0.1 * (1 - 0.65 * u), group=0, segs=12, n=14, kind='root'))

    # branches: L2 off limbs, L3 off L2, L4 twigs off L3
    def spawn(parent, count, lenk, group, kind, segs, n, rk, tmin=0.35):
        S = _path(parent['pts'], 20); out = []
        ts = sorted(rnd.uniform(tmin, 0.93) for _ in range(count))
        for t in ts:
            p, tg = at(S, t)
            side = Vector((J(1), J(1) * 0.5, J(1))); side = (side - tg * side.dot(tg))
            if side.length < 1e-4: side = Vector((1, 0, 0))
            d = tg + side.normalized() * rnd.uniform(0.75, 1.15) + Vector((0, 0, 0.15))
            pr = parent['rad'](t)
            r0 = max(0.006, pr * rk); ln = parent['len'] * lenk * (1 + J(0.15))
            pts = crooked(p, d, ln, 4 if group < 2 else 3, 0.6, 0.03)
            r1 = 0.0035 if group >= 2 else r0 * 0.28
            out.append(dict(pts=pts, rad=(lambda r0, r1: lambda u: r0 + (r1 - r0) * u)(r0, r1), group=group, segs=segs, n=n,
                            kind=kind, len=ln))
        return out

    L2 = []
    for lb in [t for t in tubes if t['kind'] == 'limb']:
        L2 += spawn(lb, rnd.choice((2, 3, 3)), 0.55, 1, 'branch', 10, 16, 0.72)
    L3 = []
    for b in L2: L3 += spawn(b, 2, 0.55, 2, 'twig', 7, 10, 0.72, 0.4)
    L4 = []
    for b in L3:
        if rnd.random() < 0.6: L4 += spawn(b, 1, 0.55, 2, 'fine', 6, 8, 0.7, 0.45)
    tubes += L2 + L3 + L4

    # fit: height 3.6 * size; mirror
    zmax = max(p.z for t in tubes for p in t['pts'])
    k = 3.6 * s / zmax
    for t in tubes:
        t['pts'] = [Vector((p.x * k * fx, p.y * k, p.z * k)) for p in t['pts']]
        t['rad'] = (lambda f, k: lambda u: f(u) * k)(t['rad'], k)

    # ---------------------------------------------------------------- meshes (one per group)
    groups = [bmesh.new() for _ in range(3)]
    uvls = [g.loops.layers.uv.new('UVMap') for g in groups]
    limb_frames = []
    for t in tubes:
        g = t['group']; S = _path(t['pts'], t['n'])
        if t['kind'] == 'trunk':
            T_, N_, L_ = _frames(S); tot = L_[-1]
            # knot hollow facing -Y (a little toward the tree's open side), centred at 0.95 m * size
            i0 = min(range(len(S)), key=lambda i: abs(S[i].z - 0.95 * s))
            s0 = L_[i0]; HA, HB, DEPTH = 0.075 * s, 0.135 * s, 0.07 * s
            want = Vector((-0.25 * fx, -1, 0)).normalized()
            phi0 = []
            for i in range(len(S)):
                B = T_[i].cross(N_[i]); d = want - T_[i] * want.dot(T_[i])
                phi0.append(math.atan2(d.dot(B), d.dot(N_[i])))

            def qd(fi, th, r):
                i = int(min(len(S) - 1, max(0, round(fi))))
                dph = (th - phi0[i] + math.pi) % (2 * math.pi) - math.pi
                rr = r if r else trad_k(L_[i] / tot)
                s_ = L_[i] if fi == int(fi) else 0.5 * (L_[int(fi)] + L_[min(len(S) - 1, int(fi) + 1)])
                return (dph * rr / HA) ** 2 + ((s_ - s0) / HB) ** 2
            trad_k = t['rad']

            def dent(fi, th, r, face=False):
                q = qd(fi, th, r)
                if face: return q < 1.0
                return DEPTH * math.sqrt(max(0.0, 1 - q)) if q < 1 else 0.0
            _tube(groups[g], uvls[g], S, t['rad'], t['segs'], ridges=6, amp=0.06, twist=1.2, dent=dent, tip=1.2)
            # the bark lip around the hollow
            P, NO = [], []
            for kk in range(28):
                a = 2 * math.pi * kk / 28
                sk = s0 + 1.04 * HB * math.sin(a)
                i = min(range(len(S)), key=lambda ii: abs(L_[ii] - sk))
                rr = trad_k(L_[i] / tot); th = phi0[i] + 1.04 * HA * math.cos(a) / rr
                rr *= 1 + 0.06 * math.sin(6 * th + 1.2 * 2 * math.pi * L_[i] / tot)
                B = T_[i].cross(N_[i]); dv = N_[i] * math.cos(th) + B * math.sin(th)
                P.append(S[i] + dv * (rr - 0.004 * s)); NO.append(dv)
            _loop_tube(groups[0], uvls[0], P, lambda kk: NO[kk], lambda kk: s * (0.024 + 0.008 * math.sin(2 * math.pi * kk / 28 - 1.2)), 8)
        else:
            res = _tube(groups[g], uvls[g], S, t['rad'], t['segs'], ridges=3 if g == 0 else 0, amp=0.05 if g == 0 else 0.0,
                        twist=0.6, tip=t.get('tip', 0.8))
            if t['kind'] == 'limb': limb_frames.append((S, res[1], t['rad'], res[3]))
    _obj(cz, name + '_trunk', groups[0], [bm_, holm], root, 0.01 * max(0.6, s))
    _obj(cz, name + '_branches', groups[1], [bm_], root, 0.006 * max(0.6, s))
    _obj(cz, name + '_twigs', groups[2], [bm_], root, 0.003)

    # ---------------------------------------------------------------- crow
    if crow:
        best = None
        for (S, T_, rad, L_) in limb_frames:
            for i in range(int(len(S) * 0.3), int(len(S) * 0.7)):
                sc = abs(T_[i].z) - 0.0005 * S[i].z    # most horizontal spot (lower wins ties)
                if best is None or sc < best[0]: best = (sc, S[i], T_[i], rad(L_[i] / L_[-1]))
        _, p, tg, r = best
        fwd = 1.0 if p.x >= 0 else -1.0          # look outward, away from the trunk
        crow_e = cz.empty(name + '_crow', tuple(p + Vector((0, 0, r * 0.92))), parent=root)
        crow_e.rotation_euler.z = math.radians(-25) if fwd > 0 else math.radians(205)
        _crow(cz, name, crow_e, s)
    return root


def _ellipsoid(bm, c, r, pitch=0.0, segs=20, rings=12):
    res = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    R = Matrix.Rotation(math.radians(pitch), 3, 'Y')
    for v in res['verts']: v.co = Vector(c) + R @ Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
    return res['verts']


def _crow(cz, name, parent, s):
    k = 1.0
    body = cz.toon(name + '_crowm', '#1b1d25', tex='grain', tex_strength=0.04)
    wing = cz.toon(name + '_crowwing', '#2b3142', tex='grain', tex_strength=0.05)
    bm = bmesh.new()
    _ellipsoid(bm, (0.0, 0, 0.11), (0.12, 0.072, 0.082), pitch=-18)
    _ellipsoid(bm, (0.105, 0, 0.205), (0.06, 0.054, 0.056))
    # fanned tail: a tapered slab out the back, tipped down
    res = bmesh.ops.create_cube(bm, size=1.0)
    for v in res['verts']:
        u = v.co.x + 0.5                          # 0 at the body, 1 at the tip
        x = -0.06 - 0.2 * u; w = 0.045 + 0.05 * u; z = 0.1 - 0.08 * u + v.co.z * 0.022
        v.co = Vector((x, v.co.y * w, z))
    # legs + toes
    for sy in (-1, 1):
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.009, radius2=0.009, depth=0.07)
        for v in res['verts']: v.co = Vector((v.co.x + 0.02, v.co.y + sy * 0.03, v.co.z + 0.035))
        res = bmesh.ops.create_cube(bm, size=1.0)
        for v in res['verts']: v.co = Vector((0.03 + v.co.x * 0.07, sy * 0.03 + v.co.y * 0.018, 0.006 + v.co.z * 0.012))
    nb = len(bm.faces)
    for sy in (-1, 1):
        _ellipsoid(bm, (-0.015, sy * 0.06, 0.12), (0.1, 0.022, 0.058), pitch=-14, segs=14, rings=8)
    for i, f in enumerate(bm.faces):
        if i >= nb: f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name + '_crowbody', bm, body, smooth=True); o.data.materials.append(wing)
    cz.place(o, parent=parent, outline_t=0.006)
    # beak (yellow, pointing forward +X)
    bmb = bmesh.new()
    res = bmesh.ops.create_cone(bmb, cap_ends=True, segments=10, radius1=0.024, radius2=0.002, depth=0.085)
    R = Matrix.Rotation(math.radians(90), 3, 'Y')
    for v in res['verts']: v.co = Vector((0.192, 0, 0.198)) + R @ Vector((v.co.x, v.co.y * 0.8, v.co.z))
    ob = cz._mesh_obj(name + '_crowbeak', bmb, cz.toon(name + '_beakm', '#e0a020', tex='grain', tex_strength=0.03), smooth=True)
    cz.place(ob, parent=parent, outline_t=0.003)
    # eyes: pale yellow with a dark pupil, both sides
    bme = bmesh.new(); npf = 0
    for sy in (-1, 1):
        _ellipsoid(bme, (0.135, sy * 0.043, 0.218), (0.014, 0.008, 0.014), segs=12, rings=8)
    npf = len(bme.faces)
    for sy in (-1, 1):
        _ellipsoid(bme, (0.141, sy * 0.049, 0.219), (0.007, 0.004, 0.007), segs=10, rings=6)
    for i, f in enumerate(bme.faces):
        if i >= npf: f.material_index = 1
    oe = cz._mesh_obj(name + '_croweye', bme, cz.toon(name + '_eyem', '#f2d860', emit=0.4), smooth=True)
    oe.data.materials.append(cz.toon(name + '_pupilm', '#141418'))
    cz.place(oe, parent=parent, outline_t=0.0)
