# Group b props (E11-E22): tower cranes, the steel mesh net, hazard straps, red steel legs, support columns,
# the steel platform (panelled skirt + copper fins), the magnet hall, magnets, arcs, arrows, rails, bogies.
# Everything is built from numpy meshes (one object per kind = few draw calls) and materials from M.
import bpy, math, os, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import cz, mega as M, common as C

R, H = C.R, C.H
_MB = {}


def mats():
    """Common film materials + group b's own."""
    if _MB: return _MB
    mt = C.mats(); _MB.update(mt)
    T = C.T
    _MB.update(
        crane=M.pbr('b_crane', '#c42a2e', rough=0.38, metal=0.35, noise=0.12),
        white=M.pbr('b_white', '#e9ebee', rough=0.4, metal=0.1),
        netsteel=M.pbr('b_net', '#3a3d44', rough=0.35, metal=0.9),
        hazard=M.pbr('b_hazard', '#e7b53a', rough=0.5, metal=0.2, img=T('hazard.png') if C.has('hazard.png') else None, scale=0.6),
        strapy=M.pbr('b_strapy', '#d9a52b', rough=0.55, metal=0.1, noise=0.25),
        band=M.steel('b_band', color='#d8dce2', rough=0.18),
        glass=M.pbr('b_glass', '#20303a', rough=0.05, metal=0.6, spec=1.0),
        cable=M.pbr('b_cable', '#202124', rough=0.5, metal=0.6),
        colmn=M.pbr('b_colmn', '#e8954a', rough=0.45, metal=0.3, noise=0.15),
        mach=M.pbr('b_mach', '#e0b43a', rough=0.45, metal=0.2, noise=0.2),
        grey=M.pbr('b_grey', '#8d939b', rough=0.45, metal=0.6, noise=0.1),
        concrete=M.pbr('b_conc', '#7c7f85', rough=0.85, noise=0.35, bump=0.25),
        coil=M.pbr('b_coil', '#c2602e', rough=0.3, metal=1.0, bump=0.6, bump_scale=60.0, noise=0.15),
        pole_r=M.pbr('b_pole_r', '#b52a33', rough=0.35, metal=0.2),
        pole_b=M.pbr('b_pole_b', '#3a5aa8', rough=0.35, metal=0.2),
        pipe_r=M.pbr('b_pipe_r', '#b81f27', rough=0.3, metal=0.3),
        pipe_b=M.pbr('b_pipe_b', '#2846b0', rough=0.3, metal=0.3),
        wall=M.steel('b_wall', color='#d4d7dc', rough=0.35, panels=0.6, panel_scale=1.2),
        floor=M.steel('b_floor', color='#80868e', rough=0.35, panels=0.7, panel_scale=0.5),
        lamp=M.emit('b_lamp', '#fff6e8', 14.0),
        warmlamp=M.emit('b_warmlamp', '#ffb35a', 1.5),
        warnlamp=M.emit('b_warnlamp', '#ff3a1a', 1.5),
        arc=M.emit('b_arc', '#cfe6ff', 6.0),
        archalo=M.xray('b_archalo', color='#9cc4ff', alpha=0.22, strength=1.5),
        arrow=M.emit('b_arrow', '#55ff66', 3.0),
        gem=M.emit('b_gem', '#3cff4a', 6.0),
        navy=M.pbr('b_navy', '#0f2442', rough=0.18, metal=0.7),
        tan=M.pbr('b_tan', '#c99a5e', rough=0.45, metal=0.5),
        rail=M.pbr('b_rail', '#5b6676', rough=0.12, metal=1.0),
        rubber=M.pbr('b_rubber', '#141416', rough=0.8),
        xr=M.xray('b_xray', alpha=0.18, strength=1.2),
        xr2=M.xray('b_xray2', alpha=0.6, strength=1.8),
        xr3=M.xray('b_xray3', alpha=0.65, strength=2.0),
        snowy=M.snow_rock('b_snowy', thresh=0.45, scale=0.25, img_rock=C.T('mountain_rock.png'), img_snow=C.T('snow.png')),
        darksnow=M.snow_rock('b_darksnow', thresh=0.93, scale=0.25, rock_col='#18202e', img_snow=C.T('snow.png')),
        platsteel=M.steel('b_platsteel', color='#7d848e', rough=0.16, panels=0.8, panel_scale=1.4),
        darkground=M.pbr('b_darkground', '#3a3b40', rough=0.9, img=C.T('dirt_dark.png'), tint='#6a6c72', scale=0.2, bump=0.5),
        therm_r=M.pbr('b_therm_r', '#e0262a', rough=0.25, emit='#ff3030', emit_strength=1.5),
        therm_b=M.pbr('b_therm_b', '#2a6cff', rough=0.25, emit='#3d7bff', emit_strength=1.5),
        tglass=M.xray('b_tglass', color='#ffffff', alpha=0.18, strength=0.4),
        xrb=M.xray('b_xray_beam', alpha=0.85, strength=1.3, fresnel=False),
        xrs=M.xray('b_xray_solid', alpha=0.85, strength=1.2, fresnel=False),
    )
    return _MB


# ---------------------------------------------------------------- mesh builders
def _obj(name, verts, faces, mat, smooth=False, parent=None):
    me = bpy.data.meshes.new(name)
    verts = np.asarray(verts, np.float32).reshape(-1, 3); faces = np.asarray(faces, np.int32)
    k = faces.shape[1]
    me.vertices.add(len(verts)); me.vertices.foreach_set('co', verts.ravel())
    me.loops.add(faces.size); me.loops.foreach_set('vertex_index', faces.ravel())
    me.polygons.add(len(faces)); me.polygons.foreach_set('loop_start', (np.arange(len(faces)) * k).astype(np.int32))
    me.polygons.foreach_set('loop_total', np.full(len(faces), k, np.int32))
    me.update(calc_edges=True); me.validate()
    if smooth: me.shade_smooth()
    if mat: me.materials.append(mat)
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob


def tubes(name, segs, r=0.05, mat=None, sides=6, parent=None, smooth=True):
    """Many straight tubes (struts, cables, net wires, columns) as ONE mesh. segs: array (n, 2, 3); r scalar or (n,)."""
    S = np.asarray(segs, np.float64).reshape(-1, 2, 3)
    n = len(S)
    if n == 0: return None
    r = np.broadcast_to(np.asarray(r, np.float64), (n,))
    p0, p1 = S[:, 0], S[:, 1]
    d = p1 - p0; L = np.linalg.norm(d, axis=1, keepdims=True); d = d / np.maximum(L, 1e-9)
    ref = np.where(np.abs(d[:, 2:3]) < 0.9, np.array([[0, 0, 1.0]]), np.array([[1.0, 0, 0]]))
    u = np.cross(d, ref); u /= np.linalg.norm(u, axis=1, keepdims=True); v = np.cross(d, u)
    a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    ring = np.cos(a)[None, :, None] * u[:, None, :] + np.sin(a)[None, :, None] * v[:, None, :]   # n,s,3
    ring = ring * r[:, None, None]
    V = np.concatenate([p0[:, None] + ring, p1[:, None] + ring], 1)   # n, 2s, 3
    base = (np.arange(n) * 2 * sides)[:, None]
    i = np.arange(sides); j = (i + 1) % sides
    q = np.stack([i, j, j + sides, i + sides], 1)[None] + base[:, :, None]   # n,s,4
    ob = _obj(name, V.reshape(-1, 3), q.reshape(-1, 4), mat, smooth=smooth, parent=parent)
    return ob


def boxes(name, centers, sizes, mat=None, rotz=None, parent=None):
    """Many boxes as ONE mesh. centers (n,3), sizes (n,3) or (3,), rotz degrees (n,) or None."""
    c = np.asarray(centers, np.float64).reshape(-1, 3); n = len(c)
    s = np.broadcast_to(np.asarray(sizes, np.float64), (n, 3))
    cube = np.array([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]) * 0.5
    V = cube[None] * s[:, None]
    if rotz is not None:
        rz = np.radians(np.broadcast_to(np.asarray(rotz, np.float64), (n,)))
        cs, sn = np.cos(rz)[:, None], np.sin(rz)[:, None]
        x, y = V[..., 0].copy(), V[..., 1].copy(); V[..., 0] = x * cs - y * sn; V[..., 1] = x * sn + y * cs
    V = V + c[:, None]
    F = np.array([[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]])
    F = F[None] + (np.arange(n) * 8)[:, None, None]
    return _obj(name, V.reshape(-1, 3), F.reshape(-1, 4), mat, parent=parent)


def ring_band(name, r, z0, z1, mat, a0=0.0, a1=2 * math.pi, nu=160, parent=None, smooth=True, inward=False):
    """Open cylinder band (or arc strip a0..a1) radius r from z0 to z1."""
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    u = np.linspace(a0, a1, nu, endpoint=not full)
    V = np.concatenate([np.stack([r * np.cos(u), r * np.sin(u), np.full(nu, z0)], 1),
                        np.stack([r * np.cos(u), r * np.sin(u), np.full(nu, z1)], 1)])
    i = np.arange(nu if full else nu - 1); j = (i + 1) % nu
    q = np.stack([i, j, j + nu, i + nu], 1)
    if inward: q = q[:, ::-1]
    return _obj(name, V, q, mat, smooth=smooth, parent=parent)


