# TICKETS: bachelor-apartment clutter for a low coffee table (or the floor). An open greasy pizza box (lid standing
# open: the shop's stamp + grease inside, the ghost ring of the eaten slices, two slices left with pepperoni), two
# stacked takeout cartons (the top one open with lo mein + chopsticks, wire handles, red pagoda print), soda cans
# (FIZZ cola, LIME; one crushed and lying down), a VOLT energy-drink can, a TV remote, a LUCKY ME! mug of cold
# coffee and a crumpled paper bag. kw items=(...) picks a subset; seed jitters the turns and the crumple.
# Root at the table-top (or floor) centre: everything stands on z = 0; spread ~0.9 x 0.5 m, front -Y.
#   textures: .venv/Scripts/python.exe assets/props/tex/make_tk_apt_clutter.py
import math, os, random, bmesh
from mathutils import Vector, Matrix

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
ALL = ('pizza', 'cartons', 'cans', 'crushed', 'energy', 'remote', 'mug', 'bag')

META = {'size': (0.9, 0.5, 0.3), 'anchor': 'table-top / floor centre (items stand on z = 0), front -Y',
        'animate': ['_pizza_lid (hinge at the box back edge, rotation_euler.x: 0 closed .. -1.83 open)'],
        'spots': {'pizza': (-0.24, 0.03), 'cartons': (0.07, 0.13), 'mug': (0.05, -0.08), 'remote': (-0.03, -0.2),
                  'cans': [(0.24, 0.1), (0.31, -0.03)], 'crushed': (0.2, -0.17), 'energy': (0.39, 0.13), 'bag': (0.43, -0.12)},
        'params': "items=%r (any subset), seed=1" % (ALL,)}


def T(n): return os.path.join(TEX, n)


