# Waiting-room fish tank on a dark teal cabinet stand: black hood + trim, glowing blue water, pink gravel with flecks,
# seaweed, a castle, bubbles, a round yellow pufferfish (pivot <name>_fish, swims about Z), a PLEASE DON'T TAP THE GLASS
# sign taped on the front glass. Floor prop, faces -Y.
import math, os

META = {'size': (0.66, 0.44, 1.32), 'anchor': 'floor centre; glass front faces -Y', 'animate': ['_fish'],
        'params': 'water=hex, stand=hex'}


def build(cz, name='lo_fish_tank', water='#3f9ff0', stand='#0f3a3e'):
    root = cz.empty(name)
    tex = os.path.join(cz.LAB, 'film', 'lottery', 'tex')
    sm = cz.toon(name + '_stand', stand, tex='grain', tex_strength=0.05)
    bk = cz.toon(name + '_black', '#1c1d22', tex='grain', tex_strength=0.03)
    W, D, H0, HT = 0.64, 0.42, 0.78, 0.46
    cz.box(name + '_cab', (W, D, H0 - 0.04), (0, 0, (H0 - 0.04) / 2 + 0.04), sm, bevel=0.012, ol=0.008, parent=root)
    cz.box(name + '_plinth', (W - 0.02, D - 0.02, 0.05), (0, 0, 0.025), bk, bevel=0.006, ol=0.005, parent=root)
    cz.box(name + '_door', (W - 0.1, 0.012, H0 - 0.22), (0, -D / 2 - 0.004, H0 / 2 + 0.02), cz.toon(name + '_doorm', '#0f4547'), bevel=0.008, ol=0.005, parent=root)
    cz.box(name + '_trim', (W - 0.04, 0.012, 0.025), (0, -D / 2 - 0.005, 0.12), cz.toon(name + '_gold', '#c99a2e'), bevel=0.004, ol=0.003, parent=root)
    cz.box(name + '_top', (W + 0.02, D + 0.02, 0.04), (0, 0, H0 - 0.02), bk, bevel=0.008, ol=0.006, parent=root)
    # glass box: water glows a little, edges in black trim
    z0 = H0
    # the water: glowing back + side panels and a surface line (a solid water box hid the fish and the weed inside)
    # (a critic read the pale back panel + big pink gravel as a TV picture: the water is a glowing saturated blue
    # volume now, darker toward the bottom, a thin gravel bed, a translucent blue front pane)
    wm = cz.toon(name + '_waterm', '#2f8cf0', emit=0.9)
    wd = cz.toon(name + '_waterdk', '#1d5fc0', emit=0.7)
    cz.box(name + '_water', (W - 0.04, 0.012, HT - 0.06), (0, D / 2 - 0.03, z0 + (HT - 0.06) / 2 + 0.01), wm, bevel=0.0, ol=0.0, parent=root)
    cz.box(name + '_waterlow', (W - 0.04, 0.014, (HT - 0.06) * 0.45), (0, D / 2 - 0.038, z0 + 0.01 + (HT - 0.06) * 0.225), wd, bevel=0.0, ol=0.0, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_waters{sx}', (0.012, D - 0.06, HT - 0.06), (sx * (W / 2 - 0.03), 0, z0 + (HT - 0.06) / 2 + 0.01), wm, bevel=0.0, ol=0.0, parent=root)
    cz.box(name + '_watertop', (W - 0.05, D - 0.05, 0.006), (0, 0, z0 + HT - 0.06), cz.toon(name + '_surfm', '#8fd2ff', emit=0.6), bevel=0, ol=0, parent=root)
    cz.box(name + '_gravel', (W - 0.045, D - 0.045, 0.035), (0, 0, z0 + 0.0275), cz.toon(name + '_gravelm', '#8a6ab8', pattern=('speckle', 1.6, '#e8c86a')), bevel=0.0, ol=0.0, parent=root)
    try:
        import sys, importlib
        so = sys.modules.get('sets_office')
        if so is not None:
            cz.plane(name + '_front', W - 0.04, HT - 0.06, (0, -D / 2 + 0.012, z0 + (HT - 0.06) / 2 + 0.01), so.glass(name + '_frontm', '#3a9cff', 0.28, strength=0.9), rot=(90, 0, 0), parent=root)
    except Exception as e: print('CZ tank front', e)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cz.box(f'{name}_edge{sx}{sy}', (0.02, 0.02, HT), (sx * (W / 2 - 0.01), sy * (D / 2 - 0.01), z0 + HT / 2), bk, bevel=0.003, ol=0.004, parent=root)
    cz.box(name + '_hood', (W + 0.02, D + 0.02, 0.09), (0, 0, z0 + HT + 0.045), bk, bevel=0.012, ol=0.007, parent=root)
    cz.box(name + '_hoodlid', (W * 0.5, D * 0.5, 0.012), (0.0, 0.04, z0 + HT + 0.096), cz.toon(name + '_lidm', '#2c2e36'), bevel=0.004, ol=0.003, parent=root)
    cz.box(name + '_lamp', (W - 0.1, 0.03, 0.01), (0, -0.05, z0 + HT - 0.005), cz.glow(name + '_lampm', '#dff4ff', 3.0), bevel=0, ol=0, parent=root)
    # seaweed: tall pointed leaves
    gm = cz.toon(name + '_weed', '#2fae5c')
    for i, (x, y, h, a) in enumerate(((-0.1, 0.06, 0.3, 8), (-0.06, 0.08, 0.36, -6), (-0.13, 0.03, 0.24, 18), (0.2, 0.1, 0.22, -10), (0.17, 0.12, 0.28, 6))):
        cz.cyl(f'{name}_weed{i}', 0.018, h, (x, y, z0 + 0.07), gm, rot=(0, a, 0), r2=0.002, ol=0.003, parent=root, verts=8)
    cz.box(name + '_castle', (0.1, 0.08, 0.12), (0.1, 0.08, z0 + 0.13), cz.toon(name + '_castlem', '#b9a9c9', tex='grain'), bevel=0.006, ol=0.004, parent=root)
    cz.box(name + '_castle2', (0.05, 0.05, 0.08), (0.1, 0.08, z0 + 0.22), cz.toon(name + '_castlem', '#b9a9c9'), bevel=0.004, ol=0.004, parent=root)
    pv = cz.empty(name + '_fish', (-0.02, -0.02, z0 + 0.25), parent=root)
    fm = cz.toon(name + '_fishm', '#f2d24a', tex='grain')
    cz.sphere(name + '_puffer', 0.055, (0, 0, 0), fm, ol=0.004, parent=pv, segs=24, rings=12)
    for i in range(10):
        a = i * math.tau / 10
        cz.cyl(f'{name}_spine{i}', 0.006, 0.02, (math.cos(a) * 0.05, 0, math.sin(a) * 0.05), fm, rot=(0, 90 - math.degrees(a), 0), r2=0.0, ol=0.0, parent=pv, verts=6)
    for sx in (-1, 1):
        cz.sphere(f'{name}_feye{sx}', 0.014, (sx * 0.024, -0.045, 0.012), cz.toon('lo_white', '#f6f4ee'), ol=0.002, parent=pv, segs=12, rings=6)
        cz.sphere(f'{name}_fpup{sx}', 0.007, (sx * 0.024, -0.056, 0.012), cz.toon('lo_black', '#1a1612'), ol=0, parent=pv, segs=10, rings=6)
    cz.box(name + '_ftail', (0.012, 0.04, 0.05), (0, 0.06, 0), cz.toon(name + '_ftailm', '#e8a832'), bevel=0.004, ol=0.003, parent=pv)
    bm = cz.toon(name + '_bub', '#e6f6ff', emit=0.4)
    for i, (x, z, r) in enumerate(((0.22, 0.2, 0.012), (0.23, 0.27, 0.009), (0.21, 0.33, 0.014), (0.24, 0.38, 0.008))):
        cz.sphere(f'{name}_bub{i}', r, (x, -0.05, z0 + z), bm, ol=0.0015, parent=root, segs=12, rings=6)
    sg = os.path.join(tex, 'lo_dont_tap.png')
    if os.path.exists(sg):
        cz.plane(name + '_sign', 0.2, 0.069, (0.06, -D / 2 - 0.012, z0 + 0.12), cz.toon(name + '_signm', img=sg, lift=0.78), rot=(90, 0, 0), parent=root)
    return root
