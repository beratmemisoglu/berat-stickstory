# TICKETS: an office desk phone (Set 2, the lottery office). A chunky wedge base (kw color) with a sloped top: the
# handset on its cradle pad on the left, a lit teal LCD (tex/tk_desk_phone_lcd.png: LINE 1, 10:42 PM, VM 3) with a
# red message light, a 3 x 4 keypad and four line keys with LEDs on the right, and a LIVE coiled cord from a socket on
# the base's left side to the handset's mouthpiece end (geometry nodes: a helix around a curve between two empties,
# so it follows the handset wherever it goes: hold() at the ear, lifted, dropped; it never sinks below the desk).
# Pivot `<name>_handset`: the handset's GRIP CENTRE (hold it there); local +Y = earpiece end, -Y = mouthpiece end,
# -Z = the speaker side (rests on the cradle). lifted=0..1 raises / turns it off the cradle (for checks).
# To hold() the handset, clear its parent first (keep transform): hold() keys world positions; the cord still follows.
# Desk prop: root at the desk-top centre under the base, front -Y.
#   textures: .venv/Scripts/python.exe assets/props/tex/make_tk_desk_phone.py
import math, os, bmesh
from mathutils import Vector, Euler

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
W, D, HF, HB = 0.24, 0.2, 0.035, 0.075          # base width, depth, front / back height
SLOPE = math.atan2(HB - HF, D)                   # ~11.3 deg
ZS = (HF + HB) / 2                               # slope height at y = 0
HS = (-0.075, 0.0, 0.027)                        # handset grip centre on the cradle (slope-local)

META = {'size': (W, D, 0.11), 'anchor': 'desk-top centre under the base, front -Y',
        'animate': ['_handset (pivot at the grip centre; loc / rot; cord follows)'],
        'grip': 'handset pivot rest: (-0.075, -0.005, 0.082) local, rot X = 11.3 deg (lying on the slope)',
        'params': "color='#2f333a' (body), lifted=0..1, on=True (lit LCD + LEDs), hs=1.0 (handset size; ~1.3 for at-ear CUs next to the 0.48 m head, it then overhangs the cradle)"}


def _wedge(cz, nm, mat, parent):
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((-W / 2, -D / 2, 0), (W / 2, -D / 2, 0), (W / 2, D / 2, 0), (-W / 2, D / 2, 0),
                                     (-W / 2, -D / 2, HF), (W / 2, -D / 2, HF), (W / 2, D / 2, HB), (-W / 2, D / 2, HB))]
    for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz.place(cz._mesh_obj(nm, bm, mat, smooth=False), (0, 0, 0), (0, 0, 0), None, parent, 0.006, 0.012)
    o.modifiers['bevel'].segments = 4
    return o