def _lathe(cz, name, prof, mat, parent, segs=36, ol=0.003, caps=True, closed=False, uv=False, v0=None, v1=None, smooth=True):
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap') if uv else None
    rings = [[bm.verts.new((r * math.cos(2 * math.pi * i / segs - math.pi), r * math.sin(2 * math.pi * i / segs - math.pi), z)) for i in range(segs)] for r, z in prof]
    zs = [z for _, z in prof]; z0 = min(zs) if v0 is None else v0; z1 = max(zs) if v1 is None else v1
    pairs = list(zip(range(len(rings)), range(1, len(rings)))) + ([(len(rings) - 1, 0)] if closed else [])
    for a, b in pairs:
        for i in range(segs):
            f = bm.faces.new((rings[a][i], rings[a][(i + 1) % segs], rings[b][(i + 1) % segs], rings[b][i]))
            if uv:
                va, vb = (prof[a][1] - z0) / (z1 - z0), (prof[b][1] - z0) / (z1 - z0)
                for lp, (u, v) in zip(f.loops, ((i / segs, va), ((i + 1) / segs, va), ((i + 1) / segs, vb), (i / segs, vb))):
                    lp[uvl].uv = (u, v)
    if caps and not closed:
        if prof[0][0] > 1e-6: bm.faces.new(rings[0][::-1])
        if prof[-1][0] > 1e-6: bm.faces.new(rings[-1])
    if not uv: bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=smooth), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _tube(cz, nm, pts, r, mat, parent, ol=0.002, segs=10):
    pts = [Vector(p) for p in pts]
    bm = bmesh.new(); rings = []
    t0 = (pts[1] - pts[0]).normalized(); n = t0.cross(Vector((0, 0, 1)))
    if n.length < 1e-4: n = t0.cross(Vector((1, 0, 0)))
    n.normalize(); prev = t0
    for i, p in enumerate(pts):
        t = t0 if i == 0 else (pts[i] - pts[i - 1]).normalized() if i == len(pts) - 1 else (pts[i + 1] - pts[i - 1]).normalized()
        ax = prev.cross(t)
        if ax.length > 1e-6: n = Matrix.Rotation(prev.angle(t), 3, ax.normalized()) @ n
        prev = t; b = t.cross(n).normalized()
        rings.append([bm.verts.new(p + (n * math.cos(2 * math.pi * k / segs) + b * math.sin(2 * math.pi * k / segs)) * r) for k in range(segs)])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(segs): bm.faces.new((ra[k], ra[(k + 1) % segs], rb[(k + 1) % segs], rb[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(nm, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _rod(cz, nm, a, b, r, mat, parent, ol=0.0015):
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.cyl(nm, r, d.length, tuple(a), mat, verts=10, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def _frustum(cz, nm, h, b, t, mat, parent, bevel=0.004, ol=0.004):
    """Carton body: rect b=(w, d) at z=0 -> t=(w, d) at z=h."""
    bm = bmesh.new()
    vs = [bm.verts.new((sx * r[0] / 2, sy * r[1] / 2, z)) for z, r in ((0, b), (h, t)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(nm, bm, mat, smooth=False), (0, 0, 0), (0, 0, 0), None, parent, ol, bevel)


def _can(cz, nm, r, h, wrap, parent, loc, rz, crush=None):
    pv = cz.empty(nm, loc, parent=parent); pv.rotation_euler = (0, 0, math.radians(rz))
    silver = cz.toon('tk_clutter_silver', '#a9adb2', lift=0.55, tex='grain', tex_strength=0.04)
    dark = cz.toon('tk_clutter_candark', '#3a3c40')
    zb, zt = 0.009, h - 0.011
    prof = [(r, zb + (zt - zb) * k / 10) for k in range(11)]
    parts = [_lathe(cz, nm + '_body', prof, cz.toon(f'{nm}_wrap_{os.path.basename(wrap)[:-4]}', img=wrap, lift=0.6, tex='grain', tex_strength=0.03),
                    pv, segs=40, ol=0.003, caps=False, uv=True, smooth=crush is None)]
    parts.append(_lathe(cz, nm + '_bot', [(0.0, 0.003), (r * 0.78, 0.0), (r * 0.95, 0.003), (r, zb + 0.001)], silver, pv, segs=40, ol=0.0025))
    parts.append(_lathe(cz, nm + '_top', [(r, zt - 0.001), (r * 0.95, h - 0.004), (r * 0.9, h), (r * 0.84, h), (r * 0.82, h - 0.004), (0.0, h - 0.004)], silver, pv, segs=40, ol=0.0025))
    tab = cz.box(nm + '_tab', (0.012, 0.022, 0.002), (0, r * 0.25, h - 0.003), silver, bevel=0.0008, ol=0.001, parent=pv)
    hole = cz.box(nm + '_hole', (0.011, 0.016, 0.0015), (0, -r * 0.42, h - 0.0042), dark, bevel=0.0, ol=0.0, parent=pv)
    if crush:
        R = crush
        for o in parts:
            for v in o.data.vertices:
                x, y, z = v.co; zn = z / h; th = math.atan2(y, x)
                k = math.sin(math.pi * min(1, max(0, zn)))
                s = 1 - 0.3 * k * (0.6 + 0.4 * math.cos(2 * th + 1.3)) + R.uniform(-0.03, 0.03) * k
                v.co = (x * s * (1 + 0.18 * k), y * s * (1 - 0.32 * k), z * 0.62 + 0.006 * math.sin(th * 3) * k)
            o.data.update()
        for o in (tab, hole): o.location.z = h * 0.62 - (h - o.location.z)
    return pv


def _slice(cz, nm, a0, a1, R, parent, z0, rng):
    cheese = cz.toon('tk_clutter_cheese', '#eaa832', tex='grain', tex_scale=3, tex_strength=0.1)
    dough = cz.toon('tk_clutter_dough', '#e0b66a', tex='grain', tex_strength=0.05)
    crust = cz.toon('tk_clutter_crust', '#b8742e', tex='grain', tex_scale=3, tex_strength=0.12)
    pep = cz.toon('tk_clutter_pep', '#a8301f', tex='grain', tex_strength=0.1)
    th = 0.011; n = 10
    bm = bmesh.new()
    arc = [(R * math.cos(math.radians(a0 + (a1 - a0) * i / n)), R * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
    bot = [bm.verts.new((0, 0, z0))] + [bm.verts.new((x, y, z0)) for x, y in arc]
    top = [bm.verts.new((0, 0, z0 + th))] + [bm.verts.new((x, y, z0 + th)) for x, y in arc]
    ft = bm.faces.new(top); fb = bm.faces.new(bot[::-1])
    m = len(bot)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    for f in bm.faces: f.material_index = 0 if f.normal.z > 0.9 else 1
    o = cz._mesh_obj(nm, bm, None, smooth=False); o.data.materials.append(cheese); o.data.materials.append(dough)
    cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, 0.003, 0.0)
    cpts = [((R - 0.004) * math.cos(math.radians(a0 + (a1 - a0) * i / 8)), (R - 0.004) * math.sin(math.radians(a0 + (a1 - a0) * i / 8)), z0 + th * 0.75) for i in range(9)]
    _tube(cz, nm + '_crust', cpts, 0.011, crust, parent, ol=0.003, segs=12)
    for k in range(3):
        rr = R * (0.32 + 0.22 * k) + rng.uniform(-0.008, 0.008)
        aa = math.radians(a0 + (a1 - a0) * (0.5 + rng.uniform(-0.18, 0.18)))
        cz.cyl(f'{nm}_pep{k}', 0.0145 - 0.002 * (k == 0), 0.003, (rr * math.cos(aa), rr * math.sin(aa), z0 + th), pep, verts=20, ol=0.0018, parent=parent)
    return o


def build(cz, name='tk_apt_clutter', items=ALL, seed=1):
    rng = random.Random(seed)
    items = set(items)
    root = cz.empty(name)

    def jit(a=6): return rng.uniform(-a, a)
    kraftm = cz.toon(name + '_kraft', '#b88a52', tex='paper', tex_scale=0.6, tex_strength=0.06)
    # ---- pizza box
    if 'pizza' in items:
        pb = cz.empty(name + '_pizza', (-0.24, 0.03, 0), parent=root); pb.rotation_euler = (0, 0, math.radians(6 + jit(4)))
        S, Hb, t = 0.36, 0.042, 0.004
        cz.box(name + '_pizza_bottom', (S, S, t), (0, 0, 0), kraftm, bevel=0.0, ol=0.004, parent=pb, origin='bottom')
        for sy in (-1, 1):
            cz.box(f'{name}_pizza_wall{"F" if sy < 0 else "B"}', (S, t, Hb - t), (0, sy * (S / 2 - t / 2), t), kraftm, bevel=0.0, ol=0.004, parent=pb, origin='bottom')
        for sx in (-1, 1):
            cz.box(f'{name}_pizza_wall{"L" if sx < 0 else "R"}', (t, S - 2 * t, Hb - t), (sx * (S / 2 - t / 2), 0, t), kraftm, bevel=0.0, ol=0.004, parent=pb, origin='bottom')
        cz.plane(name + '_pizza_floor', S - 2 * t - 0.001, S - 2 * t - 0.001, (0, 0, t + 0.0012), cz.toon(name + '_pizzain_tk', img=T('tk_apt_clutter_pizzain.png'), lift=0.55), rot=(0, 0, 0), parent=pb)
        lid = cz.empty(name + '_pizza_lid', (0, S / 2, Hb), parent=pb); lid.rotation_euler = (math.radians(-104), 0, 0)
        cz.box(name + '_pizza_lidm', (S, S, t), (0, -S / 2, t / 2), kraftm, bevel=0.0, ol=0.004, parent=lid)
        cz.plane(name + '_pizza_lidin', S - 0.01, S - 0.01, (0, -S / 2, -0.0012), cz.toon(name + '_lidin_tk', img=T('tk_apt_clutter_lidin.png'), lift=0.55), rot=(180, 0, 0), parent=lid)
        cz.box(name + '_pizza_flap', (S - 0.01, t, 0.034), (0, -S + t / 2, -0.017), kraftm, bevel=0.0, ol=0.004, parent=lid)
        z0 = t + 0.002
        _slice(cz, name + '_slice0', 198, 243, 0.152, pb, z0, rng)
        sl = cz.empty(name + '_slice1p', (0.008, -0.01, 0), parent=pb); sl.rotation_euler = (0, 0, math.radians(5))
        _slice(cz, name + '_slice1', 245, 290, 0.152, sl, z0, rng)
    # ---- takeout cartons
    if 'cartons' in items:
        white = cz.toon(name + '_carton', '#e9e3d4', tex='paper', tex_scale=0.8, tex_strength=0.05)
        wire = cz.toon(name + '_wire', '#9a9ea4', lift=0.55)
        prn = cz.toon(name + '_cartonprint_tk', img=T('tk_apt_clutter_carton.png'), lift=0.6)
        h, b, tp = 0.088, (0.074, 0.06), (0.1, 0.084)
        tilt = math.degrees(math.atan2((tp[1] - b[1]) / 2, h))
        for k, (loc, rz, open_) in enumerate((((0.07, 0.13, 0), 4 + jit(4), False), ((0.078, 0.125, h + 0.004), -12 + jit(5), True))):
            cp = cz.empty(f'{name}_carton{k}', loc, parent=root); cp.rotation_euler = (0, 0, math.radians(rz))
            _frustum(cz, f'{cp.name}_body', h, b, tp, white, cp)
            # print on the tapered front face (1.2 mm off it)
            yf = -(b[1] + tp[1]) / 4 - 0.0013
            cz.plane(f'{cp.name}_print', 0.062, 0.062, (0, yf, h / 2), prn, rot=(90 + tilt, 0, 0), parent=cp)
            if not open_:
                cz.box(f'{cp.name}_lid', (tp[0] + 0.002, tp[1] + 0.002, 0.004), (0, 0, h), white, bevel=0.001, ol=0.003, parent=cp, origin='bottom')
            else:
                food = cz.toon(name + '_noodle', '#c98638', tex='grain', tex_scale=4, tex_strength=0.14)
                cz.box(f'{cp.name}_food', (tp[0] - 0.012, tp[1] - 0.012, 0.004), (0, 0, h - 0.012), food, bevel=0.002, ol=0.0, parent=cp, origin='bottom')
                for i in range(4):
                    a = rng.uniform(0, 6.28)
                    p0 = Vector((0.02 * math.cos(a), 0.02 * math.sin(a), h - 0.006))
                    _tube(cz, f'{cp.name}_noodle{i}', [p0, p0 + Vector((0.012, 0.006, 0.01)), p0 + Vector((0.026, -0.004, 0.006)), p0 + Vector((0.036, 0.004, -0.002))],
                          0.0026, food, cp, ol=0.0012, segs=6)
                # open flaps, splayed out
                for sx, sy, w, ax in ((0, -1, tp[0], 'x'), (0, 1, tp[0], 'x'), (-1, 0, tp[1], 'y'), (1, 0, tp[1], 'y')):
                    fp = cz.empty(f'{cp.name}_flap{sx}{sy}', (sx * tp[0] / 2, sy * tp[1] / 2, h), parent=cp)
                    ang = math.radians(118 + jit(10))
                    fp.rotation_euler = (-sy * ang, 0, 0) if ax == 'x' else (0, sx * ang, 0)
                    sz = (w - 0.004, 0.034, 0.002) if ax == 'x' else (0.034, w - 0.004, 0.002)
                    off = (0, -sy * 0.017, 0) if ax == 'x' else (-sx * 0.017, 0, 0)
                    cz.box(f'{fp.name}_m', sz, off, white, bevel=0.0, ol=0.002, parent=fp)
                # chopsticks
                stick = cz.toon(name + '_chopstick', '#d4a868', tex='wood', tex_strength=0.1)
                _rod(cz, f'{cp.name}_stick0', (-0.01, 0.006, h - 0.05), (0.07, 0.04, h + 0.14), 0.0036, stick, cp)
                _rod(cz, f'{cp.name}_stick1', (0.0, -0.006, h - 0.05), (0.095, 0.0, h + 0.12), 0.0036, stick, cp)
            # wire handle over the top, between the short sides
            hp = [(math.cos(math.radians(a)) * (tp[0] / 2 + 0.002), 0.0, h - 0.01 + math.sin(math.radians(a)) * 0.05 * (1 if open_ else 0.25)) for a in range(0, 181, 15)]
            if not open_: hp = [(x, 0, h + 0.005 + (z - (h - 0.01)) * 0.5) for x, _, z in hp]
            _tube(cz, f'{cp.name}_handle', hp, 0.0018, wire, cp, ol=0.0, segs=6)
    # ---- cans
    if 'cans' in items:
        _can(cz, name + '_cola', 0.033, 0.122, T('tk_apt_clutter_cola.png'), root, (0.24, 0.1, 0), 10 + jit(8))
        _can(cz, name + '_lime', 0.033, 0.122, T('tk_apt_clutter_lime.png'), root, (0.31, -0.03, 0), -14 + jit(8))
    if 'crushed' in items:
        cr = cz.empty(name + '_crushedp', (0.2, -0.17, 0.0335), parent=root); cr.rotation_euler = (math.radians(90), 0, math.radians(70 + jit(10)))
        c = _can(cz, name + '_crushed', 0.033, 0.122, T('tk_apt_clutter_cola.png'), cr, (0, 0, -0.038), 30, crush=random.Random(seed + 7))
    if 'energy' in items:
        _can(cz, name + '_volt', 0.028, 0.165, T('tk_apt_clutter_volt.png'), root, (0.39, 0.13, 0), -8 + jit(8))
    # ---- remote
    if 'remote' in items:
        rp = cz.empty(name + '_remote', (-0.03, -0.2, 0), parent=root); rp.rotation_euler = (0, 0, math.radians(-62 + jit(6)))
        rb = cz.toon(name + '_remotem', '#2b2d31', tex='grain', tex_strength=0.05)
        grey = cz.toon(name + '_rbtn', '#8d9096')
        cz.box(name + '_remote_body', (0.05, 0.17, 0.02), (0, 0, 0), rb, bevel=0.009, ol=0.003, parent=rp, origin='bottom')
        cz.cyl(name + '_remote_power', 0.0062, 0.004, (0.012, 0.066, 0.0195), cz.toon(name + '_rpow', '#d23a2e'), verts=14, ol=0.0012, parent=rp)
        cz.cyl(name + '_remote_dpad', 0.014, 0.004, (0, 0.03, 0.0195), grey, verts=24, ol=0.0012, parent=rp)
        cz.cyl(name + '_remote_ok', 0.0062, 0.0055, (0, 0.03, 0.0195), cz.toon(name + '_rok', '#3a8fd6'), verts=14, ol=0.0012, parent=rp)
        for rr in range(4):
            for cc in range(3):
                cz.box(f'{name}_remote_k{rr}{cc}', (0.009, 0.007, 0.004), ((cc - 1) * 0.013, -0.006 - rr * 0.014, 0.019), grey, bevel=0.0015, ol=0.0008, parent=rp, origin='bottom')
        for s, c in ((-1, '#3aa04a'), (1, '#e0b23a')):
            cz.box(f'{name}_remote_rock{s}', (0.007, 0.016, 0.004), (s * 0.0125, 0.008, 0.019), cz.toon(f'{name}_rock_{c[1:]}', c), bevel=0.0015, ol=0.0008, parent=rp, origin='bottom')
    # ---- mug of cold coffee (LUCKY ME!)
    if 'mug' in items:
        mp = cz.empty(name + '_mug', (0.05, -0.08, 0), parent=root); mp.rotation_euler = (0, 0, math.radians(-20 + jit(10)))
        r, h = 0.042, 0.096
        cer = cz.toon(name + '_mugcer', '#ece8dc', tex='grain', tex_strength=0.03)
        _lathe(cz, name + '_mug_body', [(r, 0.006 + (h - 0.012) * k / 6) for k in range(7)], cz.toon(name + '_mugwrap_tk', img=T('tk_apt_clutter_mug.png'), lift=0.6), mp,
               segs=40, ol=0.004, caps=False, uv=True)
        _lathe(cz, name + '_mug_base', [(0.0, 0.0), (r - 0.004, 0.0), (r, 0.004), (r, 0.0072), (0.0, 0.0072)], cer, mp, segs=40, ol=0.0035)
        _lathe(cz, name + '_mug_rim', [(r - 0.006, h - 0.0072), (r + 0.0006, h - 0.0072), (r + 0.0006, h - 0.002), (r - 0.002, h), (r - 0.006, h)], cer, mp, segs=40, ol=0.0035, closed=True)
        _lathe(cz, name + '_mug_in', [(r - 0.0062, h - 0.004), (r - 0.0062, h - 0.03)], cz.toon(name + '_mugin', '#d9d3c4'), mp, segs=40, ol=0.0, caps=False)
        cz.cyl(name + '_coffee', r - 0.006, 0.002, (0, 0, h - 0.024), cz.toon(name + '_coffeem', '#3a2414', lift=0.5), verts=40, ol=0.0, parent=mp)
        hp = [(r - 0.002 + 0.03 * math.sin(math.radians(a)), 0, 0.05 + 0.028 * math.cos(math.radians(a))) for a in range(0, 181, 15)]
        _tube(cz, name + '_mug_handle', hp, 0.0075, cer, mp, ol=0.003, segs=12)
    # ---- crumpled paper bag
    if 'bag' in items:
        br = random.Random(seed + 3)
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=3, use_grid_fill=True)
        for v in bm.verts:
            x, y, z = v.co; k = 1 - 0.55 * max(0.0, z + 0.1) / 0.6
            v.co = Vector((x * 0.13 * k + br.uniform(-0.009, 0.009), y * 0.095 * k + br.uniform(-0.009, 0.009), (z + 0.5) * 0.12 + br.uniform(-0.008, 0.008) * (z + 0.5)))
        # tip it over a little, baked into the mesh, then rest its lowest point on z = 0
        from mathutils import Euler
        rot = Euler((math.radians(4), math.radians(-14), math.radians(25 + jit(15)))).to_matrix()
        for v in bm.verts: v.co = rot @ v.co
        mz = min(v.co.z for v in bm.verts)
        for v in bm.verts: v.co.z -= mz + 0.001
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bag = cz._mesh_obj(name + '_bag', bm, kraftm, smooth=False)
        cz.place(bag, (0.43, -0.12, 0.0), (0, 0, 0), None, root, 0.004, 0.0)
    return root
