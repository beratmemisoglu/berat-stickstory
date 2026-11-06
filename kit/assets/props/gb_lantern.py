# BELL film: an 1800s hurricane oil lantern (~0.33 m incl. the bail): a red-painted tin fuel tank with brass trim, filler
# cap and wick knob, two side tubes up to a vented red cap with a chimney, a clear glass globe (blended, Fresnel edges,
# warm when lit) in a wire guard cage, a burner cone with a teardrop flame (cz.glow, blooms) and a bail handle with a
# wooden grip on top. Lit: a warm POINT light <name>_light at the flame (soft shadow: the guard wires throw lines).
# Root = bottom centre (stands on a table / floor). Hand-held: the hand holds META['grip'] (top of the bail, local), the
# film carries the root with offset = -grip. Glass parts are named *glass* and cast no shadow.
import math, bmesh
from mathutils import Vector

META = {'size': (0.21, 0.18, 0.335), 'anchor': 'bottom centre (rest on a table / floor); front -Y (wick knob)',
        'grip': (0.0, 0.0, 0.322), 'flame': (0.0, 0.0, 0.118),
        'animate': ['_flame (scale flicker, pivot at the wick)', '_light (energy flicker)'],
        'params': "lit=True, power=40 (W, POINT light <name>_light), color='#ffb35a' (flame / light), paint='#8a2418' (tin)"}


# ------------------------------------------------------------------ shared mesh helpers (copied per gb_ prop)
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


def _arc(c, rad, a0, a1, n, plane='XZ'):
    out = []
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        out.append((c[0] + rad * math.cos(a), c[1], c[2] + rad * math.sin(a)) if plane == 'XZ' else
                   (c[0], c[1] + rad * math.cos(a), c[2] + rad * math.sin(a)))
    return out


def _teardrop(cz, name, H, R, mat, parent, loc=(0, 0, 0), curl=0.2, ol=0.0, depth=1.0):
    """Flame tongue: round bottom, pointed tip curling toward +X; base at loc, height H (from torch.py)."""
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=24, rings=16)
    ub = min(0.45, R / H)
    for v in o.data.vertices:
        x, y, z = v.co; u = (z + 1) / 2
        rad = math.hypot(x, y); cth, sth = (x / rad, y / rad) if rad > 1e-9 else (1.0, 0.0)
        if u < ub:
            a = u / ub * math.pi / 2; r = R * math.sin(a); zz = ub * H * (1 - math.cos(a))
        else:
            r = R * ((1 - u) / (1 - ub)) ** 1.35; zz = H * u
        xo = curl * R * max(0.0, u - 0.45) ** 2 * 4
        v.co = (cth * r + xo, sth * r * depth, zz)
    o.data.update()
    return o


