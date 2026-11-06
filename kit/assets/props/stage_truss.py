# Lighting truss for the law stage: a silver 30 cm box truss (four chords + zigzag lacing on every face, one merged mesh,
# end plates) with theatre cans hung under it: clamp, U yoke (turns with pan), a black can body with cooling ribs that
# tilts in the yoke, a rear cap, four barn doors and a glowing coloured lens.
# Root = the centre of the truss (it runs along X). Each can's body pivot is <name>_can<i> at (x, 0, -0.4) local;
# its local -Z is the beam direction. aim(pivot_world, target_world) -> (pan, tilt) in degrees for a cans entry.
import math, bmesh
from mathutils import Matrix, Vector, Euler

META = {'size': (7.0, 0.3, 0.75), 'anchor': 'centre of the truss (runs along X); cans hang below', 'animate': ['_can<i> (tilt about X)', '_can<i>_pan (about Z)'],
        'params': "length=7.0, cans=[(x, pan_deg, tilt_deg, '#hex'), ...], steel='#9aa1ad', lens_strength=5.0"}


def aim(pivot, target):
    d = (Vector(target) - Vector(pivot)).normalized()
    tilt = math.degrees(math.acos(max(-1, min(1, -d.z))))
    pan = math.degrees(math.atan2(-d.x, d.y)) if abs(d.z) < 0.9999 else 0.0
    return pan, tilt


def _seg(bm, a, b, r, segs=8):
    a, b = Vector(a), Vector(b); d = b - a
    q = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=d.length, matrix=Matrix.Translation((a + b) / 2) @ q)


def build(cz, name='stage_truss', length=7.0, cans=None, steel='#9aa1ad', lens_strength=5.0):
    root = cz.empty(name)
    L = length; h = 0.15
    if cans is None: cans = [(x, 0, 25, '#ffd9a0') for x in (-2.4, -1.2, 0, 1.2, 2.4)]
    st = cz.toon(name + '_steel', steel, tex='grain', tex_strength=0.04)
    blk = cz.toon('stage_canblack', '#2b2a30', tex='grain', tex_strength=0.05)
    bm = bmesh.new()
    corners = [(-h, -h), (h, -h), (h, h), (-h, h)]          # (y, z)
    for y, z in corners: _seg(bm, (-L / 2, y, z), (L / 2, y, z), 0.026, 10)
    n = int(L / 0.3)
    for f in range(4):
        (y0, z0), (y1, z1) = corners[f], corners[(f + 1) % 4]
        for k in range(n):
            xa = -L / 2 + k * L / n; xb = -L / 2 + (k + 1) * L / n
            if k % 2 == 0: _seg(bm, (xa, y0, z0), (xb, y1, z1), 0.011, 6)
            else: _seg(bm, (xa, y1, z1), (xb, y0, z0), 0.011, 6)
    cz.place(cz._mesh_obj(name + '_frame', bm, st), (0, 0, 0), (0, 0, 0), None, root, 0.004, 0)
    for s in (-1, 1):
        cz.box(f'{name}_plate{s}', (0.02, 0.36, 0.36), (s * (L / 2 + 0.01), 0, 0), st, bevel=0.006, ol=0.004, parent=root)
    for i, (x, pan, tilt, colr) in enumerate(cans):
        cz.box(f'{name}_clamp{i}', (0.07, 0.09, 0.09), (x, 0, -h - 0.06), blk, bevel=0.01, ol=0.004, parent=root)
        pv = cz.empty(f'{name}_can{i}_pan', (x, 0, -h - 0.1), parent=root); pv.rotation_euler = (0, 0, math.radians(pan))
        cz.box(f'{name}_yoke{i}_t', (0.3, 0.04, 0.03), (0, 0, -0.015), blk, bevel=0.006, ol=0.003, parent=pv)
        for sd in (-1, 1):
            cz.box(f'{name}_yoke{i}_{sd}', (0.025, 0.045, 0.3), (sd * 0.14, 0, -0.16), blk, bevel=0.006, ol=0.003, parent=pv)
        can = cz.empty(f'{name}_can{i}', (0, 0, -0.3), parent=pv); can.rotation_euler = (math.radians(tilt), 0, 0)
        cz.cyl(f'{name}_body{i}', 0.112, 0.4, (0, 0, -0.2), blk, verts=32, ol=0.005, parent=can, bevel=0.008)
        for k in range(2):
            cz.cyl(f'{name}_rib{i}_{k}', 0.12, 0.025, (0, 0, 0.02 + k * 0.07), blk, verts=32, ol=0.002, parent=can)
        cz.cyl(f'{name}_cap{i}', 0.085, 0.07, (0, 0, 0.2), blk, verts=24, ol=0.004, parent=can, r2=0.06)
        cz.cyl(f'{name}_ring{i}', 0.118, 0.03, (0, 0, -0.23), st, verts=32, ol=0.003, parent=can)
        cz.cyl(f'{name}_lens{i}', 0.092, 0.012, (0, 0, -0.236), cz.glow(f'stage_lens_{colr.lstrip("#")}', colr, lens_strength),
               verts=32, ol=0, parent=can)
        for k in range(4):     # barn doors: four flaps hinged at the front ring, opened outward
            a = math.pi / 2 * k
            door = cz.empty(f'{name}_door{i}_{k}', (0.12 * math.cos(a), 0.12 * math.sin(a), -0.245), parent=can)
            door.rotation_euler = (0, 0, a)
            hinge = cz.empty(f'{name}_doorh{i}_{k}', (0, 0, 0), parent=door); hinge.rotation_euler = (0, math.radians(-35), 0)
            cz.box(f'{name}_flap{i}_{k}', (0.006, 0.2, 0.12), (0, 0, -0.06), blk, bevel=0, ol=0.002, parent=hinge)
    return root
