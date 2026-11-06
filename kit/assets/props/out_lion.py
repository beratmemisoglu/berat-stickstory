# Stone guardian lion on a pedestal (the pair that flanks a city gate): a chunky toy lion seated on a carved plinth -
# big round head with bulging eyes, a fierce open grin with square teeth, a nose ball, curled brows, a ring of big mane
# curls and rows of small curls on the crown, a barrel chest with a carved collar and bell, front legs with round paws,
# one paw on an embroidered ball (mirror=True puts it under the other paw: the second lion of the pair), haunches and a
# curled tail. Pedestal: base slab, a body with a carved recessed panel (cloud scroll), a top slab.
# Floor prop: root at the floor centre of the pedestal; front -Y. ~0.8 x 1.0 x 1.5 m.
import math, random

META = {'size': (0.8, 1.0, 1.5), 'anchor': 'floor centre of the pedestal', 'animate': [],
        'params': "mirror=False (ball under the left paw instead of the right), stone='#a8a596', seed=3"}


def _egg(cz, name, loc, r, sc, mat, parent, ol=0.006, segs=20, rings=12):
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=segs, rings=rings)
    for v in o.data.vertices:
        v.co = (v.co.x * r * sc[0], v.co.y * r * sc[1], v.co.z * r * sc[2])
    o.data.update()
    return o


