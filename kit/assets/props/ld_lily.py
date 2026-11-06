# A lily pad on the dream lake (LOTTERY L10, reference f523-660), optionally with a pink lotus flower: a flat green
# disc with the notch, a lighter rim and vein lines; the lotus = two rings of pointed pink petals + a yellow heart.
# Root at the water surface (z 0), centre of the pad. No moving parts (the scene bobs the whole pad).
import math
import bmesh

META = {'size': (0.9, 0.9, 0.35), 'anchor': 'pad centre on the water surface', 'animate': [],
        'params': 'r=0.45 pad radius, flower=False, notch=0 (degrees, notch direction), seed'}


def _obj(cz, name, bm, mat, parent, ol=0.0, smooth=False, loc=(0, 0, 0), rot=(0, 0, 0)):
    import bpy
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.polygons.foreach_set('use_smooth', [smooth] * len(me.polygons))
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me); cz.place(o, loc, rot, parent=parent, outline_t=ol)
    return o


def _pad(bm, r, z, notch, gap=0.5, seg=28):
    c = bm.verts.new((0, 0, z)); ring = []
    for i in range(seg + 1):
        a = notch + gap / 2 + (2 * math.pi - gap) * i / seg
        ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
    for a, b in zip(ring[:-1], ring[1:]): bm.faces.new((c, a, b))
    return c, ring


def build(cz, name='ld_lily', r=0.45, flower=False, notch=0.0, seed=0):
    root = cz.empty(name)
    n = math.radians(notch)
    green = cz.toon('ld_lily_green', '#22a874', tex='grain', tex_strength=0.06, emit=0.8)
    rim = cz.toon('ld_lily_rim', '#4fd896', tex='grain', tex_strength=0.05, emit=0.8)
    vein = cz.toon('ld_lily_vein', '#1a6a52')
    bm = bmesh.new(); c, ring = _pad(bm, r, 0.02, n)
    bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    for v in bm.verts:
        if v.co.z > 0.019 and v not in ring and v is not c: pass
    _obj(cz, name + '_pad', bm, green, root, ol=0.004)
    bm = bmesh.new(); _pad(bm, r * 0.97, 0.024, n, gap=0.56)
    o = _obj(cz, name + '_rim', bm, rim, root)
    bm = bmesh.new(); _pad(bm, r * 0.82, 0.026, n, gap=0.66)
    _obj(cz, name + '_mid', bm, green, root)
    for k in range(7):
        a = n + 0.5 + (2 * math.pi - 1.0) * (k + 0.5) / 7
        cz.box(f'{name}_vein{k}', (r * 0.7, 0.014, 0.003), (r * 0.38 * math.cos(a), r * 0.38 * math.sin(a), 0.029), vein,
               rot=(0, 0, math.degrees(a)), bevel=0, ol=0, parent=root)
    if flower:
        pink = cz.toon('ld_lotus_pink', '#f06aa8', tex='grain', tex_strength=0.04, emit=0.3)
        light = cz.toon('ld_lotus_light', '#ffb0d6', tex='grain', tex_strength=0.04, emit=0.3)
        yel = cz.toon('ld_lotus_yel', '#ffcf3a')
        for ring_i, (cnt, L, tilt, mat, zc) in enumerate(((8, 0.2, 30, pink, 0.06), (6, 0.16, 62, light, 0.07))):
            for k in range(cnt):
                a = 2 * math.pi * (k + 0.5 * ring_i) / cnt
                bm = bmesh.new()
                # flat petal along +X (normal up), tip raised by tilt about Y, then turned to its angle about Z
                pts = [(0, 0), (L * 0.4, 0.06), (L * 0.78, 0.04), (L, 0.0), (L * 0.78, -0.04), (L * 0.4, -0.06)]
                vs = [bm.verts.new((x, y, 0.0)) for (x, y) in pts]; bm.faces.new(vs)
                bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.01)
                _obj(cz, f'{name}_petal{ring_i}_{k}', bm, mat, root, ol=0.004,
                     loc=(0.02 * math.cos(a), 0.02 * math.sin(a), zc - 0.03), rot=(0, -tilt, math.degrees(a)))
        cz.sphere(name + '_heart', 0.045, (0, 0, 0.09), yel, ol=0.003, parent=root, segs=12, rings=8)
    return root
