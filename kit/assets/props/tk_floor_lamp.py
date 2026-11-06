# TICKETS: a tall living-room floor lamp. Weighted dark-iron base with a brass ring (one turned shape), a brass pole
# with two knuckles, a brass socket + harp + finial, a big tapered drum shade of warm linen (tex/tk_floor_lamp_shade.png:
# brighter band at bulb height, stitched hems, back seam, a scorch mark near the top) between dark red velvet trims,
# glowing from inside when on (the shade's inside is a warm glow, its outside fabric emits a little), a bulb, a bead
# pull chain hanging below the shade with a brass pull, and a power cord running off across the floor (+Y).
# on=True: lit look. light=True: adds a warm POINT light `<name>_light` at the bulb (power kw, default 110 W, colour
# #ffb870, soft size 0.15, shadows on): the shade blocks it sideways, so it throws a pool on the floor round the base
# and a ring up the wall / ceiling (motivated light shapes); the scene may move / re-power it, or set
# `<name>_shade.visible_shadow = False` for an all-round glow. The bulb never casts a shadow.
# Floor prop: root at the floor centre (the base), front -Y.
#   textures: .venv/Scripts/python.exe assets/props/tex/make_tk_floor_lamp.py
import math, os, bmesh

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
SZ0, SZ1, SR0, SR1 = 1.26, 1.58, 0.25, 0.215      # shade bottom / top height, bottom / top radius
BULB_Z = 1.42

META = {'size': (0.5, 0.5, 1.61), 'anchor': 'floor centre (base), front -Y',
        'light': '<name>_light POINT at (0, 0, 1.42) local, power kw (110 W), #ffb870, shadow_soft_size 0.15',
        'shade': 'z 1.26 - 1.58, r 0.25 -> 0.215', 'animate': [],
        'params': 'on=True (glowing shade + bulb), light=True (adds the point light; only when on), power=110 (W)'}


