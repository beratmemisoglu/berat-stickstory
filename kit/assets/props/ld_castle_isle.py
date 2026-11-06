# The dream mansion (LOTTERY L10, reference f541-660): a faceted dark-navy rock island rising from the lake with a
# lavender castle on top - a long lit facade (rows of warm windows, a door with a K), two round towers with navy
# cone roofs + a small centre turret, battlements, palm trees both sides, and a zigzag stair of tiny lights down the
# rock face to a little jetty. Seen from ~100 m: big shapes, readable silhouettes. Root at the water, front = -Y.
import math, os, random
import bmesh
from mathutils import Vector, Matrix

META = {'size': (22, 16, 30), 'anchor': 'rock base centre on the water (z 0), front toward -Y', 'animate': [],
        'params': 'seed=1', 'top_z': 13.0}

LAB = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX = os.path.join(LAB, 'film', 'lottery', 'tex')


def _obj(cz, name, bm, mat, parent, ol=0.0, smooth=False):
    import bpy
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.polygons.foreach_set('use_smooth', [smooth] * len(me.polygons))
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me); cz.place(o, (0, 0, 0), parent=parent, outline_t=ol)
    return o


def _rock(cz, name, mat, parent, seed):
    rnd = random.Random(seed)
    bm = bmesh.new(); seg = 11
    rings = [(0.0, 9.2), (3.5, 8.8), (7.5, 8.1), (11.0, 7.2), (13.0, 7.0)]
    R = []
    for j, (z, r) in enumerate(rings):
        row = []
        for i in range(seg):
            a = 2 * math.pi * (i + 0.5 * (j % 2)) / seg
            rr = r * rnd.uniform(0.86, 1.08) if j < len(rings) - 1 else r
            zz = z + (rnd.uniform(-0.6, 0.6) if 0 < j < len(rings) - 1 else 0)
            row.append(bm.verts.new((rr * math.sin(a), -rr * math.cos(a) * 0.75, zz)))
        R.append(row)
    for j in range(len(R) - 1):
        for i in range(seg):
            a, b, c, d = R[j][i], R[j][(i + 1) % seg], R[j + 1][(i + 1) % seg], R[j + 1][i]
            bm.faces.new((a, b, c)); bm.faces.new((a, c, d))
    bm.faces.new(R[-1]); bm.faces.new(list(reversed(R[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(cz, name, bm, mat, parent, ol=0.06)


def _palm(cz, name, base, h, lean, mat_t, mat_f, parent, seed):
    rnd = random.Random(seed)
    import bpy
    pts = []
    for k in range(7):
        t = k / 6
        pts.append(Vector((base[0] + lean[0] * t * t, base[1] + lean[1] * t * t, base[2] + h * t)))
    segs = list(zip(pts[:-1], pts[1:]))
    bm = bmesh.new()
    for (a, b) in segs:
        d = b - a; g = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.42, radius2=0.34, depth=d.length)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4(), verts=g['verts'])
    _obj(cz, name + '_trunk', bm, mat_t, parent, ol=0.05)
    top = pts[-1]
    bm = bmesh.new()
    for i in range(8):
        a = 2 * math.pi * i / 8 + rnd.uniform(-0.2, 0.2)
        L = rnd.uniform(3.2, 4.2); droop = rnd.uniform(1.8, 2.8)
        dirv = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-math.sin(a), math.cos(a), 0))
        P = [top + dirv * L * t + Vector((0, 0, 0.9 * math.sin(math.pi * t * 0.7) - droop * t * t)) for t in (0, 0.33, 0.66, 1.0)]
        W = [0.15, 0.75, 0.6, 0.05]
        vs = []
        for p, w in zip(P, W): vs.append((bm.verts.new(p + side * w), bm.verts.new(p - side * w)))
        for (a1, b1), (a2, b2) in zip(vs[:-1], vs[1:]): bm.faces.new((a1, a2, b2, b1))
    _obj(cz, name + '_fronds', bm, mat_f, parent, ol=0.04)


