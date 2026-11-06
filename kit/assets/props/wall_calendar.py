# Wall calendar: a daily flip calendar hanging on a nail. A red backing board with a printed header card, a thick pad
# of day pages (the stack shows at the bottom and sides), a row of binding rings across the top, and the top page on its
# own hinge so it can flip up over the rings (the next day is printed on the page underneath).
# Wall prop: back at y = 0 (on the wall), centred on z = 0, front toward -Y.
# Pivot <name>_page: the rings' axis at the top of the pad; rotation_euler.x 0 = hanging, -pi = flipped up (its plain
# back then faces the camera, standing above the calendar). kw flip=0..1 sets it.
# kw: day='MONDAY'..'SUNDAY' (a date of the week 19-25 Oct 2026), date=N (any page made by tex/make_wall_calendar.py,
#     overrides day), flip=0..1, board='#c8463c'.
import math, os

META = {'size': (0.27, 0.05, 0.42), 'anchor': 'back centre on the wall', 'animate': ['_page'],
        'params': "day='MONDAY'..'SUNDAY', date=N, flip=0..1, board='#rrggbb'"}

TEX = 'assets/props/tex/'
WEEK = {'MONDAY': 19, 'TUESDAY': 20, 'WEDNESDAY': 21, 'THURSDAY': 22, 'FRIDAY': 23, 'SATURDAY': 24, 'SUNDAY': 25}


def _page_png(cz, date):
    f = f'wall_calendar_{date}.png'
    p = cz.made(os.path.join(cz.LAB, TEX), f, 'make_wall_calendar.py', '--days', f'{date}-{date + 1}')   # (any date: drawn the first time)
    if not p: raise FileNotFoundError(f'{f}: tex/make_wall_calendar.py could not draw it')
    return p


def build(cz, name='wall_calendar', day='FRIDAY', date=None, flip=0.0, board='#c8463c'):
    date = int(date) if date is not None else WEEK[day.upper()]
    BW, BH, BD = 0.27, 0.42, 0.012                 # board
    PW, PH, PD = 0.22, 0.27, 0.028                  # pad
    ztop = 0.085                                    # pad top
    Yb = -BD; Yp = Yb - PD                          # pad back / front faces
    root = cz.empty(name)
    cz.box(name + '_board', (BW, BD, BH), (0, -BD / 2, 0), cz.toon(name + '_boardm', board, tex='paper', tex_scale=0.6, tex_strength=0.05),
           bevel=0.004, ol=0.005, parent=root)
    # header card printed on the board (rounded corners in its alpha)
    hm = cz.toon(name + '_headerm', img=TEX + 'wall_calendar_header.png', alpha_clip=True)
    cz.plane(name + '_header', 0.25, 0.078, (0, Yb - 0.0012, 0.144), hm, parent=root)
    # nail through a metal grommet at the top
    metal = cz.toon(name + '_metal', '#8b929c'); dark = cz.toon(name + '_hole', '#2a2622')
    cz.cyl(name + '_grommet', 0.0072, 0.0016, (0, Yb, 0.196), metal, rot=(90, 0, 0), verts=32, ol=0.0015, parent=root)
    cz.cyl(name + '_holedisc', 0.0045, 0.0008, (0, Yb - 0.0012, 0.196), dark, rot=(90, 0, 0), verts=24, ol=0, parent=root)
    cz.cyl(name + '_nail', 0.0017, 0.026, (0, 0, 0.1975), metal, rot=(90, 0, 0), verts=16, ol=0.001, parent=root)
    cz.cyl(name + '_nailhead', 0.0046, 0.0022, (0, -0.026, 0.1975), metal, rot=(90, 0, 0), verts=24, bevel=0.0008, ol=0.0012, parent=root)
    # pad: three slabs of slightly different paper so the stack reads as many pages
    for k, c in enumerate(('#e9e3d3', '#f1ece0', '#e4ddca')):
        d = PD / 3
        cz.box(f'{name}_pad{k}', (PW - 0.002 * (k == 0), d, PH - 0.002 * (k == 0)), (0, Yb - d * (k + 0.5), ztop - PH / 2),
               cz.toon(f'{name}_padm{k}', c, tex='paper', tex_strength=0.04), bevel=0.0015, ol=0.0018, parent=root)
    # page underneath (the next day), 1.2 mm in front of the pad
    PGW, PGH = 0.214, 0.258
    zr = ztop - 0.004                               # ring axis = page hinge
    cz.plane(name + '_under', PGW, PGH, (0, Yp - 0.0012, zr - PGH / 2), cz.toon(f'{name}_pg{date + 1}', img=_page_png(cz, date + 1), lift=0.7), parent=root)
    # top page on its hinge: a paper card + its printed face 1.5 mm in front (just beyond the card's 1.2 mm outline hull)
    py = Yp - 0.0032
    pv = cz.empty(name + '_page', (0, py, zr), parent=root)
    pv.rotation_euler.x = -math.pi * max(0.0, min(1.0, flip))
    paper = cz.toon(name + '_paper', '#f2ede1', tex='paper', tex_strength=0.04)
    cz.box(name + '_sheet', (PGW, 0.0012, PGH), (0, 0, -PGH / 2), paper, bevel=0, ol=0.0012, parent=pv)
    cz.plane(name + '_print', PGW - 0.001, PGH - 0.001, (0, -0.0006 - 0.0015, -PGH / 2), cz.toon(f'{name}_pg{date}', img=_page_png(cz, date), lift=0.7), parent=pv)
    # binding rings across the top (wire loops seen edge-on: short dark cylinders along X)
    ring = cz.toon(name + '_ring', '#3a3f47')
    n = 11
    for i in range(n):
        x = -0.09 + i * 0.18 / (n - 1)
        cz.cyl(f'{name}_ring{i}', 0.0056, 0.0034, (x - 0.0017, py, zr), ring, rot=(0, 90, 0), verts=24, ol=0.0012, parent=root)
    return root
