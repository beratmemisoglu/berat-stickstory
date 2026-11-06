# Handcart: a two-wheeled wooden barrow cart parked with its shafts resting on the ground - big spoked wheels (iron tyre,
# hub), a plank bed with low side boards, two long shafts with a crossbar, loaded with sacks, a crate and a basket of
# cabbages (load='goods'), or empty (load=None).
# Floor prop: root at the floor centre under the axle; the shafts point to -Y (front). ~1.5 x 2.6 x 1.1 m.
import math, random

META = {'size': (1.5, 2.6, 1.1), 'anchor': 'floor centre under the axle; shafts toward -Y', 'animate': ['_wheelL/_wheelR (rotation x)'],
        'params': "load='goods'|None, seed=1"}


def build(cz, name='out_cart', load='goods', seed=1):
    rnd = random.Random(seed)
    root = cz.empty(name)
    wood = cz.toon('out_cart_wood', '#8a5a3a', tex='wood', tex_scale=3.0, tex_strength=0.08)
    wood2 = cz.toon('out_cart_wood2', '#5e3f2b', tex='wood', tex_scale=3.0, tex_strength=0.08)
    iron = cz.toon('out_cart_iron', '#3a3430')
    R = 0.5
    tilt = math.degrees(math.asin((R - 0.04) / 2.15))   # the bed tips forward until the shaft ends (y -2.15) touch the ground
    bed = cz.empty(name + '_bed', (0, 0, R), parent=root)
    bed.rotation_euler = (math.radians(tilt), 0, 0)
    cz.box(name + '_floor', (1.0, 1.4, 0.06), (0, -0.2, 0.05), wood, bevel=0.008, ol=0.005, parent=bed)
    for s in (-1, 1):
        cz.box(f'{name}_side{s}', (0.05, 1.4, 0.24), (s * 0.5, -0.2, 0.2), wood2, bevel=0.006, ol=0.005, parent=bed)
        cz.box(f'{name}_shaft{s}', (0.07, 2.4, 0.07), (s * 0.38, -0.95, 0.0), wood2, bevel=0.008, ol=0.005, parent=bed)
    cz.box(name + '_back', (1.0, 0.05, 0.22), (0, 0.48, 0.19), wood2, bevel=0.006, ol=0.005, parent=bed)
    cz.box(name + '_cross', (0.84, 0.06, 0.06), (0, -2.05, 0.0), wood2, bevel=0.006, ol=0.004, parent=bed)
    for s, nm in ((-1, 'L'), (1, 'R')):
        w = cz.empty(f'{name}_wheel{nm}', (s * 0.62, 0, R), parent=root)
        cz.cyl(f'{name}_tyre{nm}', R, 0.07, (-0.035, 0, 0), iron, rot=(0, 90, 0), verts=28, ol=0.006, parent=w)
        cz.cyl(f'{name}_rim{nm}', R - 0.04, 0.075, (-0.0375, 0, 0), wood, rot=(0, 90, 0), verts=28, ol=0.0, parent=w)
        cz.cyl(f'{name}_inner{nm}', R - 0.1, 0.08, (-0.04, 0, 0), cz.toon('out_cart_gap', '#2a2420'), rot=(0, 90, 0), verts=28, ol=0.0, parent=w)
        cz.cyl(f'{name}_hub{nm}', 0.09, 0.16, (-0.08, 0, 0), wood2, rot=(0, 90, 0), verts=12, ol=0.004, parent=w)
        for k in range(8):
            a = k / 8 * 2 * math.pi
            cz.box(f'{name}_spoke{nm}{k}', (0.035, 0.04, R - 0.12), (0, math.sin(a) * (R - 0.06) / 2, math.cos(a) * (R - 0.06) / 2), wood,
                   rot=(-math.degrees(a), 0, 0), bevel=0.004, ol=0.003, parent=w)
    cz.cyl(name + '_axle', 0.04, 1.24, (-0.62, 0, R), iron, rot=(0, 90, 0), verts=10, ol=0.003, parent=root)
    if load:
        sack = cz.toon('out_cart_sack', '#d8c49a', tex='paper', tex_strength=0.05)
        cord = cz.toon('out_cart_cord', '#3a2a20')
        for k, (x, y) in enumerate(((-0.24, 0.15), (0.22, 0.12), (0.0, -0.35))):
            o = cz.capsule(f'{name}_sack{k}', 0.2, 0.55, (x, y, 0.08), sack, ol=0.005, parent=bed)
            o.rotation_euler = (math.radians(80), 0, math.radians(rnd.uniform(-20, 20)))
        cz.box(name + '_crate', (0.4, 0.36, 0.3), (0.18, -0.72, 0.23), wood, rot=(0, 0, 12), bevel=0.01, ol=0.005, parent=bed)
        for k in range(3):
            cz.box(f'{name}_crateslat{k}', (0.41, 0.37, 0.025), (0.18, -0.72, 0.13 + k * 0.1), wood2, rot=(0, 0, 12), bevel=0, ol=0.0, parent=bed)
        cz.cyl(name + '_basket', 0.17, 0.16, (-0.22, -0.7, 0.08), cz.toon('out_cart_wicker', '#b08a55', tex='grain', tex_scale=6.0, tex_strength=0.1),
               verts=16, ol=0.004, parent=bed, r2=0.2)
        cab = cz.toon('out_cart_cabbage', '#7ab04a', tex='grain', tex_strength=0.05)
        for k in range(4):
            a = k / 4 * 2 * math.pi
            cz.sphere(f'{name}_cab{k}', 0.07, (-0.22 + math.cos(a) * 0.08, -0.7 + math.sin(a) * 0.08, 0.27), cab, ol=0.003, parent=bed, segs=10, rings=6)
    return root
