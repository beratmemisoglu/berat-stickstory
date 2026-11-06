# Palace column: a thick round red-lacquer shaft (0.45 m) on a stone plinth + carved drum base (lotus petals), a dark
# foot ring, a gold band (+ a thin second band) near the top, and a simplified dougong bracket on top: a red bearing
# block, two crossed layers of green arms (curved ends) with blue blocks on them, and a blue beam stub with a gold
# stripe.
# cracked=True (the rubble morning): five dark tapering cracks on the shaft, one chunk of lacquer + wood bitten out of
# the front-left (boolean cut, the pale wood inside shows), fallen chunks on the plinth / floor, the beam stub knocked
# a few degrees askew and one bracket block slipped.
# Floor prop: root = floor centre of the column; height = floor to the top of the bracket (default 3.2 m).
import math, random, bmesh
from mathutils import Vector

META = {'size': (1.4, 1.1, 3.2), 'anchor': 'floor centre', 'animate': [],
        'params': "height=3.2 (floor to the top of the bracket / beam stub), cracked=False, beam=True (beam stub on top), "
                  "lacquer='#9a221c', seed=4 (rubble shapes)"}

R = 0.225
AH, BS, BEAM_T = 0.12, 0.095, 0.22      # arm height, block height, beam stub thickness
CHUNK_A = -138                          # where the chunk is bitten out (deg about Z; -90 = straight to the front)


