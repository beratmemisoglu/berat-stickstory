# BELL film: a brass chamberstick: a dished saucer with a rolled rim, a turned socket column with a drip cup, a finger
# loop with a thumb rest on the right (+X), an ivory wax candle (melted top, drips down the side, a pool on the cup), a
# curled wick and a cartoon flame (two glowing teardrops + a blue base + a soft halo, blooms) with a warm POINT light
# <name>_light at the flame (soft shadow). Root = bottom centre (stands on a table). Hand-held by the finger loop.
# META 'flame' / 'grip' are local points for the default height; the root also carries them as custom props
# root['flame'], root['grip'] (exact for any height).
import math, bmesh
from mathutils import Vector

META = {'size': (0.22, 0.18, 0.306), 'anchor': 'bottom centre (stands on a table), front -Y, finger loop +X',
        'grip': (0.1, 0.0, 0.029), 'flame': (0.0, 0.0, 0.264),
        'animate': ['_flame (scale flicker, pivot at the wick top)', '_light (energy flicker)'],
        'params': "lit=True, power=25 (W), height=0.18 (candle length; flame = (0, 0, 0.084 + height)), color='#ffb35a'"}


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


def _softmat(cz, name, color, alpha=0.3, strength=2.0):
    """Soft additive-looking glow: emission, opaque in the middle, fading to nothing at the silhouette (blended)."""
    import bpy
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = cz.col(color); em.inputs['Strength'].default_value = strength
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
    k = cz.mth(N, L, 'MULTIPLY', cz.mth(N, L, 'POWER', cz.mth(N, L, 'SUBTRACT', 1.0, lw.outputs['Facing']), 2.0), alpha)
    mx = N.new('ShaderNodeMixShader'); L.new(k, mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    return m


def build(cz, name='gb_candle', lit=True, power=25.0, height=0.18, color='#ffb35a'):
    root = cz.empty(name)
    brass = cz.toon(name + '_brass', '#94691f', tex='grain', tex_scale=5.0, tex_strength=0.07)
    wax = cz.toon(name + '_wax' + ('_lit' if lit else ''), '#cdb27a', tex='grain', tex_scale=4.0, tex_strength=0.05, emit=0.32 if lit else 0.0)
    _lathe(cz, name + '_base', [(0, 0), (0.068, 0), (0.08, 0.004), (0.086, 0.013), (0.085, 0.02), (0.078, 0.018), (0.07, 0.01),
                                 (0.036, 0.008), (0.027, 0.014), (0.025, 0.022), (0.032, 0.028), (0.032, 0.034), (0.023, 0.039),
                                 (0.021, 0.056), (0.026, 0.062), (0.037, 0.066), (0.038, 0.073), (0.031, 0.074), (0.027, 0.069), (0, 0.069)],
           brass, root, segs=40, ol=0.004)
    # finger loop + thumb rest on the right
    loop = [(0.079, 0, 0.011)] + [(0.1 + 0.021 * math.cos(math.radians(a)), 0, 0.029 + 0.021 * math.sin(math.radians(a))) for a in range(235, 566, 15)]
    _tube(cz, name + '_loop', loop, 0.0065, brass, root, ol=0.003, sides=12)
    cz.cyl(name + '_thumb', 0.013, 0.005, (0.1, 0, 0.0505), brass, verts=18, bevel=0.0015, ol=0.002, parent=root)
    # candle with a melted top
    z0 = 0.066; top = z0 + height; R = 0.0205
    _lathe(cz, name + '_candle', [(0, z0), (R, z0), (R, top - 0.008), (R - 0.0015, top - 0.001), (R - 0.006, top), (R - 0.01, top - 0.004),
                                   (0.006, top - 0.006), (0, top - 0.006)], wax, root, segs=28, ol=0.004)
    # drips: beads running down the side (one reaches the cup and pools)
    for i, (a, L) in enumerate(((-70, 0.022), (-112, 0.048), (-25, 0.014), (35, 0.03), (150, 0.02), (-150, 0.065))):
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        pts = []
        for k in range(6):   # a thin start on the rim, thickening, a slight wander, a fat bead at the end
            t = k / 5; rr = R + 0.0004 + 0.0012 * t
            aa = math.radians(a + 6 * math.sin(t * 3 + i))
            pts.append((rr * math.cos(aa), rr * math.sin(aa), top - 0.002 - L * t))
        _tube(cz, f'{name}_drip{i}', pts, 0.0026, wax, root, ol=0.0, sides=8, r_end=0.0048)
        ex, ey, ez = pts[-1]
        bd = cz.sphere(f'{name}_dripbead{i}', 0.0047, (ex * 1.03, ey * 1.03, ez + 0.002), wax, ol=0.0, parent=root, segs=12, rings=8)
        for v in bd.data.vertices: v.co.z *= 1.5          # a teardrop bead, not a pearl (ISSUES 49)
        bd.data.update()
    for i, a in enumerate((-90, 10, 120, -160)):   # lumpy melted rim
        aa = math.radians(a)
        cz.sphere(f'{name}_rimlump{i}', 0.0045, ((R - 0.002) * math.cos(aa), (R - 0.002) * math.sin(aa), top - 0.002), wax, ol=0.0,
                  parent=root, segs=12, rings=8)
    pool = _lathe(cz, name + '_pool', [(0, 0.071), (0.03, 0.071), (0.032, 0.0735), (0.026, 0.076), (0, 0.0765)], wax, root, segs=24, ol=0.002)
    cz.sphere(name + '_poolbead', 0.006, (0.031 * math.cos(math.radians(-150)), 0.031 * math.sin(math.radians(-150)), 0.068), wax, ol=0.0015,
              parent=root, segs=12, rings=8)
    # wick
    _tube(cz, name + '_wick', [(0, 0, top - 0.007), (0, 0, top + 0.004), (0.0015, 0, top + 0.009), (0.003, 0, top + 0.011)], 0.0014,
          cz.toon(name + '_wickm', '#231d1a'), root, ol=0.0, sides=6)
    fz = top + 0.02
    root['flame'] = (0.0, 0.0, fz); root['grip'] = (0.1, 0.0, 0.029)
    if lit:
        fl = cz.empty(name + '_flame', (0, 0, top + 0.004), parent=root)
        parts = [_teardrop(cz, name + '_flame_out', 0.056, 0.0135, cz.glow(name + '_fl0', color, 3.2), fl, curl=0.12, depth=0.75),
                 _teardrop(cz, name + '_flame_in', 0.032, 0.0075, cz.glow(name + '_fl1', '#fff3c6', 4.0), fl, loc=(0, -0.003, 0.002), curl=0.08, depth=0.75),
                 cz.sphere(name + '_flame_blue', 0.0032, (0, -0.0035, 0.003), cz.glow(name + '_fl2', '#5a74e8', 2.0), ol=0.0, parent=fl, segs=12, rings=8),
                 cz.sphere(name + '_halo', 0.034, (0, 0, 0.02), _softmat(cz, name + '_halom', color, 0.35, 2.2), ol=0.0, parent=fl, segs=20, rings=12)]
        for o in parts: o.visible_shadow = False     # the light sits inside the flame
        # the light is 2 cm above the wax: a shadow-casting candle would put its own saucer + the table round it in the dark
        for o in root.children_recursive:
            if o.type == 'MESH' and o.name[len(name):].startswith(('_candle', '_drip', '_rimlump', '_pool', '_wick')): o.visible_shadow = False
        lt = cz.light(name + '_light', 'POINT', (0, 0, fz), color=color, power=power, size=0.015)
        lt.parent = root
    return root