def _lathe(cz, name, prof, mats, parent, segs=48, ol=0.005, caps=True, closed=False, uv=False, smooth=True):
    """Surface of revolution from (r, z) pairs (angle 0 at -X, the front -Y at u = 0.25). closed=True: the profile is
    a loop (a ring). caps: close the ends of an open profile (r > 0 ends)."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap') if uv else None
    rings = []
    for r, z in prof:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs - math.pi), r * math.sin(2 * math.pi * i / segs - math.pi), z)) for i in range(segs)])
    pairs = list(zip(range(len(rings)), range(1, len(rings))))
    if closed: pairs.append((len(rings) - 1, 0))
    zs = [z for _, z in prof]; z0, z1 = min(zs), max(zs)
    for a, b in pairs:
        ra, rb = rings[a], rings[b]
        for i in range(segs):
            f = bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
            if uv:
                va, vb = (prof[a][1] - z0) / (z1 - z0), (prof[b][1] - z0) / (z1 - z0)
                for lp, (u, v) in zip(f.loops, ((i / segs, va), ((i + 1) / segs, va), ((i + 1) / segs, vb), (i / segs, vb))):
                    lp[uvl].uv = (u, v)
    if caps and not closed:
        if prof[0][0] > 1e-6: bm.faces.new(rings[0][::-1])
        if prof[-1][0] > 1e-6: bm.faces.new(rings[-1])
    if not uv: bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, None, smooth=smooth)
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]): o.data.materials.append(m)
    return cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)


def _rod(cz, nm, a, b, r, mat, parent, ol=0.002):
    from mathutils import Vector
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.cyl(nm, r, d.length, tuple(a), mat, verts=10, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def build(cz, name='tk_floor_lamp', on=True, light=True, power=110):
    root = cz.empty(name)
    iron = cz.toon(name + '_iron', '#2f2925', tex='grain', tex_strength=0.06)
    brass = cz.toon(name + '_brass', '#b8862c', lift=0.55, tex='grain', tex_strength=0.05)
    trim = cz.toon(name + '_trim', '#6b2219', tex='grain', tex_scale=3, tex_strength=0.08)
    cord = cz.toon(name + '_cord', '#2a2622')
    # ---- weighted base: one turned shape (iron) + a brass ring band on its edge
    base = [(0.0, 0.0), (0.183, 0.0), (0.19, 0.007), (0.19, 0.028), (0.176, 0.04), (0.125, 0.054), (0.07, 0.068),
            (0.038, 0.082), (0.03, 0.098), (0.0, 0.098)]
    _lathe(cz, name + '_base', base, iron, root, segs=56, ol=0.006)
    _lathe(cz, name + '_basering', [(0.186, 0.01), (0.195, 0.01), (0.195, 0.024), (0.186, 0.024)], brass, root, segs=56, ol=0.003, closed=True)
    # ---- pole + knuckles
    cz.cyl(name + '_pole', 0.017, 1.345 - 0.09, (0, 0, 0.09), brass, verts=24, ol=0.005, parent=root)
    for k, z in enumerate((0.56, 1.02)):
        _lathe(cz, f'{name}_knuckle{k}', [(0.0, z - 0.03), (0.02, z - 0.03), (0.031, z - 0.012), (0.031, z + 0.012), (0.02, z + 0.03), (0.0, z + 0.03)],
               brass, root, segs=28, ol=0.004)
    # ---- socket, bulb, harp, finial
    _lathe(cz, name + '_socket', [(0.0, 1.33), (0.02, 1.33), (0.03, 1.345), (0.03, 1.385), (0.024, 1.392), (0.0, 1.392)], brass, root, segs=32, ol=0.003)
    bulbm = cz.glow(name + '_bulbm', '#fff0c8', 7.0) if on else cz.toon(name + '_bulboff', '#e6e0cf', tex='grain')
    b = _lathe(cz, name + '_bulb', [(0.0, 1.388), (0.016, 1.39), (0.03, 1.405), (0.048, 1.43), (0.05, 1.45), (0.042, 1.475), (0.024, 1.49), (0.0, 1.494)],
               bulbm, root, segs=32, ol=0.0)
    b.visible_shadow = False
    from mathutils import Vector
    for s in (-1, 1):
        pts = [Vector((s * 0.03, 0, 1.37))]
        for k in range(1, 13):
            t = k / 12
            pts.append(Vector((s * (0.03 + 0.05 * math.sin(math.pi * t * 0.85)), 0, 1.37 + 0.19 * t)))
        _tube(cz, f'{name}_harp{"L" if s < 0 else "R"}', pts, 0.0035, brass, root, ol=0.0, segs=8)
    for k in range(3):
        a = 2 * math.pi * k / 3 + math.pi / 2
        _rod(cz, f'{name}_spider{k}', (0, 0, SZ1 - 0.012), (SR1 * 0.97 * math.cos(a), SR1 * 0.97 * math.sin(a), SZ1 - 0.012), 0.0032, brass, root, ol=0.0)
    cz.cyl(name + '_hub', 0.016, 0.014, (0, 0, SZ1 - 0.019), brass, verts=20, ol=0.002, parent=root)
    cz.sphere(name + '_finial', 0.019, (0, 0, SZ1 + 0.012), brass, ol=0.003, parent=root, segs=20, rings=12)
    # ---- drum shade: outer linen (UV-wrapped print, emits a little when on), a warm glowing inside
    shm = cz.toon(name + ('_shade_on' if on else '_shade_off'), img=os.path.join(TEX, 'tk_floor_lamp_shade.png'),
                  emit=0.42 if on else 0.0, tex='grain', tex_scale=3, tex_strength=0.04, lift=0.6)
    inner = cz.glow(name + '_shadein', '#ffc27a', 1.6) if on else cz.toon(name + '_shadein_off', '#b89668')
    prof = [(SR0 + (SR1 - SR0) * k / 8, SZ0 + (SZ1 - SZ0) * k / 8) for k in range(9)]
    sh = _lathe(cz, name + '_shade', prof, [shm, inner], root, segs=72, ol=0.0, caps=False, uv=True)
    sol = sh.modifiers.new('thick', 'SOLIDIFY'); sol.thickness = 0.008; sol.offset = -1; sol.material_offset = 1; sol.material_offset_rim = 0
    cz.outline(sh, 0.007)
    for k, z in enumerate((SZ0, SZ1 - 0.024)):
        r = SR0 + (SR1 - SR0) * (z - SZ0) / (SZ1 - SZ0)
        r2 = SR0 + (SR1 - SR0) * (z + 0.024 - SZ0) / (SZ1 - SZ0)
        _lathe(cz, f'{name}_trim{k}', [(r - 0.004, z - 0.002), (r + 0.006, z - 0.002), (r2 + 0.006, z + 0.026), (r2 - 0.004, z + 0.026)],
               trim, root, segs=72, ol=0.004, closed=True)
    # ---- bead pull chain from the socket, hanging out below the shade, with a brass pull
    bead = cz.toon(name + '_bead', '#c99a3e', lift=0.5)
    n = 13
    for k in range(n):
        cz.sphere(f'{name}_bead{k}', 0.0062, (0.036, 0.0, 1.352 - k * 0.0128), bead, ol=0.0015, parent=root, segs=12, rings=8)
    zb = 1.352 - n * 0.0128 + 0.004
    _lathe(cz, name + '_pull', [(0.0, zb - 0.042), (0.009, zb - 0.04), (0.014, zb - 0.024), (0.011, zb - 0.006), (0.004, zb), (0.0, zb + 0.002)],
           brass, root, segs=20, ol=0.0025)
    # ---- power cord: out of the back of the base, meandering across the floor toward +Y
    pts = [(0.0, 0.14, 0.03), (0.0, 0.19, 0.016), (0.003, 0.215, 0.0072)]
    for k in range(1, 22):
        t = k / 21
        pts.append((0.003 + 0.07 * math.sin(t * 5.0) * t, 0.215 + 0.62 * t, 0.0072))
    _tube(cz, name + '_cord', pts, 0.0072, cord, root, ol=0.0025, segs=12)
    # ---- the light
    if light and on:
        lt = cz.light(name + '_light', 'POINT', (0, 0, BULB_Z), color='#ffb870', power=power, size=0.15)
        lt.parent = root
    return root


def _tube(cz, nm, pts, r, mat, parent, ol=0.002, segs=10):
    from mathutils import Vector, Matrix
    pts = [Vector(p) for p in pts]
    bm = bmesh.new(); rings = []
    t0 = (pts[1] - pts[0]).normalized(); n = t0.cross(Vector((0, 0, 1)))
    if n.length < 1e-4: n = t0.cross(Vector((1, 0, 0)))
    n.normalize(); prev = t0
    for i, p in enumerate(pts):
        t = t0 if i == 0 else (pts[i] - pts[i - 1]).normalized() if i == len(pts) - 1 else (pts[i + 1] - pts[i - 1]).normalized()
        ax = prev.cross(t)
        if ax.length > 1e-6: n = Matrix.Rotation(prev.angle(t), 3, ax.normalized()) @ n
        prev = t; b = t.cross(n).normalized()
        rings.append([bm.verts.new(p + (n * math.cos(2 * math.pi * k / segs) + b * math.sin(2 * math.pi * k / segs)) * r) for k in range(segs)])
    for ra, rb in zip(rings, rings[1:]):
        for k in range(segs): bm.faces.new((ra[k], ra[(k + 1) % segs], rb[(k + 1) % segs], rb[k]))
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(nm, bm, mat, smooth=True), (0, 0, 0), (0, 0, 0), None, parent, ol, 0.0)