def _coil(cz, name, a, c, mat, parent, turns=24, rc=0.0085, rw=0.003, off=(-0.13, -0.03, -0.11)):
    """Coiled cord between empties a and c (geometry nodes, live): quadratic bezier from a to c through a sagging
    middle, a helix of radius rc around it (turns fixed: stretching opens the coil), clamped above z = 0 of the
    cord object (the desk), swept with a wire of radius rw."""
    import bpy
    ng = bpy.data.node_groups.new(name + '_coilgn', 'GeometryNodeTree')
    ng.interface.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links

    def vm(op, x, y=None, s=None):
        n = N.new('ShaderNodeVectorMath'); n.operation = op
        for i, v in ((0, x), (1, y)):
            if v is None: continue
            if isinstance(v, (tuple, list)): n.inputs[i].default_value = v
            else: L.new(v, n.inputs[i])
        if s is not None:
            if isinstance(s, (int, float)): n.inputs['Scale'].default_value = s
            else: L.new(s, n.inputs['Scale'])
        return n.outputs[0]

    def m(op, x, y=None):
        n = N.new('ShaderNodeMath'); n.operation = op
        for i, v in ((0, x), (1, y)):
            if v is None: continue
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: L.new(v, n.inputs[i])
        return n.outputs[0]
    go = N.new('NodeGroupOutput')
    ia = N.new('GeometryNodeObjectInfo'); ia.transform_space = 'RELATIVE'; ia.inputs['Object'].default_value = a
    ic = N.new('GeometryNodeObjectInfo'); ic.transform_space = 'RELATIVE'; ic.inputs['Object'].default_value = c
    mid = vm('ADD', vm('SCALE', vm('ADD', ia.outputs['Location'], ic.outputs['Location']), s=0.5), off)
    qb = N.new('GeometryNodeCurveQuadraticBezier'); qb.inputs['Resolution'].default_value = 420
    L.new(ia.outputs['Location'], qb.inputs['Start']); L.new(mid, qb.inputs['Middle']); L.new(ic.outputs['Location'], qb.inputs['End'])
    sp = N.new('GeometryNodeSplineParameter'); tg = N.new('GeometryNodeInputTangent'); nr = N.new('GeometryNodeInputNormal')
    bn = vm('CROSS_PRODUCT', tg.outputs[0], nr.outputs[0])
    ph = m('MULTIPLY', sp.outputs['Factor'], 2 * math.pi * turns)
    hel = vm('SCALE', vm('ADD', vm('SCALE', nr.outputs[0], s=m('COSINE', ph)), vm('SCALE', bn, s=m('SINE', ph))), s=rc)
    s1 = N.new('GeometryNodeSetPosition'); L.new(qb.outputs[0], s1.inputs['Geometry']); L.new(hel, s1.inputs['Offset'])
    pos = N.new('GeometryNodeInputPosition'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(pos.outputs[0], sep.inputs[0])
    cmb = N.new('ShaderNodeCombineXYZ'); L.new(sep.outputs['X'], cmb.inputs['X']); L.new(sep.outputs['Y'], cmb.inputs['Y'])
    L.new(m('MAXIMUM', sep.outputs['Z'], rw), cmb.inputs['Z'])
    s2 = N.new('GeometryNodeSetPosition'); L.new(s1.outputs[0], s2.inputs['Geometry']); L.new(cmb.outputs[0], s2.inputs['Position'])
    circ = N.new('GeometryNodeCurvePrimitiveCircle'); circ.inputs['Resolution'].default_value = 8; circ.inputs['Radius'].default_value = rw
    c2m = N.new('GeometryNodeCurveToMesh'); c2m.inputs['Fill Caps'].default_value = True
    L.new(s2.outputs[0], c2m.inputs['Curve']); L.new(circ.outputs[0], c2m.inputs['Profile Curve'])
    sm = N.new('GeometryNodeSetMaterial'); L.new(c2m.outputs[0], sm.inputs['Geometry']); sm.inputs['Material'].default_value = mat
    L.new(sm.outputs[0], go.inputs['Geometry'])
    me = bpy.data.meshes.new(name + '_cord'); o = bpy.data.objects.new(name + '_cord', me)
    me.materials.append(mat)
    cz._link(o, parent)
    md = o.modifiers.new('coil', 'NODES'); md.node_group = ng
    return o


def build(cz, name='tk_desk_phone', color='#2f333a', lifted=0.0, on=True, hs=1.0):
    k = cz.clamp(float(lifted))
    root = cz.empty(name)
    body = cz.toon(f'{name}_body_{color.lstrip("#")}', color, tex='grain', tex_strength=0.05)
    dark = cz.toon(name + '_dark', '#1c1e22')
    key = cz.toon(name + '_key', '#d8d5cc', tex='grain', tex_strength=0.03)
    _wedge(cz, name + '_base', body, root)
    # dark rubber plinth under the bevelled bottom edge: without it the lit desk shows through as a pale strip
    cz.box(name + '_plinth', (W - 0.012, D - 0.012, 0.008), (0, 0, 0), dark, bevel=0.002, ol=0.0, parent=root, origin='bottom')
    # rubber feet
    for sx in (-1, 1):
        for sy in (-1, 1):
            cz.box(f'{name}_foot{sx}{sy}', (0.03, 0.02, 0.004), (sx * 0.085, sy * 0.07, -0.002), dark, bevel=0.0015, ol=0.0, parent=root)
    top = cz.empty(name + '_top', (0, 0, ZS), parent=root); top.rotation_euler = (SLOPE, 0, 0)
    # cradle pad under the handset + two hook-switch nubs
    cz.box(name + '_cradle', (0.066, 0.19, 0.004), (HS[0], 0, 0), dark, bevel=0.002, ol=0.0, parent=top, origin='bottom')
    for sy in (-1, 1):
        cz.box(f'{name}_hook{sy}', (0.014, 0.012, 0.007 if k > 0.05 else 0.003), (HS[0], sy * 0.03, 0.003), key, bevel=0.002, ol=0.0015, parent=top, origin='bottom')
    # LCD in a bezel + message light
    cz.box(name + '_lcdbezel', (0.118, 0.05, 0.004), (0.045, 0.055, 0), dark, bevel=0.002, ol=0.002, parent=top, origin='bottom')
    lcd = cz.screen(name + '_lcdm', os.path.join(TEX, 'tk_desk_phone_lcd.png'), strength=1.0) if on else cz.toon(name + '_lcd_off', '#4a5a52')
    cz.plane(name + '_lcd', 0.105, 0.035, (0.045, 0.055, 0.0052), lcd, rot=(0, 0, 0), parent=top)
    msg = cz.glow(name + '_msgm', '#ff3a2a', 4.0) if on else cz.toon(name + '_msg_off', '#5a1e1a')
    cz.cyl(name + '_msg', 0.0055, 0.004, (-0.03, 0.075, 0), msg, verts=14, ol=0.0015, parent=top)
    # keypad 3 x 4 + four line keys with LEDs
    for r in range(4):
        for cc in range(3):
            cz.box(f'{name}_key{r}{cc}', (0.02, 0.015, 0.007), (0.005 + cc * 0.026, -0.004 - r * 0.021, 0), key, bevel=0.003, ol=0.0015, parent=top, origin='bottom')
    ledc = ['#5dff8a', '#5dff8a', '#ff3a2a', '#5a6068']
    for r in range(4):
        cz.box(f'{name}_line{r}', (0.018, 0.012, 0.006), (0.098, -0.004 - r * 0.021, 0), key, bevel=0.0025, ol=0.0015, parent=top, origin='bottom')
        lm = cz.glow(f'{name}_led_{ledc[r][1:]}', ledc[r], 3.0) if on and r < 3 else cz.toon(name + '_led_off', '#3a3d42')
        cz.box(f'{name}_led{r}', (0.005, 0.005, 0.003), (0.082, -0.004 - r * 0.021, 0), lm, bevel=0.0, ol=0.0, parent=top, origin='bottom')
    # ---- handset on its pivot (grip centre); rest pose lying on the cradle, lifted by k
    rest = Vector((0, 0, ZS)) + Euler((SLOPE, 0, 0)).to_matrix() @ Vector(HS)
    hp = cz.empty(name + '_handset', tuple(rest + Vector((-0.05 * k, -0.04 * k, 0.17 * k))), parent=root)
    hp.rotation_euler = (SLOPE + math.radians(28 * k), math.radians(-20 * k), math.radians(30 * k))
    s = float(hs)          # handset size (built into the meshes, never object scale: that breaks the ink hulls)
    cz.box(name + '_handset_grip', (0.044 * s, 0.12 * s, 0.026 * s), (0, 0, 0), body, bevel=0.011 * s, ol=0.004 * s, parent=hp)
    for sy, nm in ((1, 'ear'), (-1, 'mouth')):
        cz.box(f'{name}_handset_{nm}', (0.06 * s, 0.052 * s, 0.036 * s), (0, sy * 0.074 * s, -0.007 * s), body, bevel=0.016 * s, ol=0.005 * s, parent=hp)
        # speaker / mic holes on the underside
        for i in range(3):
            cz.cyl(f'{name}_handset_{nm}_hole{i}', 0.0035 * s, 0.002 * s, ((i - 1) * 0.012 * s, sy * 0.074 * s, -0.0255 * s), dark, verts=10, ol=0.0, parent=hp)
    # ---- live coiled cord: base socket (left side) -> mouthpiece end
    cz.box(name + '_socket', (0.006, 0.016, 0.012), (-W / 2 - 0.001, -0.04, 0.018), dark, bevel=0.002, ol=0.0015, parent=root)
    a = cz.empty(name + '_cord_a', (-W / 2 - 0.004, -0.04, 0.018), parent=root, size=0.01)
    c = cz.empty(name + '_cord_c', (0.0, -0.098 * s, -0.012 * s), parent=hp, size=0.01)
    _coil(cz, name, a, c, cz.toon(name + '_cordm', color, tex='grain', tex_strength=0.03), root)
    return root
