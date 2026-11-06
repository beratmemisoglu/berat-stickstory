# Round glass fishbowl (Kyle's night bedroom): a wide glass sphere cut flat at the bottom and open at the top with a thick
# light-blue lip, water to ~70 % (glowing blue-cyan, a lighter ring + ripples on its flat surface), multi-colour gravel,
# a pink toy castle with two purple-roofed towers on the gravel, a toy boat (the yacht "FINDERS KEEPERS") floating on
# the water and a small orange goldfish.
# Glass: Transparent mixed with a cool emission through Layer Weight (alpha ~0.08 facing, ~0.55 at the silhouette, a
# brighter line right at the edge), BLENDED, no shadows, no hull outline (it would hide the inside): only the lip has a
# thin ink ring. Water: dithered (sorts correctly with everything inside), no shadows.
# Floor prop: root at the bowl's floor centre (it usually stands on ld_crate: put the root at the crate's META['top']).
import bpy, bmesh, math, random
from mathutils import Vector, Matrix

R, ZC = 0.30, 0.26                 # outer sphere radius / centre height
RIN = 0.292                        # clearance radius for everything inside
Z_RIM = ZC + math.sqrt(R * R - 0.2 * 0.2)       # 0.4836: opening radius 0.2
Z_WATER = 0.34                                  # ~70 % of the bowl's height

META = {'size': (0.62, 0.62, 0.50), 'anchor': 'floor centre of the bowl (stand it on ld_crate META top)',
        'animate': ['_fish (pivot: swim it inside META inside, r <= 0.15 around the centre)', '_boat (bob in z, yaw)'],
        'water': '<name>_water (object), material <name>_waterm; surface ring <name>_watertop',
        'inside': {'centre': (0.0, 0.0, 0.21), 'r': 0.2, 'note': 'free water volume for a picture card (x -0.2..0.2, z 0.08..0.33)'},
        'rim': {'z': round(Z_RIM, 4), 'r': 0.2}, 'water_z': Z_WATER,
        'params': 'fish=True, boat=True, castle=True, water=0.7 (fill fraction 0.3..0.85)'}


def _rin(z):
    h = z - ZC
    return math.sqrt(max(0.0, RIN * RIN - h * h))


def _sharp(me, deg=40):
    try: me.set_sharp_from_angle(angle=math.radians(deg))
    except Exception: pass


def _obj(cz, name, bm, mats, parent, loc=(0, 0, 0), ol=0.0, smooth=True, sharp=None, rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    if sharp: _sharp(me, sharp)
    for m in mats: me.materials.append(m)
    return cz.place(bpy.data.objects.new(name, me), loc, rot, None, parent, ol)


def lathe(cz, name, prof, mat, parent, loc=(0, 0, 0), segs=48, ol=0.0, closed=False, sharp=None):
    """Surface of revolution of the (r, z) profile about Z (normals outward when the profile runs bottom-centre ->
    out -> up the outside -> down the inside, or counter-clockwise for a closed loop)."""
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r < 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((r * math.cos(2 * math.pi * j / segs), r * math.sin(2 * math.pi * j / segs), z)) for j in range(segs)])
    n = len(rings); pairs = [(i, i + 1) for i in range(n - 1)] + ([(n - 1, 0)] if closed else [])
    for a, b in pairs:
        A, B = rings[a], rings[b]
        for j in range(segs):
            j2 = (j + 1) % segs
            if len(A) == 1 and len(B) == 1: continue
            if len(A) == 1: bm.faces.new((A[0], B[j2], B[j]))
            elif len(B) == 1: bm.faces.new((A[j], A[j2], B[0]))
            else: bm.faces.new((A[j], A[j2], B[j2], B[j]))
    return _obj(cz, name, bm, [mat], parent, loc, ol, sharp=sharp)


