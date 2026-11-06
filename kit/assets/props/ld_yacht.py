# The yacht FINDERS KEEPERS (LOTTERY L10, reference f517-660): a chunky toy cabin cruiser. Faceted white hull with navy
# stripes and the gold name on both sides, a teak foredeck with a glowing round HOT TUB, chrome rails round the bow,
# a cream deckhouse with a navy window band, a flybridge with a console, a wooden ship's wheel and a radar arch with a
# red pennant; warm string lights from the arch down to the bow rail (and back to the stern), portholes, a swim
# platform, bow-wave foam lines. Root at the waterline centre; the bow faces -Y.
import math, os
import bmesh
from mathutils import Vector, Matrix

META = {'size': (3.3, 9.0, 4.8), 'anchor': 'waterline centre (z 0 = water), bow toward -Y',
        'animate': ['_wheel (ship wheel pivot, spins about local Y)', '_flag (pennant pivot, flutters about Z)'],
        'params': 'lights=1.0 (string-light emission scale; the scene keys material ld_yacht_bulbm node "bulb_emit")',
        'deck_z': 1.25, 'fly_z': 1.65,
        'captain': (0.0, 0.55, 1.69),        # where the captain's feet go (flybridge, behind the wheel), faces -Y
        'wheel': (0.0, 0.12, 2.07), 'wheel_r': 0.24,
        'tub': (0.0, -2.0, 1.25), 'tub_r': 0.95, 'tub_water_z': 1.77,
        'bulbs': 'material ld_yacht_bulbm (emission node bulb_emit), the lights to key on'}

LAB = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(LAB, 'film', 'lottery', 'tex')

# deck outline (half widths): stern .. bow, (y, half-width)
OUTLINE = [(4.1, 1.55), (2.0, 1.62), (-0.8, 1.62), (-2.0, 1.48), (-3.0, 1.1), (-3.8, 0.55), (-4.35, 0.0)]


def _outline_pts(scale_x=1.0, bow_y=None):
    """Closed deck polygon (x, y), counter-clockwise from the stern centre."""
    right = [(hw * scale_x, y) for (y, hw) in OUTLINE]
    if bow_y is not None:
        right[-1] = (0.0, bow_y)
    left = [(-x, y) for (x, y) in reversed(right[:-1])]
    return right + left


def _hull(cz, name, mats, parent):
    """Lofted faceted hull: rings bottom -> deck; material index per band (0 white, 1 navy)."""
    # (z, x scale, bow y, material of the band BELOW this ring): navy boot stripe, white, navy pinstripe, white
    # (the name), navy sheer band, white gunwale cap (reference f541)
    rings = [(-0.45, 0.56, -3.4, 0), (0.0, 0.9, -4.0, 1), (0.12, 0.93, -4.06, 1), (0.34, 0.985, -4.18, 0),
             (0.42, 1.0, -4.22, 1), (0.98, 1.0, -4.3, 0), (1.17, 1.0, -4.33, 1), (1.25, 1.0, -4.35, 0)]
    bm = bmesh.new(); R = []
    for (z, sx, by, _) in rings:
        R.append([bm.verts.new((x, y, z)) for (x, y) in _outline_pts(sx, by)])
    n = len(R[0])
    for j in range(len(R) - 1):
        mi = rings[j + 1][3]
        for i in range(n):
            f = bm.faces.new((R[j][i], R[j][(i + 1) % n], R[j + 1][(i + 1) % n], R[j + 1][i])); f.material_index = mi
    top = bm.faces.new(R[-1]); top.material_index = 2
    bot = bm.faces.new(list(reversed(R[0]))); bot.material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy_mesh(name, bm)
    for m in mats: me.materials.append(m)
    import bpy
    o = bpy.data.objects.new(name, me)
    cz.place(o, (0, 0, 0), parent=parent, outline_t=0.012)
    return o


def bpy_mesh(name, bm):
    import bpy
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); return me


