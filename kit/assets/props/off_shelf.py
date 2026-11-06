# Office storage in light steel (the Japanese office standard): kind='low' = a 0.9 m credenza (two sliding doors with
# finger pulls below, an open shelf of binders above, box files / a tray / a plant / a trophy on top), kind='tall' = a
# 1.8 m open bookcase with four shelves of binders, box files and stacked papers, cardboard archive boxes on top.
# Binders: coloured spines with white labels (tex/off_binder_spines.png, 12 labels), seeded per shelf.
# Floor prop: root at the floor centre, front -Y, back at y = +0.21.
import math, os, random

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': ('w', 0.42, '0.9 low | 1.8 tall'), 'anchor': 'floor centre, front -Y', 'animate': [],
        'params': "kind='low'|'tall', w=1.8 (low) / 0.9 (tall), seed=1, top=('files','plant','trophy','tray') items on a low one "
                  "(subset, in that order from the left), body='#cfd2d2', door='#aeb7bd'"}

D = 0.42
COLS = ('#3f6fb5', '#d6463c', '#4f9a6a', '#e0a63a', '#2b3a5c', '#7d5ab8', '#1f7385', '#e86a8a', '#3a3d44')


def _spine(cz, i):
    m = cz.toon(f'off_spine{i}', img=os.path.join(TEX, 'off_binder_spines.png'), scale=(1 / 12, 1))
    for nd in m.node_tree.nodes:
        if nd.type == 'MAPPING': nd.inputs['Location'].default_value = (i / 12, 0, 0)
    return m


def _row(cz, name, parent, x0, x1, z, depth, hmax, rnd, M):
    """Fill x0..x1 at height z with binders / box files / a lying paper stack; returns the object count."""
    x = x0 + 0.01; i = 0
    while x < x1 - 0.05:
        r = rnd.random()
        if r < 0.1 and x < x1 - 0.25:       # a lying stack of papers / a magazine
            w = 0.24
            for k in range(3):
                cz.box(f'{name}_st{i}_{k}', (0.22, depth * 0.7, 0.022), (x + w / 2, -0.01, z + 0.022 * k), M('paper' + str(k % 2), ('#f2efe6', '#e6dcc6')[k % 2], tex='paper'),
                       rot=(0, 0, rnd.uniform(-4, 4)), bevel=0.002, ol=0.003, parent=parent, origin='bottom')
            x += w + 0.01; i += 1; continue
        if r < 0.28:                        # a magazine box file (white or blue) with a label window
            w = 0.1; h = min(hmax, 0.3)
            c = rnd.choice(('#eeeae0', '#3f6fb5', '#eeeae0'))
            cz.box(f'{name}_bf{i}', (w, depth * 0.85, h), (x + w / 2, 0, z), M('boxfile' + c.lstrip('#'), c, tex='grain'), bevel=0.006, ol=0.004, parent=parent, origin='bottom')
            cz.plane(f'{name}_bfl{i}', 0.06, 0.09, (x + w / 2, -depth * 0.425 - 0.001, z + h * 0.62), _spine(cz, rnd.randrange(12)), parent=parent)
            x += w + 0.004; i += 1; continue
        w = rnd.choice((0.05, 0.06, 0.07, 0.075)); h = min(hmax, rnd.uniform(0.27, 0.32))
        c = rnd.choice(COLS)
        lean = rnd.random() < 0.08 and x > x0 + 0.1
        cz.box(f'{name}_b{i}', (w, depth * 0.82, h), (x + w / 2, 0, z), M('binder' + c.lstrip('#'), c, tex='grain'),
               rot=(0, 8 if lean else 0, 0), bevel=0.005, ol=0.004, parent=parent, origin='bottom')
        if not lean:
            cz.plane(f'{name}_bl{i}', w * 0.66, h * 0.42, (x + w / 2, -depth * 0.41 - 0.001, z + h * 0.62), _spine(cz, rnd.randrange(12)), parent=parent)
        x += w + (0.05 if lean else 0.002); i += 1
    return i