def extrude(cz, name, pts, d0, d1, mats, parent, axis='z', loc=(0, 0, 0), ol=0.0, taper=1.0, rot=(0, 0, 0)):
    """Prism of the polygon pts (u, v): axis 'z' -> (x, y) from z=d0 (scaled by taper) to z=d1 (top, mats[0]);
    axis 'y' -> (x, z) from y=d0 (front, mats[0]) to y=d1. Sides mats[-1]."""
    bm = bmesh.new()
    cu = sum(p[0] for p in pts) / len(pts); cv = sum(p[1] for p in pts) / len(pts)

    def P(u, v, d, k):
        u, v = cu + (u - cu) * k, cv + (v - cv) * k
        return (u, v, d) if axis == 'z' else (u, d, v)
    lo = [bm.verts.new(P(u, v, d0, taper if axis == 'z' else 1.0)) for u, v in pts]
    hi = [bm.verts.new(P(u, v, d1, 1.0 if axis == 'z' else taper)) for u, v in pts]
    bm.faces.new(lo); bm.faces.new(hi)
    n = len(pts)
    for i in range(n): bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    want = Vector((0, 0, 1)) if axis == 'z' else Vector((0, -1, 0))
    for f in bm.faces: f.material_index = 0 if f.normal.dot(want) > 0.9 else len(mats) - 1
    return _obj(cz, name, bm, mats, parent, loc, ol, smooth=False, rot=rot)


def ellipsoid(cz, name, rx, ry, rz, loc, mat, parent, ol=0.0, segs=24, rings=12):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * rx, v.co.y * ry, v.co.z * rz))
    return _obj(cz, name, bm, [mat], parent, loc, ol)


