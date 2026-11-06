# Corridor water cooler: a grey cabinet with a big blue water bottle upside down on top, hot (red) and cold (blue)
# taps over a drip tray with a slotted grid, a paper-cone cup dispenser on its side and a sticker. Floor prop: root at
# the floor centre, taps toward -Y. 0.32 x 0.32 x 1.36 m.
import math

META = {'size': (0.32, 0.32, 1.36), 'anchor': 'floor centre, taps toward -Y', 'animate': [],
        'params': "water=0..1 (bottle fill), cups=True"}


def build(cz, name='room_water_cooler', water=0.6, cups=True):
    root = cz.empty(name)
    body = cz.toon(name + '_body', '#d8d8d0', tex='grain', tex_strength=0.05)
    dark = cz.toon(name + '_dark', '#3d3c38')
    cz.box(name + '_cab', (0.32, 0.32, 0.95), (0, 0, 0), body, bevel=0.015, ol=0.007, parent=root, origin='bottom')
    cz.box(name + '_top', (0.30, 0.30, 0.03), (0, 0, 0.95), cz.toon(name + '_topm', '#c4c4bc'), bevel=0.006, ol=0.004, parent=root, origin='bottom')
    # recess with the taps and the drip tray
    cz.box(name + '_recess', (0.2, 0.01, 0.26), (0, -0.157, 0.66), dark, bevel=0.004, ol=0.002, parent=root)
    for s, c in ((-1, '#d2483c'), (1, '#3c78c8')):
        cz.box(f'{name}_tap{s}', (0.04, 0.05, 0.035), (s * 0.05, -0.18, 0.76), cz.toon(f'{name}_tapm{s}', c), bevel=0.006, ol=0.003, parent=root)
        cz.cyl(f'{name}_spout{s}', 0.008, 0.03, (s * 0.05, -0.19, 0.715), cz.toon(name + '_spoutm', '#e8e8e2'), verts=12, ol=0.0015, parent=root)
    cz.box(name + '_tray', (0.2, 0.07, 0.025), (0, -0.19, 0.555), cz.toon(name + '_traym', '#9a9a94'), bevel=0.004, ol=0.003, parent=root)
    for k in range(5):
        cz.box(f'{name}_grid{k}', (0.17, 0.005, 0.002), (0, -0.215 + k * 0.012, 0.5685), dark, bevel=0, ol=0, parent=root)
    cz.box(name + '_vent', (0.22, 0.004, 0.12), (0, -0.162, 0.18), dark, bevel=0.002, ol=0, parent=root)
    for k in range(5):
        cz.box(f'{name}_slat{k}', (0.21, 0.004, 0.008), (0, -0.1645, 0.135 + k * 0.022), body, bevel=0, ol=0, parent=root)
    # the bottle: neck into the top, wide body, a lighter water level band
    blue = cz.toon(name + '_bottle', '#5f9fd6', emit=0.12)
    cz.cyl(name + '_neck', 0.04, 0.06, (0, 0, 0.98), blue, verts=24, ol=0.003, parent=root)
    cz.cyl(name + '_shoulder', 0.04, 0.05, (0, 0, 1.03), blue, verts=32, r2=0.125, ol=0, parent=root)
    cz.cyl(name + '_bot', 0.125, 0.26, (0, 0, 1.08), blue, verts=40, bevel=0.03, ol=0.006, parent=root)
    cz.cyl(name + '_air', 0.1265, (1 - cz.clamp(water)) * 0.24, (0, 0, 1.33 - (1 - cz.clamp(water)) * 0.24), cz.toon(name + '_airm', '#a9cdec', emit=0.08), verts=40, ol=0, parent=root)
    for z in (1.14, 1.24):
        cz.cyl(f'{name}_rib{z}', 0.127, 0.008, (0, 0, z), cz.toon(name + '_ribm', '#4d8cc4'), verts=40, ol=0, parent=root)
    cz.sphere(name + '_shine', 0.018, (-0.07, -0.098, 1.25), cz.toon(name + '_shinem', '#e8f4ff', emit=0.4), scale=(0.6, 0.2, 2.4), ol=0, parent=root)
    if cups:   # paper cone dispenser on the right side (+X)
        cz.cyl(name + '_tube', 0.035, 0.28, (0.2, 0.0, 0.55), cz.toon(name + '_tubem', '#e6e6e0'), verts=24, ol=0.004, parent=root)
        cz.cyl(name + '_cone', 0.003, 0.05, (0.2, 0.0, 0.5), cz.toon(name + '_conem', '#f2eee2'), verts=20, r2=0.03, ol=0.002, parent=root)
        cz.box(name + '_bracket', (0.05, 0.03, 0.04), (0.175, 0.0, 0.7), body, bevel=0.003, ol=0.003, parent=root)
    cz.box(name + '_sticker', (0.07, 0.002, 0.05), (0.06, -0.1615, 0.88), cz.toon(name + '_stick', '#f0c840'), bevel=0, ol=0.0012, parent=root)
    return root
