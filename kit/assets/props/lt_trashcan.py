# Grey store trash can (LOTTERY L06): a big tapered 12-sided can with speckled grey paint, a dark rolled rim, a dark
# opening (cartoon cheat: an inner wall ring + a deep dark disc 4 cm under the rim, so a body pushed in head-first reads
# as going inside), a crumpled paper and a cup poking out at the back unless empty=True. Floor prop, root at the floor
# centre. Size like the reference: a third taller than the hip of a 1.3 m character.
import math, random

META = {'size': (0.56, 0.56, 0.66), 'anchor': 'floor centre', 'animate': [],
        'params': 'h=0.66, r0=0.22, r1=0.28, empty=False, color=#7d8794'}


def build(cz, name='lt_trashcan', h=0.66, r0=0.22, r1=0.28, empty=False, color='#7d8794'):
    root = cz.empty(name)
    body = cz.toon(name + '_bodym', color, pattern=('speckle', 1.6, '#aab3bd'), tex='grain', tex_strength=0.06)
    rim = cz.toon(name + '_rimm', '#4b525c', tex='grain', tex_strength=0.04)
    dark = cz.toon(name + '_holem', '#15171b')
    wall = cz.toon(name + '_wallm', '#3c434c')
    cz.cyl(name + '_body', r0, h, (0, 0, 0), body, r2=r1, verts=12, bevel=0.006, ol=0.009, parent=root)
    cz.cyl(name + '_rim', r1 + 0.012, 0.035, (0, 0, h - 0.02), rim, verts=12, bevel=0.012, ol=0.008, parent=root)
    cz.cyl(name + '_wall', r1 - 0.004, 0.004, (0, 0, h + 0.012), wall, verts=12, ol=0.0, parent=root)
    cz.cyl(name + '_hole', r1 - 0.03, 0.004, (0, 0, h + 0.013), dark, verts=24, ol=0.0, parent=root)
    cz.cyl(name + '_foot', r0 - 0.01, 0.02, (0, 0, 0), rim, verts=12, ol=0.004, parent=root)
    if not empty:
        rnd = random.Random(7)
        p = cz.sphere(name + '_paper', 0.06, (0.1, 0.12, h + 0.03), cz.toon('lt_paperm', '#f2efe6', tex='paper'), ol=0.004, parent=root, segs=10, rings=6)
        for v in p.data.vertices: v.co = v.co * (1 + rnd.uniform(-0.25, 0.25))
        p.data.polygons.foreach_set('use_smooth', [False] * len(p.data.polygons))
        cz.cyl(name + '_cup', 0.035, 0.11, (-0.12, 0.1, h - 0.03), cz.toon('lt_cupm', '#f4f1ea'), r2=0.045, rot=(18, -12, 0), ol=0.004, parent=root, verts=20)
    return root