def _lathe(cz, name, prof, mat, parent, segs=48, ol=0.006, lobes=0, depth=0.0):
    """Surface of revolution from (r, z) pairs (bottom to top), closed with caps; optional petal lobes."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            k = 1 - depth * (1 - abs(math.sin(lobes * a / 2))) ** 2 if lobes else 1.0
            ring.append(bm.verts.new((r * k * math.cos(a), r * k * math.sin(a), z)))
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _arm(cz, name, L, W, H, loc, mat, parent, axis='x', ol=0.007):
    """Bracket arm: a bar whose ends curve up underneath (the end faces are 45 % of its height), soft edges."""
    e = min(0.16, L * 0.18); n = 6
    pts = [(-L / 2, H), (L / 2, H), (L / 2, H * 0.45)]
    for i in range(1, n + 1):                         # right end: quarter curve down to the flat bottom
        a = math.pi / 2 * i / n
        pts.append((L / 2 - e + e * math.cos(a), H * 0.45 * (1 - math.sin(a))))
    for i in range(n + 1):                            # left end, mirrored
        a = math.pi / 2 * i / n
        pts.append((-(L / 2 - e) - e * math.sin(a), H * 0.45 * (1 - math.cos(a))))
    bm = bmesh.new()
    fr = [bm.verts.new((x, -W / 2, z)) for x, z in pts]; bk = [bm.verts.new((x, W / 2, z)) for x, z in pts]
    bm.faces.new(fr); bm.faces.new(bk[::-1])
    m = len(pts)
    for i in range(m):
        bm.faces.new((fr[i], bk[i], bk[(i + 1) % m], fr[(i + 1) % m]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mat, smooth=False)
    return cz.place(o, loc, (0, 0, 90 if axis == 'y' else 0), None, parent, ol, 0.02)


def _crack(cz, name, pts, w0, w1, mat, parent, r=R + 0.0016):
    """A tapering dark crack ribbon lying on the shaft surface: pts = [(angle_deg, z), ...], width w0 -> w1."""
    bm = bmesh.new(); L, Rr = [], []
    n = len(pts)
    for k, (ad, z) in enumerate(pts):
        a = math.radians(ad)
        pa, pb = pts[max(0, k - 1)], pts[min(n - 1, k + 1)]
        du, dv = math.radians(pb[0] - pa[0]) * R, pb[1] - pa[1]
        ln = math.hypot(du, dv) or 1.0; nu, nv = -dv / ln, du / ln
        w = (w0 + (w1 - w0) * k / (n - 1)) / 2
        for sgn, lst in ((1, L), (-1, Rr)):
            aa = a + sgn * w * nu / r
            lst.append(bm.verts.new((r * math.cos(aa), r * math.sin(aa), z + sgn * w * nv)))
    for k in range(n - 1):
        bm.faces.new((L[k], Rr[k], Rr[k + 1], L[k + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:            # face outward (normal away from the axis)
        c = f.calc_center_median()
        if f.normal.dot(Vector((c.x, c.y, 0))) < 0: f.normal_flip()
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=False), (0, 0, 0), (0, 0, 0), None, parent, 0.0, 0.0)


def _lump(cz, name, r, loc, mat, parent, rnd, sx=1.0, sy=1.0, sz=0.6, ol=0.004):
    """A faceted lump (low-poly sphere, jittered, the scale baked into the mesh, flat shaded)."""
    o = cz.sphere(name, r, loc, mat, ol=ol, parent=parent, segs=7, rings=5)
    for v in o.data.vertices:
        k = rnd.uniform(0.82, 1.18)
        v.co.x *= sx * k; v.co.y *= sy * k; v.co.z *= sz * k
    o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    o.rotation_euler = (0, 0, rnd.uniform(0, 6.28))
    return o


def build(cz, name='palace_column', height=3.2, cracked=False, beam=True, lacquer='#9a221c', seed=4):
    rnd = random.Random(seed)
    root = cz.empty(name)
    red = cz.toon(name + '_lacquer', lacquer, tex='grain', tex_strength=0.04)
    stone = cz.toon(name + '_stone', '#9c9484', tex='grain', tex_scale=1.5, tex_strength=0.06)
    stone2 = cz.toon(name + '_stone2', '#b3aa98', tex='grain', tex_scale=1.5, tex_strength=0.05)
    gold = cz.toon(name + '_gold', '#c99a2e', tex='grain', tex_scale=2.0, tex_strength=0.05)
    dark = cz.toon(name + '_dark', '#3a2a22')
    green = cz.toon(name + '_green', '#2b6a5c', tex='grain', tex_strength=0.04)
    blue = cz.toon(name + '_blue', '#2a4d7a', tex='grain', tex_strength=0.04)
    wood = cz.toon(name + '_wood', '#c08a52', tex='wood', tex_scale=2.0, tex_strength=0.08)

    # ---- base: square plinth + drum with lotus petals
    cz.box(name + '_plinth', (0.82, 0.82, 0.1), (0, 0, 0.05), stone, bevel=0.02, ol=0.009, parent=root)
    _lathe(cz, name + '_drum', [(0.33, 0.1), (0.35, 0.15), (0.33, 0.21), (0.27, 0.25), (0.25, 0.27)], stone2, root,
           segs=96, ol=0.008, lobes=16, depth=0.06)
    # ---- shaft (height budget: bearing 0.16 + arms / blocks + optional beam, all ending at `height`)
    stack = 0.16 + AH + BS + AH + ((BS + BEAM_T) if beam else 0.0) - 0.02
    z0, z1 = 0.26, height - stack
    shaft = cz.cyl(name + '_shaft', R, z1 - z0, (0, 0, z0), red, verts=64, ol=0.0, parent=root)
    if cracked:     # bite a jagged chunk out of the front-left (boolean BEFORE the outline so the ink follows the notch)
        zc = z0 + (z1 - z0) * 0.47
        ca = math.radians(CHUNK_A)
        inner = cz.toon(name + '_woodcut', '#9c683a', tex='wood', tex_scale=2.0, tex_strength=0.08)
        cut = _lump(cz, name + '_cutter', 0.16, (R * math.cos(ca) * 1.04, R * math.sin(ca) * 1.04, zc),
                    inner, root, rnd, sx=1.0, sy=1.0, sz=1.65, ol=0.0)
        cut.data.materials.append(inner)
        cut.data.polygons.foreach_set('material_index', [1] * len(cut.data.polygons))
        cut.rotation_euler = (0, 0, ca)
        cut.hide_render = True; cut.display_type = 'WIRE'; cut.visible_shadow = False
        shaft.data.materials.append(inner)
        bo = shaft.modifiers.new('chunk', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.object = cut
        try: bo.solver = 'EXACT'
        except Exception: pass
        try: bo.material_mode = 'INDEX'
        except Exception as e: print('CZ column: boolean material_mode', e)
    cz.outline(shaft, 0.009)
    cz.cyl(name + '_footring', R + 0.012, 0.045, (0, 0, z0), dark, verts=64, bevel=0.006, ol=0.005, parent=root)
    zb = z1 - 0.3
    cz.cyl(name + '_band', R + 0.012, 0.12, (0, 0, zb), gold, verts=64, bevel=0.006, ol=0.006, parent=root)
    cz.cyl(name + '_band2', R + 0.01, 0.035, (0, 0, zb + 0.16), gold, verts=64, bevel=0.004, ol=0.004, parent=root)
    # ---- bracket: bearing block (square frustum), two crossed arm layers with blocks, beam stub
    z = z1 - 0.02
    blk = cz.cyl(name + '_bearing', 0.27, 0.16, (0, 0, z), red, r2=0.34, verts=4, rot=(0, 0, 45), bevel=0.012, ol=0.007,
                 parent=root)
    blk.data.polygons.foreach_set('use_smooth', [False] * len(blk.data.polygons))
    z += 0.16
    _arm(cz, name + '_armX1', 0.92, 0.17, AH, (0, 0, z), green, root, 'x')
    _arm(cz, name + '_armY1', 0.8, 0.17, AH - 0.002, (0, 0, z - 0.002), green, root, 'y')
    z += AH
    for i, (x, y) in enumerate([(-0.36, 0), (0.36, 0), (0, -0.3), (0, 0.3), (0, 0)]):
        slip = (0.06, -0.035) if (cracked and i == 1) else (0, 0)
        b = cz.box(f'{name}_blk1_{i}', (0.19, 0.19, BS), (x + slip[0], y + slip[1], z + BS / 2), blue, bevel=0.015, ol=0.005,
                   parent=root)
        if cracked and i == 1: b.rotation_euler = (0, 0, math.radians(14))
    z += BS
    _arm(cz, name + '_armX2', 1.3, 0.17, AH, (0, 0, z), green, root, 'x')
    _arm(cz, name + '_armY2', 1.04, 0.17, AH - 0.002, (0, 0, z - 0.002), green, root, 'y')
    z += AH
    if beam:
        for i, (x, y) in enumerate([(-0.55, 0), (0.55, 0), (0, -0.42), (0, 0.42), (0, 0)]):
            cz.box(f'{name}_blk2_{i}', (0.19, 0.19, BS), (x, y, z + BS / 2), blue, bevel=0.015, ol=0.005, parent=root)
        z += BS
        bt = height - z
        bm_ = cz.box(name + '_beam', (1.45, 0.3, bt), (0, 0, z + bt / 2), blue, bevel=0.025, ol=0.008, parent=root)
        for k, sy in enumerate((-1, 1)):      # gold stripe on both long faces
            cz.box(f'{name}_beamstripe{k}', (1.38, 0.006, 0.045), (0, sy * 0.1515, -bt * 0.05), gold, bevel=0.0, ol=0.0,
                   parent=bm_)
        if cracked:
            bm_.rotation_euler = (math.radians(2.5), math.radians(-4.0), math.radians(6.0))
            bm_.location.x += 0.06
    # ---- cracked: cracks + fallen chunks
    if cracked:
        cm = cz.toon(name + '_crackm', '#2a1a16')
        zc = z0 + (z1 - z0) * 0.47
        _crack(cz, name + '_crack0', [(-124, zc - 0.25), (-116, zc - 0.36), (-122, zc - 0.53), (-110, zc - 0.7),
                                       (-114, zc - 0.86), (-104, zc - 0.98)], 0.024, 0.004, cm, root)
        _crack(cz, name + '_crack1', [(-121, zc - 0.53), (-107, zc - 0.6), (-97, zc - 0.68), (-85, zc - 0.72)], 0.012, 0.003,
               cm, root)
        _crack(cz, name + '_crack2', [(-78, zb - 0.01), (-82, zb - 0.16), (-74, zb - 0.3), (-80, zb - 0.44), (-72, zb - 0.55)],
               0.018, 0.003, cm, root)
        _crack(cz, name + '_crack3', [(-122, zc + 0.24), (-112, zc + 0.34), (-118, zc + 0.46), (-106, zc + 0.58)], 0.016, 0.003,
               cm, root)
        _crack(cz, name + '_crack4', [(-60, z0 + 0.05), (-66, z0 + 0.2), (-58, z0 + 0.34)], 0.012, 0.003, cm, root)
        _lump(cz, name + '_chunk0', 0.085, (-0.22, -0.5, 0.04), red, root, rnd)
        _lump(cz, name + '_chunk1', 0.06, (0.27, -0.52, 0.03), wood, root, rnd)
        _lump(cz, name + '_chunk2', 0.055, (-0.3, -0.24, 0.125), red, root, rnd)
        sp = cz.box(name + '_splinter', (0.16, 0.025, 0.02), (0.1, -0.56, 0.012), wood, rot=(0, 0, 28), bevel=0.004, ol=0.003,
                    parent=root)
    return root