def glass_mat(cz, name, edge='#b8e4ff'):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial')
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.4
    a = N.new('ShaderNodeMapRange'); a.inputs['From Min'].default_value = 0.2; a.inputs['From Max'].default_value = 0.97
    a.inputs['To Min'].default_value = 0.08; a.inputs['To Max'].default_value = 0.55; L.new(lw.outputs['Facing'], a.inputs['Value'])
    s = N.new('ShaderNodeMapRange'); s.inputs['From Min'].default_value = 0.86; s.inputs['From Max'].default_value = 0.985
    s.inputs['To Min'].default_value = 0.7; s.inputs['To Max'].default_value = 2.2; L.new(lw.outputs['Facing'], s.inputs['Value'])
    tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = cz.col(edge); L.new(s.outputs['Result'], em.inputs['Strength'])
    mx = N.new('ShaderNodeMixShader'); L.new(a.outputs['Result'], mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'; m.use_backface_culling = False
    return m


def clear_mat(cz, name, color, alpha, strength, method='DITHERED'):
    """Semi-transparent glowing material (water)."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.name = 'water_glow'; em.inputs['Color'].default_value = cz.col(color); em.inputs['Strength'].default_value = strength
    mx = N.new('ShaderNodeMixShader'); mx.inputs[0].default_value = alpha
    L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], out.inputs['Surface'])
    m.surface_render_method = method
    return m


def build(cz, name='ld_fishbowl', fish=True, boat=True, castle=True, water=0.7):
    rnd = random.Random(11)
    root = cz.empty(name)
    zw = Z_WATER if abs(float(water) - 0.7) < 1e-6 else cz.clamp(float(water), 0.3, 0.85) * Z_RIM

    # ---- glass shell (flat bottom r 0.15, open top r 0.2) + a thick rolled lip
    ph0, ph1 = math.asin(-ZC / R), math.asin((Z_RIM - ZC) / R)
    prof = [(0.0, 0.0)] + [(R * math.cos(ph0 + (ph1 - ph0) * i / 28), ZC + R * math.sin(ph0 + (ph1 - ph0) * i / 28)) for i in range(29)]
    prof[1] = (prof[1][0], 0.0)
    gl = lathe(cz, name + '_glass', prof, glass_mat(cz, name + '_glassm'), root, segs=64)
    gl.visible_shadow = False
    rr = math.sqrt(R * R - (Z_RIM - ZC) ** 2)
    lip = lathe(cz, name + '_lip', [(rr + 0.011 * math.cos(2 * math.pi * i / 14), Z_RIM + 0.011 * math.sin(2 * math.pi * i / 14)) for i in range(14)],
                cz.toon(name + '_lipm', '#9fd2ee', emit=0.35), root, segs=64, ol=0.0025, closed=True)
    lip.visible_shadow = False

    # ---- water: a solid of revolution up to zw with a flat top; a lighter ring and two ripples on the surface
    wprof = [(0.0, 0.006), (_rin(0.006) - 0.002, 0.006)]
    for i in range(1, 17):
        z = 0.006 + (zw - 0.006) * i / 16; wprof.append((_rin(z) - 0.002, z))
    wprof.append((0.0, zw))
    wat = lathe(cz, name + '_water', wprof, clear_mat(cz, name + '_waterm', '#1fb4d6', 0.5, 1.0), root, segs=64)
    wat.visible_shadow = False
    rt = _rin(zw) - 0.002
    topm = clear_mat(cz, name + '_watertopm', '#8fe8f4', 0.75, 1.15)
    ring = lathe(cz, name + '_watertop', [(rt - 0.034, zw + 0.0013), (rt - 0.004, zw + 0.0013)], topm, root, segs=64)
    ring.visible_shadow = False
    for k, (r0, w) in enumerate(((0.07, 0.006), (0.15, 0.005))):
        rp = lathe(cz, f'{name}_ripple{k}', [(r0, zw + 0.0013), (r0 + w, zw + 0.0013)], topm, root, segs=48)
        rp.visible_shadow = False

    # ---- gravel: a dark bed filling the bottom + one mesh of many multi-colour pebbles (one material per colour)
    gb = [(0.0, 0.003), (_rin(0.003) - 0.003, 0.003)] + [(_rin(z) - 0.003, z) for z in (0.02, 0.035, 0.05)] + [(0.0, 0.058)]
    lathe(cz, name + '_gravelbed', gb, cz.toon(name + '_bedm', '#5a4f7a', tex='grain', tex_strength=0.08), root, segs=48)
    cols = ['#e0559a', '#e8c23a', '#2fae9e', '#8a55c8', '#e07a3a', '#3a7ad8', '#f08cc0']
    mats = [cz.toon(f'{name}_peb{i}', c) for i, c in enumerate(cols)]
    bm = bmesh.new()
    for layer, (z0, n) in enumerate(((0.045, 70), (0.062, 60), (0.075, 34))):
        for i in range(n):
            pr = rnd.uniform(0.011, 0.016)
            z = z0 + rnd.uniform(-0.004, 0.004)
            lim = min(_rin(z - pr), _rin(z + pr)) - pr - 0.004
            if layer == 2: lim *= 0.62          # mound higher in the middle
            a = rnd.uniform(0, 2 * math.pi); d = lim * math.sqrt(rnd.random())
            n0 = len(bm.faces)
            mtx = Matrix.Translation((d * math.cos(a), d * math.sin(a), z)) @ Matrix.Diagonal((1.0, rnd.uniform(0.8, 1.0), rnd.uniform(0.7, 0.85), 1.0))
            bmesh.ops.create_icosphere(bm, subdivisions=2, radius=pr, matrix=mtx)
            bm.faces.ensure_lookup_table(); k = rnd.randrange(len(cols))
            for fi in range(n0, len(bm.faces)): bm.faces[fi].material_index = k
    _obj(cz, name + '_gravel', bm, mats, root)

    # ---- toy castle on the gravel (back right): pink walls with crenels, two towers, purple cone roofs, windows
    if castle:
        cs = cz.empty(name + '_castle', (0.04, 0.06, 0.05), parent=root)
        pink = cz.toon(name + '_pink', '#e46aa6', tex='grain', tex_strength=0.05)
        purple = cz.toon(name + '_roof', '#7a3fb8')
        dark = cz.toon(name + '_win', '#3a2456')
        cz.box(name + '_wall', (0.15, 0.05, 0.11), (0, 0, 0), pink, bevel=0.003, ol=0.003, parent=cs, origin='bottom')
        for i in range(4):
            cz.box(f'{name}_crenel{i}', (0.022, 0.05, 0.02), (-0.054 + i * 0.036, 0, 0.11), pink, bevel=0.002, ol=0.0025, parent=cs, origin='bottom')
        cz.box(name + '_gate', (0.034, 0.004, 0.05), (0, -0.0262, 0.0), dark, bevel=0.0, ol=0.0, parent=cs, origin='bottom')
        for j, tx in enumerate((-0.08, 0.08)):
            cz.cyl(f'{name}_tower{j}', 0.03, 0.22, (tx, 0, 0), pink, verts=24, bevel=0.002, ol=0.003, parent=cs)
            cz.cyl(f'{name}_cone{j}', 0.04, 0.09, (tx, 0, 0.22), purple, r2=0.002, verts=24, ol=0.003, parent=cs)
            for wz in (0.1, 0.165):
                cz.box(f'{name}_twin{j}_{int(wz * 1000)}', (0.012, 0.004, 0.022), (tx, -0.0297, wz), dark, bevel=0.0, ol=0.0, parent=cs, origin='bottom')
        cz.box(name + '_wwin', (0.016, 0.004, 0.02), (0.0, -0.0262, 0.07), dark, bevel=0.0, ol=0.0, parent=cs, origin='bottom')

    # ---- goldfish (pivot <name>_fish, swims along its +X)
    if fish:
        fp = cz.empty(name + '_fish', (-0.1, -0.13, 0.2), parent=root); fp.rotation_euler = (0, 0, math.radians(-15))
        org = cz.toon(name + '_orange', '#ec6a14')
        ellipsoid(cz, name + '_fishbody', 0.042, 0.018, 0.028, (0, 0, 0), org, fp, ol=0.0025)
        extrude(cz, name + '_fishtail', [(-0.034, 0.0), (-0.072, 0.03), (-0.064, 0.0), (-0.072, -0.03)], -0.004, 0.004,
                [cz.toon(name + '_orange2', '#f08a2a')], fp, axis='y', ol=0.002)
        extrude(cz, name + '_fishfin', [(-0.01, 0.022), (0.012, 0.022), (-0.018, 0.042)], -0.003, 0.003, [cz.toon(name + '_orange2', '#f08a2a')], fp, axis='y', ol=0.002)
        for s in (-1, 1):
            cz.sphere(f'{name}_fisheye{s + 1}', 0.0055, (0.026, s * 0.0145, 0.006), cz.toon(name + '_eye', '#1a1414'), ol=0.0, parent=fp, segs=10, rings=6)

    # ---- toy boat floating on the water (pivot <name>_boat at the waterline)
    if boat:
        bp = cz.empty(name + '_boat', (-0.07, -0.05, zw), parent=root); bp.rotation_euler = (0, 0, math.radians(-25))
        white = cz.toon(name + '_hull', '#e8e4ee', tex='grain', tex_strength=0.03)
        blue = cz.toon(name + '_cabin', '#2f5fd0', tex='grain', tex_strength=0.03)
        hull = [(-0.08, -0.034), (0.045, -0.034), (0.088, 0.0), (0.045, 0.034), (-0.08, 0.034)]
        extrude(cz, name + "_hullm", hull, -0.024, 0.02, [white], bp, axis='z', ol=0.003, taper=0.72)
        band = [(x * 1.04, y * 1.08) for x, y in hull]
        extrude(cz, name + '_hullband', band, 0.004, 0.011, [blue], bp, axis='z', ol=0.0, taper=1.0)
        cz.box(name + '_cabinm', (0.07, 0.05, 0.034), (-0.022, 0, 0.02), blue, bevel=0.004, ol=0.003, parent=bp, origin='bottom')
        cz.box(name + '_cabroof', (0.08, 0.058, 0.008), (-0.024, 0, 0.054), white, bevel=0.002, ol=0.0025, parent=bp, origin='bottom')
        for k, wx in enumerate((-0.04, -0.016, 0.008)):
            cz.box(f'{name}_porthole{k}', (0.013, 0.003, 0.012), (wx, -0.0262, 0.031), cz.toon(name + '_glassw', '#bfe6ff'), bevel=0.0, ol=0.0, parent=bp, origin='bottom')
        cz.cyl(name + '_mast', 0.0028, 0.06, (-0.03, 0, 0.062), cz.toon(name + '_mastm', '#3a2a22'), verts=8, ol=0.0, parent=bp)
        extrude(cz, name + '_flag', [(-0.03, 0.118), (0.004, 0.106), (-0.03, 0.094)], -0.0015, 0.0015,
                [cz.toon(name + '_flagm', '#e0302a')], bp, axis='y', ol=0.0015)
    return root