def build(cz, name='out_lion', mirror=False, stone='#a8a596', seed=3):
    rnd = random.Random(seed)
    root = cz.empty(name)
    st = cz.toon(f'out_lion_stone{stone}', stone, tex='grain', tex_scale=2.5, tex_strength=0.09)
    st2 = cz.toon(f'out_lion_stone2{stone}', _dark(stone, 0.82), tex='grain', tex_scale=2.5, tex_strength=0.08)
    eye = cz.toon('out_lion_eye', '#e8e4d6')
    dark = cz.toon('out_lion_dark', '#2e2a26')
    red = cz.toon('out_lion_ribbon', '#b8291b', tex='grain', tex_strength=0.04)
    # pedestal
    cz.box(name + '_base', (0.82, 1.02, 0.14), (0, 0, 0.07), st2, bevel=0.02, ol=0.008, parent=root)
    cz.box(name + '_body', (0.66, 0.86, 0.5), (0, 0, 0.39), st, bevel=0.015, ol=0.008, parent=root)
    cz.box(name + '_panel', (0.48, 0.012, 0.3), (0, -0.436, 0.39), st2, bevel=0.004, ol=0.004, parent=root)
    for i in range(3):     # a cloud scroll on the panel: three curls
        cz.cyl(f'{name}_scroll{i}', 0.055, 0.012, (-0.13 + i * 0.13, -0.444, 0.39 + (0.03 if i == 1 else -0.02)), st, rot=(90, 0, 0), verts=16,
               ol=0.003, parent=root)
    cz.box(name + '_top', (0.8, 1.0, 0.12), (0, 0, 0.70), st2, bevel=0.02, ol=0.008, parent=root)
    z0 = 0.76
    L = cz.empty(name + '_lion', (0, 0.05, z0), parent=root)
    s = -1 if mirror else 1        # the ball paw side (+X = the lion's left, seen from the front it is on the right)
    _egg(cz, name + '_haunch', (0, 0.12, 0.17), 0.24, (1.25, 1.0, 0.75), st, L)
    _egg(cz, name + '_chest', (0, -0.04, 0.32), 0.24, (0.95, 0.9, 1.25), st, L)
    cz.cyl(name + '_collar', 0.2, 0.05, (0, -0.06, 0.47), red, verts=20, ol=0.004, parent=L, r2=0.19)
    cz.sphere(name + '_bell', 0.045, (0, -0.25, 0.44), cz.toon('out_lion_bronze', '#b07a3a'), ol=0.004, parent=L, segs=12, rings=8)
    # legs + paws (the ball paw rests on the ball)
    for side in (-1, 1):
        on_ball = side == s
        x = side * 0.11
        cz.cyl(f'{name}_leg{side}', 0.055, 0.3 if not on_ball else 0.22, (x, -0.17, 0.0 if not on_ball else 0.12), st, verts=12, ol=0.005, parent=L)
        if on_ball:
            ball = cz.sphere(f'{name}_ball', 0.1, (x + side * 0.05, -0.26, 0.1), st2, ol=0.005, parent=L, segs=16, rings=10)
            for k in range(3):
                cz.cyl(f'{name}_ballband{k}', 0.101, 0.012, (x + side * 0.05, -0.26, 0.1), st, rot=(90, 0, k * 60), verts=20, ol=0.0, parent=L)
            cz.sphere(f'{name}_paw{side}', 0.07, (x + side * 0.03, -0.24, 0.2), st, ol=0.005, parent=L, segs=14, rings=8)
        else:
            cz.sphere(f'{name}_paw{side}', 0.07, (x, -0.22, 0.04), st, ol=0.005, parent=L, segs=14, rings=8)
        _egg(cz, f'{name}_hind{side}', (side * 0.2, 0.05, 0.08), 0.12, (0.8, 1.3, 0.7), st, L)
    # head
    hz = 0.66
    cz.sphere(name + '_head', 0.2, (0, -0.1, hz), st, ol=0.007, parent=L, segs=24, rings=14)
    for i in range(11):        # mane ring (curls around the back of the head)
        a = math.radians(-20 + i * 22)
        cz.sphere(f'{name}_mane{i}', 0.075, (math.cos(a) * 0.2, -0.0, hz + math.sin(a) * 0.2 - 0.02), st2, ol=0.005, parent=L, segs=12, rings=8)
    for j in range(2):         # rows of crown curls
        for i in range(4 - j):
            cz.sphere(f'{name}_curl{j}_{i}', 0.04, (-0.09 + j * 0.03 + i * 0.06, -0.14 + j * 0.06, hz + 0.18 - j * 0.02), st2, ol=0.003, parent=L,
                      segs=10, rings=6)
    for side in (-1, 1):
        ex = side * 0.075
        cz.sphere(f'{name}_eye{side}', 0.048, (ex, -0.27, hz + 0.05), eye, ol=0.004, parent=L, segs=14, rings=8)
        cz.sphere(f'{name}_pupil{side}', 0.022, (ex + side * 0.005, -0.31, hz + 0.05), dark, ol=0.0, parent=L, segs=10, rings=6)
        cz.box(f'{name}_brow{side}', (0.09, 0.04, 0.03), (side * 0.08, -0.27, hz + 0.115), st2, rot=(0, side * 18, 0), bevel=0.01, ol=0.004, parent=L)
        cz.sphere(f'{name}_cheek{side}', 0.06, (side * 0.12, -0.23, hz - 0.06), st, ol=0.004, parent=L, segs=12, rings=8)
    cz.sphere(name + '_nose', 0.045, (0, -0.31, hz - 0.01), st2, ol=0.004, parent=L, segs=12, rings=8)
    cz.box(name + '_mouth', (0.16, 0.03, 0.06), (0, -0.285, hz - 0.1), dark, bevel=0.012, ol=0.003, parent=L)
    for i in range(4):
        cz.box(f'{name}_tooth{i}', (0.028, 0.012, 0.025), (-0.045 + i * 0.03, -0.302, hz - 0.08), eye, bevel=0.003, ol=0.0, parent=L)
    # tail curls up the back
    for i in range(3):
        cz.sphere(f'{name}_tail{i}', 0.07 - i * 0.012, (0.0, 0.33 - i * 0.02, 0.18 + i * 0.12), st2, ol=0.004, parent=L, segs=12, rings=8)
    return root


def _dark(h, k):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return '#' + ''.join(f'{int(x * k):02x}' for x in c)
