# Blue plastic bucket (Kyle's bedroom floor): real walls (outer taper r 0.13 -> 0.16, a rolled rim, inner wall), water
# inside (a darker blue disc with a light highlight oval, the reference's white oval seen from above), a thin metal wire
# handle on two ears (pivot <name>_handle at the ear axis: rotation_euler.x tips it forward / back).
# Floor prop: root at the floor centre, front -Y.
import bpy, bmesh, math
from mathutils import Vector

RB, RT, H = 0.13, 0.16, 0.28
ZW = 0.17
META = {'size': (0.36, 0.34, 0.44), 'anchor': 'floor centre; rim z = 0.28, water z = 0.17', 'animate': ['_handle (rotation_euler.x)'],
        'water': '<name>_water', 'params': "color='#2a6fd6', water=True, handle_tilt=-25 (deg)"}


def _obj(cz, name, bm, mats, parent, loc=(0, 0, 0), ol=0.0, smooth=True, sharp=None):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    if sharp:
        try: me.set_sharp_from_angle(angle=math.radians(sharp))
        except Exception: pass
    for m in mats: me.materials.append(m)
    return cz.place(bpy.data.objects.new(name, me), loc, (0, 0, 0), None, parent, ol)


def lathe(cz, name, prof, mat, parent, loc=(0, 0, 0), segs=48, ol=0.0, closed=False, sharp=None):
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


def tube(cz, name, pts, r, mat, parent, loc=(0, 0, 0), sides=10, ol=0.0):
    """A round wire along the polyline pts (closed ends)."""
    bm = bmesh.new(); rings = []
    P = [Vector(p) for p in pts]
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        a = t.cross(Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))).normalized(); b = t.cross(a)
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * r) for k in range(sides)])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(sides): bm.faces.new((A[k], A[(k + 1) % sides], B[(k + 1) % sides], B[k]))
    bm.faces.new(rings[0]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(cz, name, bm, [mat], parent, loc, ol)


def build(cz, name='ld_bucket', color='#2563c8', water=True, handle_tilt=-25):
    root = cz.empty(name)
    blue = cz.toon(name + '_plastic', color, tex='grain', tex_strength=0.05)
    inner = cz.toon(name + '_inside', '#1d4c9e', tex='grain', tex_strength=0.05)
    # outer wall + rolled rim + inner wall (one solid of revolution)
    rim = [(RT + 0.012 * math.cos(math.radians(a)), H - 0.008 + 0.012 * math.sin(math.radians(a))) for a in range(-80, 181, 20)]
    prof = [(0.0, 0.0), (RB - 0.006, 0.0), (RB, 0.006)] + [(RB + (RT - RB) * k / 6, 0.006 + (H - 0.03) * k / 6) for k in range(1, 7)] + rim
    prof += [(RT - 0.014, H - 0.02), (RB - 0.01, 0.022), (0.0, 0.022)]
    lathe(cz, name + '_shell', prof, blue, root, segs=56, ol=0.008, sharp=50)
    # a darker inner wall card (so the inside reads deeper): a thin cone just inside the wall
    ri = lambda z: (RB - 0.01) + (RT - 0.014 - (RB - 0.01)) * (z - 0.022) / (H - 0.02 - 0.022)
    lathe(cz, name + '_innerwall', [(ri(z) - 0.0015, z) for z in (H - 0.03, 0.03)], inner, root, segs=56)
    if water:
        wm = cz.toon(name + '_waterm', '#173f8c', emit=0.15)
        lathe(cz, name + '_water', [(0.0, ZW), (ri(ZW) - 0.002, ZW)], wm, root, segs=56)
        # highlight oval (seen from above): a light ring slightly flattened, 1.3 mm over the water
        hm = cz.toon(name + '_shine', '#cfe4ff', emit=0.4)
        bm = bmesh.new(); seg = 40; a0, b0 = 0.07, 0.045; w = 0.009
        outer = [bm.verts.new(((a0 + w) * math.cos(2 * math.pi * k / seg), (b0 + w) * math.sin(2 * math.pi * k / seg), 0)) for k in range(seg)]
        inn = [bm.verts.new((a0 * math.cos(2 * math.pi * k / seg), b0 * math.sin(2 * math.pi * k / seg), 0)) for k in range(seg)]
        for k in range(seg): bm.faces.new((inn[k], inn[(k + 1) % seg], outer[(k + 1) % seg], outer[k]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces:
            if f.normal.z < 0: f.normal_flip()
        _obj(cz, name + '_shinering', bm, [hm], root, (0.01, -0.01, ZW + 0.0013), smooth=False)
    # ears + wire handle
    metal = cz.toon(name + '_wire', '#9aa0aa')
    ez = H - 0.05
    for s in (-1, 1):
        x = s * (RB + (RT - RB) * (ez - 0.006) / (H - 0.03) + 0.004)
        cz.box(f'{name}_ear{s + 1}', (0.016, 0.03, 0.035), (x, 0, ez), blue, bevel=0.004, ol=0.004, parent=root)
    hp = cz.empty(name + '_handle', (0, 0, ez), parent=root); hp.rotation_euler = (math.radians(float(handle_tilt)), 0, 0)
    xr = RT + 0.012
    pts = [(-xr, 0, 0)] + [(-xr * math.cos(math.radians(a)), 0, 0.17 * math.sin(math.radians(a)) + 0.0) for a in range(10, 171, 10)] + [(xr, 0, 0)]
    tube(cz, name + '_wirem', pts, 0.0035, metal, hp, ol=0.0025)
    cz.cyl(name + '_grip', 0.011, 0.11, (-0.055, 0, 0.17), cz.toon(name + '_gripm', '#2a2622'), rot=(0, 90, 0), verts=14, ol=0.003, parent=hp)
    return root
