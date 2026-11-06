# Wall window covered by a sheet (Kyle's bedroom): a square window opening with a white-lavender trim frame, the pane
# behind it (a plain emissive card the scene animates navy night -> pink dawn), and over it a pale-blue polka-dot
# bedspread tacked to the wall with red push pins, its TOP-RIGHT corner folded down diagonally (a triangle flap showing
# the sheet's lighter back side, hanging a little off the sheet) revealing a triangle of the pane.
# Wall prop: back at y = 0, faces -Y, centred on z = 0 (the window centre).
# Scene hooks: pane colour = bpy.data.materials['<name>_pane'].node_tree.nodes['pane_color'].outputs[0].default_value
#   (+ nodes['pane_emit'].inputs['Strength']); sheet glow = materials['<name>_sheetm'].node_tree.nodes['sheet_glow']
#   .inputs['Strength'] (0 at night; ~0.6-1.2 at dawn: the sheet lights up from behind).
import bpy, bmesh, math, os
from mathutils import Vector

FW, FH = 0.95, 1.05            # window opening (outer frame)
TRIM = 0.065
SW, SH = 1.0, 1.1              # sheet
SX, SZ = -0.035, -0.03         # sheet centre offset (the frame peeks out top-right)
FOLD = 0.36                    # fold leg length along the top and the right edge
Y_SHEET = -0.036               # sheet front plane (in front of the trim, which ends at y = -0.03)

META = {'size': (1.05, 0.06, 1.12), 'anchor': 'wall prop: back at y = 0, faces -Y, centred on z = 0',
        'animate': ['_flap (pivot on the fold line: rotation_euler.x/y lifts it; or scale the flap)'],
        'pane': '<name>_pane (object + material; node pane_color = RGB, pane_emit = Emission)',
        'sheetm': '<name>_sheetm', 'sheet_glow_node': 'sheet_glow',
        'params': "pane='#1b2a6b' (start colour), fold=0.36 (m), pins=True"}


def _png():
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex', 'ld_sheet_window_dots.png')
    return p if os.path.exists(p) else None


def _obj(cz, name, bm, mats, parent, loc=(0, 0, 0), ol=0.0, smooth=False):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    for m in mats: me.materials.append(m)
    return cz.place(bpy.data.objects.new(name, me), loc, (0, 0, 0), None, parent, ol)


