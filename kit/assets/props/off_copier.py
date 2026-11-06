# Office multifunction copier: paper-drawer base on casters, the body with the dark output gap and a sheet in it,
# the flatbed scanner with a document feeder (a stack of originals waiting), a tilted touch panel with a lit screen
# (tex/off_copier_panel.png), a green status LED, a side bypass tray. paper=True adds a cardboard box of copy paper
# reams beside it (+X). Floor prop: root at the floor centre, front (panel side) -Y.
import os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (0.66, 0.62, 1.02), 'anchor': 'floor centre, front -Y', 'animate': [],
        'params': "paper=True (a box of reams beside it at +X, 0.42 m wide), body='#e2dfd8', trim='#4a5560'"}


def build(cz, name='off_copier', paper=True, body='#e2dfd8', trim='#4a5560'):
    root = cz.empty(name)

    def M(key, c, **k):
        return cz.toon(f'off_copier_{key}', c, **k)
    bm = M('body', body, tex='grain', tex_strength=0.03)
    tm = M('trim', trim, tex='grain', tex_strength=0.03)
    dark = M('dark', '#2e3136')
    papr = M('paper', '#f6f3ea', tex='paper', tex_strength=0.03)
    W, Dp = 0.62, 0.6
    # casters + base with two paper drawers
    for i, (x, y) in enumerate(((-0.25, -0.24), (0.25, -0.24), (-0.25, 0.24), (0.25, 0.24))):
        cz.cyl(f'{name}_caster{i}', 0.03, 0.04, (x, y, 0), dark, verts=16, ol=0.003, parent=root)
    cz.box(name + '_base', (W, Dp, 0.4), (0, 0, 0.04), bm, bevel=0.01, ol=0.007, parent=root, origin='bottom')
    for k, z in enumerate((0.07, 0.25)):
        cz.box(f'{name}_drawer{k}', (W - 0.04, 0.02, 0.16), (0, -Dp / 2 - 0.006, z + 0.08), bm, bevel=0.006, ol=0.005, parent=root)
        cz.box(f'{name}_handle{k}', (0.22, 0.02, 0.025), (0, -Dp / 2 - 0.02, z + 0.135), tm, bevel=0.008, ol=0.004, parent=root)
        cz.box(f'{name}_gauge{k}', (0.05, 0.004, 0.014), (0.22, -Dp / 2 - 0.0175, z + 0.135), M('orange', '#e8812f'), bevel=0, ol=0.0, parent=root)
    # body, the output gap with a printed sheet, scanner, feeder
    cz.box(name + '_body', (W, Dp, 0.26), (0, 0, 0.44), bm, bevel=0.012, ol=0.007, parent=root, origin='bottom')
    cz.box(name + '_band', (W + 0.004, Dp - 0.08, 0.035), (0, 0.02, 0.6), tm, bevel=0.004, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_gap', (W - 0.08, Dp - 0.1, 0.09), (0, 0.03, 0.7), dark, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    cz.box(name + '_out', (0.21, 0.3, 0.01), (-0.06, -0.06, 0.705), papr, rot=(0, 0, 6), bevel=0.001, ol=0.002, parent=root, origin='bottom')
    for s in (-1, 1):
        cz.box(f'{name}_post{s}', (0.04, Dp - 0.1, 0.09), (s * (W / 2 - 0.02), 0.03, 0.7), bm, bevel=0.004, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_scan', (W, Dp, 0.07), (0, 0, 0.79), bm, bevel=0.01, ol=0.007, parent=root, origin='bottom')
    cz.box(name + '_adf', (0.5, 0.44, 0.07), (0.0, 0.05, 0.86), tm, bevel=0.012, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_adftray', (0.42, 0.3, 0.012), (0.0, 0.05, 0.93), bm, rot=(-6, 0, 0), bevel=0.004, ol=0.004, parent=root, origin='bottom')
    for k in range(3):
        cz.box(f'{name}_orig{k}', (0.21, 0.28, 0.006), (0.0, 0.05, 0.945 + k * 0.006), papr, rot=(-6, 0, 3 * k - 3), bevel=0, ol=0.002, parent=root, origin='bottom')
    # touch panel on a short arm, front right
    pv = cz.empty(name + '_panel', (0.12, -Dp / 2 - 0.05, 0.84), parent=root)
    pv.rotation_euler.x = -0.55          # the screen tilts up toward a standing user
    cz.box(name + '_panelbox', (0.34, 0.035, 0.2), (0, 0, 0), tm, bevel=0.008, ol=0.005, parent=pv)
    cz.plane(name + '_screen', 0.28, 0.154, (0, -0.0185, 0.006), cz.screen('off_copier_screenm', os.path.join(TEX, 'off_copier_panel.png'), 1.3), parent=pv)
    cz.box(name + '_arm', (0.08, 0.08, 0.04), (0.12, -Dp / 2 - 0.01, 0.8), tm, bevel=0.006, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_led', (0.016, 0.004, 0.01), (-0.24, -Dp / 2 - 0.002, 0.74), cz.glow('off_led_green', '#6dff8a', 3.0), bevel=0, ol=0, parent=root)
    # bypass tray folded out on the right side
    cz.box(name + '_bypass', (0.14, 0.34, 0.012), (W / 2 + 0.065, 0.0, 0.52), bm, rot=(0, -12, 0), bevel=0.004, ol=0.004, parent=root, origin='bottom')
    if paper:
        card = M('card', '#c9a06a', tex='grain', tex_strength=0.05)
        bx = W / 2 + 0.28
        cz.box(name + '_pbox', (0.42, 0.3, 0.27), (bx, -0.08, 0), card, rot=(0, 0, -4), bevel=0.008, ol=0.006, parent=root, origin='bottom')
        cz.box(name + '_pboxlbl', (0.2, 0.004, 0.1), (bx, -0.232, 0.15), M('label', '#f2efe6', tex='paper'), rot=(0, 0, -4), bevel=0, ol=0.002, parent=root)
        wrap = M('ream', '#4f8fc9', tex='paper', tex_strength=0.03)
        for k in range(2):
            cz.box(f'{name}_ream{k}', (0.3, 0.21, 0.05), (bx - 0.02 + 0.02 * k, -0.08, 0.27 + 0.05 * k), wrap, rot=(0, 0, -4 + 9 * k), bevel=0.006, ol=0.004, parent=root, origin='bottom')
    return root
