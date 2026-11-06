# Cash register (LOTTERY counter): a beige drawer base with a dark drawer seam and a key lock, a beige body with a
# chunky keypad toward the clerk (+Y), a green customer display box on a stalk toward the customer (-Y, picture
# film/lottery/tex/st_register_disp.png), a receipt slot with a curl of paper. Root = base centre on the counter (z=0).
import os

META = {'size': (0.46, 0.42, 0.3), 'anchor': 'base centre on the counter top; customer display faces -Y, keys +Y',
        'animate': ['_drawer (location.y: slides out toward +Y)'], 'params': 'drawer=0.0 (0..0.2 m open)'}
TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'film', 'lottery', 'tex')


def build(cz, name='lt_register', drawer=0.0):
    root = cz.empty(name)
    beige = cz.toon(name + '_beige', '#b8a47c', tex='grain', tex_strength=0.05)
    beige2 = cz.toon(name + '_beige2', '#a38e66', tex='grain', tex_strength=0.05)
    dark = cz.toon(name + '_dark', '#2c2a28')
    cz.box(name + '_base', (0.46, 0.42, 0.1), (0, 0, 0.05), beige, bevel=0.012, ol=0.007, parent=root)
    dr = cz.empty(name + '_drawer', (0, drawer, 0), parent=root)
    cz.box(name + '_drawerfront', (0.42, 0.012, 0.07), (0, 0.212, 0.05), beige2, bevel=0.006, ol=0.004, parent=dr)
    cz.box(name + '_handle', (0.12, 0.012, 0.014), (0, 0.222, 0.06), dark, bevel=0.004, ol=0.002, parent=dr)
    cz.box(name + '_body', (0.42, 0.3, 0.1), (0, -0.02, 0.15), beige, rot=(-8, 0, 0), bevel=0.014, ol=0.007, parent=root)
    # keypad toward the clerk
    km = cz.toon(name + '_keym', '#f0e8d4'); kr = cz.toon(name + '_keyred', '#d8483a'); kg = cz.toon(name + '_keygrn', '#4caa5c')
    for i in range(4):
        for j in range(5):
            m = kr if (i, j) == (3, 4) else kg if (i, j) == (0, 4) else km
            cz.box(f'{name}_k{i}_{j}', (0.05, 0.034, 0.016), (-0.12 + j * 0.06, 0.08 - i * 0.042 + 0.0, 0.205 + i * 0.006), m, rot=(-8, 0, 0), bevel=0.005, ol=0.0025, parent=root)
    # customer display on a stalk
    cz.cyl(name + '_stalk', 0.016, 0.07, (0.12, -0.12, 0.19), dark, ol=0.003, parent=root, verts=12)
    cz.box(name + '_disp', (0.17, 0.07, 0.075), (0.12, -0.12, 0.29), dark, bevel=0.01, ol=0.005, parent=root)
    cz.plane(name + '_dispscr', 0.13, 0.05, (0.12, -0.1565, 0.29), cz.screen(name + '_dispm', os.path.join(TEX, 'st_register_disp.png'), 1.1), rot=(90, 0, 0), parent=root)
    cz.plane(name + '_dispscr2', 0.13, 0.05, (0.12, -0.0835, 0.29), cz.screen(name + '_dispm', os.path.join(TEX, 'st_register_disp.png'), 1.1), rot=(90, 0, 180), parent=root)
    # receipt slot + paper curl
    cz.box(name + '_slot', (0.1, 0.02, 0.012), (-0.13, -0.12, 0.215), dark, bevel=0.003, ol=0.0, parent=root)
    cz.box(name + '_receipt', (0.075, 0.004, 0.08), (-0.13, -0.125, 0.25), cz.toon('lt_receipt', '#f4f1e8', tex='paper'), rot=(-12, 0, 0), bevel=0.001, ol=0.002, parent=root)
    cz.cyl(name + '_lock', 0.012, 0.01, (0.17, 0.212, 0.075), cz.toon('lt_brass', '#c8a040'), rot=(90, 0, 0), ol=0.002, parent=root, verts=12)
    return root
