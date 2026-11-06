# 1800s six-sided "toe-pincher" coffin for a 1.3 m character lying on his back (BELL film). Long axis along X, HEAD END
# at -X (widest at the shoulders x = -0.30, narrow at the feet +X). Mitred plank walls (two boards high, painted wood
# grain PNG), a floor board, brass bar handles on the long sides + the head end, nail heads along the boards; inside a
# cream quilted satin lining with button tufts (walls + mattress, PNG box-projected) and a puffy satin pillow at the head.
#   lid='closed' (a six-sided lid with a raised panel + nails) | 'off' (no lid) | 'cut' (cross-section: lid AND the
#   front long walls (-Y side) gone, a low cut stub of the bottom board left with raw end-grain on its cut face, so a
#   camera at -Y sees inside); bills=N paper bills / IOUs (gb_bill) heaped inside under the empty <name>_bills: the
#   middle strip where the body lies stays clear while N < 30, at N >= 30 they heap over everything.
# Floor prop: root = floor centre under the coffin, front -Y. Graphics: tex/make_gb_grave.py (static, cached).
import math, os, random, subprocess

T = 0.03                     # wall thickness
H = 0.40                     # outer height (walls top)
FB = 0.03                    # floor board
FLOOR_Z = 0.07               # top of the satin mattress = where the body's back lies
OUTER = [(-0.90, -0.30), (-0.30, -0.34), (0.90, -0.23), (0.90, 0.23), (-0.30, 0.34), (-0.90, 0.30)]   # CCW, top view

META = {'size': (1.82, 0.70, 0.45), 'anchor': 'floor centre under the coffin; head end -X, front long side -Y',
        'animate': ['_lid', '_bills'],
        'floor_z': FLOOR_Z, 'head_x': -0.87, 'foot_x': 0.87, 'inner': (1.74, 0.62, H - FLOOR_Z),
        'pillow': {'x': -0.72, 'top_z': FLOOR_Z + 0.085, 'size': (0.24, 0.40, 0.085)},
        'params': "lid='closed'|'off'|'cut', bills=0 (N sheets under <name>_bills), seed=3. Inner widths: head end 0.54, "
                  "shoulders (x -0.30) 0.62, feet 0.40. The lid (closed) is the object <name>_lid (origin at its centre on the rim, z 0.40)."}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _tex(cz, n):
    p = os.path.join(TEX, n)
    if not os.path.exists(p):
        py = cz.py()
        try:
            subprocess.run([py, os.path.join(TEX, 'make_gb_grave.py'), 'static'], timeout=120, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e:
            print('CZ gb_coffin: png failed', e)
    return p if os.path.exists(p) else None


def _offset(pts, d):
    """Offset a CCW polygon inward by d (mitred corners)."""
    n = len(pts); out = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        def nrm(a, b):
            dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy); return (-dy / L, dx / L)
        n1, n2 = nrm(p0, p1), nrm(p1, p2)
        bx, by = n1[0] + n2[0], n1[1] + n2[1]; bl = math.hypot(bx, by); bx, by = bx / bl, by / bl
        k = d / max(0.2, (bx * n1[0] + by * n1[1]))
        out.append((p1[0] + bx * k, p1[1] + by * k))
    return out


def _prism(cz, name, pts, z0, h, mat, parent, ol=0.006, bevel=0.0):
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    if area < 0: pts = pts[::-1]
    n = len(pts)
    o = cz.cyl(name, 1.0, h, (0, 0, z0), mat, verts=n, ol=ol, parent=parent, bevel=bevel)
    vs = o.data.vertices
    a0 = math.atan2(vs[0].co.y, vs[0].co.x); step = 2 * math.pi / n
    for v in vs:
        k = int(round(((math.atan2(v.co.y, v.co.x) - a0) % (2 * math.pi)) / step)) % n
        v.co.x, v.co.y = pts[k]
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons)); o.data.update()
    return o


def _second_mat(o, mat, pick):
    """Give the faces pick(p) a second material, keeping the outline ink in the LAST slot (cz.outline put it at slot 1;
    appending after it made those faces ink). Solidify then offsets slot 1 past the end, which Blender clamps to the ink."""
    ms = o.data.materials
    ink = ms[len(ms) - 1]
    ms.pop(index=len(ms) - 1); ms.append(mat); ms.append(ink)
    if 'cz_outline' in o.modifiers: o.modifiers['cz_outline'].material_offset = len(ms) - 1
    for p in o.data.polygons:
        if pick(p): p.material_index = 1


def _halfw(x, poly):
    """Half width of a CCW toe-pincher polygon (symmetric in Y) at x."""
    low = sorted([p for p in poly if p[1] < 0])
    for (xa, ya), (xb, yb) in zip(low, low[1:]):
        if xa - 1e-6 <= x <= xb + 1e-6:
            k = (x - xa) / max(1e-6, xb - xa); return -(ya + (yb - ya) * k)
    return -low[0][1] if x < low[0][0] else -low[-1][1]


