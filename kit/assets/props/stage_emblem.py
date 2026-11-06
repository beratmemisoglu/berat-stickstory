# Giant wall emblem for the law stage: a deep-blue enamel disc in a fat gold rim, a ring of 28 glowing marquee bulbs on
# a gold outer band, and in front of it gold scales of justice (stepped base, post, finial, a balance beam with curled
# tips, two shallow pans on three chains each) framed by two gold laurel sprigs.
# Wall prop: back at y = 0, centred on z = 0 (the disc centre), front faces -Y. tilt (deg) tips the beam (+ = right
# pan down); the pans hang plumb.
import math, bmesh
from mathutils import Matrix, Vector, Euler

META = {'size': (2.6, 0.32, 2.6), 'anchor': 'wall: back at y = 0, disc centre at z = 0', 'animate': [],
        'params': "radius=1.05, tilt=0.0, bulbs=28, enamel='#1f2f66', gold='#d2a23e', bulb='#ffe2a0', bulb_strength=7.0"}


def _lathe_y(cz, name, prof, mat, parent, y0, segs=64, ol=0.006):
    """Surface of revolution about the Y axis (the disc's axis), (r, depth) pairs, depth toward -Y from y0, capped."""
    bm = bmesh.new(); rings = []
    for r, dy in prof:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), y0 - dy, r * math.sin(2 * math.pi * i / segs))) for i in range(segs)])
    for ra, rb in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat), (0, 0, 0), (0, 0, 0), None, parent, ol, 0)


def _leaf(bm, c, ang, L, Wd, T):
    """One laurel leaf (a pointed lens shape with a little thickness) in the XZ plane at c, pointing along ang."""
    ca, sa = math.cos(ang), math.sin(ang)
    n = 6; top, bot = [], []
    for i in range(n + 1):
        t = i / n; x = (t - 0.5) * L; w = Wd * math.sin(math.pi * t) ** 0.8
        for lst, s in ((top, 1), (bot, -1)):
            px, pz = x, s * w
            lst.append((c[0] + px * ca - pz * sa, c[2] + px * sa + pz * ca))
    ring = top + bot[::-1][1:-1]
    f = [bm.verts.new((x, c[1] - T, z)) for x, z in ring]; b = [bm.verts.new((x, c[1], z)) for x, z in ring]
    bm.faces.new(f[::-1]); bm.faces.new(b)
    m = len(ring)
    for i in range(m):
        bm.faces.new((f[i], f[(i + 1) % m], b[(i + 1) % m], b[i]))


