# BELL film: a porcelain teacup on its saucer, painted with a rose + forget-me-not band, gold rims and a blue foot line
# (tex/gb_teacup_floral.png wrapped on lathed meshes with UVs), dark amber tea with a shine, the handle on the right
# (+X), soft steam wisps (no outline, soft additive glow, ISSUES 82/88) when steam=True.
# The cup is its own part: pivot empty <name>_cup at the cup's foot (local (0, 0, 0.009) on the saucer), every cup part
# (tea, steam) under it, so a hand lifts the cup off the saucer: hide nothing, just move <name>_cup.
# Root = bottom centre (saucer on the table). META 'grip' = the handle (in the root frame with the cup at rest;
# 'grip_cup' = the same point in the <name>_cup frame).
import math, os, subprocess, bmesh
from mathutils import Vector

META = {'size': (0.184, 0.184, 0.09), 'anchor': 'bottom centre (saucer on the table), front -Y, handle +X',
        'grip': (0.083, 0.0, 0.052), 'grip_cup': (0.083, 0.0, 0.043), 'cup': (0.0, 0.0, 0.009),
        'animate': ['_cup (location / rotation: lift it off the saucer)', '_steam (scale / location z: drift)'],
        'params': "steam=True, steam_strength=0.6 (additive glow; raise it on bright backgrounds), saucer=True (False = the cup alone on the table, <name>_cup at z 0: grip z -0.009), tea=True"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
MAKER = os.path.join(TEX, 'make_gb_handprops.py')


def _png(cz, fn, what):
    out = os.path.join(TEX, fn)
    if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(MAKER): return out
    py = cz.py()
    try:
        subprocess.run([py, MAKER, what], timeout=90, check=True, capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e: print('CZ gb png failed', fn, e)
    return out


def _lathe(cz, name, prof, mat, parent=None, loc=(0, 0, 0), segs=32, ol=0.004, vs=None):
    """Surface of revolution about Z. prof = [(r, z), ...] from the bottom centre, up the OUTSIDE (normals point out);
    r == 0 makes a pole. UVs: u around, v along the profile (or the explicit list vs)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    rings = []
    for r, z in prof:
        rings.append([bm.verts.new((0, 0, z))] if r < 1e-6 else
                     [bm.verts.new((r * math.cos(2 * math.pi * j / segs), r * math.sin(2 * math.pi * j / segs), z)) for j in range(segs)])
    if vs is None:
        L = [0.0]
        for (r0, z0), (r1, z1) in zip(prof, prof[1:]): L.append(L[-1] + math.hypot(r1 - r0, z1 - z0))
        vs = [x / (L[-1] or 1) for x in L]
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        if len(a) == 1 and len(b) == 1: continue
        for j in range(segs):
            j2 = (j + 1) % segs; u0, u1 = j / segs, (j + 1) / segs
            if len(a) == 1: q = [(a[0], (u0 + u1) / 2, vs[i]), (b[j2], u1, vs[i + 1]), (b[j], u0, vs[i + 1])]
            elif len(b) == 1: q = [(a[j], u0, vs[i]), (a[j2], u1, vs[i]), (b[0], (u0 + u1) / 2, vs[i + 1])]
            else: q = [(a[j], u0, vs[i]), (a[j2], u1, vs[i]), (b[j2], u1, vs[i + 1]), (b[j], u0, vs[i + 1])]
            f = bm.faces.new([x[0] for x in q])
            for lp, x in zip(f.loops, q): lp[uvl].uv = (x[1], x[2])
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), loc, (0, 0, 0), None, parent, ol, 0.0)


def _tube(cz, name, pts, r, mat, parent=None, ol=0.003, sides=10, closed=False, r_end=None):
    """A round tube swept along pts (parallel-transport frames), capped unless closed."""
    bm = bmesh.new(); P = [Vector(p) for p in pts]; n = len(P); rings = []; prev = None
    for i, p in enumerate(P):
        t = (P[(i + 1) % n] - P[i - 1]) if closed else (P[min(i + 1, n - 1)] - P[max(i - 1, 0)])
        t.normalize()
        if prev is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            nr = (ref - t * ref.dot(t)).normalized()
        else: nr = (prev - t * prev.dot(t)).normalized()
        prev = nr; bn = t.cross(nr)
        rr = r if r_end is None else r + (r_end - r) * i / max(1, n - 1)
        rings.append([bm.verts.new(p + (nr * math.cos(2 * math.pi * k / sides) + bn * math.sin(2 * math.pi * k / sides)) * rr) for k in range(sides)])
    for i in range(n if closed else n - 1):
        a, b = rings[i], rings[(i + 1) % n]
        for k in range(sides): bm.faces.new((a[k], a[(k + 1) % sides], b[(k + 1) % sides], b[k]))
    if not closed: bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _steammat(cz, name, color, strength=0.3, height=0.13):
    """Additive steam: a fully transparent surface + a faint emission that fades out at the silhouette (Facing), at the
    tea surface and toward the top (object Z) - soft glow, no body, no outline (ISSUES 82/88)."""
    import bpy
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = cz.col(color)
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
    edge = cz.mth(N, L, 'POWER', cz.mth(N, L, 'SUBTRACT', 1.0, lw.outputs['Facing']), 2.5)
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    top = cz.mth(N, L, 'SUBTRACT', 1.0, cz.mth(N, L, 'MINIMUM', cz.mth(N, L, 'DIVIDE', sep.outputs['Z'], height), 1.0))
    base = cz.mth(N, L, 'MINIMUM', cz.mth(N, L, 'DIVIDE', sep.outputs['Z'], 0.025), 1.0)
    k = cz.mth(N, L, 'MULTIPLY', cz.mth(N, L, 'MULTIPLY', edge, cz.mth(N, L, 'MULTIPLY', top, base)), strength)
    L.new(k, em.inputs['Strength'])
    ad = N.new('ShaderNodeAddShader'); L.new(tr.outputs[0], ad.inputs[0]); L.new(em.outputs[0], ad.inputs[1])
    L.new(ad.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    return m


def build(cz, name='gb_teacup', steam=True, saucer=True, tea=True, steam_strength=0.6):
    root = cz.empty(name)
    img = _png(cz, 'gb_teacup_floral.png', 'floral')
    por = cz.toon(name + '_porcelain_gb_teacup_floral', img=img, lift=0.5)
    plain = cz.toon(name + '_porcelain', '#e6e0d2', tex='grain', tex_strength=0.02, lift=0.5)
    if saucer:
        _lathe(cz, name + '_saucer', [(0, 0), (0.045, 0), (0.05, 0.004), (0.085, 0.012), (0.088, 0.016), (0.084, 0.019), (0.079, 0.0185),
                                       (0.055, 0.013), (0.032, 0.009), (0, 0.009)], por, root, segs=48, ol=0.004,
               vs=[0.12, 0.12, 0.13, 0.69, 0.715, 0.74, 0.66, 0.17, 0.12, 0.12])
    cup = cz.empty(name + '_cup', (0, 0, 0.009 if saucer else 0.0), parent=root)   # no saucer: the foot on the table
    o = -0.009     # cup profile written in the root frame, shifted into the cup frame
    prof = [(0, 0.009), (0.026, 0.009), (0.028, 0.013), (0.024, 0.017), (0.03, 0.022), (0.044, 0.035), (0.052, 0.055), (0.056, 0.075),
            (0.054, 0.079), (0.051, 0.075), (0.046, 0.055), (0.034, 0.03), (0, 0.026)]
    _lathe(cz, name + '_cupbody', [(r, z + o) for r, z in prof], por, cup, segs=48, ol=0.004,
           vs=[0.0, 0.02, 0.06, 0.08, 0.12, 0.3, 0.5, 0.71, 0.755, 0.79, 0.9, 0.97, 1.0])
    # handle on the right (+X): a loop with a little spur on top
    hp = [(0.051, 0, 0.066), (0.066, 0, 0.071), (0.079, 0, 0.065), (0.083, 0, 0.052), (0.077, 0, 0.04), (0.064, 0, 0.034), (0.046, 0, 0.033)]
    _tube(cz, name + '_handle', [(x, y, z + o) for x, y, z in hp], 0.0058, plain, cup, ol=0.003, sides=10)
    cz.sphere(name + '_spur', 0.0055, (0.07, 0, 0.074 + o), plain, ol=0.002, parent=cup, segs=12, rings=8)
    root['grip'] = META['grip']
    if tea:
        tm = cz.toon(name + '_tea', '#5c2a0e', tex='grain', tex_strength=0.05, lift=0.7)
        cz.cyl(name + '_teasurf', 0.0484, 0.002, (0, 0, 0.066 + o), tm, verts=40, ol=0.0, parent=cup, origin='center')
        sh = cz.toon(name + '_teashine2', '#c9a27a', lift=0.6)
        s = cz.cyl(name + '_teashine', 0.0055, 0.0006, (-0.024, 0.022, 0.0672 + o), sh, verts=20, ol=0.0, parent=cup, origin='center')
        for v in s.data.vertices: v.co.x *= 1.8
        s.data.update()
    if steam:
        sm = _steammat(cz, name + '_steamm', '#efe8dc', strength=steam_strength, height=0.14)
        st = cz.empty(name + '_steam', (0, 0, 0.066 + o), parent=cup)
        # three separate S-wisps rising side by side (never crossing: an X of steam reads as a twisted rope)
        for i, (x0, y0, ph, h) in enumerate(((-0.018, -0.004, 0.0, 0.14), (0.004, 0.006, 2.1, 0.12), (0.022, -0.002, 4.0, 0.1))):
            pts = []
            for k in range(15):
                t = k / 14
                pts.append((x0 + 0.007 * math.sin(ph + t * 6.0) * (0.3 + t), y0 + 0.004 * math.cos(ph + t * 4.0), 0.002 + h * t))
            w = _tube(cz, f'{name}_steam{i}', pts, 0.012, sm, st, ol=0.0, sides=12, r_end=0.006)
            w.visible_shadow = False
    return root