def build(cz, name='gb_coffin', lid='closed', bills=0, seed=3):
    root = cz.empty(name)
    rnd = random.Random(seed)
    wp, sp, cp = _tex(cz, 'gb_coffin_wood.png'), _tex(cz, 'gb_coffin_satin.png'), _tex(cz, 'gb_coffin_cut.png')
    wood = cz.toon(name + '_wood', '#5e3820', img=wp, proj='box', proj_scale=1.7, tex='grain', tex_strength=0.04) if wp else cz.toon(name + '_wood', '#5e3820', tex='wood')
    wood2 = cz.toon(name + '_wood2', '#553219', img=wp, proj='box', proj_scale=1.3, tint='#e8dcd0', tex='grain', tex_strength=0.05) if wp else wood
    wvp = _tex(cz, 'gb_coffin_wood_v.png')
    woodtop = cz.toon(name + '_woodtop', '#5e3820', img=wvp, proj='box', proj_scale=1.7, tex='grain', tex_strength=0.04) if wvp else wood
    satin = cz.toon(name + '_satin', '#d6c6a0', img=sp, proj='box', proj_scale=2.1, lift=0.55) if sp else cz.toon(name + '_satin', '#d6c6a0')
    pil = cz.toon(name + '_pillowm', '#dccdaa', lift=0.55, tex='grain', tex_strength=0.05)
    cut = cz.toon(name + '_cutm', '#c49a64', img=cp, proj='box', proj_scale=5.0) if cp else cz.toon(name + '_cutm', '#c49a64')
    brass = cz.toon(name + '_brass', '#8c5c17', tex='grain', tex_strength=0.08)
    brass_hi = cz.toon(name + '_brasshi', '#b38630', tex='grain', tex_strength=0.05)
    nailm = cz.toon(name + '_nail', '#2a2624')

    outer = OUTER
    inner = _offset(outer, T)
    lining = _offset(outer, T + 0.012)
    n = len(outer)
    removed = {0, 1} if lid == 'cut' else set()        # the two -Y edges: head->shoulder, shoulder->foot
    # floor board + mattress
    _prism(cz, name + '_floor', _offset(outer, -0.004), 0.0, FB, wood2, root, ol=0.008, bevel=0.0)
    _prism(cz, name + '_mattress', lining, FB, FLOOR_Z - FB, satin, root, ol=0.004, bevel=0.008)
    # walls: two boards high, mitred; their outer face is the outer polygon edge
    zs = [(FB, FB + (H - FB) / 2), (FB + (H - FB) / 2, H)]
    for i in range(n):
        q = [outer[i], outer[(i + 1) % n], inner[(i + 1) % n], inner[i]]
        # overlap the neighbours by 1 cm at both ends (a mitre gap let the satin show through at the shoulder)
        (ax, ay), (bx_, by_) = outer[i], outer[(i + 1) % n]
        el = math.hypot(bx_ - ax, by_ - ay); ex, ey = (bx_ - ax) / el * 0.01, (by_ - ay) / el * 0.01
        s0 = 1 if i in (1, 4) else 0; s1 = 1 if i in (0, 3) else 0      # only at the shallow shoulder joints
        q = [(q[0][0] - ex * s0, q[0][1] - ey * s0), (q[1][0] + ex * s1, q[1][1] + ey * s1), (q[2][0] + ex * s1, q[2][1] + ey * s1), (q[3][0] - ex * s0, q[3][1] - ey * s0)]
        if i in removed:
            st = _prism(cz, f'{name}_stub{i}', q, FB, 0.07, wood, root, ol=0.006, bevel=0.002)
            _second_mat(st, cut, lambda p: p.normal.z > 0.9)
            continue
        for j, (za, zb) in enumerate(zs):
            w = _prism(cz, f'{name}_wall{i}_{j}', q, za, zb - za - 0.004, wood, root, ol=0.007, bevel=0.003)
            if removed and i in (2, 5):     # the end boards' sawn faces toward the cut-away side show raw end grain
                _second_mat(w, cut, lambda p: p.normal.y < -0.5 and abs(p.normal.z) < 0.5)
        # satin on the inner face
        lq = [inner[i], inner[(i + 1) % n], lining[(i + 1) % n], lining[i]]
        _prism(cz, f'{name}_lining{i}', lq, FLOOR_Z - 0.005, H - 0.03 - FLOOR_Z, satin, root, ol=0.003, bevel=0.003)
        # nails along both boards, brass handles on the long walls + the head end
        (x0, y0), (x1, y1) = outer[i], outer[(i + 1) % n]
        L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L; nx, ny = uy, -ux   # outward
        a = math.degrees(math.atan2(uy, ux)); an = math.degrees(math.atan2(ny, nx))
        cnt = max(2, int(L / 0.16))
        for k in range(cnt):
            t = (k + 0.5) / cnt
            for zz in (FB + 0.035, H - 0.03):
                cz.cyl(f'{name}_nail{i}_{k}_{int(zz * 100)}', 0.0062, 0.004, (x0 + ux * L * t, y0 + uy * L * t, zz), nailm,
                       rot=(90, 0, an + 90), verts=8, ol=0, parent=root)
        hts = (0.27, 0.73) if L > 1.0 else ((0.5,) if i == 5 else ())
        for k, t in enumerate(hts):
            cx, cy = x0 + ux * L * t, y0 + uy * L * t; zh = 0.235
            for s in (-1, 1):
                bx, by = cx + ux * s * 0.07 + nx * 0.012, cy + uy * s * 0.07 + ny * 0.012
                cz.box(f'{name}_hbr{i}_{k}_{s}', (0.03, 0.024, 0.055), (bx, by, zh + 0.012), brass, rot=(0, 0, a), bevel=0.004, ol=0.004, parent=root)
                cz.sphere(f'{name}_hbk{i}_{k}_{s}', 0.009, (bx + nx * 0.013, by + ny * 0.013, zh + 0.02), brass_hi, ol=0, parent=root, segs=10, rings=6)
            hl = 0.17
            cz.cyl(f'{name}_hbar{i}_{k}', 0.012, hl, (cx - ux * hl / 2 + nx * 0.04, cy - uy * hl / 2 + ny * 0.04, zh), brass,
                   rot=(90, 0, a + 90), verts=14, ol=0.004, parent=root)
            for s in (-1, 1):   # the bar's bent ends into the brackets
                cz.cyl(f'{name}_hend{i}_{k}_{s}', 0.009, 0.03, (cx + ux * s * 0.075 + nx * 0.012, cy + uy * s * 0.075 + ny * 0.012, zh),
                       brass, rot=(90, 0, an + 90), verts=10, ol=0.003, parent=root)

    # pillow: a puffy superellipsoid
    px, pw, pd, ph = -0.72, 0.24, 0.40, 0.085
    po = cz.sphere(name + '_pillow', 1.0, (px, 0, FLOOR_Z + ph / 2 - 0.004), pil, ol=0.005, parent=root, segs=32, rings=16)
    for v in po.data.vertices:
        x, y, z = v.co
        f = lambda c, e: math.copysign(abs(c) ** e, c)
        v.co = (f(x, 0.45) * pw / 2, f(y, 0.4) * pd / 2, f(z, 0.75) * ph / 2 * (1 - 0.25 * abs(f(y, 0.4)) ** 4))
    po.data.update()

    # lid
    if lid == 'closed':
        lp = _offset(outer, -0.012)
        lo = cz.empty(name + '_lid', (0, 0, H), parent=root)
        for o_ in (_prism(cz, name + '_lidboard', lp, 0.0, 0.032, woodtop, lo, ol=0.009, bevel=0.005),
                   _prism(cz, name + '_lidpanel', _offset(outer, 0.07), 0.032, 0.014, woodtop, lo, ol=0.006, bevel=0.006)):
            _second_mat(o_, wood, lambda p: abs(p.normal.z) < 0.5)   # edges: grain along the board; top: the turned PNG
        for i in range(n):
            (x0, y0), (x1, y1) = lp[i], lp[(i + 1) % n]
            L = math.hypot(x1 - x0, y1 - y0); cnt = max(2, int(L / 0.2))
            for k in range(cnt):
                t = (k + 0.5) / cnt; ix, iy = _offset(lp, 0.02)[i], _offset(lp, 0.02)[(i + 1) % n]
                cz.cyl(f'{name}_lnail{i}_{k}', 0.0062, 0.004, (ix[0] + (iy[0] - ix[0]) * t, ix[1] + (iy[1] - ix[1]) * t, 0.032), nailm,
                       verts=8, ol=0, parent=lo)

    # bills
    if bills:
        be = cz.empty(name + '_bills', (0, 0, 0), parent=root)
        N = int(bills); heap = N >= 30
        for i in range(N):
            for _ in range(30):
                x = rnd.uniform(-0.74, 0.80)
                hw = _halfw(x, inner) - 0.08
                y = rnd.uniform(-hw, hw)
                body = -0.62 < x < 0.5 and abs(y) < 0.15
                if heap or not body: break
            if heap:
                d = max(0.0, 1 - (x / 0.9) ** 2) * max(0.0, 1 - (y / (hw + 0.08)) ** 2)
                z = FLOOR_Z + 0.02 + 0.24 * d * rnd.uniform(0.6, 1.0) + i * 0.0012
            else:
                z = FLOOR_Z + 0.012 + 0.03 * rnd.random() + i * 0.002
                if x < -0.6: z += 0.06 * max(0, 1 - abs(y) / 0.2)      # on the pillow
            b = cz.prop('gb_bill', name=f'{name}_bill{i}', loc=(x, y, z), parent=be, kind=rnd.randrange(6), crumple=rnd.uniform(0.25, 0.9), seed=seed * 100 + i)
            b.rotation_euler = (math.radians(-90 + rnd.uniform(-28, 28)), math.radians(rnd.uniform(-25, 25)), math.radians(rnd.uniform(0, 360)))
            b.scale = (0.85, 0.85, 0.85)
    return root
