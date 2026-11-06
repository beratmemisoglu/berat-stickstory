# Pendant globe lamp (waiting room): a dark rod from a ceiling canopy, a brass collar, a faceted opal-white globe that
# glows, a thin equator band. Ceiling prop: the root is the ceiling mount point, the lamp hangs down -Z (drop metres).
import math

META = {'size': (0.36, 0.36, 1.0), 'anchor': 'ceiling mount point (hangs down -Z)', 'animate': [],
        'params': 'drop=0.75 (rod length), r=0.17 (globe radius), glow=1.6'}


def build(cz, name='lo_globe_lamp', drop=0.75, r=0.17, glow=1.6):
    root = cz.empty(name)
    rod = cz.toon(name + '_rod', '#2a2622')
    br = cz.toon(name + '_brass', '#c99a2e', tex='grain')
    cz.cyl(name + '_canopy', 0.07, 0.03, (0, 0, -0.03), rod, ol=0.004, parent=root, verts=24)
    cz.cyl(name + '_stem', 0.012, drop, (0, 0, -drop - 0.02), rod, ol=0.004, parent=root, verts=12)
    zc = -drop - 0.02 - r * 0.92
    cz.cyl(name + '_collar', 0.045, 0.05, (0, 0, zc + r * 0.86), br, ol=0.004, parent=root, verts=24, bevel=0.004)
    gm = cz.toon(name + '_globe', '#f4f2ea', emit=glow)
    g = cz.sphere(name + '_ball', r, (0, 0, zc), gm, ol=0.006, parent=root, segs=12, rings=7)
    g.data.polygons.foreach_set('use_smooth', [False] * len(g.data.polygons))     # faceted glass globe
    cz.cyl(name + '_band', r * 1.005, 0.012, (0, 0, zc - 0.006), cz.toon(name + '_bandm', '#d8d4c8'), ol=0.003, parent=root, verts=12)
    return root