def build(cz, name='off_shelf', kind='low', w=None, seed=1, top=('files', 'plant', 'trophy', 'tray'), body='#cfd2d2', door='#aeb7bd'):
    root = cz.empty(name)
    rnd = random.Random(seed)
    w = w or (1.8 if kind == 'low' else 0.9)

    def M(key, c, **k):
        return cz.toon(f'off_shelf_{key}', c, **k)
    steel = M('steel_' + body.lstrip('#'), body, tex='grain', tex_strength=0.03)
    inner = M('inner', '#8f9498', tex='grain', tex_strength=0.03)
    dark = M('dark', '#3a3d44')
    t = 0.022
    H = 0.9 if kind == 'low' else 1.8
    # carcass: plinth, sides, back, top
    cz.box(name + '_plinth', (w - 0.04, D - 0.05, 0.06), (0, 0.0, 0), dark, bevel=0.004, ol=0.005, parent=root, origin='bottom')
    for s in (-1, 1):
        cz.box(f'{name}_side{s}', (t, D, H - 0.06), (s * (w / 2 - t / 2), 0, 0.06), steel, bevel=0.004, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_backp', (w - 2 * t, 0.012, H - 0.06), (0, D / 2 - 0.006, 0.06), inner, bevel=0, ol=0, parent=root, origin='bottom')
    cz.box(name + '_top', (w + 0.01, D + 0.01, t), (0, 0, H - t), steel, bevel=0.006, ol=0.007, parent=root, origin='bottom')
    if kind == 'low':
        cz.box(name + '_bottom', (w - 2 * t, D - 0.01, t), (0, 0, 0.06), steel, bevel=0.002, ol=0.0, parent=root, origin='bottom')
        cz.box(name + '_mid', (w - 2 * t, D - 0.01, t), (0, 0, 0.46), steel, bevel=0.003, ol=0.005, parent=root, origin='bottom')
        dm = M('door_' + door.lstrip('#'), door, tex='grain', tex_strength=0.035)
        dw = (w - 2 * t) / 2 + 0.02
        for k, s in enumerate((-1, 1)):
            yy = -D / 2 - 0.012 - 0.014 * k          # the two sliding doors on their two tracks
            cz.box(f'{name}_door{k}', (dw, 0.014, 0.37), (s * (dw / 2 - 0.02), yy, 0.08 + 0.185), dm, bevel=0.004, ol=0.005, parent=root)
            cz.box(f'{name}_pull{k}', (0.03, 0.004, 0.12), (s * (dw - 0.08), yy - 0.008, 0.08 + 0.2), dark, bevel=0.002, ol=0.0, parent=root)
        cz.box(name + '_track', (w - 2 * t, 0.04, 0.012), (0, -D / 2 - 0.016, 0.075), dark, bevel=0.002, ol=0.003, parent=root, origin='bottom')
        _row(cz, name + '_r0', root, -w / 2 + t, w / 2 - t, 0.46 + t, D * 0.9, 0.38, rnd, M)
        x = -w / 2 + 0.08
        for it in top:
            if it == 'files':
                for k in range(3):
                    c = ('#eeeae0', '#3f6fb5', '#eeeae0')[k]
                    cz.box(f'{name}_tf{k}', (0.1, 0.3, 0.3), (x + 0.05 + k * 0.105, 0, H), M('boxfile' + c.lstrip('#'), c, tex='grain'), bevel=0.006, ol=0.004, parent=root, origin='bottom')
                    cz.plane(f'{name}_tfl{k}', 0.06, 0.09, (x + 0.05 + k * 0.105, -0.151, H + 0.19), _spine(cz, (seed * 3 + k) % 12), parent=root)
                x += 0.4
            elif it == 'plant':
                pot = M('pot', '#c9714b', tex='grain', tex_strength=0.05)
                cz.cyl(name + '_pot', 0.075, 0.13, (x + 0.1, 0, H), pot, r2=0.09, bevel=0.005, ol=0.005, parent=root)
                cz.cyl(name + '_soil', 0.082, 0.004, (x + 0.1, 0, H + 0.125), M('soil', '#5a4030'), ol=0, parent=root)
                leaf = M('leaf', '#4f9a4e', tex='grain', tex_strength=0.06)
                for k in range(7):
                    a = k * 2.4; r = 0.06 + 0.02 * (k % 3)
                    cz.sphere(f'{name}_leaf{k}', 0.06, (x + 0.1 + r * math.cos(a), r * math.sin(a), H + 0.2 + 0.05 * (k % 2)), leaf, scale=(1, 0.6, 1.4),
                              ol=0.004, parent=root, segs=16, rings=8)
                x += 0.26
            elif it == 'trophy':
                gold = M('gold', '#e0b030', tex='grain', tex_strength=0.04)
                cz.box(name + '_tbase', (0.12, 0.1, 0.05), (x + 0.08, 0, H), M('tbase', '#3a2a22', tex='wood'), bevel=0.005, ol=0.004, parent=root, origin='bottom')
                cz.cyl(name + '_tstem', 0.014, 0.08, (x + 0.08, 0, H + 0.05), gold, verts=14, ol=0.003, parent=root)
                cz.cyl(name + '_tcup', 0.03, 0.09, (x + 0.08, 0, H + 0.12), gold, r2=0.055, verts=24, bevel=0.003, ol=0.004, parent=root)
                x += 0.2
            elif it == 'tray':
                cz.box(name + '_tray', (0.27, 0.34, 0.06), (x + 0.15, 0, H), M('tray', '#3a3d44'), bevel=0.004, ol=0.004, parent=root, origin='bottom')
                cz.box(name + '_traypaper', (0.21, 0.29, 0.02), (x + 0.15, 0, H + 0.03), M('paper0', '#f2efe6', tex='paper'), rot=(0, 0, 4), bevel=0.001, ol=0.002, parent=root, origin='bottom')
                x += 0.32
    else:
        zs = [0.06 + t + k * 0.425 for k in range(4)]
        for k, z in enumerate(zs):
            cz.box(f'{name}_shelf{k}', (w - 2 * t, D - 0.01, t), (0, 0, z - t), steel, bevel=0.002, ol=0.004, parent=root, origin='bottom')
            _row(cz, f'{name}_r{k}', root, -w / 2 + t, w / 2 - t, z, D * 0.9, 0.36, rnd, M)
        # archive boxes on top
        card = M('card', '#c9a06a', tex='grain', tex_strength=0.05)
        for k, (dx, ww) in enumerate(((-0.2, 0.38), (0.21, 0.36))):
            cz.box(f'{name}_arch{k}', (ww, 0.32, 0.26), (dx, 0, H), card, rot=(0, 0, 3 - 5 * k), bevel=0.006, ol=0.005, parent=root, origin='bottom')
            cz.box(f'{name}_archl{k}', (0.16, 0.004, 0.08), (dx, -0.163, H + 0.15), M('label', '#f2efe6', tex='paper'), rot=(0, 0, 3 - 5 * k), bevel=0, ol=0.002, parent=root)
    return root
