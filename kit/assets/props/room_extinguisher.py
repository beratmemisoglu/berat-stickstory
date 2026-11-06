# Fire extinguisher in its red floor stand, the way Japanese offices keep them by a door: an open-top red stand box
# with a 消火器 label on its front, the red cylinder standing in it (domed top, black valve head, carry handle and
# squeeze lever, yellow safety pin, black hose curling down to a nozzle clipped to the side). Floor prop: root at the
# floor centre, the label toward -Y.

META = {'size': (0.22, 0.2, 0.62), 'anchor': 'floor centre, label toward -Y', 'animate': [], 'params': 'dusty=True'}

TEX = 'assets/props/tex/'


def build(cz, name='room_extinguisher', dusty=True):
    import math
    root = cz.empty(name)
    red = cz.toon(name + '_red', '#cc3a30', tex='grain', tex_strength=0.04)
    stand = cz.toon(name + '_standm', '#b8322a', tex='grain', tex_strength=0.05)
    black = cz.toon(name + '_black', '#2c2a28')
    # stand: base, back, two sides, low front panel with the label
    cz.box(name + '_base', (0.22, 0.2, 0.02), (0, 0, 0), stand, bevel=0.003, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_back', (0.22, 0.012, 0.3), (0, 0.094, 0), stand, bevel=0.003, ol=0.004, parent=root, origin='bottom')
    for s in (-1, 1):
        cz.box(f'{name}_side{s}', (0.012, 0.2, 0.24), (s * 0.104, 0, 0), stand, bevel=0.003, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_front', (0.22, 0.012, 0.2), (0, -0.094, 0), stand, bevel=0.003, ol=0.004, parent=root, origin='bottom')
    cz.plane(name + '_label', 0.12, 0.165, (0, -0.1015, 0.105), cz.toon(name + '_labelm', img=TEX + 'room_ext_label.png', lift=0.62), parent=root)
    # the cylinder
    cz.cyl(name + '_can', 0.07, 0.42, (0, 0.0, 0.02), red, verts=40, bevel=0.01, ol=0.006, parent=root)
    cz.sphere(name + '_dome', 0.07, (0, 0, 0.44), red, scale=(1, 1, 0.45), ol=0.006, parent=root)
    cz.cyl(name + '_neck', 0.022, 0.05, (0, 0, 0.46), black, verts=20, ol=0.003, parent=root)
    cz.box(name + '_head', (0.07, 0.035, 0.04), (0, 0, 0.51), black, bevel=0.006, ol=0.003, parent=root, origin='bottom')
    h = cz.box(name + '_lever', (0.11, 0.025, 0.012), (0.03, 0, 0.575), black, bevel=0.003, ol=0.0025, parent=root)
    h.rotation_euler.y = math.radians(-12)
    cz.box(name + '_handle', (0.1, 0.025, 0.01), (0.025, 0, 0.545), black, bevel=0.003, ol=0.0025, parent=root)
    cz.cyl(name + '_pin', 0.012, 0.006, (-0.03, -0.022, 0.535), cz.toon(name + '_pinm', '#f2c230'), rot=(90, 0, 0), verts=16, ol=0.0015, parent=root)
    # hose: from the head down the left side to a nozzle held by a clip
    cz.cyl(name + '_hose1', 0.009, 0.08, (-0.04, 0, 0.47), black, rot=(0, -40, 0), verts=12, ol=0.002, parent=root)
    cz.cyl(name + '_hose2', 0.009, 0.24, (-0.078, 0, 0.24), black, verts=12, ol=0.002, parent=root)
    cz.cyl(name + '_nozzle', 0.013, 0.06, (-0.078, 0, 0.19), black, verts=12, r2=0.009, ol=0.002, parent=root)
    if dusty:   # a dust film on the valve head's top
        cz.box(name + '_dust', (0.066, 0.031, 0.0012), (0, 0, 0.5506), cz.toon('room_dust', '#cfc8b2', lift=0.7), bevel=0, ol=0, parent=root)
    return root
