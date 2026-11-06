# Fire extinguisher on its floor stand (the red Japanese ABC type): red cylinder with a domed top, black valve head,
# carry handle + lever, pressure gauge, a black hose curving down to the nozzle clipped to the side, a yellow
# instruction band; the stand is a black box tray. Floor prop: root at the floor centre, gauge / band toward -Y.
META = {'size': (0.24, 0.22, 0.6), 'anchor': 'floor centre, front -Y', 'animate': [], 'params': 'none'}


def build(cz, name='off_extinguisher'):
    root = cz.empty(name)
    red = cz.toon('off_ext_red', '#d0302a', tex='grain', tex_strength=0.04)
    blk = cz.toon('off_ext_black', '#2a2622')
    cz.box(name + '_stand', (0.24, 0.22, 0.05), (0, 0, 0), blk, bevel=0.008, ol=0.005, parent=root, origin='bottom')
    cz.cyl(name + '_body', 0.075, 0.38, (0, 0, 0.04), red, verts=32, bevel=0.02, ol=0.006, parent=root)
    cz.sphere(name + '_dome', 0.074, (0, 0, 0.42), red, scale=(1, 1, 0.5), ol=0.005, parent=root, segs=32, rings=12)
    cz.cyl(name + '_band', 0.0765, 0.08, (0, 0, 0.2), cz.toon('off_ext_band', '#f2c230'), verts=32, ol=0.0, parent=root)
    cz.cyl(name + '_valve', 0.03, 0.06, (0, 0, 0.45), blk, verts=16, ol=0.004, parent=root)
    cz.box(name + '_handle', (0.13, 0.03, 0.018), (0.03, 0, 0.5), blk, rot=(0, -8, 0), bevel=0.006, ol=0.004, parent=root)
    cz.box(name + '_lever', (0.12, 0.028, 0.016), (0.03, 0, 0.535), blk, rot=(0, -18, 0), bevel=0.006, ol=0.004, parent=root)
    cz.cyl(name + '_gauge', 0.02, 0.012, (0, -0.032, 0.47), cz.toon('off_ext_gauge', '#f2efe6'), rot=(90, 0, 0), verts=20, ol=0.003, parent=root)
    a = cz.empty(name + '_hose_a', (-0.03, 0, 0.47), parent=root)
    b = cz.empty(name + '_hose_b', (-0.16, -0.02, 0.36), parent=root)
    c = cz.empty(name + '_hose_c', (-0.085, -0.03, 0.15), parent=root)
    h = cz.limb(name + '_hose', a, b, c, 0.011, blk, root)
    cz.outline(h, 0.003)
    cz.cyl(name + '_nozzle', 0.014, 0.06, (-0.085, -0.03, 0.09), blk, verts=12, ol=0.003, parent=root)
    return root
