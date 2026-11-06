# Court balustrade ("the bar") for the law stage: a cream marble base plinth, a row of turned vase balusters (one merged
# mesh), a thick moulded top rail with a gold cap strip, and square end posts with gold ball finials (or, lamps=True,
# brass lamp posts with glowing globes).
# Floor prop: root at the floor centre of the run; the run goes along X (length), front faces -Y.
import math, bmesh
from mathutils import Matrix

META = {'size': (4.0, 0.34, 1.05), 'anchor': 'floor centre of the run (runs along X)', 'animate': [],
        'params': "length=4.0, height=0.95, spacing=0.21, posts=True|False|'-'|'+' (end posts: both, none, only the -X / +X end), "
                  "marble='#ddd2bb', gold='#d2a23e', lamps=False (glowing globe lamp posts on the end posts instead of gold balls), "
                  "glow='#ffd58a'"}

# vase baluster profile (r, z) for a 1.0 m tall rail: z from the plinth top to the rail bottom is scaled to fit
PROF = [(0.05, 0.0), (0.055, 0.02), (0.04, 0.045), (0.045, 0.07), (0.07, 0.17), (0.075, 0.24), (0.06, 0.33), (0.035, 0.42),
        (0.03, 0.47), (0.045, 0.5), (0.03, 0.53), (0.035, 0.58), (0.05, 0.6)]


def build(cz, name='stage_balustrade', length=4.0, height=0.95, spacing=0.21, posts=True, marble='#ddd2bb', gold='#d2a23e',
          lamps=False, glow='#ffd58a'):
    root = cz.empty(name)
    mm = cz.toon(name + '_marble', marble, tex='grain', tex_scale=2.0, tex_strength=0.05)
    gm = cz.toon('stage_gold', gold, tex='grain', tex_scale=3.0, tex_strength=0.04)
    L = length; pb, rt = 0.14, 0.12               # base plinth height, rail thickness
    pl = 0.36 if posts else 0.0
    cz.box(name + '_base', (L, 0.32, pb), (0, 0, pb / 2), mm, bevel=0.012, ol=0.009, parent=root)
    cz.box(name + '_rail', (L, 0.3, rt), (0, 0, height - rt / 2), mm, bevel=0.02, ol=0.009, parent=root)
    cz.box(name + '_railcap', (L - 0.02, 0.2, 0.025), (0, 0, height + 0.012), gm, bevel=0.008, ol=0.004, parent=root)
    # balusters: one mesh
    bz0, bz1 = pb, height - rt
    sc = (bz1 - bz0) / PROF[-1][1]
    n = max(1, int((L - 2 * pl - 0.1) / spacing))
    span = (n - 1) * spacing
    bm = bmesh.new(); segs = 20
    for k in range(n):
        x = -span / 2 + k * spacing
        rings = []
        for r, z in PROF:
            rings.append([bm.verts.new((x + r * 1.05 * math.cos(2 * math.pi * s / segs), r * 1.05 * math.sin(2 * math.pi * s / segs), bz0 + z * sc))
                          for s in range(segs)])
        for ra, rb in zip(rings, rings[1:]):
            for s in range(segs):
                bm.faces.new((ra[s], ra[(s + 1) % segs], rb[(s + 1) % segs], rb[s]))
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cz.place(cz._mesh_obj(name + '_balusters', bm, mm), (0, 0, 0), (0, 0, 0), None, root, 0.006, 0)
    if posts:
        for s in ((-1, 1) if posts is True else ((-1,) if posts == '-' else (1,))):
            x = s * (L / 2 - pl / 2)
            cz.box(f'{name}_post{s}', (pl, 0.38, height + 0.05), (x, 0, (height + 0.05) / 2), mm, bevel=0.015, ol=0.009, parent=root)
            cz.box(f'{name}_postcap{s}', (pl + 0.05, 0.43, 0.06), (x, 0, height + 0.08), mm, bevel=0.012, ol=0.007, parent=root)
            if lamps:     # a brass lamp post with a glowing frosted globe instead of the gold ball
                br = cz.toon('stage_brass', '#b8862f')
                cz.cyl(f'{name}_lampfoot{s}', 0.09, 0.05, (x, 0, height + 0.11), br, verts=24, ol=0.004, parent=root, r2=0.06)
                cz.cyl(f'{name}_lamppost{s}', 0.03, 0.32, (x, 0, height + 0.16), br, verts=16, ol=0.004, parent=root)
                cz.cyl(f'{name}_lampcup{s}', 0.05, 0.06, (x, 0, height + 0.46), br, verts=20, ol=0.004, parent=root, r2=0.085)
                cz.sphere(f'{name}_lampglobe{s}', 0.12, (x, 0, height + 0.62), cz.glow('stage_globe', glow, 6.0), ol=0.004,
                          parent=root, segs=24, rings=12)
            else:
                cz.cyl(f'{name}_ballneck{s}', 0.06, 0.05, (x, 0, height + 0.11), gm, verts=24, ol=0.004, parent=root)
                cz.sphere(f'{name}_ball{s}', 0.1, (x, 0, height + 0.24), gm, ol=0.006, parent=root, segs=24, rings=12)
    return root
