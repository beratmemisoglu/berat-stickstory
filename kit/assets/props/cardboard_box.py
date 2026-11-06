# Cardboard box: a kraft moving / office box with real walls (hollow), four hinged flaps, packing tape, a marker
# scrawl "私物" (personal belongings) on the front, hand-hold slots and this-way-up arrows on the sides.
# open=0 closed and taped .. 1 flaps up and splayed (the tape is cut along the seam: each long flap keeps half).
# items=True (only shown when open >= 0.5): what you pack when you clear your desk: a red desk-lamp head on its arm,
# papers + a blue file folder against the back wall, a little snake plant in a pot on a stack of books.
# Pivots: <name>_flapF / _flapB rotate about X (front: +, back: -), <name>_flapL / _flapR about Y (left: -, right: +),
# all at the fold line; 0 = closed. Floor prop: root at the floor centre, the front (marker) faces -Y.
import math
from mathutils import Vector

META = {'size': (0.45, 0.33, 0.28), 'anchor': 'floor centre, front -Y',
        'animate': ['_flapF', '_flapB', '_flapL', '_flapR'],
        'params': 'open=0..1 (or True/False), items=True (contents, shown when open >= 0.5), marker=True'}

W, D, H = 0.45, 0.33, 0.28
T, FT = 0.008, 0.006            # wall / flap thickness
TEX = 'assets/props/tex/'
# open angles (deg), a little uneven on purpose; the front flap flops furthest so the contents show from the front
OPEN = {'F': 146, 'B': 112, 'L': 116, 'R': 126}