def build(cz, name='stage_emblem', radius=1.05, tilt=0.0, bulbs=28, enamel='#1f2f66', gold='#d2a23e', bulb='#ffe2a0',
          bulb_strength=7.0):
    root = cz.empty(name)
    R = radius
    gm = cz.toon('stage_gold', gold, tex='grain', tex_scale=3.0, tex_strength=0.04)
    en = cz.toon(name + '_enamel', enamel, tex='grain', tex_scale=2.0, tex_strength=0.05)
    # disc + rim + outer band
    cz.cyl(name + '_disc', R, 0.06, (0, 0, 0), en, rot=(90, 0, 0), verts=72, ol=0.008, parent=root)
    _lathe_y(cz, name + '_rim', [(R - 0.1, 0.06), (R - 0.07, 0.1), (R + 0.0, 0.115), (R + 0.06, 0.095), (R + 0.08, 0.06),
                                  (R + 0.08, 0.0), (R - 0.1, 0.0)], gm, root, 0.0, ol=0.007)
    _lathe_y(cz, name + '_band', [(R + 0.08, 0.05), (R + 0.24, 0.05), (R + 0.26, 0.03), (R + 0.26, 0.0), (R + 0.08, 0.0)],
             gm, root, 0.0, ol=0.007)
    # marquee bulbs: one mesh of small spheres + one of their gold sockets
    bb, sk = bmesh.new(), bmesh.new()
    for k in range(bulbs):
        a = 2 * math.pi * k / bulbs; rr = R + 0.17
        p = Vector((rr * math.cos(a), -0.08, rr * math.sin(a)))
        bmesh.ops.create_uvsphere(bb, u_segments=14, v_segments=8, radius=0.042, matrix=Matrix.Translation(p + Vector((0, -0.02, 0))))
        bmesh.ops.create_cone(sk, cap_ends=True, segments=14, radius1=0.05, radius2=0.05, depth=0.04,
                              matrix=Matrix.Translation(p + Vector((0, 0.02, 0))) @ Euler((math.radians(90), 0, 0)).to_matrix().to_4x4())
    cz.place(cz._mesh_obj(name + '_bulbs', bb, cz.glow('stage_bulb', bulb, bulb_strength)), (0, 0, 0), (0, 0, 0), None, root, 0.003, 0)
    cz.place(cz._mesh_obj(name + '_sockets', sk, gm), (0, 0, 0), (0, 0, 0), None, root, 0.003, 0)
    # scales of justice
    y = -0.22
    s = R / 1.05
    cz.cyl(name + '_foot0', 0.3 * s, 0.07 * s, (0, y, -0.78 * s), gm, verts=40, ol=0.006, parent=root, bevel=0.01)
    cz.cyl(name + '_foot1', 0.19 * s, 0.07 * s, (0, y, -0.71 * s), gm, verts=40, ol=0.006, parent=root, bevel=0.01)
    cz.cyl(name + '_post', 0.045 * s, 1.18 * s, (0, y, -0.64 * s), gm, verts=24, ol=0.006, parent=root)
    cz.sphere(name + '_knot', 0.075 * s, (0, y, 0.36 * s), gm, ol=0.006, parent=root, segs=24, rings=12)
    cz.sphere(name + '_finial', 0.1 * s, (0, y, 0.62 * s), gm, ol=0.006, parent=root, segs=24, rings=12)
    cz.cyl(name + '_spike', 0.05 * s, 0.14 * s, (0, y, 0.7 * s), gm, verts=16, r2=0.0, ol=0.005, parent=root)
    beam = cz.empty(name + '_beam', (0, y, 0.36 * s), parent=root); beam.rotation_euler = (0, math.radians(tilt), 0)
    cz.box(name + '_beambar', (1.36 * s, 0.07 * s, 0.07 * s), (0, 0, 0), gm, bevel=0.012, ol=0.006, parent=beam)
    for sd in (-1, 1):
        cz.sphere(f'{name}_tip{sd}', 0.055 * s, (sd * 0.7 * s, 0, 0.02 * s), gm, ol=0.005, parent=beam, segs=16, rings=8)
    tr = math.radians(tilt)
    for sd in (-1, 1):
        tip = Vector((sd * 0.7 * s * math.cos(tr), y, 0.36 * s - sd * 0.7 * s * math.sin(tr)))
        pz = tip.z - 0.6 * s; px = tip.x
        # pan: a shallow bowl (lathe about Z) under the tip
        bm = bmesh.new(); prof = [(0.03, 0.0), (0.16, 0.025), (0.25, 0.07), (0.29, 0.11), (0.3, 0.12)]; segs = 40
        rings = [[bm.verts.new((px + r * s * math.cos(2 * math.pi * i / segs), y + r * s * math.sin(2 * math.pi * i / segs) * 0.45, pz + z * s))
                  for i in range(segs)] for r, z in prof]
        for ra, rb in zip(rings, rings[1:]):
            for i in range(segs):
                bm.faces.new((ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]))
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        cz.place(cz._mesh_obj(f'{name}_pan{sd}', bm, gm), (0, 0, 0), (0, 0, 0), None, root, 0.006, 0)
        # three chains from the tip to the rim
        cb = bmesh.new()
        for th in (-90, 30, 150):
            a = math.radians(th)
            rim = Vector((px + 0.29 * s * math.cos(a), y + 0.29 * s * math.sin(a) * 0.45, pz + 0.12 * s))
            top = Vector((px, y, tip.z - 0.02))
            d = rim - top; L = d.length
            rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            bmesh.ops.create_cone(cb, cap_ends=True, segments=8, radius1=0.011 * s, radius2=0.011 * s, depth=L,
                                  matrix=Matrix.Translation((top + rim) / 2) @ rot)
        cz.place(cz._mesh_obj(f'{name}_chains{sd}', cb, gm), (0, 0, 0), (0, 0, 0), None, root, 0.003, 0)
    # laurel sprigs up both sides inside the rim: single pointed leaves alternating either side of a curved stem
    # (pairs in a V read as little crescents at phone size)
    lb = bmesh.new(); stems = []
    for sd in (-1, 1):
        stem = []
        for i in range(15):
            t = i / 14; a = math.radians(-100 + 150 * t) if sd > 0 else math.radians(-80 - 150 * t)
            rr = (0.8 - 0.04 * t) * R
            c = (rr * math.cos(a), -0.075, rr * math.sin(a))
            stem.append((c[0], -0.085, c[2]))
            if i == 0: continue
            tang = a + (math.pi / 2 if sd > 0 else -math.pi / 2)
            side = 1 if i % 2 else -1
            ang = tang + side * 0.55
            L = (0.17 - 0.05 * t) * s
            off = (c[0] + 0.45 * L * math.cos(ang), c[1], c[2] + 0.45 * L * math.sin(ang))
            _leaf(lb, off, ang, L, L * 0.27, 0.016)
        stems.append(stem)
    cz.place(cz._mesh_obj(name + '_laurel', lb, gm, smooth=False), (0, 0, 0), (0, 0, 0), None, root, 0.004, 0)
    import importlib.util, os
    spec = importlib.util.spec_from_file_location('stage_curtain_util', os.path.join(cz.LAB, 'assets', 'props', 'stage_curtain.py'))
    cu = importlib.util.module_from_spec(spec); spec.loader.exec_module(cu)
    for k, stem in enumerate(stems):
        cu.tube(cz, f'{name}_stem{k}', stem, 0.009 * s, gm, root, segs=6, ol=0.002)
    return root
