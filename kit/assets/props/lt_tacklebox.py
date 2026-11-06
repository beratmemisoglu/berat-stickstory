# Teal tackle box (LOTTERY L18: the undercover agent carries it into the shop): a chunky teal plastic box with a lighter
# lid, two orange latches, a dark carry handle on top, a little brand sticker. Held prop: root = the handle grip (where
# the ball hand holds it); the box hangs below it (-Z), long side along X, front (latches) toward -Y.
META = {'size': (0.34, 0.19, 0.24), 'anchor': 'handle grip (top); box hangs below, latches toward -Y', 'animate': [],
        'params': "color='#22886a' (green-teal, the reference's box)"}


def build(cz, name='lt_tacklebox', color='#22886a'):
    root = cz.empty(name)
    body = cz.toon(name + '_bodym', color, tex='grain', tex_strength=0.05)
    lid = cz.toon(name + '_lidm', '#2aa7a0', tex='grain', tex_strength=0.05)
    dark = cz.toon(name + '_darkm', '#163c3c')
    org = cz.toon(name + '_latchm', '#e0782a')
    cz.box(name + '_box', (0.34, 0.19, 0.14), (0, 0, -0.22), body, bevel=0.018, ol=0.006, parent=root)
    cz.box(name + '_lid', (0.35, 0.2, 0.05), (0, 0, -0.125), lid, bevel=0.016, ol=0.006, parent=root)
    cz.box(name + '_seam', (0.352, 0.202, 0.012), (0, 0, -0.152), dark, bevel=0.004, ol=0.0, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_latch{sx}', (0.04, 0.02, 0.05), (sx * 0.1, -0.1, -0.16), org, bevel=0.006, ol=0.003, parent=root)
        cz.box(f'{name}_post{sx}', (0.025, 0.04, 0.07), (sx * 0.075, 0, -0.07), dark, bevel=0.008, ol=0.004, parent=root)
    cz.box(name + '_handle', (0.17, 0.035, 0.03), (0, 0, -0.03), dark, bevel=0.012, ol=0.004, parent=root)
    cz.box(name + '_sticker', (0.12, 0.003, 0.05), (0.02, -0.0965, -0.22), cz.toon(name + '_stickm', '#f2e6c4'), bevel=0.001, ol=0.0015, parent=root)
    cz.box(name + '_stickfish', (0.05, 0.003, 0.02), (0.02, -0.098, -0.22), cz.toon(name + '_fishm', '#2f6fd0'), bevel=0.001, ol=0.0, parent=root)
    return root
