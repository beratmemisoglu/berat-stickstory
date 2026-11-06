# Desk partition: low cubicle divider, fabric panel recessed in a light frame (end posts, rounded top cap, dark base
# rail), small stabiliser feet, a few screws. papers=True pins a goal chart, a month calendar, a memo with a hanko
# stamp, a cat polaroid and two sticky notes on the -Y face, all above desk height (0.78-1.07 m) so they show over a
# desk standing in front. Floor prop: root at the floor centre, the panel in the XZ plane at y = 0, front faces -Y.
import math, os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (1.4, 0.24, 1.15),
        'anchor': 'floor centre; panel centred on y = 0 (6 cm deep frame), feet reach y = +-0.12; papers on the -Y face',
        'animate': [],
        'params': "papers=True|False, feet=True|False (False: stands on its base rail, e.g. flush behind a desk), "
                  "color='#8a93a0' (fabric), frame='#aab0b6', width=1.4, height=1.15"}

POST, PT, FT, CAP, BASE = 0.045, 0.06, 0.044, 0.045, 0.07   # post width, frame depth, fabric depth, cap height, base rail


def build(cz, name='desk_partition', papers=True, feet=True, color='#8a93a0', frame='#aab0b6', width=1.4, height=1.15):
    root = cz.empty(name)

    def M(key, c, **k):
        return cz.toon(f'desk_partition_{key}_{c.lstrip("#")}', c, **k)

    W, Hh = width, height
    fab = M('fabric', color, tex='paper', tex_scale=0.4, tex_strength=0.06)
    frm = M('frame', frame, tex='grain', tex_strength=0.03)
    base = M('base', '#5b5f66', tex='grain', tex_strength=0.03)
    screw = M('screw', '#8e939a')
    fh = 0.03 if feet else 0.0
    for s in (-1, 1):
        x = s * (W / 2 - POST / 2)
        if feet:
            cz.box(f'{name}_foot{s}', (0.06, 0.24, fh), (x, 0, 0), base, bevel=0.01, ol=0.006, parent=root, origin='bottom')
        cz.box(f'{name}_post{s}', (POST, PT, Hh - fh - CAP), (x, 0, fh), frm, bevel=0.008, ol=0.007, parent=root, origin='bottom')
        for z in (0.16, Hh - 0.13):
            cz.cyl(f'{name}_screw{s}_{int(z * 100)}', 0.0065, 0.002, (x, -PT / 2, z), screw, rot=(90, 0, 0), verts=16, ol=0, parent=root)
    cz.box(name + '_cap', (W, PT + 0.008, CAP), (0, 0, Hh - CAP), frm, bevel=0.016, ol=0.008, parent=root, origin='bottom')
    inner = W - 2 * POST
    cz.box(name + '_base', (inner, PT - 0.006, BASE), (0, 0, 0), base, bevel=0.006, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_fabric', (inner, FT, Hh - CAP - BASE), (0, 0, BASE), fab, bevel=0.006, ol=0.005, parent=root, origin='bottom')
    if papers: _papers(cz, name, root, W, M)
    return root


def _papers(cz, name, root, W, M):
    fy = -FT / 2 - 0.0015          # 1.5 mm in front of the fabric
    k = W / 1.4
    pins = {'r': '#d6463c', 'y': '#f2c230', 'b': '#3a63c4', 'g': '#4f9a6a'}
    #        picture        w      h      x      z     tilt  pins (offset x, offset z from the paper centre, colour)
    items = (('chart',     0.21, 0.28, -0.44, 0.92, -3.0, ((-0.085, 0.12, 'r'), (0.085, 0.12, 'r'))),
             ('cal',       0.21, 0.28, -0.17, 0.93, 2.5, ((-0.08, 0.12, 'b'), (0.08, 0.12, 'b'))),
             ('memo',      0.21, 0.28, 0.13, 0.915, -1.5, ((0, 0.115, 'g'),)),
             ('photo',     0.12, 0.144, 0.36, 0.975, 6.0, ((0, 0.052, 'y'),)),
             ('note_yellow', 0.08, 0.08, 0.5, 1.0, -5.0, ()),
             ('note_pink', 0.08, 0.08, 0.52, 0.875, 4.0, ()))
    for key, w, h, x, z, tilt, pp in items:
        x *= k
        mat = cz.toon(f'desk_partition_{key}m', img=os.path.join(TEX, f'desk_partition_{key}.png'), tex='paper', tex_strength=0.03)
        cz.plane(f'{name}_{key}', w, h, (x, fy, z), mat, rot=(90, tilt, 0), parent=root)
        t = math.radians(tilt)
        for i, (ox, oz, c) in enumerate(pp):
            px, pz = x + ox * math.cos(t) + oz * math.sin(t), z - ox * math.sin(t) + oz * math.cos(t)
            cz.cyl(f'{name}_{key}_pin{i}', 0.0025, 0.016, (px, -FT / 2, pz), M('needle', '#c9cdd2'), rot=(90, 0, 0), verts=8, ol=0, parent=root)
            cz.sphere(f'{name}_{key}_pinhead{i}', 0.011, (px, -FT / 2 - 0.019, pz), M('pin_' + c, pins[c]), ol=0.003, parent=root, segs=20, rings=10)
