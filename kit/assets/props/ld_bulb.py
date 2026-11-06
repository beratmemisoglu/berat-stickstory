# Bare light bulb on a long black cord (Kyle's bedroom): the cord from the ceiling (z = +1.6 above the bulb) down to a
# dark socket cap with ridges, a soft pear-shaped warm glowing bulb (cz-style glow mixed with a little transparency so
# the bright zig-zag filament inside shows), blooms in post. The scene adds the real point light at META['light'].
# Root at the BULB CENTRE (place it at the bulb's height); pivot <name>_swing at the cord top (rotation x / y swings
# the whole bulb about the ceiling point).
import bpy, bmesh, math
from mathutils import Vector

CORD = 1.6
META = {'size': (0.1, 0.1, CORD + 0.06), 'anchor': 'bulb centre (cord top at local z = +1.6 = the ceiling)',
        'animate': ['_swing (pivot at the cord top: rotation_euler.x / .y)'], 'light': (0.0, 0.0, 0.0), 'cord_top': (0.0, 0.0, CORD),
        'glow': '<name>_glowm (Emission strength node "bulb_emit")', 'params': "color='#ffd9a0', strength=6.0, on=True, cord=1.6 (m, bulb centre to ceiling)"}


def _obj(cz, name, bm, mats, parent, loc=(0, 0, 0), ol=0.0, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    for m in mats: me.materials.append(m)
    return cz.place(bpy.data.objects.new(name, me), loc, (0, 0, 0), None, parent, ol)


def lathe(cz, name, prof, mat, parent, loc=(0, 0, 0), segs=32, ol=0.0):
    bm = bmesh.new(); rings = []
    for r, z in prof:
        if r < 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((r * math.cos(2 * math.pi * j / segs), r * math.sin(2 * math.pi * j / segs), z)) for j in range(segs)])
    for a in range(len(rings) - 1):
        A, B = rings[a], rings[a + 1]
        for j in range(segs):
            j2 = (j + 1) % segs
            if len(A) == 1: bm.faces.new((A[0], B[j2], B[j]))
            elif len(B) == 1: bm.faces.new((A[j], A[j2], B[0]))
            else: bm.faces.new((A[j], A[j2], B[j2], B[j]))
    return _obj(cz, name, bm, [mat], parent, loc, ol)


def tube(cz, name, pts, r, mat, parent, sides=8):
    bm = bmesh.new(); rings = []; P = [Vector(p) for p in pts]
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        a = t.cross(Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))).normalized(); b = t.cross(a)
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * r) for k in range(sides)])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(sides): bm.faces.new((A[k], A[(k + 1) % sides], B[(k + 1) % sides], B[k]))
    bm.faces.new(rings[0]); bm.faces.new(rings[-1]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(cz, name, bm, [mat], parent)


def bulb_mat(cz, name, color, strength, alpha=0.82):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; N, L = m.node_tree.nodes, m.node_tree.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.name = 'bulb_emit'; em.inputs['Color'].default_value = cz.col(color); em.inputs['Strength'].default_value = strength
    mx = N.new('ShaderNodeMixShader'); mx.inputs[0].default_value = alpha
    L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    return m


def build(cz, name='ld_bulb', color='#ffd9a0', strength=6.0, on=True, cord=CORD):
    CORD_ = float(cord)
    root = cz.empty(name)
    sw = cz.empty(name + '_swing', (0, 0, CORD_), parent=root)
    off = cz.empty(name + '_hang', (0, 0, -CORD_), parent=sw)          # everything below hangs from the swing pivot
    st = float(strength) if on else 0.0
    gm = bulb_mat(cz, name + '_glowm', color if on else '#d8d2c4', st if on else 0.0, 0.92 if on else 0.45)
    # pear: a sphere r 0.042 at the bottom easing into a neck r 0.017 at z 0.07
    prof = [(0.0, -0.042)]
    for i in range(1, 13):
        a = -math.pi / 2 + math.pi * 0.62 * i / 12; prof.append((0.042 * math.cos(a), 0.042 * math.sin(a)))
    prof += [(0.03, 0.045), (0.021, 0.06), (0.0175, 0.072)]
    bulb = lathe(cz, name + '_glass', prof + [(0.0, 0.072)], gm, off, ol=0.003)
    bulb.visible_shadow = False
    # filament: a bright zig-zag between two support wires
    fm = cz.glow(name + '_filament', '#fff6d8', 14.0 if on else 0.0) if on else cz.toon(name + '_filament_off', '#5a4a3a')
    zig = [(-0.014 + 0.028 * k / 6, 0, 0.004 + (0.006 if k % 2 else -0.006)) for k in range(7)]
    tube(cz, name + '_fil', zig, 0.0016, fm, off)
    wire = cz.toon(name + '_support', '#6a5a4a')
    for s in (-1, 1):
        tube(cz, f'{name}_sup{s + 1}', [(s * 0.014, 0, 0.004), (s * 0.006, 0, 0.07)], 0.0011, wire, off)
    # socket cap with two ridges, cord up to the ceiling, a small ceiling rose
    dark = cz.toon(name + '_socket', '#2a2626', tex='grain', tex_strength=0.04)
    cz.cyl(name + '_cap', 0.021, 0.05, (0, 0, 0.066), dark, verts=24, bevel=0.003, ol=0.004, parent=off)
    for k, z in enumerate((0.078, 0.096)):
        cz.cyl(f'{name}_ridge{k}', 0.0235, 0.006, (0, 0, z), dark, verts=24, ol=0.0, parent=off)
    cz.cyl(name + '_capTop', 0.014, 0.014, (0, 0, 0.116), dark, r2=0.008, verts=16, ol=0.003, parent=off)
    cz.cyl(name + '_cord', 0.0045, CORD_ - 0.13 - 0.012, (0, 0, 0.13), cz.toon(name + '_cordm', '#1c1a1a'), verts=10, ol=0.0, parent=off)
    cz.cyl(name + '_rose', 0.035, 0.012, (0, 0, CORD_ - 0.012), dark, verts=24, bevel=0.003, ol=0.003, parent=off)
    return root