def build(cz, name='ld_castle_isle', seed=1):
    import bpy
    root = cz.empty(name)
    rockm = cz.toon(name + '_rockm', '#2a2c78', tex='grain', tex_scale=0.15, tex_strength=0.1)
    _rock(cz, name + '_rock', rockm, root, seed)
    # lighter facets: a few big flat shards on the rock face (the reference's cel facets)
    shard = cz.toon(name + '_shardm', '#3b3f98', tex='grain', tex_scale=0.15, tex_strength=0.08)
    rnd = random.Random(seed + 4)
    for k in range(7):
        a = rnd.uniform(-1.2, 1.2); z = rnd.uniform(1.5, 11.0)
        r = 8.9 - 0.15 * z
        cz.box(f'{name}_shard{k}', (rnd.uniform(1.8, 3.2), 0.3, rnd.uniform(2.0, 4.0)), (r * math.sin(a) * 0.98, -r * math.cos(a) * 0.73, z), shard,
               rot=(rnd.uniform(-8, 8), rnd.uniform(-15, 15), math.degrees(a)), bevel=0.0, ol=0.0, parent=root)
    T = META['top_z']
    stone = cz.toon(name + '_stone', '#8f97dc', tex='grain', tex_scale=0.3, tex_strength=0.06)
    stone2 = cz.toon(name + '_stone2', '#7a82c8', tex='grain', tex_scale=0.3, tex_strength=0.06)
    roof = cz.toon(name + '_roof', '#26307a', tex='grain', tex_scale=0.3, tex_strength=0.06)
    # main facade (front face carries the lit window picture)
    cz.box(name + '_hall', (11.0, 5.5, 7.2), (0, 0.6, T + 3.6), stone, bevel=0.08, ol=0.05, parent=root)
    face = cz.toon(name + '_facem', img=os.path.join(TEX, 'ld_castle_face.png'), lift=0.8, emit=0.35)
    cz.plane(name + '_face', 10.4, 6.5, (0, 0.6 - 2.77, T + 3.45), face, rot=(90, 0, 0), parent=root)
    # the windows glow (emission picked by the lit yellow of the picture): a soft additive panel in front
    for k in range(10):
        cz.box(f'{name}_merlon{k}', (0.75, 0.7, 0.8), (-4.95 + k * 1.1, 0.6 - 2.4, T + 7.6), stone, bevel=0.05, ol=0.03, parent=root)
    cz.box(name + '_upper', (6.0, 4.0, 2.6), (0, 1.2, T + 8.5), stone2, bevel=0.06, ol=0.04, parent=root)
    for k in range(4):
        cz.box(f'{name}_upwin{k}', (0.7, 0.05, 1.0), (-2.1 + k * 1.4, 1.2 - 2.03, T + 8.4), cz.glow(name + '_winglow', '#ffd770', 2.2), bevel=0.0, ol=0.0, parent=root)
    # towers with cone roofs
    for sx in (1, -1):
        cz.cyl(f'{name}_tower{sx}', 1.9, 11.0, (sx * 6.2, 0.2, T), stone, verts=20, bevel=0.0, ol=0.05, parent=root)
        cz.cyl(f'{name}_towerband{sx}', 2.15, 0.7, (sx * 6.2, 0.2, T + 10.6), stone2, verts=20, ol=0.04, parent=root)
        cz.cyl(f'{name}_cone{sx}', 2.4, 5.2, (sx * 6.2, 0.2, T + 11.3), roof, r2=0.05, verts=20, ol=0.05, parent=root)
        cz.cyl(f'{name}_spire{sx}', 0.08, 1.4, (sx * 6.2, 0.2, T + 16.4), roof, verts=8, ol=0.02, parent=root)
        for k in range(3):
            cz.box(f'{name}_twin{sx}{k}', (0.6, 0.05, 1.1), (sx * 6.2, 0.2 - 1.93, T + 2.4 + k * 2.9), cz.glow(name + '_winglow', '#ffd770', 2.2), bevel=0.0, ol=0.0, parent=root)
    cz.cyl(name + '_turret', 1.1, 4.0, (0, 2.0, T + 9.5), stone, verts=16, ol=0.04, parent=root)
    cz.cyl(name + '_turretcone', 1.45, 3.4, (0, 2.0, T + 13.5), roof, r2=0.05, verts=16, ol=0.04, parent=root)
    # a crenellated curtain wall round the front of the top with warm lamps, more lit tower windows, a flag
    win = cz.glow(name + '_winglow', '#ffd770', 2.2)
    wallm = cz.toon(name + '_wallm', '#7d86cc', tex='grain', tex_scale=0.3, tex_strength=0.06)
    for k in range(9):
        a = math.radians(-60 + 15 * k); r = 6.6
        x, y = r * math.sin(a), -r * math.cos(a) * 0.75
        cz.box(f'{name}_cwall{k}', (2.4, 0.6, 1.6), (x, y, T + 0.8), wallm, rot=(0, 0, math.degrees(math.atan2(x, -y * 1.33))), bevel=0.04, ol=0.03, parent=root)
        cz.box(f'{name}_cmerl{k}', (0.6, 0.62, 0.5), (x, y, T + 1.85), wallm, rot=(0, 0, math.degrees(math.atan2(x, -y * 1.33))), bevel=0.03, ol=0.02, parent=root)
        if k % 2 == 0:
            cz.sphere(f'{name}_lamp{k}', 0.28, (x * 1.02, y * 1.02 - 0.3, T + 2.4), cz.glow(name + '_lampm', '#ffe0a0', 3.0), ol=0, parent=root, segs=10, rings=6)
    for sx in (1, -1):
        for k in range(3):
            cz.box(f'{name}_twin2{sx}{k}', (0.5, 0.05, 0.8), (sx * 6.2 + sx * 1.0, 0.2 - 1.66, T + 3.8 + k * 2.6), win, rot=(0, 0, sx * -30), bevel=0.0, ol=0.0, parent=root)
    cz.cyl(name + '_flagpole', 0.06, 2.6, (0, 2.0, T + 16.9), cz.toon(name + '_polem', '#c8c8e0'), ol=0.02, verts=8, parent=root)
    cz.box(name + '_flag', (1.6, 0.05, 0.9), (0.8, 2.0, T + 19.0), cz.toon(name + '_flagm', '#e8404a'), bevel=0.0, ol=0.03, parent=root)
    # palms on the rim
    trunk = cz.toon(name + '_trunkm', '#3a2a66', tex='grain', tex_scale=0.5)
    frond = cz.toon(name + '_frondm', '#1f4a6e', tex='grain', tex_scale=0.5)
    for k, (x, y, h, lx, ly) in enumerate(((-8.8, -1.5, 6.5, -1.5, -0.5), (-7.6, 2.5, 8.0, -1.0, 0.5), (8.6, -1.8, 7.0, 1.6, -0.5), (7.8, 2.6, 8.5, 0.8, 0.4))):
        _palm(cz, f'{name}_palm{k}', (x, y, T - 0.2), h, (lx, ly), trunk, frond, root, k)
    # zigzag stair lights down the front of the rock + a little jetty
    lamp = cz.glow(name + '_stairm', '#ffe8f6', 4.0)
    zig = [(-0.2, -5.4, T), (1.8, -6.4, 9.6), (-1.0, -7.2, 6.2), (1.2, -7.7, 3.0), (0.0, -8.6, 0.4)]
    pts = []
    for a, b in zip(zig[:-1], zig[1:]):
        for k in range(6): pts.append(Vector(a).lerp(Vector(b), k / 6))
    pts.append(Vector(zig[-1]))
    bm = bmesh.new()
    for p in pts:
        g = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=0.22); bmesh.ops.translate(bm, vec=p, verts=g['verts'])
    _obj(cz, name + '_stairlights', bm, lamp, root, smooth=True)
    path = cz.toon(name + '_pathm', '#c9b8ff')
    bm = bmesh.new()
    for a, b in zip(zig[:-1], zig[1:]):
        a, b = Vector(a), Vector(b); d = b - a
        g = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.09, radius2=0.09, depth=d.length)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4(), verts=g['verts'])
    _obj(cz, name + '_stairline', bm, path, root, smooth=True)
    cz.box(name + '_jetty', (3.0, 4.0, 0.3), (0.0, -10.0, 0.25), cz.toon(name + '_jettym', '#5a3a6a', tex='wood'), bevel=0.05, ol=0.04, parent=root)
    return root