def _segment(cz, nm, a, b, r, mat, parent, ol):
    """A capsule whose two ball centres sit on points a and b."""
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.capsule(nm, r, d.length + 2 * r, tuple(a - d.normalized() * r), mat, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def _blade(o, L, w, th):
    """Sphere (radius L/2, long axis X) -> a pointed blade leaf (mesh edit, keeps the outline even)."""
    h = L / 2
    for v in o.data.vertices:
        x, y, z = v.co; t = x / h
        yy = y / h * w / 2 * (1 - 0.7 * max(0.0, t) ** 1.3)
        v.co = (x, yy, z / h * th + abs(yy) * 0.3)
    o.data.update()


def build(cz, name='cardboard_box', open=False, items=True, marker=True):
    k = 1.0 if open is True else 0.0 if open is False else cz.clamp(float(open))
    root = cz.empty(name)
    card = cz.toon(name + '_card', '#c8955a', tex='paper', tex_scale=0.6, tex_strength=0.06)
    tape = cz.toon(name + '_tape', '#e2c486', 0.7)
    # ---- walls: front/back run the full width and stand FT higher (the long flaps rest on them), sides between
    cz.box(name + '_bottom', (W - 2 * T + 0.002, D - 2 * T + 0.002, T), (0, 0, 0), card, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    for s, nm in ((-1, 'front'), (1, 'back')):
        cz.box(f'{name}_{nm}', (W, T, H + FT), (0, s * (D / 2 - T / 2), 0), card, bevel=0.002, ol=0.006, parent=root, origin='bottom')
    for s, nm in ((-1, 'left'), (1, 'right')):
        cz.box(f'{name}_{nm}', (T, D - 2 * T + 0.002, H), (s * (W / 2 - T / 2), 0, 0), card, bevel=0.002, ol=0.006, parent=root, origin='bottom')

    # ---- flaps on their fold lines
    def flap(tag, hinge, size, center, axis, sign, ol=0.005):
        pv = cz.empty(f'{name}_flap{tag}', hinge, parent=root)
        ang = math.radians(OPEN[tag] * k) * sign
        pv.rotation_euler = (ang, 0, 0) if axis == 'X' else (0, ang, 0)
        cz.box(f'{name}_flap{tag}_m', size, center, card, bevel=0.002, ol=ol, parent=pv)
        return pv
    lol = 0.005
    fl = D / 2 - 0.002
    pF = flap('F', (0, -D / 2, H + FT), (W - 0.003, fl, FT), (0, fl / 2, FT / 2), 'X', 1, lol)
    pB = flap('B', (0, D / 2, H + FT), (W - 0.003, fl, FT), (0, -fl / 2, FT / 2), 'X', -1, lol)
    sl = D - 2 * T - 0.004
    flap('L', (-W / 2, 0, H), (fl, sl, FT), (fl / 2, 0, FT / 2), 'Y', -1)
    flap('R', (W / 2, 0, H), (fl, sl, FT), (-fl / 2, 0, FT / 2), 'Y', 1)
    # ---- packing tape: half of the strip on each long flap's free edge (meets in the middle when closed), wrapping
    # down the left / right walls
    # each half runs 2 mm past its flap's edge so the halves butt exactly on the seam (no dark gap, no overlap).
    # Closed, the halves are 5.6 mm thick: a flap's ink hull stands 5 mm proud of its free edge and would poke up
    # through a thin tape as a dark line along the seam (inverted-hull contact line); open, they are thin.
    tt = 0.0056 if k < 0.05 else 0.0012
    for pv, sgn in ((pF, 1), (pB, -1)):
        cz.box(f'{pv.name}_tape', (W + 0.006, 0.026, tt), (0, sgn * (D / 2 - 0.013), FT + 0.0001 + tt / 2), tape, bevel=0, ol=0.0, parent=pv)
    ztop = H + 2 * FT + tt + 0.0001 if k < 0.05 else H
    for s, nm in ((-1, 'L'), (1, 'R')):
        zb = H - 0.075
        cz.box(f'{name}_tape{nm}', (0.0012, 0.052, ztop - zb), (s * (W / 2 + 0.0007), 0, zb), tape, bevel=0, ol=0.0, parent=root, origin='bottom')

    # ---- prints (cards 1.5 mm off the walls; alpha cut-outs)
    if marker:
        cz.plane(name + '_marker', 0.17, 0.0956, (-0.07, -D / 2 - 0.0015, 0.122), cz.toon(name + '_markerm', img=TEX + 'cardboard_box_marker.png', lift=0.6, alpha_clip=True), parent=root)
    hole = cz.toon(name + '_holem', img=TEX + 'cardboard_box_hole.png', lift=0.6, alpha_clip=True)
    arrows = cz.toon(name + '_arrowsm', img=TEX + 'cardboard_box_arrows.png', lift=0.6, alpha_clip=True)
    for s, nm in ((-1, 'L'), (1, 'R')):
        cz.plane(f'{name}_hole{nm}', 0.096, 0.032, (s * (W / 2 + 0.0015), 0, H - 0.075 - 0.03), hole, rot=(90, 0, -s * 90), parent=root)
        cz.plane(f'{name}_arrows{nm}', 0.055, 0.055, (s * (W / 2 + 0.0015), s * 0.1, 0.07), arrows, rot=(90, 0, -s * 90), parent=root)

    # ---- contents
    if items and k >= 0.5:
        paper = cz.toon(name + '_paper', '#f2efe6', tex='paper', tex_strength=0.05)
        # file folder + two loose sheets leaning on the back wall
        cz.box(name + '_folder', (0.22, 0.008, 0.31), (-0.05, D / 2 - T - 0.035, 0.03), cz.toon(name + '_folderm', '#4f78c0', tex='grain', tex_strength=0.04),
               rot=(-7, 0, 3), bevel=0.003, ol=0.004, parent=root, origin='bottom')
        for i, (x, rz, tilt, c) in enumerate(((-0.03, -6, -4, '#f2efe6'), (-0.085, 7, -2, '#e9e1c8'))):
            cz.box(f'{name}_sheet{i}', (0.2, 0.003, 0.29), (x, D / 2 - T - 0.06 - 0.012 * i, 0.045 + 0.01 * i),
                   cz.toon(f'{name}_sheet_{c[1:]}', c, tex='paper', tex_strength=0.05), rot=(tilt - 6, 0, rz), bevel=0.0008, ol=0.003, parent=root, origin='bottom')
        # stack of books (filler) with the little potted snake plant on top
        for i, (c, h, rz, dx) in enumerate((('#7a4a8c', 0.055, 4, 0.0), ('#3e8a6b', 0.06, -6, 0.006), ('#d9a441', 0.05, 9, -0.004))):
            z0 = 0.008 + sum((0.055, 0.06, 0.05)[:i])
            cz.box(f'{name}_book{i}', (0.15, 0.115, h), (-0.12 + dx, -0.055, z0), cz.toon(f'{name}_book_{c[1:]}', c, tex='grain', tex_strength=0.04),
                   rot=(0, 0, rz), bevel=0.004, ol=0.004, parent=root, origin='bottom')
        pz = 0.008 + 0.165
        potm = cz.toon(name + '_potm', '#f2efe6', tex='grain', tex_strength=0.04)
        cz.cyl(name + '_pot', 0.036, 0.075, (-0.12, -0.055, pz), potm, r2=0.044, bevel=0.003, ol=0.004, parent=root)
        cz.cyl(name + '_potsoil', 0.039, 0.006, (-0.12, -0.055, pz + 0.071), cz.toon(name + '_soilm', '#4a3426', tex='grain', tex_strength=0.1), ol=0.0, parent=root)
        for i, (yaw, el, L, c) in enumerate(((20, 80, 0.17, '#3f8a4a'), (140, 74, 0.14, '#4c9a52'), (250, 78, 0.16, '#367f45'), (300, 70, 0.12, '#4c9a52'), (80, 72, 0.13, '#3f8a4a'))):
            pv = cz.empty(f'{name}_blade{i}', (-0.12, -0.055, pz + 0.072), parent=root)
            pv.rotation_euler = (math.radians(10 * (i % 2 * 2 - 1)), math.radians(-el), math.radians(yaw))
            b = cz.sphere(f'{name}_blade{i}_m', L / 2, (L / 2 - 0.004, 0, 0), cz.toon(f'{name}_blade_{c[1:]}', c, tex='grain', tex_strength=0.05), ol=0.0035, parent=pv, segs=20, rings=10)
            _blade(b, L, 0.032, 0.005)
        # desk lamp: arm from the box floor, a knuckle, the cone shade pointing out front-left with its bulb
        lamp = cz.toon(name + '_lampm', '#cf4b3c', tex='grain', tex_strength=0.04)
        metal = cz.toon(name + '_lampmetal', '#5b5e66', 0.7)
        knob = Vector((0.11, 0.02, 0.385))
        _segment(cz, name + '_lamparm', (0.15, 0.06, 0.03), tuple(knob), 0.011, metal, root, 0.004)
        cz.sphere(name + '_lampknob', 0.02, tuple(knob), lamp, ol=0.004, parent=root, segs=20, rings=12)
        d = Vector((-0.45, -0.8, -0.4)).normalized()     # where the shade's mouth points
        hgt = 0.095
        sh = cz.cyl(name + '_shade', 0.064, hgt, tuple(knob + d * (hgt + 0.012)), lamp, r2=0.026, bevel=0.003, ol=0.005, parent=root, verts=32)
        sh.rotation_euler = Vector((0, 0, 1)).rotation_difference(-d).to_euler()
        cz.cyl(name + '_shadein', 0.057, 0.002, (0, 0, -0.0024), cz.toon(name + '_shadeinm', '#5a2a22'), ol=0.0, parent=sh, verts=32)
        cz.sphere(name + '_bulb', 0.027, (0, 0, -0.006), cz.toon(name + '_bulbm', '#f4efd8', tex='grain', tex_strength=0.03), ol=0.003, parent=sh, segs=20, rings=12)
    return root
