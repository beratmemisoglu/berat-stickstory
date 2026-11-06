# TICKETS: the hero's saggy, worn 2-seat sofa. Mustard (kw color) upholstery with darker piping, a deck + rolled-ish
# arms + a tall back, two seat cushions that sag where he sits (his side, the left one, is the most worn: fabric maps
# tex/tk_couch_seatL/seatR/back.png multiplied by the colour), two slumped back cushions (the right one slouches),
# chunky tapered wooden feet, a crocheted granny-square throw over the right arm (tassels on the hem), a plaid patch
# sewn over a tear on the left arm's outer side, a strip of silver tape on the deck front, a stray sock on his cushion
# and a scratch card wedged in the crack between the cushions.
# Floor prop: root at the floor centre, front -Y. Textures: .venv/Scripts/python.exe assets/props/tex/make_tk_couch.py
import math, os, bmesh
from mathutils import Vector

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
W, D = 1.7, 0.8
AW, FZ = 0.2, 0.09              # arm width, foot height
DECK_Z = 0.31                   # deck top (seat cushions rest on it)
SC_H, SC_D = 0.16, 0.63         # seat cushion thickness / depth
SEAT_EDGE = DECK_Z + SC_H       # 0.47 at the cushion edges
SAG = 0.034                     # seat dip at the sitting spot -> seat top ~0.435 there
SC_W = (W - 2 * AW) / 2 - 0.005
SC_Y = -D / 2 - 0.01 + SC_D / 2  # seat cushions overhang the front by 1 cm

META = {'size': (W, D, 0.85), 'anchor': 'floor centre, front -Y',
        'seat_h': 0.435, 'seat_edge_h': SEAT_EDGE,
        'seats': [(-0.33, -0.2, 0.435), (0.33, -0.2, 0.435)],
        'seat_depth': 0.41, 'arm_top_h': 0.62, 'back_top_h': 0.85,
        'animate': [],
        'params': "color='#a46c16' (upholstery; '#a8481a' burnt orange), throw=True, sock=True, card=True"}


