# Law book: a thick, heavy hardcover in dark red cloth. Gold "LABOR LAW" title, scales-of-justice emblem and double
# border on the front cover, a rounded spine with four raised gold bands and a black title label, a cream page block
# with page-edge lines, a gold ribbon bookmark draped over the head and three sticky tabs out of the fore edge (someone
# has been studying it). Prints: tex/make_law_book.py (any title with --title "...").
# Floor/desk prop: root at the floor centre. Standing (default): bottom on z = 0, front cover facing -Y, spine at -X.
# lying=True: flat on its back cover, front cover up, top of the book toward +Y.
# The whole book is under the pivot <name>_book (at its centre): animate it to drop / slam / slide the book.
import math

META = {'size': (0.30, 0.08, 0.40), 'anchor': 'floor centre (standing on its bottom edge, or lying flat)', 'animate': ['_book'],
        'params': "lying=False|True, cloth='#7a2228', cover=PNG, spine=PNG"}

TEX = 'assets/props/tex/'


def build(cz, name='law_book', lying=False, cloth='#7a2228', cover=None, spine=None):
    W, T, H = 0.30, 0.08, 0.40       # width (X), thickness (Y), height (Z)
    CT = 0.006                       # board thickness
    root = cz.empty(name)
    bk = cz.empty(name + '_book', (0, 0, T / 2 + 0.0015) if lying else (0, 0, H / 2 + 0.001), parent=root)
    if lying: bk.rotation_euler.x = math.radians(-90)
    red = cz.toon(name + '_cloth', cloth, tex='grain', tex_scale=4.0, tex_strength=0.05)
    gold = cz.toon(name + '_gold', '#e3b74c')
    # covers (spine edge hidden inside the spine), page block inset 6 mm on top, bottom and fore edge
    for s, nm in ((-1, '_front'), (1, '_back')):
        cz.box(name + nm, (W - 0.004, CT, H), (0.002, s * (T / 2 - CT / 2), 0), red, bevel=0.0025, ol=0.005, parent=bk)
    PB = (W - 0.014, T - 2 * CT - 0.001, H - 0.012)
    cz.box(name + '_pages', PB, (0.001, 0, 0), cz.toon(name + '_paper', '#e6d8b4', tex='paper', tex_strength=0.04), bevel=0.0015, ol=0.003, parent=bk)
    pm = cz.toon(name + '_edges', img=TEX + 'law_book_pages.png')
    cz.plane(name + '_foreedge', PB[1] - 0.002, PB[2] - 0.003, (0.001 + PB[0] / 2 + 0.0012, 0, 0), pm, rot=(90, 0, 90), parent=bk)
    cz.plane(name + '_headedge', PB[1] - 0.002, PB[0] - 0.003, (0.001, 0, PB[2] / 2 + 0.0012), pm, rot=(0, 0, 90), parent=bk)
    cz.plane(name + '_tailedge', PB[1] - 0.002, PB[0] - 0.003, (0.001, 0, -PB[2] / 2 - 0.0012), pm, rot=(180, 0, 90), parent=bk)   # seen when lying
    # rounded spine, 1.5 mm proud of the covers (a hinge step, and no coplanar faces), 1 mm longer at head and tail
    sx = -W / 2
    cz.box(name + '_spine', (0.02, T + 0.003, H + 0.002), (sx, 0, 0), red, bevel=0.008, ol=0.005, parent=bk)
    for k, z in enumerate((0.175, 0.128, -0.107, -0.155)):   # raised gold bands
        cz.box(f'{name}_band{k}', (0.004, T - 0.012, 0.009), (sx - 0.01 + 0.0005, 0, z), gold, bevel=0.0012, ol=0.0018, parent=bk)
    cz.plane(name + '_spineprint', 0.07, 0.384, (sx - 0.01 - 0.0012, 0, 0),
             cz.toon(name + '_spinem', img=spine or TEX + 'law_book_spine.png', alpha_clip=True), rot=(90, 0, -90), parent=bk)
    # front cover print (gold on the cloth, alpha clipped), 1.2 mm off the board
    cz.plane(name + '_coverprint', 0.28, 0.388, (0.006, -T / 2 - 0.0012, 0),
             cz.toon(name + '_coverm', img=cover or TEX + 'law_book_cover.png', alpha_clip=True), parent=bk)
    # ribbon bookmark out of the head, over the top of the front board and down the cover
    rib = cz.toon(name + '_ribbon', '#d9a63a'); rx = 0.116
    cz.box(name + '_ribbon_up', (0.011, 0.0012, 0.008), (rx, -T / 2 + CT + 0.003, PB[2] / 2 + 0.003), rib, bevel=0, ol=0.001, parent=bk)
    cz.box(name + '_ribbon_top', (0.011, CT + 0.006, 0.0012), (rx, -T / 2 + CT / 2 - 0.0002, H / 2 + 0.0012), rib, bevel=0, ol=0.001, parent=bk)
    cz.box(name + '_ribbon_down', (0.011, 0.0012, 0.055), (rx, -T / 2 - 0.0028, H / 2 - 0.0275 + 0.0012), rib, bevel=0, ol=0.001, parent=bk)
    # sticky tabs between the pages, sticking out past the fore edge of the covers
    for k, (z, y, c) in enumerate(((0.12, -0.018, '#f2c230'), (0.02, 0.004, '#f08a80'), (-0.09, 0.022, '#5aa8e0'))):
        cz.box(f'{name}_tab{k}', (0.03, 0.0009, 0.024), (W / 2 - 0.006, y, z), cz.toon(f'{name}_tabm{k}', c), bevel=0, ol=0.0009, parent=bk)
    return root
