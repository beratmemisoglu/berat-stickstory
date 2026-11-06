# Bare mattress on the floor (Kyle's bedroom, no bed frame): pale lavender-white, rounded corners, quilted top (a grid
# of button tufts with stitched rings), a darker piped seam band round the top and bottom edges, and a thick cream
# pillow (a squashed superellipsoid, thinner at its edges) at the head end (+Y).
# Floor prop: root at the floor centre, long axis Y, head end at +Y. A 1.3 m character lies on it: META['lie'].
import bpy, bmesh, math
from mathutils import Vector, Matrix

W, L, T = 1.1, 1.85, 0.22
PW, PL, PT = 0.55, 0.35, 0.14
PY = L / 2 - 0.07 - PL / 2

META = {'size': (W, L, T + PT), 'anchor': 'floor centre; long axis Y, head end +Y; top surface z = 0.22',
        'animate': [], 'top': T,
        'lie': {'hip': (0.0, 0.05, T), 'head': (0.0, PY - 0.02, T + PT * 0.8),
                'note': 'hip point on the mattress top; head = back of the head resting on the pillow top (pillow centre y %.3f)' % PY},
        'pillow': {'centre': (0.0, round(PY, 3), T), 'size': (PW, PL, PT)},
        'params': 'pillow=True, color=#hex (mattress), tufts=True'}


def _obj(cz, name, bm, mats, parent, loc=(0, 0, 0), ol=0.0, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    for m in mats: me.materials.append(m)
    return cz.place(bpy.data.objects.new(name, me), loc, (0, 0, 0), None, parent, ol)


def superellipsoid(cz, name, size, loc, mat, parent, e=0.32, puff=0.35, ol=0.0):
    """A soft box: unit sphere directions pushed toward a cube (exponent e), thinner toward the edges (puff)."""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
    sx, sy, sz = size[0] / 2, size[1] / 2, size[2] / 2
    for v in bm.verts:
        x, y, z = v.co
        f = lambda c: math.copysign(abs(c) ** e, c)
        X, Y, Z = f(x), f(y), f(z)
        edge = max(abs(X), abs(Y)) ** 3
        v.co = Vector((X * sx, Y * sy, Z * sz * (1 - puff * edge)))
    return _obj(cz, name, bm, [mat], parent, loc, ol)


def build(cz, name='ld_mattress', pillow=True, color='#d8d0e8', tufts=True):
    root = cz.empty(name)
    body = cz.toon(name + '_cloth', color, tex='grain', tex_strength=0.04)
    pip = cz.toon(name + '_piping', '#a99fc2', tex='grain', tex_strength=0.04)
    btn = cz.toon(name + '_button', '#9084b2')
    st = cz.toon(name + '_stitch', '#a89cc6')
    cz.box(name + '_body', (W, L, T), (0, 0, 0), body, bevel=0.045, ol=0.009, parent=root, origin='bottom')
    # piped seams: thin bands 3 mm proud of the sides, just under the top edge and just over the floor
    # (a rounded-rectangle prism with the body's corner radius + 3 mm: a bevelled thin box squared its corners off and
    # they poked out of the round mattress corners)
    for k, z in enumerate((T - 0.052, 0.03)):
        bm = bmesh.new(); rc = 0.045 + 0.003; hx, hy = W / 2 + 0.003 - rc, L / 2 + 0.003 - rc; pts = []
        for cx, cy, a0 in ((hx, hy, 0), (-hx, hy, 90), (-hx, -hy, 180), (hx, -hy, 270)):
            for s in range(7):
                a = math.radians(a0 + 90 * s / 6); pts.append((cx + rc * math.cos(a), cy + rc * math.sin(a)))
        lo = [bm.verts.new((x, y, z)) for x, y in pts]; hi = [bm.verts.new((x, y, z + 0.016)) for x, y in pts]
        bm.faces.new(lo); bm.faces.new(hi)
        for i in range(len(pts)): bm.faces.new((lo[i], lo[(i + 1) % len(pts)], hi[(i + 1) % len(pts)], hi[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        o = _obj(cz, f'{name}_pipe{k}', bm, [pip], root, smooth=True)
        try: o.data.set_sharp_from_angle(angle=math.radians(35))
        except Exception: pass
    if tufts:   # one mesh: a stitched ring + a button per tuft (1.5 / 4 mm proud of the flat top)
        bm = bmesh.new()
        nx, ny = 5, 9
        for i in range(nx):
            for j in range(ny):
                x = (i - (nx - 1) / 2) * (W - 0.24) / (nx - 1)
                y = (j - (ny - 1) / 2) * (L - 0.3) / (ny - 1)
                if pillow and y > PY - PL / 2 - 0.03 and abs(x) < PW / 2 + 0.03: continue
                n0 = len(bm.faces)
                bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.03, radius2=0.03, depth=0.0015,
                                      matrix=Matrix.Translation((x, y, T + 0.00075)))
                bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.022, radius2=0.022, depth=0.0018,
                                      matrix=Matrix.Translation((x, y, T + 0.0016)))
                bm.faces.ensure_lookup_table()
                for fi in range(n0, len(bm.faces)): bm.faces[fi].material_index = 0
                for fi in range(n0 + (len(bm.faces) - n0) // 2, len(bm.faces)): bm.faces[fi].material_index = 2
                n1 = len(bm.faces)
                bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=0.011, radius2=0.008, depth=0.005,
                                      matrix=Matrix.Translation((x, y, T + 0.0025)))
                bm.faces.ensure_lookup_table()
                for fi in range(n1, len(bm.faces)): bm.faces[fi].material_index = 1
        # the stitched ring: a darker disc under a body-coloured disc 1 mm higher (reads as a ring) + the button
        _obj(cz, name + '_tufts', bm, [st, btn, body], root, smooth=False)
    if pillow:
        superellipsoid(cz, name + '_pillow', (PW, PL, PT), (0, PY, T + PT / 2 - 0.012),
                       cz.toon(name + '_pillowm', '#e6d6b8', tex='grain', tex_strength=0.05), root, ol=0.007)
    return root