def _glassmat(cz, name, tint, alpha=0.12, edge=0.55, strength=1.0):
    """Clear glass: mostly transparent, Fresnel-bright edges in an unlit tint (blended)."""
    import bpy
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = cz.col(tint); em.inputs['Strength'].default_value = strength
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    k = cz.mth(N, L, 'MULTIPLY_ADD', lw.outputs['Facing'], edge, alpha)
    k = cz.mth(N, L, 'MINIMUM', k, 0.92)
    mx = N.new('ShaderNodeMixShader'); L.new(k, mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    return m


# ------------------------------------------------------------------ the lantern
def build(cz, name='gb_lantern', lit=True, power=40.0, color='#ffb35a', paint='#8a2418'):
    root = cz.empty(name)
    red = cz.toon(name + '_paint', paint, tex='grain', tex_scale=3.0, tex_strength=0.07)
    brass = cz.toon(name + '_brass', '#a07524', tex='grain', tex_scale=4.0, tex_strength=0.06)
    tin = cz.toon(name + '_tin', '#3b3a38', tex='grain', tex_scale=3.0, tex_strength=0.05)
    wood = cz.toon(name + '_wood', '#6a4026', tex='wood', tex_scale=6.0, tex_strength=0.1)
    # fuel tank (red tin) with a brass foot ring and a brass collar for the burner
    _lathe(cz, name + '_tank', [(0, 0), (0.07, 0), (0.079, 0.01), (0.083, 0.035), (0.078, 0.055), (0.06, 0.068), (0.034, 0.073), (0, 0.073)],
           red, root, ol=0.005)
    _lathe(cz, name + '_foot', [(0, -0.0005), (0.075, -0.0005), (0.078, 0.004), (0.078, 0.012), (0.07, 0.014), (0, 0.014)],
           brass, root, ol=0.003)
    _lathe(cz, name + '_collar', [(0, 0.068), (0.04, 0.068), (0.042, 0.074), (0.04, 0.084), (0, 0.084)], brass, root, ol=0.003)
    # filler cap (back right) + wick knob (front)
    cz.cyl(name + '_filler', 0.012, 0.014, (0.045, 0.035, 0.064), brass, verts=14, bevel=0.002, ol=0.002, parent=root)
    cz.cyl(name + '_wickstem', 0.004, 0.04, (0, -0.03, 0.08), brass, rot=(90, 0, 0), verts=10, ol=0.0015, parent=root)
    cz.cyl(name + '_wickknob', 0.012, 0.007, (0, -0.07, 0.08), brass, rot=(90, 0, 0), verts=16, bevel=0.0015, ol=0.002, parent=root)
    # burner cone + slotted dome inside the globe
    _lathe(cz, name + '_burner', [(0, 0.083), (0.03, 0.083), (0.026, 0.095), (0.014, 0.106), (0.008, 0.108), (0, 0.108)], brass, root, ol=0.002)
    cz.cyl(name + '_wick', 0.0045, 0.006, (0, 0, 0.107), cz.toon(name + '_wickm', '#2a2420'), verts=8, ol=0.0, parent=root)
    # glass globe (bulging), on the collar, under the cap
    gl = _glassmat(cz, name + '_glassm' + ('_lit' if lit else ''), color if lit else '#c9dde3',
                   alpha=0.16 if lit else 0.08, edge=0.6, strength=1.6 if lit else 0.7)
    g = _lathe(cz, name + '_glass', [(0, 0.084), (0.04, 0.084), (0.056, 0.11), (0.064, 0.145), (0.058, 0.185), (0.042, 0.212), (0, 0.212)],
               gl, root, ol=0.003)
    g.visible_shadow = False
    # top cap: red vented dome + chimney + brass ring
    _lathe(cz, name + '_cap', [(0, 0.206), (0.07, 0.206), (0.074, 0.212), (0.07, 0.222), (0.05, 0.238), (0.03, 0.247), (0, 0.247)],
           red, root, ol=0.005)
    _lathe(cz, name + '_chimney', [(0, 0.244), (0.02, 0.244), (0.02, 0.262), (0.028, 0.266), (0.022, 0.274), (0, 0.274)], tin, root, ol=0.003)
    for i in range(8):   # vent holes on the dome
        a = 2 * math.pi * (i + 0.5) / 8
        cz.sphere(f'{name}_vent{i}', 0.006, (0.05 * math.cos(a), 0.05 * math.sin(a), 0.236), tin, ol=0.0, parent=root, segs=10, rings=6)
    # side tubes: from the tank shoulder up and in to the cap (the bail hangs on them)
    for s in (-1, 1):
        pts = [(s * 0.078, 0, 0.04), (s * 0.09, 0, 0.06), (s * 0.094, 0, 0.12), (s * 0.094, 0, 0.18), (s * 0.088, 0, 0.215), (s * 0.072, 0, 0.228)]
        _tube(cz, f'{name}_side{"LR"[s > 0]}', pts, 0.0085, red, root, ol=0.003, sides=12)
        cz.sphere(f'{name}_pivot{"LR"[s > 0]}', 0.011, (s * 0.094, 0, 0.19), brass, ol=0.002, parent=root, segs=14, rings=8)
    # wire guards: 6 bowed vertical wires + 2 rings around the globe
    for i in range(6):
        a = 2 * math.pi * (i + 0.5) / 6
        c, s_ = math.cos(a), math.sin(a)
        pts = [((0.05) * c, 0.05 * s_, 0.078), (0.066 * c, 0.066 * s_, 0.1), (0.075 * c, 0.075 * s_, 0.145), (0.068 * c, 0.068 * s_, 0.19), (0.058 * c, 0.058 * s_, 0.21)]
        _tube(cz, f'{name}_guard{i}', pts, 0.0028, tin, root, ol=0.0015, sides=6)
    for k, (z, r) in enumerate(((0.118, 0.071), (0.172, 0.0725))):
        pts = [(r * math.cos(2 * math.pi * j / 36), r * math.sin(2 * math.pi * j / 36), z) for j in range(36)]
        _tube(cz, f'{name}_ring{k}', pts, 0.003, tin, root, ol=0.0015, sides=6, closed=True)
    # bail: wire from the side tubes over the top, wooden grip roll at the top
    pts = [(-0.094, 0, 0.19), (-0.1, 0, 0.215)] + _arc((0, 0, 0.222), 0.1, 180, 0, 20)[1:-1] + [(0.1, 0, 0.215), (0.094, 0, 0.19)]
    pts = [(x, y, 0.222 + (z - 0.222) * 1.0) for x, y, z in pts]
    _tube(cz, name + '_bail', pts, 0.0035, tin, root, ol=0.002, sides=8)
    cz.cyl(name + '_grip', 0.011, 0.052, (0, 0, 0.3215), wood, rot=(0, 90, 0), verts=14, bevel=0.003, ol=0.003, parent=root, origin='center')
    if lit:
        fl = cz.empty(name + '_flame', (0, 0, 0.108), parent=root)
        for o in (_teardrop(cz, name + '_flame_out', 0.05, 0.013, cz.glow(name + '_fl0', color, 3.2), fl, curl=0.15, depth=0.7),
                  _teardrop(cz, name + '_flame_in', 0.03, 0.0075, cz.glow(name + '_fl1', '#fff1c0', 4.0), fl, loc=(0, -0.004, 0.002), curl=0.1, depth=0.7)):
            o.visible_shadow = False      # the light sits inside the flame: a shadow-casting flame would black out the room
        # warm halo inside the glass (soft, no shadow) so the globe reads lit from every side
        halo = _glassmat(cz, name + '_halo', color, alpha=0.18, edge=-0.18, strength=2.2)
        h = cz.sphere(name + '_glass_halo', 0.04, (0, 0, 0.138), halo, ol=0.0, parent=root, segs=20, rings=12)
        h.visible_shadow = False
        lt = cz.light(name + '_light', 'POINT', (0, 0, 0.125), color=color, power=power, size=0.02)
        lt.parent = root
    root['grip'] = META['grip']
    return root