def _tubes(cz, name, segs, r, mat, parent, ol=0.004, verts=10):
    """Many cylinders in ONE mesh: segs = [(p0, p1), ...] (rails, posts, arch)."""
    import bpy
    bm = bmesh.new()
    for (a, b) in segs:
        a, b = Vector(a), Vector(b); d = b - a; L = d.length
        if L < 1e-5: continue
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=L)
        q = d.normalized().to_track_quat('Z', 'Y')
        bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=g['verts'])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)   # outward normals: the engine's contact check reads them
    me = bpy_mesh(name, bm); me.materials.append(mat)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    o = bpy.data.objects.new(name, me); cz.place(o, (0, 0, 0), parent=parent, outline_t=ol)
    return o


def _balls(cz, name, pts, r, mat, parent, segs=10, rings=6):
    import bpy
    bm = bmesh.new()
    for p in pts:
        g = bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
        bmesh.ops.translate(bm, vec=Vector(p), verts=g['verts'])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)   # outward normals: the engine's contact check reads them
    me = bpy_mesh(name, bm); me.materials.append(mat)
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    o = bpy.data.objects.new(name, me); cz.place(o, (0, 0, 0), parent=parent)
    return o


def _catenary(a, b, sag, n):
    a, b = Vector(a), Vector(b)
    return [a.lerp(b, k / n) - Vector((0, 0, sag * 4 * (k / n) * (1 - k / n))) for k in range(n + 1)]


def _edge_pts(inset, z, y_from, y_to=None, step=0.42):
    """Points along the right deck edge (x > 0) from y_from to the bow tip, inset from the edge."""
    pts = [(hw, y) for (y, hw) in OUTLINE if y <= y_from + 1e-6]
    hw0 = _hw(y_from); pts = [(hw0, y_from)] + pts
    out = []
    for (x0, y0), (x1, y1) in zip(pts[:-1], pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0); n = max(1, round(L / step))
        for k in range(n):
            t = k / n; out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    out.append(pts[-1])
    res = []
    for (x, y) in out:
        res.append((max(0.0, x - inset) if x > 0.05 else 0.0, y + (inset * 0.9 if x < 0.05 else 0.0), z))
    return res


def _hw(y):
    for (y0, h0), (y1, h1) in zip(OUTLINE[:-1], OUTLINE[1:]):
        if y1 <= y <= y0: return h0 + (h1 - h0) * (y0 - y) / (y0 - y1)
    return OUTLINE[0][1]


def bulb_material(name='ld_yacht_bulbm'):
    """String-light bulbs: a cream glass base + emission keyed by the scene (node 'bulb_emit')."""
    import bpy
    m = bpy.data.materials.get(name)
    if m: return m
    import cz
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N, L = nt.nodes, nt.links
    out = N.new('ShaderNodeOutputMaterial'); e = N.new('ShaderNodeEmission'); e.name = 'bulb_emit'
    e.inputs['Color'].default_value = cz.col('#fff0c8'); e.inputs['Strength'].default_value = 4.0
    e2 = N.new('ShaderNodeEmission'); e2.inputs['Color'].default_value = cz.col('#7a86c8'); e2.inputs['Strength'].default_value = 1.0
    ad = N.new('ShaderNodeAddShader'); L.new(e.outputs[0], ad.inputs[0]); L.new(e2.outputs[0], ad.inputs[1])
    L.new(ad.outputs[0], out.inputs['Surface'])
    return m


def water_glow(name):
    """Hot-tub water: cyan glow, brighter toward the centre (radial gradient), never clipping to white."""
    import bpy, cz
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N, L = nt.nodes, nt.links
    out = N.new('ShaderNodeOutputMaterial'); tc = N.new('ShaderNodeTexCoord')
    gr = N.new('ShaderNodeTexGradient'); gr.gradient_type = 'SPHERICAL'
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1.1, 1.1, 1.1); L.new(tc.outputs['Object'], mp.inputs['Vector']); L.new(mp.outputs[0], gr.inputs['Vector'])
    cr = N.new('ShaderNodeValToRGB'); L.new(gr.outputs['Fac'], cr.inputs['Fac'])
    cr.color_ramp.elements[0].color = cz.col('#1468e0'); cr.color_ramp.elements[1].color = cz.col('#7af0ff')
    e = N.new('ShaderNodeEmission'); e.inputs['Strength'].default_value = 1.0; L.new(cr.outputs['Color'], e.inputs['Color'])
    L.new(e.outputs[0], out.inputs['Surface'])
    return m