def lattice(segs, p0, p1, w, step, up=(0, 0, 1), tri=False):
    """Append lattice-boom struts from p0 to p1 (square, or triangular if tri) of width w, bays of length step."""
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length; d.normalize()
    a = Vector(up).cross(d)
    if a.length < 1e-6: a = Vector((1, 0, 0)).cross(d)
    a.normalize(); b = d.cross(a).normalized()
    if tri: corners = [a * (-w / 2), a * (w / 2), b * (w * 0.8)]
    else: corners = [(a * sx + b * sy) * (w / 2) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    nb = max(1, int(round(L / step)))
    pts = [[p0 + d * (L * k / nb) + c for c in corners] for k in range(nb + 1)]
    m = len(corners)
    for c in range(m): segs.append((pts[0][c], pts[-1][c]))                     # chords
    for k in range(nb + 1):
        for c in range(m): segs.append((pts[k][c], pts[k][(c + 1) % m]))       # rungs
    for k in range(nb):
        for c in range(m):
            if (k + c) % 2: segs.append((pts[k][c], pts[k + 1][(c + 1) % m]))
            else: segs.append((pts[k][(c + 1) % m], pts[k + 1][c]))            # zigzag diagonals
    return segs


# ---------------------------------------------------------------- tower crane
def tower_crane(name, base, height=40.0, jib=55.0, counter=16.0, yaw=0.0, mast_w=2.2, mt=None, hook=(0.65, 20.0), luff=0.0):
    """Red lattice tower crane: mast, slewing unit + cab with glass, jib + counter-jib, apex with tie bars,
    counterweights, trolley, hook block + cables. base = foot position (world), yaw degrees (jib direction)."""
    mt = mt or mats()
    root = cz.empty(name, base); root.rotation_euler = (0, 0, math.radians(yaw))
    segs = []
    lattice(segs, (0, 0, 0), (0, 0, height), mast_w, mast_w, up=(1, 0, 0))
    zj = height + 1.2
    cl, sl = math.cos(math.radians(luff)), math.sin(math.radians(luff)); je = (jib * cl, 0, zj + jib * sl)
    lattice(segs, (0, 0, zj), je, mast_w * 0.8, mast_w, tri=True)
    lattice(segs, (0, 0, zj), (-counter, 0, zj), mast_w * 0.9, mast_w)
    lattice(segs, (0, 0, zj), (0, 0, zj + 7), mast_w * 0.7, mast_w * 0.7, up=(1, 0, 0))
    m = tubes(name + '_lat', segs, 0.09 * mast_w / 2.2, mt['crane'], sides=5, parent=root)
    lad = [((mast_w * 0.5 + 0.05, -0.3, z), (mast_w * 0.5 + 0.05, 0.3, z)) for z in np.arange(0.5, height, 0.35)]
    lad += [((mast_w * 0.5 + 0.05, sy * 0.3, 0.3), (mast_w * 0.5 + 0.05, sy * 0.3, height)) for sy in (-1, 1)]
    lad += [((x, sy * mast_w * 0.45, zj + 0.9), (x + 2.0, sy * mast_w * 0.45, zj + 0.9 + 2.0 * math.tan(math.radians(luff)))) for x in np.arange(0, je[0] - 2, 2.0) for sy in (-1, 1)]
    tubes(name + '_ladder', lad, 0.025, mt['grey'], sides=4, parent=root)
    tie = [((0, 0, zj + 7), (je[0] * 0.55, 0, zj + (je[2] - zj) * 0.55 + 1.6)), ((0, 0, zj + 7), (je[0], 0, je[2] + 1.6)), ((0, 0, zj + 7), (-counter, 0, zj + 0.6))]
    tubes(name + '_tie', tie, 0.12 * mast_w / 2.2, mt['crane'], sides=6, parent=root)
    s = mast_w
    cz.box(name + '_slew', (s * 1.4, s * 1.4, 1.2), (0, 0, height + 0.6), mat=mt['crane'], bevel=0.08, ol=0, parent=root)
    cab = cz.box(name + '_cab', (s * 0.9, s * 0.9, s * 0.9), (s * 0.4, -s * 0.95, height + 1.6), mat=mt['white'], bevel=0.1, ol=0, parent=root)
    cz.box(name + '_cabg', (s * 0.92, s * 0.6, s * 0.5), (s * 0.4 + 0.05, -s * 1.0, height + 1.75), mat=mt['glass'], bevel=0.05, ol=0, parent=root)
    cz.box(name + '_cw', (3.2, s * 1.1, 2.6), (-counter + 2.2, 0, zj - 1.4), mat=mt['concrete'], bevel=0.08, ol=0, parent=root)
    cz.box(name + '_cw2', (2.4, s * 1.0, 1.6), (-counter + 5.4, 0, zj - 0.8), mat=mt['grey'], bevel=0.06, ol=0, parent=root)
    tx = je[0] * hook[0]; zt = zj + (je[2] - zj) * hook[0]; drop = hook[1]
    cz.box(name + '_trol', (1.6, s * 0.9, 0.6), (tx, 0, zt - 0.6), mat=mt['grey'], bevel=0.05, ol=0, parent=root)
    hz = zt - drop
    tubes(name + '_cab_l', [((tx - 0.3, 0, zt - 0.9), (tx - 0.3, 0, hz + 1.2)), ((tx + 0.3, 0, zt - 0.9), (tx + 0.3, 0, hz + 1.2))], 0.04, mt['cable'], parent=root)
    cz.box(name + '_hook', (1.1, 0.7, 1.4), (tx, 0, hz + 0.5), mat=mt['mach'], bevel=0.12, ol=0, parent=root)
    cz.box(name + '_foot', (s * 2.6, s * 2.6, 1.0), (0, 0, 0.0), mat=mt['concrete'], bevel=0.05, ol=0, parent=root)
    root['hook_local'] = (tx, 0, hz)
    return root


# ---------------------------------------------------------------- the net over the cap
def surface_bvh(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    bpy.context.view_layer.update()
    return BVHTree.FromObject(ob, dg), ob.matrix_world.copy()


def drape_fn(cap_ob, rad=R * 1.1, cell=0.4, dilate=4, sigma=5.0, lift=0.5):
    """Smooth drape surface over the cap: sample its heights on a grid, dilate (max filter) so the sheet rests on
    the peaks, Gaussian-blur, lift. Returns h(x, y) (bilinear) or None outside the cap."""
    bvh, mw = surface_bvh(cap_ob); inv = mw.inverted(); dd = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
    xs = np.arange(-rad, rad + 1e-6, cell); n = len(xs)
    Z = np.full((n, n), np.nan)
    for i, y in enumerate(xs):
        for j, x in enumerate(xs):
            hit = bvh.ray_cast(inv @ Vector((x, y, 300)), dd)
            if hit[0] is not None: Z[i, j] = (mw @ hit[0]).z
    base = np.nanmin(Z); Zf = np.where(np.isnan(Z), base, Z)
    D = Zf.copy()
    for di in range(-dilate, dilate + 1):
        for dj in range(-dilate, dilate + 1):
            if di * di + dj * dj <= dilate * dilate:
                D = np.maximum(D, np.roll(np.roll(Zf, di, 0), dj, 1))
    k = np.exp(-0.5 * (np.arange(-3 * sigma, 3 * sigma + 1) / sigma) ** 2); k /= k.sum()
    P = int(3 * sigma)
    B = np.apply_along_axis(lambda v: np.convolve(np.pad(v, P, mode='edge'), k, mode='valid'), 0, D)
    B = np.apply_along_axis(lambda v: np.convolve(np.pad(v, P, mode='edge'), k, mode='valid'), 1, B)
    B = np.maximum(B, Zf + 0.15) + lift
    valid = ~np.isnan(Z)
    def h(x, y):
        fx, fy = (x + rad) / cell, (y + rad) / cell
        j0, i0 = int(math.floor(fx)), int(math.floor(fy))
        if not (0 <= i0 < n - 1 and 0 <= j0 < n - 1) or not valid[i0, j0]: return None
        tx, ty = fx - j0, fy - i0
        return float(B[i0, j0] * (1 - tx) * (1 - ty) + B[i0, j0 + 1] * tx * (1 - ty) + B[i0 + 1, j0] * (1 - tx) * ty + B[i0 + 1, j0 + 1] * tx * ty)
    return h


def cap_net(name, cap_ob, spacing=1.0, lift=0.12, r=0.045, mat=None, rad=R * 0.995, step=0.25, side_to=None, parent=None, top=True, drape=None):
    """Steel mesh draped on the cap: grid lines every spacing, sampled every step and dropped onto the cap surface
    (ray cast down), lift above it. side_to=z: the grid continues down the slab wall (vertical lines + rings)."""
    bvh, mw = surface_bvh(cap_ob); inv = mw.inverted()
    def z_at(x, y):
        o = inv @ Vector((x, y, 200)); dd = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
        hit = bvh.ray_cast(o, dd)
        if hit[0] is None: return None
        w = mw @ hit[0]; nrm = (mw.to_3x3() @ hit[1]).normalized()
        return w + nrm * lift
    segs = []
    ks = np.arange(-rad, rad + 1e-6, spacing)
    for axis in ((0, 1) if top else ()):
        for k in ks:
            span = math.sqrt(max(0, rad * rad - k * k))
            ts = np.arange(-span, span + 1e-6, step)
            pts = []
            for t in ts:
                x, y = (t, k) if axis == 0 else (k, t)
                if drape:
                    hz = drape(x, y); p = Vector((x, y, hz + (lift - 0.4))) if hz is not None else None
                else: p = z_at(x, y)
                if p is not None: pts.append(p)
            if len(pts) > 4 and not drape:      # wire rides over the peaks (never dips between samples)
                zz = np.array([p.z for p in pts]); kz = np.exp(-np.linspace(-2, 2, 25) ** 2); kz /= kz.sum()
                zs = np.convolve(np.pad(zz, 12, mode='edge'), kz, mode='valid') + 0.25
                zz = np.maximum(zz, zs)
                for p, z in zip(pts, zz): p.z = float(z)
            segs += [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    if side_to is not None:
        body = bpy.data.objects.get('slab_body')
        bb, bmw = surface_bvh(body); binv = bmw.inverted()
        def wall(a, z):
            o = binv @ Vector((40 * math.cos(a), 40 * math.sin(a), z)); d = (binv.to_3x3() @ Vector((-math.cos(a), -math.sin(a), 0))).normalized()
            h = bb.ray_cast(o, d)
            rw = (bmw @ h[0]).xy.length if h[0] is not None else R
            return Vector(((rw + lift + 0.1) * math.cos(a), (rw + lift + 0.1) * math.sin(a), z))
        n = int(2 * math.pi * R * 1.05 / spacing)
        zs = list(np.arange(side_to, C.H - 0.01, spacing)) + [C.H - 0.05]
        grid = [[wall(2 * math.pi * i / n, z) for z in zs] for i in range(n)]
        for i in range(n):
            col = grid[i]
            segs += [(col[k], col[k + 1]) for k in range(len(col) - 1)]
            top = z_at(rad * 0.97 * math.cos(2 * math.pi * i / n), rad * 0.97 * math.sin(2 * math.pi * i / n))
            if top is not None: segs.append((col[-1], top))
            for k in range(len(zs)):
                segs.append((col[k], grid[(i + 1) % n][k]))
    return tubes(name, segs, r, mat, sides=5, parent=parent)


def straps(name, mt, angles, z0, z1, width=1.1, r=R * 1.06 + 0.45, parent=None):
    """Yellow hazard straps down the slab wall (curved strips) + a polished steel belt ring at mid height."""
    obs = []
    for i, a in enumerate(angles):
        da = width / r / 2
        obs.append(ring_band(f'{name}_{i}', r, z0, z1, mt['strapy'], a - da, a + da, nu=12, parent=parent))
    return obs


# ---------------------------------------------------------------- legs, columns, machinery
def red_leg(segs, foot, top, w=1.2, step=1.6):
    return lattice(segs, foot, top, w, step, up=(0, 0, 1) if abs(Vector(top).z - Vector(foot).z) < 0.1 else (1, 0, 0))


def slab_legs(name, mt, z_under, n=6, r_top=R * 0.95, r_foot=R * 1.35, w=1.4, parent=None):
    """Red + white lattice legs from the ground up to the slab underside (the reference's 'lifted on legs')."""
    red, wht = [], []
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n; c, s = math.cos(a), math.sin(a)
        foot = Vector((r_foot * c, r_foot * s, 0)); top = Vector((r_top * c, r_top * s, z_under))
        mid = foot.lerp(top, 0.5)
        lattice(red if i % 2 == 0 else wht, foot, top, w, w * 1.2, up=(c, s, 0))
    tubes(name + '_red', red, 0.12, mt['crane'], sides=5, parent=parent)
    tubes(name + '_wht', wht, 0.12, mt['white'], sides=5, parent=parent)
    pads = [((r_foot * math.cos(2 * math.pi * (i + 0.5) / n), r_foot * math.sin(2 * math.pi * (i + 0.5) / n), 0.25)) for i in range(n)]
    boxes(name + '_pads', pads, (3.0, 3.0, 0.5), mt['concrete'], parent=parent)
    # the ring beam under the slab (the reference's dark disk edge)
    ring_band(name + '_beam', R * 0.98, z_under - 0.6, z_under, mt['dark'], nu=120, parent=parent)


def support_columns(name, mt, z_under, rad=R * 0.92, spacing=0.75, r=0.12, seed=4, xray=True, top_cap=True, parent=None, zfun=None, zlen=None):
    """Thousands of support columns under the slab (one mesh) + their green x-ray twin (one mesh)."""
    rnd = random.Random(seed)
    segs = []
    for x in np.arange(-rad, rad, spacing):
        for y in np.arange(-rad, rad, spacing):
            xx, yy = x + rnd.uniform(-0.12, 0.12), y + rnd.uniform(-0.12, 0.12)
            if xx * xx + yy * yy > rad * rad: continue
            zb = zfun(xx, yy) if zfun else 0.0
            segs.append(((xx, yy, z_under - zlen * rnd.uniform(0.7, 1.0) if zlen else zb), (xx, yy, z_under)))
    col = tubes(name, segs, r, mt['colmn'], sides=8, parent=parent)
    xo = None
    if xray:
        xo = tubes(name + '_xr', segs, r * 1.2, mt['xr'], sides=8, parent=parent)
    return col, xo, len(segs)


def _equip_sources(mt):
    """One source group per kind of site equipment (instanced with linked duplicates)."""
    src = {}
    # shipping container: shell + corrugation ribs + door bars + corner castings
    for k, col in (('cont_w', 'white'), ('cont_b', 'pole_b'), ('cont_r', 'crane')):
        r = cz.empty('src_' + k, (0, 0, -500))
        cz.box(k + '_shell', (2.4, 1.0, 1.05), (0, 0, 0.525), mat=mt[col], bevel=0.02, ol=0, parent=r)
        boxes(k + '_rib', [(x, sy * 0.505, 0.525) for x in np.arange(-1.1, 1.11, 0.1) for sy in (-1, 1)], (0.04, 0.02, 0.95), mt[col], parent=r)
        tubes(k + '_bar', [((1.205, y, 0.08), (1.205, y, 0.97)) for y in (-0.3, -0.1, 0.1, 0.3)], 0.015, mt['grey'], parent=r)
        boxes(k + '_cast', [(sx * 1.17, sy * 0.47, sz) for sx in (-1, 1) for sy in (-1, 1) for sz in (0.04, 1.01)], (0.08, 0.08, 0.08), mt['dark'], parent=r)
        src[k] = r
    # generator set: skid, yellow canopy, radiator grille, exhaust stack, panel
    r = cz.empty('src_gen', (0, 0, -500))
    cz.box('gen_skid', (2.2, 0.95, 0.12), (0, 0, 0.06), mat=mt['dark'], bevel=0.01, ol=0, parent=r)
    cz.box('gen_body', (2.0, 0.85, 0.95), (0, 0, 0.6), mat=mt['mach'], bevel=0.05, ol=0, parent=r)
    boxes('gen_grille', [(1.005, 0, 0.35 + 0.06 * i) for i in range(10)], (0.02, 0.7, 0.025), mt['dark'], parent=r)
    boxes('gen_vent', [(x, -0.43, 0.75) for x in np.arange(-0.8, 0.5, 0.12)], (0.06, 0.02, 0.35), mt['dark'], parent=r)
    cz.cyl('gen_stack', 0.07, 0.55, (-0.6, 0.2, 1.07), mat=mt['grey'], verts=16, ol=0, parent=r)
    cz.box('gen_panel', (0.3, 0.02, 0.35), (0.5, -0.435, 0.7), mat=mt['white'], bevel=0.01, ol=0, parent=r)
    src['gen'] = r
    # cable drum: two flanges, core, wound cable
    r = cz.empty('src_drum', (0, 0, -500))
    for sy in (-1, 1): cz.cyl(f'drum_fl{sy}', 0.55, 0.06, (0, sy * 0.32, 0.55), mat=mt['tan'], rot=(90, 0, 0), verts=32, ol=0, parent=r)
    cz.cyl('drum_cable', 0.42, 0.58, (0, 0.29, 0.55), mat=mt['cable'], rot=(90, 0, 0), verts=32, ol=0, parent=r)
    src['drum'] = r
    # small mobile crane: carrier, cab with glass, turret, inclined telescopic boom, outriggers
    r = cz.empty('src_mcrane', (0, 0, -500))
    cz.box('mc_carrier', (3.2, 1.0, 0.45), (0, 0, 0.55), mat=mt['mach'], bevel=0.04, ol=0, parent=r)
    tubes('mc_wheels', [((x, -0.55, 0.3), (x, 0.55, 0.3)) for x in (-1.1, -0.4, 0.6, 1.2)], 0.28, mt['rubber'], sides=14, parent=r)
    cz.box('mc_cab', (0.6, 0.9, 0.6), (1.35, 0, 1.05), mat=mt['mach'], bevel=0.05, ol=0, parent=r)
    cz.box('mc_glass', (0.62, 0.7, 0.3), (1.37, 0, 1.15), mat=mt['glass'], bevel=0.02, ol=0, parent=r)
    cz.box('mc_turret', (0.9, 0.8, 0.45), (-0.5, 0, 1.0), mat=mt['mach'], bevel=0.04, ol=0, parent=r)
    tubes('mc_boom', [((-0.4, 0, 1.15), (2.6, 0, 3.2))], 0.13, mt['mach'], sides=8, parent=r)
    tubes('mc_boom2', [((2.4, 0, 3.05), (3.6, 0, 3.9))], 0.09, mt['grey'], sides=8, parent=r)
    tubes('mc_hook', [((3.6, 0, 3.9), (3.6, 0, 2.2))], 0.012, mt['cable'], parent=r)
    tubes('mc_out', [((x, -0.5, 0.45), (x, -1.2, 0.05)) for x in (-1.3, 1.0)] + [((x, 0.5, 0.45), (x, 1.2, 0.05)) for x in (-1.3, 1.0)], 0.06, mt['grey'], parent=r)
    src['mcrane'] = r
    return src


def machinery(name, mt, n, area, seed=7, z=0.0, avoid=None, parent=None):
    """Site equipment piles under the slab: shipping containers (stacked), generator sets, cable drums, small mobile
    cranes - one source each, the rest linked duplicates."""
    rnd = random.Random(seed); src = _equip_sources(mt); out = []
    kinds = ['cont_w', 'cont_w', 'cont_b', 'cont_r', 'gen', 'gen', 'drum', 'drum', 'mcrane']
    for i in range(n):
        for _ in range(30):
            x, y = rnd.uniform(area[0][0], area[1][0]), rnd.uniform(area[0][1], area[1][1])
            if not (avoid and avoid(x, y)): break
        k = rnd.choice(kinds); rot = rnd.choice([0, 90, 180]) + rnd.uniform(-10, 10); s = rnd.uniform(0.9, 1.15)
        stack = rnd.choice([1, 1, 2, 3]) if k.startswith('cont') else 1
        for st in range(stack):
            kk = k if st == 0 else rnd.choice(['cont_w', 'cont_b', 'cont_r'])
            o = instance_tree(src[kk], f'{name}_{i}_{st}', (x, y, z + st * 1.06 * s), yaw=rot + rnd.uniform(-4, 4), scale=s)
            if parent: o.parent = parent
            out.append(o)
    return out


# ---------------------------------------------------------------- the steel platform
def platform(name, mt, z_top, height=6.0, r=R * 1.0, fins=True, fin_h=1.6, parent=None, rows=4, cols=40):
    """Polished steel-panelled skirt below the slab + the copper fin band at its top + dark seams.
    Returns (skirt, fins, xray skirt)."""
    root = cz.empty(name, (0, 0, 0), parent=parent)
    zb = z_top - fin_h - height
    sk = ring_band(name + '_skirt', r, zb, z_top - fin_h, mt['platsteel'], nu=200, parent=root)
    # panel seams: horizontal rings + vertical ribs (raised)
    segs = []
    for k in range(rows + 1):
        z = zb + height * k / rows
        for i in range(cols * 3):
            a0, a1 = 2 * math.pi * i / (cols * 3), 2 * math.pi * (i + 1) / (cols * 3)
            segs.append(((r * math.cos(a0) * 1.004, r * math.sin(a0) * 1.004, z), (r * math.cos(a1) * 1.004, r * math.sin(a1) * 1.004, z)))
    for i in range(cols):
        a = 2 * math.pi * i / cols
        segs.append(((r * 1.004 * math.cos(a), r * 1.004 * math.sin(a), zb), (r * 1.004 * math.cos(a), r * 1.004 * math.sin(a), z_top - fin_h)))
    tubes(name + '_seams', segs, 0.035, mt['dark'], sides=4, parent=root)
    fo = None
    if fins:
        n = 220; cen, siz, rz = [], [], []
        for i in range(n):
            a = 2 * math.pi * i / n
            cen.append(((r + 0.05) * math.cos(a), (r + 0.05) * math.sin(a), z_top - fin_h / 2)); rz.append(math.degrees(a))
        fo = boxes(name + '_fins', cen, (0.5, 0.06, fin_h), mt['copper'], rotz=rz, parent=root)
        ring_band(name + '_finback', r - 0.15, z_top - fin_h, z_top, mt['dark'], nu=120, parent=root)
        ring_band(name + '_lip', r + 0.32, z_top - 0.12, z_top + 0.05, mt['band'], nu=160, parent=root)
        ring_band(name + '_lip2', r + 0.32, z_top - fin_h - 0.05, z_top - fin_h + 0.1, mt['band'], nu=160, parent=root)
    xs = ring_band(name + '_xr', r + 0.08, zb, z_top - fin_h, mt['xr2'], nu=200, parent=root)
    # bottom plate
    ring_band(name + '_bot', r * 0.999, zb - 0.4, zb, mt['dark'], nu=120, parent=root)
    return root, sk, fo, xs


def rails(name, mt, length, gauge=6.0, n=2, spacing=5.0, z=0.0, x0=0.0, sleepers=True, parent=None, y_axis=True):
    """n tracks along Y (from x0), each a pair of rails on sleepers. Returns root."""
    root = cz.empty(name, (0, 0, z), parent=parent)
    segs, cen = [], []
    for k in range(n):
        xc = x0 + (k - (n - 1) / 2) * spacing
        for side in (-1, 1):
            xr = xc + side * gauge / 2 * 0.25
            segs.append(((xr, -length / 2, 0.35), (xr, length / 2, 0.35)))
        if sleepers:
            for y in np.arange(-length / 2, length / 2, 1.2):
                cen.append((xc, y, 0.12))
    tubes(name + '_r', segs, 0.2, mt['rail'], sides=6, parent=root)
    if cen: boxes(name + '_s', cen, (gauge * 0.4, 0.35, 0.24), mt['navy'], parent=root)
    boxes(name + '_bed', [(x0 + (k - (n - 1) / 2) * spacing, 0, 0.05) for k in range(n)], (gauge * 0.55, length, 0.1), mt['navy'], parent=root)
    return root


# ---------------------------------------------------------------- the magnet hall
def magnet(name, mt, loc=(0, 0, 0), size=1.0, yaw=0.0, parent=None, poles=True, Rr=1.0):
    """Horseshoe electromagnet: a half-torus copper coil body (ribbed), two coil legs, red/blue pole caps, base plate."""
    root = cz.empty(name, loc, parent=parent); root.rotation_euler = (0, 0, math.radians(yaw)); root.scale = (size,) * 3
    rr, LH = 0.42 * (1 + 0.25 * (Rr - 1)), 2.4
    nu, nv = 40, 16
    u = np.linspace(0, math.pi, nu); v = np.linspace(0, 2 * math.pi, nv, endpoint=False)
    U, Vv = np.meshgrid(u, v, indexing='ij')
    rib = np.ones_like(U)
    X = (Rr + rr * rib * np.cos(Vv)) * np.cos(U); Z = (Rr + rr * rib * np.cos(Vv)) * np.sin(U) + LH; Y = rr * rib * np.sin(Vv)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    for half, (a0, a1), mm in ((0, (0, nu // 2 + 1), mt["pole_b"]), (1, (nu // 2, nu), mt["pole_r"])):
        ii = np.arange(a0 * nv, a1 * nv).reshape(-1, nv) - a0 * nv; jj = np.roll(ii, -1, 1)
        q = np.stack([ii[:-1].ravel(), jj[:-1].ravel(), jj[1:].ravel(), ii[1:].ravel()], 1)
        _obj(name + f"_arch{half}", verts[a0 * nv:a1 * nv], q, mm, smooth=True, parent=root)
    nr = 26
    cz.box(name + "_core", (2 * Rr, rr * 0.9, 0.3), (0, 0, LH - 0.1), mat=mt["grey"], bevel=0.03, ol=0, parent=root)
    for sx in (-1, 1):
        cz.cyl(name + f'_leg{sx}', rr * 1.25, LH, (sx * Rr, 0, 0), mat=mt['coil'], verts=32, ol=0, parent=root)
        tubes(name + f'_wind{sx}', [((sx * Rr, 0, z), (sx * Rr, 0, z + 0.035)) for z in np.linspace(0.15, LH - 0.2, nr)], rr * 1.3, mt['copper'], sides=24, parent=root)
        if poles:
            cz.cyl(name + f'_pole{sx}', rr * 1.12, 0.35, (sx * Rr, 0, -0.05), mat=mt['pole_r'] if sx < 0 else mt['pole_b'], verts=24, ol=0, parent=root)
        cz.cyl(name + f'_ring{sx}', rr * 1.32, 0.12, (sx * Rr, 0, LH - 0.1), mat=mt['grey'], verts=24, ol=0, parent=root)
    cz.box(name + '_base', (2 * Rr + 1.0, 1.2, 0.25), (0, 0, -0.15), mat=mt['grey'], bevel=0.04, ol=0, parent=root)
    return root


def instance_tree(src, name, loc, yaw=0.0, scale=1.0):
    """Linked duplicate of a parented group (empty + mesh children share their data)."""
    root = cz.empty(name, loc); root.rotation_euler = (0, 0, math.radians(yaw)); root.scale = (scale,) * 3
    for ch in src.children:
        o = ch.copy(); bpy.context.scene.collection.objects.link(o); o.parent = root
        o.matrix_parent_inverse = ch.matrix_parent_inverse.copy()
    return root


def fan(name, mt, loc, size=2.0, parent=None):
    """Cooling fan unit: housing box, round grille ring, hub and 7 blades."""
    root = cz.empty(name, loc, parent=parent)
    cz.box(name + '_h', (size, size, size * 0.35), (0, 0, size * 0.175), mat=mt['grey'], bevel=0.05, ol=0, parent=root)
    ring_band(name + '_rg', size * 0.42, size * 0.35, size * 0.38, mt['dark'], nu=40, parent=root)
    cz.cyl(name + '_hub', size * 0.09, size * 0.05, (0, 0, size * 0.35), mat=mt['dark'], ol=0, parent=root)
    cen, siz, rz = [], [], []
    for k in range(7):
        a = 2 * math.pi * k / 7
        cen.append((math.cos(a) * size * 0.24, math.sin(a) * size * 0.24, size * 0.37)); rz.append(math.degrees(a) + 25)
    boxes(name + '_bl', cen, (size * 0.32, size * 0.11, 0.03), mt['dark'], rotz=rz, parent=root)
    g = []
    for k in np.linspace(-0.4, 0.4, 9):
        g.append(((-size * 0.42, k * size, size * 0.39), (size * 0.42, k * size, size * 0.39)))
    tubes(name + '_gr', g, 0.012 * size, mt['dark'], sides=4, parent=root)
    return root


def ceiling(name, mt, w, d, z, cell=2.0, parent=None):
    """Grid ceiling: deep dark beams in both directions + one emissive light panel per cell."""
    cen, siz = [], []
    for x in np.arange(-w / 2, w / 2 + 1e-6, cell): cen.append((x, 0, z)); siz.append((0.3, d, 1.2))
    for y in np.arange(-d / 2, d / 2 + 1e-6, cell): cen.append((0, y, z)); siz.append((w, 0.3, 1.2))
    boxes(name + '_beams', cen, siz, mt['dark'], parent=parent)
    lc = [(x + cell / 2, y + cell / 2, z + 0.2) for i, x in enumerate(np.arange(-w / 2, w / 2 - 1e-6, cell)) for j, y in enumerate(np.arange(-d / 2, d / 2 - 1e-6, cell)) if (i + j) % 2 == 0]
    boxes(name + '_lamps', lc, (cell * 0.62, cell * 0.08, 0.05), mt['lamp'], rotz=[35] * len(lc), parent=parent)
    boxes(name + '_plate', [(0, 0, z + 0.35)], (w, d, 0.1), mt['dark'], parent=parent)


def arcs(name, mt, pairs, seed=1, jag=0.25, n=10, r=0.025, parent=None):
    """Lightning arcs: jagged polylines between point pairs (thin emissive tubes)."""
    rnd = random.Random(seed); segs = []
    for a, b in pairs:
        a, b = Vector(a), Vector(b)
        pts = [a.lerp(b, k / n) + (Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * jag if 0 < k < n else Vector()) for k in range(n + 1)]
        segs += [(pts[k], pts[k + 1]) for k in range(n)]
        if rnd.random() < 0.6:
            k = rnd.randrange(2, n - 2); e = pts[k] + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * jag * 3
            segs.append((pts[k], e))
    return tubes(name, segs, r, mt['arc'], sides=4, parent=parent)


def arrow(name, mt, loc, size=1.0, parent=None, mat=None):
    """Green up-arrow (shaft + head), flat card facing -Y, emissive."""
    m = mat or mt['arrow']
    root = cz.empty(name, loc, parent=parent)
    cz.box(name + '_s', (0.18 * size, 0.08 * size, 0.7 * size), (0, 0, 0.35 * size), mat=m, bevel=0, ol=0, parent=root)
    V = np.array([[-0.32, 0, 0.6], [0.32, 0, 0.6], [0, 0, 1.0], [-0.32, -0.04, 0.6], [0.32, -0.04, 0.6], [0, -0.04, 1.0]]) * size
    _obj(name + '_h', V, [[0, 2, 1], [3, 4, 5]], m, parent=root)
    return root


# ---------------------------------------------------------------- shared scene: the wrap (E11-E13)
def scene_wrap(F1, net_drop=None, xray_keys=None, side=True, straps_on=False, cranes=None, side_span=None, F0=1, hole=13):
    """Slab + Everest cap + snow range + two tower cranes + the steel net (optionally lowered: net_drop=[(t, dz)]).
    cranes: [(base, yaw, height, jib)]; side_span: [(t0, t1)] when the wall net + straps show."""
    M.setup(F1, sun_elev=22, sun_rot=250, sky_sat=2.3, exposure=-0.45, light_sat=0.9, haze=0.6)
    mt = mats()
    C.slab('slab', mt)
    C.snow_range('range', mt, hole=hole)
    C.snow_range('farwrap', mt, hole=260, height=70, size=2400, res=200, z=-20, seed=11)
    M.heightfield('pitfloor', 2 * hole + 20, 120, lambda X, Y: 0.6 * M.fbm(X * 0.08, Y * 0.08, 2, 4) - 0.3, mat=mt['ground'], loc=(0, 0, 0.5))
    cap = bpy.data.objects['slab_cap']; cap.data.materials[0] = mt['snowy']
    cranes = cranes or [((-20, 16, -8), -40, 44, 40, 10), ((10, 22, -8), 233, 32, 40, 30)]
    for i, cr in enumerate(cranes):
        b, yaw, hh, jb = cr[:4]; lf = cr[4] if len(cr) > 4 else 30
        tower_crane(f"crane{i}", b, height=hh, jib=jb, counter=14, yaw=yaw, mt=mt, hook=(0.72, 9), mast_w=2.6, luff=lf)
    netroot = cz.empty('net', (0, 0, 0))
    dr = drape_fn(cap, rad=R * 1.1)
    cap_net('net_top', cap, spacing=1.3, r=0.09, step=0.3, lift=0.4, drape=dr, rad=R * 1.08, mat=mt['netsteel'], side_to=None, parent=netroot)
    rim = [];
    for i in range(120):
        a0, a1 = 2 * math.pi * i / 120, 2 * math.pi * (i + 1) / 120; rr = R * 1.07
        h0, h1 = dr(rr * math.cos(a0), rr * math.sin(a0)), dr(rr * math.cos(a1), rr * math.sin(a1))
        if h0 and h1: rim.append(((rr * math.cos(a0), rr * math.sin(a0), h0), (rr * math.cos(a1), rr * math.sin(a1), h1)))
    tubes('net_rim', rim, 0.2, mt['netsteel'], sides=8, parent=netroot)
    # enrich (E12): net clamps on the rim, a snow lip round the top edge, hook slings down to the net, snow drifts at the foot
    cl, rz = [], []
    for i in range(18):
        a = 2 * math.pi * i / 18; rr = R * 1.08; h = dr(rr * math.cos(a), rr * math.sin(a))
        if h: cl.append((rr * math.cos(a), rr * math.sin(a), h - 0.15)); rz.append(math.degrees(a))
    boxes('net_clamps', cl, (0.5, 0.35, 0.6), mt['dark'], rotz=rz, parent=netroot)
    ring_band('snowlip', R * 1.105, C.H - 0.7, C.H + 0.15, mt['snow'], nu=200)
    for i in range(len(cranes)):
        cr = bpy.data.objects.get(f'crane{i}')
        if not cr: continue
        bpy.context.view_layer.update()
        hk = cr.matrix_world @ Vector(cr['hook_local'])
        if Vector((hk.x, hk.y)).length > R * 1.2: continue
        pts = [Vector((hk.x + dx, hk.y + dy, 0)) for dx, dy in ((2.5, 2.5), (-2.5, 2.5), (2.5, -2.5), (-2.5, -2.5))]
        sl = [(hk, Vector((p.x, p.y, (dr(p.x, p.y) or C.H) + 0.4))) for p in pts]
        tubes(f'slings{i}', sl, 0.04, mt['cable'], parent=netroot)
    if side:
        sn = cap_net('net_side', cap, spacing=1.05, r=0.06, mat=mt['netsteel'], side_to=4.0, top=False)
        if side_span: M.visible(sn, side_span, F0, F1)
    if straps_on:
        so = straps('strap', mt, [math.radians(a) for a in (-150, -112, -78, -40, -5)], 3.0, C.H + 0.3)
        so.append(ring_band('belt', R * 1.06 + 1.3, 10.8, 11.2, mt['band'], nu=200))
        # enrich (E13): catwalk round the rim (grated deck, brackets, handrail), anchor plates, a ladder, warning lamps
        wr = lambda z: R * (1 + 0.1 * z / C.H) + 0.25
        n = 90; deck, dz, rz, rail, brk = [], [], [], [], []
        for i in range(n):
            a = 2 * math.pi * i / n; c, s_ = math.cos(a), math.sin(a); r0 = wr(C.H) + 0.45
            deck.append((r0 * c, r0 * s_, C.H - 0.2)); rz.append(math.degrees(a))
            if i % 3 == 0:
                brk.append(((wr(C.H - 1.2) * c, wr(C.H - 1.2) * s_, C.H - 1.2), ((r0 + 0.35) * c, (r0 + 0.35) * s_, C.H - 0.25)))
                rail.append((((r0 + 0.4) * c, (r0 + 0.4) * s_, C.H - 0.2), ((r0 + 0.4) * c, (r0 + 0.4) * s_, C.H + 0.9)))
            a1 = 2 * math.pi * (i + 1) / n
            for zz in (C.H + 0.45, C.H + 0.9):
                rail.append((((r0 + 0.4) * c, (r0 + 0.4) * s_, zz), ((r0 + 0.4) * math.cos(a1), (r0 + 0.4) * math.sin(a1), zz)))
        so.append(boxes('catwalk', deck, (1.2, 0.8, 0.06), mt['netsteel'], rotz=rz))
        so.append(tubes('catwalk_rail', rail, 0.035, mt['grey'], sides=5))
        so.append(tubes('catwalk_brk', brk, 0.05, mt['dark'], sides=6))
        rnd = random.Random(9); ap, apz = [], []
        for i in range(140):
            a = rnd.uniform(-2.6, -0.3); z = rnd.uniform(3.5, C.H - 1)
            ap.append((wr(z) * math.cos(a), wr(z) * math.sin(a), z)); apz.append(math.degrees(a) + 90)
        so.append(boxes('anchor_plates', ap, (0.25, 0.05, 0.32), mt['dark'], rotz=apz))
        la = -1.25; lad = []
        for sx in (-0.25, 0.25):
            lad.append((((wr(3) + 0.1) * math.cos(la) - sx * math.sin(la), (wr(3) + 0.1) * math.sin(la) + sx * math.cos(la), 3), ((wr(C.H) + 0.1) * math.cos(la) - sx * math.sin(la), (wr(C.H) + 0.1) * math.sin(la) + sx * math.cos(la), C.H)))
        for z in np.arange(3.2, C.H, 0.35):
            rr = wr(z) + 0.1
            lad.append(((rr * math.cos(la) + 0.25 * math.sin(la), rr * math.sin(la) - 0.25 * math.cos(la), z), (rr * math.cos(la) - 0.25 * math.sin(la), rr * math.sin(la) + 0.25 * math.cos(la), z)))
        so.append(tubes('wall_ladder', lad, 0.03, mt['grey'], sides=4))
        wl = [(wr(z) * math.cos(a), wr(z) * math.sin(a), z) for a, z in ((-1.0, C.H + 0.3), (-1.6, 9.0), (-0.6, 6.0), (-2.1, C.H + 0.3))]
        so.append(boxes('warn_lamps', wl, (0.2, 0.2, 0.2), mt['warnlamp']))
        if side_span:
            for o in so: M.visible(o, side_span, F0, F1)
    if net_drop:
        bake_path = M.bake_path
        def pos(t):
            ks = net_drop
            if t <= ks[0][0]: return (0, 0, ks[0][1])
            for (a, za), (b, zb) in zip(ks, ks[1:]):
                if t <= b:
                    k = (t - a) / (b - a); k = k * k * (3 - 2 * k); return (0, 0, za + (zb - za) * k)
            return (0, 0, ks[-1][1])
        bake_path(netroot, 1, F1, pos=pos)
    if xray_keys:
        cap_net('net_xr', cap, spacing=1.3, lift=0.44, r=0.13, step=0.3, drape=dr, rad=R * 1.08, mat=mt['xr3'], side_to=None)
        M.xray_fade(mt['xr3'], xray_keys)
    return mt


# ---------------------------------------------------------------- shared scene: the lift (E14-E16)
ZU = 12.0       # slab underside when lifted


def scene_lift(F1, F0=1, stub=False, legs=True, cols=False, cols_xray=None, plat=False, plat_xray=None, rails_on=False,
               mach=True, sun_rot=230, sun_elev=26, tower=None, cols_len=3.0, zu=ZU, plat_h=None):
    M.setup(F1, sun_elev=sun_elev, sun_rot=sun_rot, sky_sat=1.5, exposure=-0.3, light_sat=0.9)
    mt = mats()
    C.slab('slab', mt, z0=zu)
    bpy.data.objects['slab_cap'].data.materials[0] = mt['snowy']
    cz.cyl('slab_bottom', R * 1.02, 0.3, (0, 0, zu - 0.05), mat=mt['rock'], verts=96, ol=0)
    rg = C.snow_range('range', mt, hole=110, height=26, size=900); rg.data.materials[0] = mt['darksnow']
    M.heightfield('ground', 240, 200, lambda X, Y: 0.5 * M.fbm(X * 0.06, Y * 0.06, 4, 5) - 0.25, mat=mt['darkground'], loc=(0, 0, 0))
    out = {}
    # enrich (E14/E15): ground debris, puddles, hanging cable catenaries under the slab, tyre tracks, hose coils
    rnd = random.Random(21)
    r0 = cz.sphere('debris', 0.25, (0, 0, -100), mat=mt['rock'], ol=0, segs=6, rings=4)
    for i in range(500):
        a = rnd.uniform(0, 2 * math.pi); rr = rnd.uniform(R * 1.0, 45); s_ = rnd.uniform(0.6, 2.6)
        o = r0.copy(); bpy.context.scene.collection.objects.link(o)
        o.location = (rr * math.cos(a), rr * math.sin(a), 0.05); o.scale = (s_, s_ * rnd.uniform(0.6, 1.2), s_ * 0.5)
        o.rotation_euler = (rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3))
    wm = M.water('b_puddle', color='#1a2430', rough=0.03)
    for i in range(7):
        a = rnd.uniform(-2.6, -0.5); rr = rnd.uniform(R * 1.6, 30)
        p = cz.cyl(f'puddle{i}', rnd.uniform(1.0, 2.6), 0.02, (rr * math.cos(a), rr * math.sin(a), 0.22), mat=wm, verts=24, ol=0)
        p.scale = (1.0, rnd.uniform(0.4, 0.8), 1)
    cab = []
    for i in range(14):
        a0 = 2 * math.pi * i / 14 + rnd.uniform(-0.1, 0.1); a1 = a0 + rnd.uniform(0.2, 0.45); rr = R * 0.97
        pa = Vector((rr * math.cos(a0), rr * math.sin(a0), zu - 0.65)); pb = Vector((rr * math.cos(a1), rr * math.sin(a1), zu - 0.65))
        sag = rnd.uniform(0.6, 1.8); pts = [pa.lerp(pb, k / 10) - Vector((0, 0, sag * 4 * (k / 10) * (1 - k / 10))) for k in range(11)]
        cab += [(pts[k], pts[k + 1]) for k in range(10)]
    tubes('hang_cables', cab, 0.05, mt['cable'], sides=5)
    trk = []
    for sx in (-1.2, 1.2):
        for k in range(60):
            y0 = -60 + k * 1.0; x0 = 4 + sx + 3 * math.sin(y0 * 0.05)
            trk.append((x0, y0, 0.12))
    if stub:
        M.column('stub', R, 7.0, mat=mt['rock'], rough=0.04, seed=8)
    if legs:
        slab_legs('legs', mt, zu, n=4, r_foot=R * 1.45)
    if cols:
        c, x, n = support_columns('cols', mt, zu, spacing=0.8, r=0.09, zlen=cols_len)
        out['cols'] = (c, x, n)
        if cols_xray: M.xray_fade(mt['xr'], cols_xray)
        else: x.hide_render = True
    if plat:
        root, sk, fo, xs = platform('plat', mt, zu, height=plat_h or zu - 2.0)
        out['plat'] = root
        if plat_xray: M.xray_fade(mt['xr2'], plat_xray)
        else: xs.hide_render = True
    if rails_on:
        boxes('beam_tracks', [(sx * 3.0, 0, 0.6) for sx in (-1, 1)], (2.6, 300, 1.2), mt['navy'])
        boxes('beam_plates', [(sx * 3.0, y, 1.23) for sx in (-1, 1) for y in np.arange(-150, 150, 2.5)], (2.7, 0.12, 0.04), mt['dark'])
        boxes('pit_floor', [(0, 0, -3.0)], (3.4, 300, 0.2), mt['dark'])
        tubes('pit_truss', [((sx * 1.7, y, -2.9), (-sx * 1.7, y + 2.0, 1.0)) for sx in (-1, 1) for y in np.arange(-150, 150, 2.0)], 0.06, mt['grey'], sides=5)
        boxes('beam_tops', [(sx * 3.0, 0, 1.22) for sx in (-1, 1)], (2.2, 300, 0.04), mt['rail'])
        boxes('beam_slot_w', [(sx * 1.75, 0, -1.0) for sx in (-1, 1)], (0.1, 300, 4.0), mt['dark'])
        boxes('beam_brk', [(sx * 4.5, y, 0.7) for sx in (-1, 1) for y in np.arange(-150, 150, 4.0)], (0.4, 0.5, 1.0), mt['mach'])
        boxes('rail_lamps', [(x, y, -2.85) for x in (-1.0, 1.0) for y in np.arange(-150, 150, 4.0)], (0.25, 0.4, 0.06), mt['warmlamp'])
        boxes('plat_lamps_u', [(R * 0.9 * math.cos(a), R * 0.9 * math.sin(a), zu - 1.6 - (plat_h or zu - 2.0) - 0.45) for a in np.linspace(0, 2 * math.pi, 40, endpoint=False)], (0.3, 0.3, 0.06), mt['warmlamp'])
    if mach:
        machinery('mach', mt, 55, ((-9, -9), (9, 9)), avoid=lambda x, y: x * x + y * y > 8 ** 2)
    if tower:
        segs = []; b = Vector(tower)
        lattice(segs, b, b + Vector((0, 0, 30)), 1.6, 1.6, up=(1, 0, 0))
        tubes('tower_r', segs[: len(segs) // 2], 0.08, mt['crane'], sides=5)
        tubes('tower_w', segs[len(segs) // 2:], 0.08, mt['white'], sides=5)
    return mt, out


def show_but_xray(root, spans, F0, F1):
    """M.visible on a group, leaving the x-ray children to their own fade (hide_render untouched)."""
    for ch in root.children:
        if ch.name.endswith('_xr'): continue
        M.visible(ch, spans, F0, F1)


# ---------------------------------------------------------------- shared scene: the magnet hall (E17)
def scene_hall(F1, F0=1, xray_keys=None, W=110, D=70, Hh=17):
    M.setup(F1, sun_elev=40, sun_rot=230, sun_power=0.0, sky_sat=1.4, exposure=-0.5)
    mt = mats()
    boxes('hall_floor', [(0, 0, -0.1)], (W, D, 0.2), mt['floor'])
    for sx, sy, cx, cy in ((W, 0.3, 0, D / 2), (W, 0.3, 0, -D / 2), (0.3, D, W / 2, 0), (0.3, D, -W / 2, 0)):
        boxes('hall_wall', [(cx, cy, Hh / 2)], (max(sx, 0.3), max(sy, 0.3), Hh), mt['wall'])
    ceiling('hall_ceil', mt, W, D, Hh, cell=3.0)
    for x in np.arange(-W / 2 + 15, W / 2, 30):
        for y in (-D / 4, D / 4):
            cz.light(f'hall_l{x:.0f}{y:.0f}', 'AREA', (x, y, Hh - 1.0), (0, 0, 0), '#fff4e6', 16000, 8, shadow=True)
    src = magnet('mag_src', mt, (0, 0, 1.3), size=2.4, Rr=1.5)
    mags = []
    rows = np.arange(-D / 2 + 8, D / 2 - 4, 18.0)
    for j, y in enumerate(rows):
        for i, x in enumerate(np.arange(-W / 2 + 6, W / 2 - 4, 12.0)):
            if i == 0 and j == 0: src.location = (x, y, 1.3); mags.append(src); continue
            mags.append(instance_tree(src, f'mag_{i}_{j}', (x, y, 1.3), scale=2.4))
    # aisle between rows: pipe bundles (red hot / blue cold), cross pipes into the magnets, fans + cabinets
    red, blue, xseg, xsegm = [], [], [], []
    rnd = random.Random(3)
    for y in rows[:-1] + 9.0:
        for k, dy in enumerate((-2.4, -1.6, -0.8, 0.8, 1.6, 2.4)):
            (red if k % 2 == 0 else blue).append(((-W / 2, y + dy, 0.4), (W / 2, y + dy, 0.4)))
        xseg += [((-W / 2, y - 1.2, 0.55), (W / 2, y - 1.2, 0.55)), ((-W / 2, y + 1.2, 0.55), (W / 2, y + 1.2, 0.55))]
        for x in np.arange(-W / 2 + 6, W / 2 - 4, 12.0):
            for sgn in (-1, 1):
                L = red if rnd.random() < 0.5 else blue
                p0 = (x + sgn * 1.5, y + sgn * 2.4, 0.4); p1 = (x + sgn * 1.5, y + sgn * 2.4, 1.6); p2 = (x + sgn * 1.5, y + sgn * 6.5, 1.6)
                L += [(p0, p1), (p1, p2)]
            xseg.append(((x - 1.5, y - 2.4, 1.6), (x - 1.5, y - 6.5, 1.6)))
    tubes('pipes_r', red, 0.3, mt['pipe_r'], sides=12)
    tubes('pipes_b', blue, 0.3, mt['pipe_b'], sides=12)
    for y in rows:
        for x in np.arange(-W / 2 + 6, W / 2 - 4, 12.0):
            for sx in (-1, 1): xsegm.append(((x + sx * 3.6, y, 1.2), (x + sx * 3.6, y, 1.3 + 2.4 * 2.4)))
    tubes('pipes_x', xseg, 0.36, mt['xr'], sides=12)
    tubes('mags_x', xsegm, 1.7, mt['xr'], sides=24)
    if xray_keys: M.xray_fade(mt['xr'], xray_keys)
    fsrc = fan('fan_src', mt, (0, 0, 0), size=5.2)
    k = 0
    for y in rows[:-1] + 9.0:
        for x in np.arange(-W / 2 + 10, W / 2 - 4, 12.0):
            yy = y + (5.6 if (k % 2) else -5.6)
            if k == 0: fsrc.location = (x, yy, 0)
            else: instance_tree(fsrc, f'fan_{k}', (x, yy, 0))
            k += 1
    cab = [(x, y + (-5.6 if (i % 2) else 5.6), 1.4) for y in rows[:-1] + 9.0 for i, x in enumerate(np.arange(-W / 2 + 16, W / 2 - 4, 12.0))]
    boxes('cabinets', cab, (6.0, 3.6, 2.8), mt['grey'])
    boxes('cab_top', [(x, y, 2.5) for x, y, _ in cab], (5.0, 3.0, 0.3), mt['dark'])
    return mt, mags


# ---------------------------------------------------------------- shared scene: the cutaway (E18) and the lift close-up (E19)
def scene_cut(F1, F0=1, xray_keys=None):
    """Front cutaway: dark backlit slab on the lit platform, ground line with lamps, lava-cracked ground section."""
    M.setup(F1, sun_elev=14, sun_rot=0, sun_power=2.0, sky_sat=1.2, exposure=-0.2)
    mt = mats()
    zu = 6.5; yc = R + 1.0
    s = C.slab('slab', mt, z0=zu); s.location.y = yc
    bpy.data.objects['slab_cap'].data.materials[0] = mt['dark']
    bpy.data.objects['slab_body'].data.materials[0] = mt['dark']
    root, sk, fo, xs = platform('plat', mt, zu, height=4.9)
    root.location.y = yc
    sk.data.materials[0] = mt['wall']
    lamps = []
    for k in range(4):
        for i in range(48):
            a = 2 * math.pi * i / 48 + k * 0.06
            lamps.append(((R + 0.03) * math.cos(a), (R + 0.03) * math.sin(a) + yc, zu - 1.6 - 0.6 - k * 1.0))
    boxes('plat_lamps', lamps, (0.7, 0.05, 0.18), mt['lamp'])
    if xray_keys: M.xray_fade(mt['xr2'], xray_keys)
    else: xs.hide_render = True
    boxes('cut_ground', [(0, 40.05, -20)], (400, 80, 40), mt['dark'])
    cz.plane('cut_face', 140, 70, (0, -0.01, -35), mat=M.pbr('b_lavaface', '#0b1020', rough=0.8, img=C.T('lava_cracks.png'), coord='UV', scale=7), ol=0)
    boxes('cut_line', [(0, 0.1, 0.0)], (400, 0.3, 0.12), mt['navy'])
    boxes('cut_lamps', [(x, 0.0, 0.08) for x in np.arange(-60, 60, 1.6)], (0.25, 0.1, 0.06), mt['lamp'])
    rg = C.snow_range('range', mt, hole=60, height=18, size=600); rg.data.materials[0] = mt['darksnow']; rg.location.y = 320
    return mt


def scene_lift_close(F1, F0=1, grid_keys=None, lift=None):
    """Close cutaway at the platform floor: grey panel wall (green x-ray tint fading), a row of horseshoe magnets on the
    floor plate, lightning arcs between them, green arrows in the gap, the navy rail beam with tan brackets below."""
    M.setup(F1, sun_elev=35, sun_rot=200, sun_power=1.5, sky_sat=1.0, exposure=-0.3)
    mt = mats()
    up = cz.empty('upper', (0, 0, 0))
    boxes('back', [(0, 3.0, 6)], (60, 0.2, 10.5), mt['wall'], parent=up)
    beams = [(x, 2.8, 6) for x in np.arange(-30, 30, 2.6)]
    boxes('back_v', beams, (0.22, 0.3, 10.5), mt['dark'], parent=up)
    boxes('back_h', [(0, 2.8, z) for z in np.arange(1.4, 11, 2.6)], (60, 0.3, 0.22), mt['dark'], parent=up)
    g = boxes('back_xr', [(0, 2.6, 6)], (60, 0.05, 10.5), mt['xrs'], parent=up)
    if grid_keys: M.xray_fade(mt['xrs'], grid_keys)
    boxes('floorplate', [(0, 0.5, 0.95)], (60, 5.0, 0.08), mt['band'], parent=up)
    boxes('floorbeam', [(0, 0.5, 0.82)], (60, 5.0, 0.18), mt['navy'], parent=up)
    src = magnet('m0', mt, (0, 0, 1.15), size=0.75, parent=up)
    xs = np.arange(-8.4, 8.5, 2.8)
    for i, x in enumerate(xs):
        if i == 0: src.location.x = x
        else:
            o = instance_tree(src, f'm{i}', (x, 0, 1.15), scale=0.75); o.parent = up
    # arcs: 4 variants, flickering
    for v in range(4):
        pairs = [((x + 0.75, -0.4, 1.7 + 0.25 * ((i + v) % 3)), (x + 2.8 - 0.75, -0.4, 1.7 + 0.25 * ((i + v + 1) % 3))) for i, x in enumerate(xs[:-1])]
        pairs += [((x - 0.75, -0.4, 2.2), (x + 0.75, -0.4, 1.9)) for x in xs]
        a = arcs(f'arc{v}', mt, pairs * 6, seed=v + 1, jag=0.16, n=16, r=0.006, parent=up)
        ah = arcs(f'arch{v}', mt, pairs * 2, seed=v + 1, jag=0.16, n=16, r=0.05, parent=up); ah.data.materials[0] = mt['archalo']
        M.visible(ah, [((f - 1) / 30, f / 30) for f in range(F0 + v, F1 + 2, 4)], F0, F1)
        M.visible(a, [((f - 1) / 30, f / 30) for f in range(F0 + v, F1 + 2, 4)], F0, F1)
    for i, x in enumerate(np.arange(-6.6, 6.7, 1.1)):
        arrow(f'arw{i}', mt, (x, -0.6, 0.47), size=0.38)
    boxes('rail', [(0, 0.5, 0.1)], (60, 2.0, 0.55), mt['navy'])
    boxes('rail_top', [(0, -0.45, 0.4)], (60, 0.08, 0.05), mt['band'])
    br = [(x, -0.6, -1.4) for x in (-2.9, 2.9)]
    boxes('brk', br, (0.6, 0.8, 3.4), mt['tan'])
    boxes('brk_in', [(x, -1.01, -1.3) for x in (-2.9, 2.9)], (0.3, 0.02, 2.6), mt['dark'])
    boxes('pit', [(0, 3, -6)], (60, 0.2, 12), mt['navy'])
    boxes('pitfloor', [(0, 0, -3.2)], (60, 8, 0.2), mt['dark'])
    if lift: M.bake_path(up, F0, F1, pos=lift)
    return mt


# ---------------------------------------------------------------- shared scene: on the tracks (E20-E22)
def scene_track(F1, F0=1, rail_xray=None, slab_xray=None, glide=None, canyon=False, zu=10.0, plat_h=7.0, bowl=False):
    """Slab on the steel platform riding a long track (navy rails + tan sleepers, optional green x-ray rails) in a
    trench through snowfields (canyon=True: dark rock canyon walls). glide(t)->y offset moves slab + platform."""
    M.setup(F1, sun_elev=28, sun_rot=230, sky_sat=1.5, exposure=-0.3, light_sat=0.9)
    mt = mats()
    car = cz.empty('car', (0, 0, 0))
    s = C.slab('slab', mt, z0=zu); s.parent = car
    bpy.data.objects['slab_cap'].data.materials[0] = mt['snowy']
    cz.cyl('slab_bottom', R * 1.02, 0.3, (0, 0, zu - 0.05), mat=mt['rock'], verts=96, ol=0, parent=car)
    root, sk, fo, xs = platform('plat', mt, zu, height=plat_h, parent=car)
    xs.hide_render = True
    # bogies: yellow brackets + wheels under the skirt
    zb = zu - 1.6 - plat_h
    # bogies: separate L-shaped yellow brackets round the skirt foot (vertical arm + foot) + a wheel on each
    nb = 20; vc, fc, rz, whl = [], [], [], []
    for i in range(nb):
        a = 2 * math.pi * (i + 0.5) / nb; c, s_ = math.cos(a), math.sin(a); rb = R * 0.98
        vc.append((rb * c, rb * s_, zb - 0.55)); fc.append(((rb - 0.45) * c, (rb - 0.45) * s_, zb - 1.05)); rz.append(math.degrees(a))
        whl.append((((rb - 0.7) * c - 0.3 * s_, (rb - 0.7) * s_ + 0.3 * c, zb - 1.0), ((rb - 0.7) * c + 0.3 * s_, (rb - 0.7) * s_ - 0.3 * c, zb - 1.0)))
    boxes('bogie_v', vc, (0.35, 0.9, 1.3), mt['mach'], rotz=rz, parent=car)
    boxes('bogie_f', fc, (1.2, 0.9, 0.3), mt['mach'], rotz=rz, parent=car)
    boxes('bogie_bolt', [(x, y, z + 0.3) for x, y, z in vc], (0.4, 0.5, 0.12), mt['dark'], rotz=rz, parent=car)
    tubes('wheels', whl, 0.4, mt['rubber'], sides=16, parent=car)
    if slab_xray:
        xo = M.column('slab_xr', R * 1.06, C.H + 1.0, mat=mt['xr3'], rough=0.02, seed=3, taper=-0.14); xo.parent = car; xo.location.z = zu
        M.xray_fade(mt['xr3'], slab_xray)
    rails('track', mt, 900, gauge=8, n=4, spacing=4.0, z=0.0)
    if rail_xray:
        # one solid green x-ray beam track on truss sleepers (tan cross beams + dark X bracing)
        boxes('track_beam', [(-1.6, 0, 0.9), (1.6, 0, 0.9)], (2.2, 900, 0.9), mt['xrb'])
        boxes('track_brk', [(sx * 2.85, y, 1.0) for y in np.arange(-450, 450, 3.0) for sx in (-1, 1)], (0.35, 0.6, 1.2), mt['tan'])
        boxes('track_slot', [(0, y + 1.5, 0.75) for y in np.arange(-450, 450, 3.0)], (1.0, 0.25, 0.25), mt['tan'])
        ys = np.arange(-450, 450, 3.0)
        boxes('track_sl', [(0, y, 0.3) for y in ys], (12.0, 0.5, 0.35), mt['tan'])
        xseg = []
        for y in ys[::1]:
            xseg += [((-5.5, y, 0.1), (5.5, y + 3.0, 0.5)), ((5.5, y, 0.1), (-5.5, y + 3.0, 0.5))]
        tubes('track_x', xseg, 0.12, mt['dark'], sides=5)
        M.xray_fade(mt['xrb'], rail_xray)
    # trench: floor + banks (snowy or dark canyon rock)
    def fn(X, Y):
        ax = (np.sqrt(X * X + Y * Y) - 14) if bowl else np.abs(X)
        bank = np.clip((ax - 16) / (9 if bowl else 6), 0, 1) ** 1.3 * (11 if bowl else (22 if canyon else 14))
        return bank + M.fbm(X * 0.03, Y * 0.03, 9, 5) * (10 if canyon else 6) * np.clip((ax - 18) / 20, 0, 1) - 0.2
    tr = M.heightfield('trench', (300, 900), (160, 300), fn, mat=mt['rock' if canyon else 'snowy'])
    if canyon: tr.data.materials[0] = mt['rock']
    if not bowl: M.heightfield('trenchfloor', (34, 900), (8, 60), lambda X, Y: X * 0 - 0.15, mat=mt['darkground'])
    fr = C.snow_range('farrange', mt, hole=160, height=30, size=1400, z=-4); fr.data.materials[0] = mt['darksnow'] if canyon else mt['snow']
    if bowl: cz.cyl('bowlfloor', 33, 0.1, (0, 0, -0.12), mat=mt['darkground'], verts=96, ol=0)
    if glide: M.bake_path(car, F0, F1, pos=lambda t: (0, glide(t), 0))
    return mt, car


def thermo(name, mt, loc, hot=True, size=1.0, rot=(0, 0, 0)):
    """Floating thermometer sign: white rounded backing card, glass tube along X with red (hot) / blue (cold) fluid,
    bulb, tick marks and a degree label."""
    root = cz.empty(name, loc); root.rotation_euler = [math.radians(a) for a in rot]; root.scale = (size,) * 3
    fl = mt['therm_r'] if hot else mt['therm_b']
    cz.box(name + '_card', (5.6, 0.12, 1.7), (0.3, 0.12, 0), mat=mt['white'], bevel=0.5, ol=0, parent=root)
    cz.cyl(name + '_glass', 0.34, 4.4, (-2.0, 0, 0), mat=mt['tglass'], rot=(0, 90, 0), verts=32, ol=0, parent=root)
    L = 3.3 if hot else 1.5
    cz.cyl(name + '_fluid', 0.2, L, (-2.0, -0.02, 0), mat=fl, rot=(0, 90, 0), verts=24, ol=0, parent=root)
    cz.sphere(name + '_bulb', 0.62, (-2.3, 0, 0), mat=fl, ol=0, parent=root, segs=32, rings=16)
    cz.sphere(name + '_bulbg', 0.7, (-2.3, 0, 0), mat=mt['tglass'], ol=0, parent=root, segs=32, rings=16)
    boxes(name + '_ticks', [(-1.2 + 0.35 * k, -0.1, 0.45) for k in range(10)], (0.05, 0.04, 0.22), mt['dark'], parent=root)
    cz.text(name + '_lbl', '\u00b0C', size=0.7, loc=(2.55, -0.08, -0.25), mat=mt['dark'], rot=(90, 0, 0), extrude=0.03, parent=root)
    return root


def wipe_card(cam, keys, F0, F1, dist=0.3):
    """Black-bar slide: a black card glued to the camera lens; keys [(t, x)] in frame widths (0 = covers the frame,
    1 = fully off to the right, -1 = off to the left)."""
    cd = cam.data
    fh = dist * cd.sensor_height / cd.lens; fw = fh * 9 / 16
    m = M.emit('b_black', '#000000', 0.0)
    card = cz.plane('wipe', fw * 1.02, fh * 1.6, (0, 0, -dist), mat=m, rot=(0, 0, 0), parent=cam, ol=0)
    def pos(t):
        if t <= keys[0][0]: x = keys[0][1]
        elif t >= keys[-1][0]: x = keys[-1][1]
        else:
            for (a, xa), (b, xb) in zip(keys, keys[1:]):
                if a <= t <= b:
                    k = (t - a) / (b - a); k = k * k * (3 - 2 * k); x = xa + (xb - xa) * k; break
        return (x * fw * 1.05, 0, -dist)
    M.bake_path(card, F0, F1, pos=pos)
    return card


def blink(cam, frames, F0, F1, dist=0.3):
    """One black frame at each hard cut (frames list): hides the cut inside the whip like the reference's blur and
    keeps the motion measurement from matching two different shots."""
    cd = cam.data
    fh = dist * cd.sensor_height / cd.lens * 1.6; fw = fh
    m = M.emit('b_black', '#000000', 0.0)
    card = cz.plane('blink', fw * 2, fh * 2, (0, 0, -dist), mat=m, rot=(0, 0, 0), parent=cam, ol=0)
    M.visible(card, [((f - 1) / 30, f / 30) for f in frames], F0, F1)
    return card