def slab(cz, name, pts, y0, y1, mats, parent, uvrect=None, ol=0.0, loc=(0, 0, 0), push=None):
    """Polygon pts (x, z) extruded from y0 (front, mats[0], UVs from uvrect=(x0, z0, x1, z1)) to y1 (back); sides
    mats[-1]. push: per-vertex extra -y (curl) as a function (x, z) -> dy."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    dy = (lambda x, z: 0.0) if push is None else push
    fr = [bm.verts.new((x, y0 - dy(x, z), z)) for x, z in pts]
    bk = [bm.verts.new((x, y1 - dy(x, z), z)) for x, z in pts]
    ff = bm.faces.new(fr); bm.faces.new(bk); n = len(pts)
    for i in range(n): bm.faces.new((fr[i], fr[(i + 1) % n], bk[(i + 1) % n], bk[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.material_index = 0 if f is ff else len(mats) - 1
        for lp in f.loops:
            if uvrect:
                x0, z0, x1, z1 = uvrect
                lp[uvl].uv = ((lp.vert.co.x - x0) / (x1 - x0), (lp.vert.co.z - z0) / (z1 - z0))
    return _obj(cz, name, bm, mats, parent, loc, ol)


def pane_mat(cz, name, color):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial')
    rgb = N.new('ShaderNodeRGB'); rgb.name = 'pane_color'; rgb.outputs[0].default_value = cz.col(color)
    em = N.new('ShaderNodeEmission'); em.name = 'pane_emit'; em.inputs['Strength'].default_value = 1.0
    L.new(rgb.outputs[0], em.inputs['Color']); L.new(em.outputs[0], out.inputs['Surface'])
    return m


def build(cz, name='ld_sheet_window', pane='#1b2a6b', fold=FOLD, pins=True):
    f = float(fold)
    root = cz.empty(name)
    trim = cz.toon(name + '_trim', '#d6d0e6', tex='grain', tex_strength=0.04)
    # ---- pane (unlit, no shadow) + a dark reveal box around it, the trim frame in front
    pn = cz.plane(name + '_pane', FW - 0.02, FH - 0.02, (0, -0.004, 0), pane_mat(cz, name + '_pane', pane), rot=(90, 0, 0), parent=root)
    pn.visible_shadow = False
    hw, hh = FW / 2, FH / 2
    for k, (sx, sz, x, z) in enumerate(((FW, TRIM, 0, hh - TRIM / 2), (FW, TRIM, 0, -hh + TRIM / 2),
                                        (TRIM, FH - 2 * TRIM + 0.002, -hw + TRIM / 2, 0), (TRIM, FH - 2 * TRIM + 0.002, hw - TRIM / 2, 0))):
        cz.box(f'{name}_trim{k}', (sx, 0.03, sz), (x, -0.015, z), trim, bevel=0.006, ol=0.006, parent=root)

    # a thin cross bar on the pane (only shows inside the revealed triangle)
    cz.box(name + '_bar', (0.03, 0.012, FH - 2 * TRIM), (0.08, -0.008, 0), trim, bevel=0.003, ol=0.004, parent=root)

    # ---- the sheet: a pentagon (rectangle minus the top-right triangle), printed front, plain back/sides
    x0, x1 = SX - SW / 2, SX + SW / 2; z0, z1 = SZ - SH / 2, SZ + SH / 2
    png = _png()
    sheetm = cz.toon(name + '_sheetm', '#8098ce', img=png, lift=0.62, emit=0.001) if png else cz.toon(name + '_sheetm', '#8098ce', emit=0.001)
    for n in sheetm.node_tree.nodes:   # the scene animates this one (dawn glow)
        if n.type == 'EMISSION' and abs(n.inputs['Strength'].default_value - 0.001) < 1e-6:
            n.name = 'sheet_glow'; n.inputs['Strength'].default_value = 0.0
    backm = cz.toon(name + '_sheetback', '#c3cde6', tex='grain', tex_strength=0.04)
    pent = [(x0, z0), (x1, z0), (x1, z1 - f), (x1 - f, z1), (x0, z1)]
    slab(cz, name + '_sheet', pent, Y_SHEET, Y_SHEET + 0.004, [sheetm, backm], root, uvrect=(x0, z0, x1, z1), ol=0.004)
    # ---- the flap: the folded corner = the corner triangle mirrored over the fold line, back side out, hanging
    # 6 mm in front of the sheet and curling off it toward its tip (pivot on the fold line for animation)
    A, B = Vector((x1 - f, 0, z1)), Vector((x1, 0, z1 - f))
    pv = cz.empty(name + '_flap', tuple((A + B) / 2 + Vector((0, Y_SHEET - 0.002, 0))), parent=root)
    tip = (x1 - f, z1 - f)
    mid = ((A + B) / 2)
    tri = [(A.x - mid.x, A.z - mid.z), (tip[0] - mid.x, tip[1] - mid.z), (B.x - mid.x, B.z - mid.z)]
    curl = lambda x, z: 0.004 + 0.02 * max(0.0, -(x + z) / (f * 0.7071)) ** 1.5
    slab(cz, name + '_flapm', tri, -0.004, 0.0, [backm, sheetm], pv, ol=0.004, push=curl)
    # ---- red push pins: three sheet corners + the right edge under the fold
    if pins:
        red = cz.toon(name + '_pin', '#d42a2a'); metal = cz.toon(name + '_pinmetal', '#8a8a92')
        for k, (px, pz) in enumerate(((x0 + 0.03, z0 + 0.03), (x1 - 0.03, z0 + 0.03), (x0 + 0.03, z1 - 0.03), (x1 - 0.025, z1 - f - 0.035))):
            cz.cyl(f'{name}_pinbase{k}', 0.011, 0.006, (px, Y_SHEET - 0.0005, pz), red, rot=(90, 0, 0), verts=16, ol=0.002, parent=root)
            cz.sphere(f'{name}_pinhead{k}', 0.011, (px, Y_SHEET - 0.014, pz), red, ol=0.002, parent=root, segs=16, rings=8)
    return root