def _ring_segs(c, r, axis, n=24):
    out = []
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        def p(a):
            u, v = r * math.cos(a), r * math.sin(a)
            return (c[0] + u, c[1], c[2] + v) if axis == 'y' else (c[0], c[1] + u, c[2] + v) if axis == 'x' else (c[0] + u, c[1] + v, c[2])
        out.append((p(a0), p(a1)))
    return out


def _lifering(cz, name, c, r, axis, red, wht, parent):
    """Red/white life ring: four red and four white quarters (axis = the ring's normal)."""
    segs = _ring_segs(c, r, axis, 24)
    _tubes(cz, name + '_r', [s for i, s in enumerate(segs) if (i // 3) % 2 == 0], r * 0.3, red, parent, ol=0.004, verts=10)
    _tubes(cz, name + '_w', [s for i, s in enumerate(segs) if (i // 3) % 2 == 1], r * 0.3, wht, parent, ol=0.004, verts=10)


def _coil(cz, name, c, r, parent, mat, turns=3):
    segs = []
    for t in range(turns):
        segs += _ring_segs((c[0], c[1], c[2] + 0.028 + t * 0.045), r * (1 - 0.12 * t), 'z', 20)
    tail = [(c[0] + r, c[1], c[2] + 0.03), (c[0] + r + 0.25, c[1] - 0.12, c[2] + 0.025), (c[0] + r + 0.45, c[1] - 0.05, c[2] + 0.025)]
    segs += list(zip(tail[:-1], tail[1:]))
    _tubes(cz, name, segs, 0.026, mat, parent, ol=0.004, verts=8)


def _clutter(cz, name, root, chrome, wood, woodl, teakd, cream, white, red, wht, dark, glassn):
    """Deck life (enriched target l10_0601): rope coils + cleats on the foredeck, a cooler and two deck chairs on the
    flybridge, a second life ring on the flybridge rail, switches / gauges / a radio mic on the console, rail ball caps."""
    import random
    FLY = META['fly_z']
    rope = cz.toon(name + '_rope', '#c9a06a', tex='grain', tex_strength=0.1)
    for k, (x, y, z, r) in enumerate(((-0.42, -3.3, 1.29, 0.17), (0.48, -3.25, 1.29, 0.15), (0.85, 1.05, FLY + 0.04, 0.16), (-0.9, 2.9, FLY + 0.04, 0.14))):
        _coil(cz, f'{name}_coil{k}', (x, y, z), r, root, rope)
    # cleats along the foredeck edge
    for k, (x, y) in enumerate(((1.3, -1.6), (-1.3, -1.6), (0.75, -3.4), (-0.75, -3.4))):
        cz.box(f'{name}_cleat{k}', (0.05, 0.22, 0.05), (x, y, 1.33), chrome, bevel=0.012, ol=0.003, parent=root)
        cz.box(f'{name}_cleatb{k}', (0.05, 0.06, 0.05), (x, y, 1.305), chrome, bevel=0.01, ol=0.0, parent=root)
    # cooler (white lid, blue body, handle) and two folding deck chairs on the flybridge
    blue = cz.toon(name + '_coolerb', '#2f7ae0', tex='grain', tex_strength=0.05)
    cz.box(name + '_cooler', (0.46, 0.32, 0.3), (-0.82, 1.35, FLY + 0.04 + 0.15), blue, bevel=0.03, ol=0.005, parent=root)
    cz.box(name + '_coolerlid', (0.48, 0.34, 0.06), (-0.82, 1.35, FLY + 0.04 + 0.33), wht, bevel=0.02, ol=0.004, parent=root)
    _tubes(cz, name + '_coolerh', [((-1.0, 1.35, FLY + 0.4), (-1.0, 1.35, FLY + 0.46)), ((-1.0, 1.35, FLY + 0.46), (-0.64, 1.35, FLY + 0.46)), ((-0.64, 1.35, FLY + 0.46), (-0.64, 1.35, FLY + 0.4))], 0.012, dark, root, ol=0.0)
    for k, x in enumerate((-0.55, 0.55)):
        y0 = 2.55
        frame = [((x - 0.24, y0 - 0.2, FLY + 0.04), (x - 0.24, y0 + 0.25, FLY + 0.36)), ((x + 0.24, y0 - 0.2, FLY + 0.04), (x + 0.24, y0 + 0.25, FLY + 0.36)),
                 ((x - 0.24, y0 + 0.25, FLY + 0.04), (x - 0.24, y0 - 0.1, FLY + 0.3)), ((x + 0.24, y0 + 0.25, FLY + 0.04), (x + 0.24, y0 - 0.1, FLY + 0.3)),
                 ((x - 0.24, y0 + 0.25, FLY + 0.36), (x - 0.24, y0 + 0.38, FLY + 0.8)), ((x + 0.24, y0 + 0.25, FLY + 0.36), (x + 0.24, y0 + 0.38, FLY + 0.8))]
        _tubes(cz, f'{name}_chairf{k}', frame, 0.014, chrome, root, ol=0.002)
        canvas = cz.toon(f'{name}_canvas{k}', ['#e04a4a', '#2fa0d8'][k], tex='grain', tex_strength=0.05)
        cz.box(f'{name}_chairs{k}', (0.46, 0.4, 0.02), (x, y0 + 0.02, FLY + 0.33), canvas, rot=(-6, 0, 0), bevel=0.006, ol=0.003, parent=root)
        cz.box(f'{name}_chairb{k}', (0.46, 0.02, 0.38), (x, y0 + 0.32, FLY + 0.6), canvas, rot=(-16, 0, 0), bevel=0.006, ol=0.003, parent=root)
    _lifering(cz, name + '_lifering2', (1.34, 0.6, FLY + 0.3), 0.19, 'x', red, wht, root)
    # console: switches, two gauges, a radio mic on a curly cord, a sticker
    cy = -0.2 - 0.25 - 0.012
    for k, (x, c) in enumerate(((-0.42, '#e84040'), (-0.36, '#40c060'), (-0.3, '#e8c040'), (0.3, '#4080e8'), (0.36, '#e84040'))):
        cz.box(f'{name}_sw{k}', (0.035, 0.03, 0.05), (x, cy, FLY + 0.12), cz.toon(f'{name}_swm{k}', c), bevel=0.004, ol=0.002, parent=root)
    for k, x in enumerate((-0.47, 0.44)):
        cz.cyl(f'{name}_gauge{k}', 0.055, 0.02, (x, cy + 0.004, FLY + 0.26), wht, rot=(90, 0, 0), ol=0.003, verts=20, origin='center', parent=root)
        cz.box(f'{name}_needle{k}', (0.008, 0.004, 0.045), (x + 0.01, cy - 0.008, FLY + 0.27), cz.toon(name + '_needlem', '#d02020'), rot=(0, 35, 0), bevel=0, ol=0, parent=root)
    cz.box(name + '_mic', (0.05, 0.03, 0.08), (0.48, cy - 0.01, FLY + 0.12), dark, bevel=0.01, ol=0.002, parent=root)
    curl = [(0.48 + 0.02 * math.sin(k * 1.3), cy - 0.02, FLY + 0.08 - 0.012 * k) for k in range(8)]
    _tubes(cz, name + '_miccord', list(zip(curl[:-1], curl[1:])), 0.006, dark, root, ol=0.0, verts=6)
    # rail post ball caps (chrome) on the bow rail
    caps = []
    for sx in (1, -1):
        caps += [(sx * x, y, 2.04) for (x, y, z) in _edge_pts(0.07, 2.03, -0.7)]
    _balls(cz, name + '_railcaps', caps, 0.034, chrome, root, 10, 6)
    # two steel bands round the tub
    tx, ty, _ = META['tub']; TR = META['tub_r']
    for z in (1.42, 1.64):
        _tubes(cz, f'{name}_tubband{z}', _ring_segs((tx, ty, z), TR + 0.008, 'z', 40), 0.012, chrome, root, ol=0.0, verts=6)


def build(cz, name='ld_yacht', lights=1.0, wheel=0.0, clutter=True):
    import bpy
    root = cz.empty(name)
    white = cz.toon(name + '_white', '#a9b3e4', tex='grain', tex_strength=0.04)   # reads mid-blue in the moon's back light (ref f541)
    navy = cz.toon(name + '_navy', '#1d2a72', tex='grain', tex_strength=0.04)
    cream = cz.toon(name + '_cream', '#efe6d2', tex='grain', tex_strength=0.04)
    deckw = cz.toon(name + '_deckw', '#e9e2d2', tex='grain', tex_strength=0.05)
    teak = cz.toon(name + '_teak', '#c0703a', tex='wood', tex_scale=2.0, tex_strength=0.12)
    teakd = cz.toon(name + '_teakd', '#8a4a24', tex='wood', tex_scale=2.0, tex_strength=0.1)
    chrome = cz.toon(name + '_chrome', '#c4cbe4', tex='grain', tex_strength=0.03)
    glassn = cz.toon(name + '_win', '#1a1f52', tex='grain', tex_strength=0.05)
    wood = cz.toon(name + '_wood', '#8e4f24', tex='wood', tex_scale=3.0, tex_strength=0.14)
    woodl = cz.toon(name + '_woodl', '#c27a3c', tex='wood', tex_scale=3.0, tex_strength=0.12)
    dark = cz.toon(name + '_dark', '#1a1630')
    wire = cz.toon(name + '_wire', '#23203a')
    # ---- hull
    _hull(cz, name + '_hull', [white, navy, deckw], root)
    # the name on both sides (straight part of the hull, y -0.9 .. +3.6), 1.5 mm proud
    nm = cz.toon(name + '_namem', img=os.path.join(TEX, 'ld_finders.png'), lift=0.7, alpha_clip=True)
    for sx in (1, -1):
        cz.plane(f'{name}_name{sx}', 3.4, 0.51, (sx * 1.6215, 0.25, 0.7), nm, rot=(90, 0, 90 * sx), parent=root)   # under the flybridge, forward of the captain (ref f559)
    # portholes forward of the name
    for sx in (1, -1):
        for k, y in enumerate((-1.45, -2.05)):
            hw = _hw(y) + 0.004
            ang = math.degrees(math.atan2(_hw(y - 0.1) - _hw(y + 0.1), 0.2))
            cz.cyl(f'{name}_port{sx}{k}', 0.11, 0.03, (sx * hw, y, 0.72), chrome, rot=(0, 90 * sx, -sx * ang), ol=0.004, verts=20, origin='center')
            cz.cyl(f'{name}_portg{sx}{k}', 0.075, 0.032, (sx * (hw + 0.004), y, 0.72), glassn, rot=(0, 90 * sx, -sx * ang), ol=0.0, verts=20, origin='center')
    # teak foredeck (inset slab) + a gunwale cap strip
    bm = bmesh.new()
    fwd = [(hw * 0.93, y) for (y, hw) in OUTLINE if y <= -0.8]
    poly = [(1.5, -0.6)] + fwd[:-1] + [(0.0, -4.15)] + [(-x, y) for (x, y) in reversed(fwd[:-1])] + [(-1.5, -0.6)]
    vs = [bm.verts.new((x, y, 1.25)) for (x, y) in poly]; bm.faces.new(vs)
    bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    for v in bm.verts:
        if v.co.z > 1.249 and v not in vs: pass
    top = [v for v in bm.verts if v not in vs]
    for v in top: v.co.z = 1.29
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy_mesh(name + '_deck', bm); me.materials.append(teak)
    o = bpy.data.objects.new(name + '_deck', me); cz.place(o, (0, 0, 0), parent=root, outline_t=0.004)
    # plank lines on the teak (thin dark strips along Y)
    for i in range(-6, 7):
        x = i * 0.22
        y0 = -0.62; y1 = -0.62 - 3.5 * (1 - (abs(x) / 1.45) ** 1.6) - 0.05
        if abs(x) > 1.35: continue
        cz.box(f'{name}_plank{i}', (0.012, abs(y1 - y0), 0.004), (x, (y0 + y1) / 2, 1.292), teakd, bevel=0, ol=0, parent=root)
    # ---- hot tub on the foredeck
    tx, ty, tz = META['tub']; TR = META['tub_r']
    cz.cyl(name + '_tub', TR, 0.5, (tx, ty, 1.27), cream, verts=48, bevel=0.02, ol=0.008, parent=root)
    rim_s = []
    for k in range(40):
        a0, a1 = 2 * math.pi * k / 40, 2 * math.pi * (k + 1) / 40
        rim_s.append(((tx + (TR + 0.02) * math.cos(a0), ty + (TR + 0.02) * math.sin(a0), 1.79), (tx + (TR + 0.02) * math.cos(a1), ty + (TR + 0.02) * math.sin(a1), 1.79)))
    _tubes(cz, name + '_tubrim', rim_s, 0.055, woodl, root, ol=0.006, verts=10)
    for k in range(16):   # vertical cladding lines on the tub side
        a = 2 * math.pi * k / 16
        cz.box(f'{name}_tubslat{k}', (0.02, 0.012, 0.46), (tx + (TR + 0.004) * math.sin(a), ty - (TR + 0.004) * math.cos(a), 1.5), cz.toon(name + '_tubline', '#d2c6aa'),
               rot=(0, 0, math.degrees(a)), bevel=0, ol=0, parent=root)
    # glowing pool: saturated cyan (strength > 1 clips to white under the Standard view: keep it ~1)
    wm = water_glow(name + '_waterm')
    cz.cyl(name + '_tubwater', TR - 0.04, 0.02, (tx, ty, 1.772), wm, verts=48, ol=0.0, parent=root)
    bub = cz.glow(name + '_bubm', '#d8f6ff', 1.1)
    import random
    rnd = random.Random(4)
    pts = []
    for _ in range(60):
        r = TR * 0.85 * math.sqrt(rnd.random()); a = rnd.uniform(0, 2 * math.pi)
        pts.append((tx + r * math.cos(a), ty + r * math.sin(a), 1.795))
    _balls(cz, name + '_bubbles', pts, 0.022, bub, root, 8, 5)
    # tub light (cyan up-light on the bathers)
    tl = cz.light(name + '_tublight', 'POINT', (tx, ty, 1.95), color='#5ee0ff', power=160, size=0.6, shadow=False)
    tl.parent = root
    # ---- bow rails: posts + top rail + mid rail along both deck edges from the deckhouse to the bow tip
    segs = []
    for sx in (1, -1):
        top = [(sx * x, y, z) for (x, y, z) in _edge_pts(0.07, 1.25 + 0.78, -0.7)]
        mid = [(sx * x, y, z) for (x, y, z) in _edge_pts(0.07, 1.25 + 0.42, -0.7)]
        bot = [(sx * x, y, z) for (x, y, z) in _edge_pts(0.07, 1.29, -0.7)]
        segs += list(zip(top[:-1], top[1:])) + list(zip(mid[:-1], mid[1:]))
        segs += [(b, t) for b, t in zip(bot, top)]
    _tubes(cz, name + '_rails', segs, 0.022, chrome, root, ol=0.004)
    # ---- deckhouse (cabin) with the navy window band
    FLY = META['fly_z']
    cz.box(name + '_cabin', (2.7, 4.6, FLY - 1.25), (0, 1.6, (1.25 + FLY) / 2), cream, bevel=0.04, ol=0.009, parent=root)
    zw = 1.25 + (FLY - 1.25) * 0.5
    cz.box(name + '_cabinwin_f', (2.2, 0.02, 0.24), (0, -0.71, zw), glassn, bevel=0.01, ol=0.003, parent=root)
    for sx in (1, -1):
        cz.box(f'{name}_cabinwin{sx}', (0.02, 3.8, 0.24), (sx * 1.355, 1.65, zw), glassn, bevel=0.01, ol=0.003, parent=root)
        for k in range(5):
            cz.box(f'{name}_mull{sx}{k}', (0.03, 0.06, 0.26), (sx * 1.362, -0.1 + k * 0.85, zw), cream, bevel=0.004, ol=0.0, parent=root)
    cz.box(name + '_cabindoor', (0.6, 0.02, FLY - 1.4), (0, 3.91, (1.3 + FLY) / 2), glassn, bevel=0.01, ol=0.003, parent=root)
    # flybridge deck lip + rails round its sides and back
    cz.box(name + '_flylip', (2.8, 4.7, 0.08), (0, 1.6, FLY), deckw, bevel=0.02, ol=0.006, parent=root)
    b0, b1, bm_ = FLY + 0.04, FLY + 0.5, FLY + 0.27
    segs = []
    for sx in (1, -1):
        ys = [-0.3 + 0.55 * k for k in range(9)]
        segs += [((sx * 1.32, y, b0), (sx * 1.32, y, b1)) for y in ys]
        segs += [((sx * 1.32, ys[0], b1), (sx * 1.32, ys[-1], b1)), ((sx * 1.32, ys[0], bm_), (sx * 1.32, ys[-1], bm_))]
    segs += [((-1.32, 4.1, b1), (1.32, 4.1, b1)), ((-1.32, 4.1, bm_), (1.32, 4.1, bm_))]
    segs += [((x, 4.1, b0), (x, 4.1, b1)) for x in (-0.66, 0.0, 0.66)]
    _tubes(cz, name + '_flyrails', segs, 0.02, white, root, ol=0.003)
    # ---- console + ship's wheel (the wheel sits low: its top spokes reach the captain's chin, reference f601)
    ch_ = 0.32
    cz.box(name + '_console', (1.05, 0.5, ch_), (0, -0.2, FLY + 0.04 + ch_ / 2), cream, bevel=0.03, ol=0.008, parent=root)
    cz.box(name + '_consolewin', (0.78, 0.02, 0.17), (0, -0.455, FLY + 0.04 + ch_ * 0.55), glassn, bevel=0.01, ol=0.003, parent=root)
    cz.box(name + '_consoletop', (1.08, 0.53, 0.04), (0, -0.2, FLY + 0.06 + ch_), cz.toon(name + '_ctop', '#2a2e5e'), bevel=0.01, ol=0.004, parent=root)
    for k, (x, c) in enumerate(((-0.32, '#ff5a5a'), (-0.22, '#6dff8a'), (0.3, '#ffd85a'))):
        cz.sphere(f'{name}_led{k}', 0.02, (x, -0.33, FLY + 0.085 + ch_), cz.glow(f'{name}_ledm{k}', c, 1.4), ol=0, parent=root, segs=10, rings=6)
    wx, wy, wz = META['wheel']
    wpv = cz.empty(name + '_wheel', (wx, wy, wz), parent=root)
    wpv.rotation_euler = (0, math.radians(wheel), 0)
    R = META['wheel_r']
    rim = []
    n = 24
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        rim.append(((R * math.cos(a0), 0, R * math.sin(a0)), (R * math.cos(a1), 0, R * math.sin(a1))))
    _tubes(cz, name + '_wheelrim', rim, 0.032, woodl, wpv, ol=0.005, verts=10)
    spokes = []
    for k in range(8):
        a = 2 * math.pi * k / 8 + math.pi / 8
        spokes.append(((0.05 * math.cos(a), 0, 0.05 * math.sin(a)), ((R + 0.1) * math.cos(a), 0, (R + 0.1) * math.sin(a))))
    _tubes(cz, name + '_spokes', spokes, 0.02, wood, wpv, ol=0.004, verts=8)
    _balls(cz, name + '_knobs', [((R + 0.115) * math.cos(2 * math.pi * k / 8 + math.pi / 8), 0, (R + 0.115) * math.sin(2 * math.pi * k / 8 + math.pi / 8)) for k in range(8)],
           0.036, wood, wpv, 10, 6)
    cz.cyl(name + '_hub', 0.065, 0.08, (0, 0, 0), woodl, rot=(90, 0, 0), ol=0.004, verts=20, origin='center', parent=wpv)
    cz.cyl(name + '_hubcap', 0.035, 0.09, (0, 0, 0), cz.toon(name + '_brass', '#e0b44a'), rot=(90, 0, 0), ol=0.0, verts=16, origin='center', parent=wpv)
    cz.cyl(name + '_wheelpost', 0.05, wz - FLY - 0.3, (wx, wy + 0.06, FLY + 0.36), dark, ol=0.004, verts=12, parent=root)
    # ---- radar arch over the captain (leans back), radar dome, flag pole + pennant
    AT = FLY + 1.55
    A = [((-1.05, -0.05, FLY + 0.04), (-0.82, 0.75, AT)), ((1.05, -0.05, FLY + 0.04), (0.82, 0.75, AT)), ((-0.82, 0.75, AT), (0.82, 0.75, AT))]
    _tubes(cz, name + '_arch', A, 0.075, cream, root, ol=0.007, verts=14)
    _balls(cz, name + '_archjoint', [(-0.82, 0.75, AT), (0.82, 0.75, AT)], 0.085, cream, root, 14, 8)
    cz.cyl(name + '_radar', 0.2, 0.16, (0.25, 0.8, AT + 0.06), cream, r2=0.12, ol=0.005, verts=24, parent=root)
    cz.sphere(name + '_radartop', 0.12, (0.25, 0.8, AT + 0.22), white, ol=0.005, parent=root, segs=16, rings=8)
    cz.cyl(name + '_flagpole', 0.018, 0.7, (-0.82, 0.75, AT + 0.05), chrome, ol=0.003, verts=8, parent=root)
    fpv = cz.empty(name + '_flag', (-0.82, 0.75, AT + 0.62), parent=root)
    cz.plane(name + '_pennant', 0.5, 0.25, (0.25, 0, 0), cz.toon(name + '_pennm', img=os.path.join(TEX, 'ld_pennant.png'), lift=0.7, alpha_clip=True),
             rot=(90, 0, 0), parent=fpv)
    # ---- string lights: arch top corners -> bow rail shoulders -> along the rail to the bow tip; arch -> stern
    bulbm = bulb_material(); bulbm.node_tree.nodes['bulb_emit'].inputs['Strength'].default_value = 4.0 * lights
    strings = []
    for sx in (1, -1):
        a = (sx * 0.82, 0.75, AT); s = (sx * 1.38, -1.0, 2.05)
        strings.append(_catenary(a, s, 0.3, 12))
        rail = [(sx * x, y, 2.05) for (x, y, z) in _edge_pts(0.07, 2.05, -1.0, step=0.3)]
        strings.append([Vector(p) for p in rail])
        strings.append(_catenary(a, (sx * 1.32, 4.1, FLY + 0.55), 0.3, 12))
    strings.append(_catenary((-0.82, 0.75, AT), (0.82, 0.75, AT), 0.12, 8))
    wsegs, bpts = [], []
    for s in strings:
        wsegs += list(zip([tuple(p) for p in s[:-1]], [tuple(p) for p in s[1:]]))
        bpts += [tuple(p - Vector((0, 0, 0.05))) for p in s[1:-1]]
    _tubes(cz, name + '_strwire', wsegs, 0.007, wire, root, ol=0.0, verts=6)
    _balls(cz, name + '_bulbs', bpts, 0.078, bulbm, root, 14, 9)
    # ---- swim platform + ladder at the stern, a life ring on the cabin back
    cz.box(name + '_platform', (2.6, 0.55, 0.08), (0, 4.32, 0.3), teak, bevel=0.01, ol=0.005, parent=root)
    _tubes(cz, name + '_ladder', [((0.5, 4.5, 0.3), (0.5, 4.5, -0.3)), ((0.8, 4.5, 0.3), (0.8, 4.5, -0.3)),
                                   ((0.5, 4.5, 0.05), (0.8, 4.5, 0.05)), ((0.5, 4.5, -0.15), (0.8, 4.5, -0.15))], 0.018, chrome, root)
    red = cz.toon(name + '_ringm', '#e8402e'); wht = cz.toon(name + '_ringw', '#f2eee6')
    _lifering(cz, name + '_lifering', (0.85, 3.93, 1.45), 0.2, 'y', red, wht, root)
    if clutter: _clutter(cz, name, root, chrome, wood, woodl, teakd, cream, white, red, wht, dark, glassn)
    # ---- bow wave foam lines (on the water, outside the hull)
    foam = cz.glow(name + '_foamm', '#bfe6ff', 1.3)
    for sx in (1, -1):
        P = [(sx * (0.05 + 0.25 * k ** 1.1), -3.95 + 0.9 * k, 0.03) for k in range(6)]
        _tubes(cz, f'{name}_foam{sx}', list(zip(P[:-1], P[1:])), 0.035, foam, root, ol=0.0, verts=6)
    return root