def _hex(c, k=1.0):
    h = c.lstrip('#'); v = [min(255, int(int(h[i:i + 2], 16) * k)) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(v)


def _sagw(xn, yn):
    """Sag weight on a seat cushion (normalised coords -0.5..0.5): deepest in front of the back cushions, 0 at the
    side and front edges and under the back cushions."""
    fx = max(0.0, 1 - (2 * xn) ** 2)
    k = (yn + 0.5) / 0.66
    fy = math.sin(math.pi * min(1.0, max(0.0, k)))
    return fx * fy


def _cushion(cz, nm, size, loc, mat, parent, bulge=0.012, sag=0.0, sagfn=None, uv='top', bevel=0.03, ol=0.008, cuts=8):
    """Upholstered block: subdivided cube whose faces bulge out by `bulge` metres in their middles (edges stay put),
    optional top sag; outer size = size. UVs projected from the top (uv='top') or the front ('front')."""
    w, d, h = size; wi, di, hi = w - 2 * bulge, d - 2 * bulge, h - 2 * bulge
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    uvl = bm.loops.layers.uv.new('UVMap')
    for v in bm.verts:
        x, y, z = v.co
        fx, fy, fz = 1 - 4 * x * x, 1 - 4 * y * y, 1 - 4 * z * z
        nx = x * wi + 2 * x * bulge * fy * fz
        ny = y * di + 2 * y * bulge * fx * fz
        nz = z * hi + 2 * z * bulge * fx * fy
        if sag: nz -= sag * (sagfn or _sagw)(x, y) * (z + 0.5)
        v.co = Vector((nx, ny, nz))
    for f in bm.faces:
        for lp in f.loops:
            p = lp.vert.co
            lp[uvl].uv = ((p.x / w + 0.5, p.y / d + 0.5) if uv == 'top' else (p.x / w + 0.5, p.z / h + 0.5))
    o = cz.place(cz._mesh_obj(nm, bm, mat, smooth=True), loc, (0, 0, 0), None, parent, ol, bevel)
    if bevel: o.modifiers['bevel'].segments = 4
    return o


def _tube(cz, nm, pts, r, mat, parent, ol=0.003, segs=10, flat=1.0, caps=True):
    """Round tube along a polyline (parallel-transport frames); flat < 1 squashes it along world Z (lying cloth)."""
    pts = [Vector(p) for p in pts]
    bm = bmesh.new(); rings = []
    t0 = (pts[1] - pts[0]).normalized()
    n = t0.cross(Vector((0, 0, 1)))
    if n.length < 1e-4: n = t0.cross(Vector((1, 0, 0)))
    n.normalize()
    prev_t = t0
    for i, p in enumerate(pts):
        if i == 0: t = t0
        elif i == len(pts) - 1: t = (pts[i] - pts[i - 1]).normalized()
        else: t = (pts[i + 1] - pts[i - 1]).normalized()
        ax = prev_t.cross(t)
        if ax.length > 1e-6:
            ang = prev_t.angle(t); from mathutils import Matrix
            n = Matrix.Rotation(ang, 3, ax.normalized()) @ n
        prev_t = t
        b = t.cross(n).normalized()
        ring = []
        ri = r[i] if isinstance(r, (list, tuple)) else r
        for k in range(segs):
            a = 2 * math.pi * k / segs
            off = (n * math.cos(a) + b * math.sin(a)) * ri
            off.z *= flat
            ring.append(bm.verts.new(p + off))
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for k in range(segs):
            bm.faces.new((ra[k], ra[(k + 1) % segs], rb[(k + 1) % segs], rb[k]))
    if caps:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(nm, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _profile_arm(xi, xo, zt, rc, m, z_in, z_out):
    """Polyline over a bevelled arm cross-section (x, z), offset m outward: up the inner face, over the top, down."""
    P = [(xi - m, z_in), (xi - m, zt - rc)]
    for k in range(1, 9):
        a = math.pi - k * (math.pi / 2) / 8
        P.append((xi + rc + (rc + m) * math.cos(a), zt - rc + (rc + m) * math.sin(a)))
    P.append((xo - rc, zt + m))
    for k in range(1, 9):
        a = math.pi / 2 - k * (math.pi / 2) / 8
        P.append((xo - rc + (rc + m) * math.cos(a), zt - rc + (rc + m) * math.sin(a)))
    P.append((xo + m, z_out))
    L = [0.0]
    for a, b in zip(P, P[1:]): L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return P, L


def _walk(P, L, s):
    s = max(0.0, min(L[-1], s))
    for i in range(len(P) - 1):
        if L[i + 1] >= s:
            k = (s - L[i]) / max(1e-9, L[i + 1] - L[i]); a, b = P[i], P[i + 1]
            # outward normal of the segment (profile runs clockwise seen from -Y: normal = (-dz, dx) rotated)
            dx, dz = b[0] - a[0], b[1] - a[1]; ln = math.hypot(dx, dz) or 1
            return (a[0] + dx * k, a[1] + dz * k), (-dz / ln, dx / ln)
    return P[-1], (1.0, 0.0)


def _throw(cz, name, root, xi, xo, zt, rc):
    """Crocheted throw draped over an arm (x in [xi, xo], top zt, edge radius rc): a thick grid sheet with UVs."""
    m = 0.021
    P, L = _profile_arm(xi, xo, zt, rc, m, 0.505, 0.10)
    y0, y1 = -0.35, 0.21
    nu, nv = 56, 22
    top_s0 = L[2 + 8 - 1]          # where the top flat starts (folds grow from there down the outside)
    s_in, s_len = 0.0, 0.74
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap'); grid = []
    for j in range(nv + 1):
        v = j / nv; y = y0 + (y1 - y0) * v
        lo = s_in + 0.012 * math.sin(v * 7.0)
        hi = s_len + 0.035 * math.sin(v * 5.3 + 1.0) + 0.02 * math.sin(v * 13.0)
        row = []
        for i in range(nu + 1):
            u = i / nu; s = lo + (hi - lo) * u
            (x, z), (nx, nz) = _walk(P, L, s)
            down = max(0.0, (s - top_s0 - 0.15) / 0.4)
            fold = 0.007 * (1 + math.sin(v * 2 * math.pi * 4.5 + 0.6)) * min(1.0, down)   # folds only stand OUT
            x += fold * nx; z += fold * nz
            dy = 0.01 * math.sin(u * 9) * min(1.0, down)
            row.append(bm.verts.new((x, y + dy, z)))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
            for lp, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (a / nu, b / nv)
    # face order (u along the drape, v along +Y) makes every normal point away from the arm: the thickness goes
    # inward (toward the arm), the ink hull outward
    mat = cz.toon(name + '_throwm', img=os.path.join(TEX, 'tk_couch_throw.png'), tex='grain', tex_scale=4, tex_strength=0.05)
    o = cz.place(cz._mesh_obj(name + '_throw', bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, root, 0.0, 0.0)
    sol = o.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.011; sol.offset = -1
    cz.outline(o, 0.005)
    # tassels along the outer hem
    tas = cz.toon(name + '_tasselm', '#e6d9b8', tex='grain')
    for k in range(9):
        v = (k + 0.5) / 9; y = y0 + (y1 - y0) * v
        hi = s_len + 0.035 * math.sin(v * 5.3 + 1.0) + 0.02 * math.sin(v * 13.0)
        (x, z), _ = _walk(P, L, hi)
        cz.capsule(f'{name}_tassel{k}', 0.007, 0.05, (x - 0.006, y, z - 0.044), tas, ol=0.002, parent=root)
    return o


def build(cz, name='tk_couch', color='#a46c16', throw=True, sock=True, card=True):
    root = cz.empty(name)
    hx = color.lstrip('#')
    frame = cz.toon(f'{name}_frame_{hx}', _hex(color, 0.9), tex='grain', tex_scale=2.5, tex_strength=0.06)
    seatL = cz.toon(f'{name}_seatL_{hx}', img=os.path.join(TEX, 'tk_couch_seatL.png'), tint=color, tex='grain', tex_scale=2.5, tex_strength=0.05)
    seatR = cz.toon(f'{name}_seatR_{hx}', img=os.path.join(TEX, 'tk_couch_seatR.png'), tint=color, tex='grain', tex_scale=2.5, tex_strength=0.05)
    backm = cz.toon(f'{name}_backc_{hx}', img=os.path.join(TEX, 'tk_couch_back.png'), tint=_hex(color, 0.96), tex='grain', tex_scale=2.5, tex_strength=0.05)
    pipe = cz.toon(f'{name}_pipe_{hx}', _hex(color, 0.5), tex='grain', tex_strength=0.04)
    wood = cz.toon(name + '_wood', '#6e4322', tex='wood', tex_scale=2.0, tex_strength=0.12)

    # ---- feet, deck, arms, back
    for sx in (-1, 1):
        for sy in (-1, 1):
            cz.cyl(f'{name}_foot{"L" if sx < 0 else "R"}{"F" if sy < 0 else "B"}', 0.026, FZ + 0.004, (sx * 0.75, sy * 0.31, 0), wood,
                   r2=0.038, verts=20, bevel=0.004, ol=0.005, parent=root)
    cz.box(name + '_deck', (W - 2 * AW, D - 0.18, DECK_Z - FZ), (0, -0.09, FZ), frame, bevel=0.02, ol=0.008, parent=root, origin='bottom')
    for sx, nm in ((-1, 'L'), (1, 'R')):
        a = cz.box(f'{name}_arm{nm}', (AW, D, 0.62 - FZ), (sx * (W / 2 - AW / 2), 0, FZ), frame, bevel=0.06, ol=0.009, parent=root, origin='bottom')
        a.modifiers['bevel'].segments = 5
        # piping round the arm's front panel (on the bevel's mid line)
        e = 0.293 * 0.06; xi, xo = W / 2 - AW + e, W / 2 - e; zt = 0.62 - e; yf = -D / 2 + e; rc = 0.045
        pts = [(xi, yf, FZ + 0.025), (xi, yf, zt - rc)]
        for k in range(1, 7):
            t = math.pi - k * (math.pi / 2) / 6
            pts.append((xi + rc + rc * math.cos(t), yf, zt - rc + rc * math.sin(t)))
        for k in range(0, 7):
            t = math.pi / 2 - k * (math.pi / 2) / 6
            pts.append((xo - rc + rc * math.cos(t), yf, zt - rc + rc * math.sin(t)))
        pts.append((xo, yf, FZ + 0.025))
        pts = [(sx * p[0], p[1], p[2]) for p in pts]
        _tube(cz, f'{name}_armpipe{nm}', pts, 0.0095, pipe, root, ol=0.003, segs=10)
    _cushion(cz, name + '_back', (W - 2 * AW, 0.18, 0.85 - FZ), (0, D / 2 - 0.09, FZ + (0.85 - FZ) / 2), frame, parent=root,
             bulge=0.012, bevel=0.05, ol=0.009, cuts=8)

    # ---- seat cushions (sagging), piping on their front-top edges
    for sx, nm, mat in ((-1, 'L', seatL), (1, 'R', seatR)):
        cx = sx * (SC_W / 2 + 0.005)
        _cushion(cz, f'{name}_seat{nm}', (SC_W, SC_D, SC_H), (cx, SC_Y, DECK_Z + SC_H / 2), mat, root,
                 bulge=0.012, sag=SAG, uv='top', bevel=0.035, ol=0.008)
        e = 0.293 * 0.035
        y = SC_Y - SC_D / 2 + e; z = SEAT_EDGE - e
        _tube(cz, f'{name}_seatpipe{nm}', [(cx - SC_W / 2 + 0.03, y, z - 0.004), (cx - SC_W / 2 + 0.06, y, z), (cx + SC_W / 2 - 0.06, y, z), (cx + SC_W / 2 - 0.03, y, z - 0.004)],
              0.009, pipe, root, ol=0.003, segs=10)

    # ---- back cushions: hinged at their bottom-centre, leaning on the back (the right one slouches)
    BH, BD, BW = 0.37, 0.17, SC_W - 0.01
    for sx, nm, tilt, roll in ((-1, 'L', 9.0, 0.0), (1, 'R', 14.0, -3.5)):
        a = math.radians(tilt)
        oy = D / 2 - 0.18 + 0.005 - (BD / 2 * math.cos(a) + BH * math.sin(a))
        pv = cz.empty(f'{name}_backc{nm}', (sx * (SC_W / 2 + 0.005), oy, SEAT_EDGE - 0.012), parent=root)
        pv.rotation_euler = (-a, math.radians(roll), 0)
        _cushion(cz, f'{name}_backc{nm}_m', (BW, BD, BH), (0, 0, BH / 2), backm, pv, bulge=0.026,
                 sag=0.018, sagfn=lambda x, y: max(0.0, 1 - (2 * x) ** 2), uv='front', bevel=0.04, ol=0.008)

    # ---- the patched tear (left arm's outer side) + silver tape on the deck front
    pm = cz.toon(name + '_patchm', img=os.path.join(TEX, 'tk_couch_patch.png'), alpha_clip=True, lift=0.62)
    cz.plane(name + '_patch', 0.17, 0.17, (-W / 2 - 0.0016, -0.15, 0.37), pm, rot=(90, 9, -90), parent=root)
    tape = cz.toon(name + '_tapem', '#9da2a9', tex='grain', tex_strength=0.06)
    cz.box(name + '_tape', (0.12, 0.0012, 0.032), (-0.42, -D / 2 - 0.0012, 0.2), tape, rot=(0, -36, 0), bevel=0, ol=0.0, parent=root)
    cz.box(name + '_tape2', (0.11, 0.0012, 0.032), (-0.42, -D / 2 - 0.0024, 0.2), tape, rot=(0, 33, 0), bevel=0, ol=0.0, parent=root)

    # ---- throw over the right arm
    if throw:
        _throw(cz, name, root, W / 2 - AW, W / 2, 0.62, 0.06)

    # ---- stray sock on his (left) cushion, lying in the dip
    if sock:
        cx = -(SC_W / 2 + 0.005)
        wi, di = SC_W - 0.024, SC_D - 0.024

        def top(x, y):
            xn = max(-0.5, min(0.5, (x - cx) / wi)); yn = max(-0.5, min(0.5, (y - SC_Y) / di))
            return SEAT_EDGE - 0.012 + 0.012 * (1 - 4 * xn * xn) * (1 - 4 * yn * yn) - SAG * _sagw(xn, yn)
        fl = 0.32
        path = [(-0.63, -0.335), (-0.595, -0.322), (-0.555, -0.306), (-0.515, -0.29), (-0.485, -0.276), (-0.466, -0.258),
                (-0.457, -0.232), (-0.452, -0.2), (-0.449, -0.172), (-0.447, -0.152), (-0.446, -0.14), (-0.4455, -0.133)]
        rr = [0.025, 0.025, 0.024, 0.024, 0.026, 0.029, 0.029, 0.028, 0.026, 0.021, 0.014, 0.006]
        P = [(x, y, top(x, y) + 0.026 * fl - 0.003) for x, y in path]
        sockm = cz.toon(name + '_sockm', '#d6d0c2', tex='grain', tex_strength=0.06)
        band = cz.toon(name + '_sockband', '#c23a2e', tex='grain', tex_strength=0.04)
        _tube(cz, name + '_sock', P[1:], rr[1:], sockm, root, ol=0.003, segs=14, flat=fl)
        _tube(cz, name + '_sockcuff', [P[0], P[1]], 0.027, band, root, ol=0.003, segs=14, flat=fl)

    # ---- a scratch card wedged in the crack between the seat cushions
    if card:
        cp = cz.empty(name + '_card', (0.0, -0.26, SEAT_EDGE - 0.045), parent=root)
        cp.rotation_euler = (math.radians(-16), math.radians(12), math.radians(-58))
        cz.box(name + '_card_m', (0.066, 0.0016, 0.099), (0, 0, 0.0495), cz.toon(name + '_cardback', '#d8d3c6', tex='paper'), bevel=0, ol=0.002, parent=cp)
        cz.plane(name + '_card_print', 0.064, 0.096, (0, -0.002, 0.0495), cz.toon(name + '_cardm_tk_couch_card', img=os.path.join(TEX, 'tk_couch_card.png'), lift=0.6), parent=cp)
    return root
