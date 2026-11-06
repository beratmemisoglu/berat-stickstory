# 3-door glass-front drink cooler (TICKETS): white enamel cabinet, a blue "COLD DRINKS" header (lit when on), black
# aluminium door frames with chrome pull handles, glass with glints, clings ("ICE COLD", "2 FOR $3", "MAX" energy) and
# PULL stickers. Inside: a cool-white glowing back wall printed with the deeper rows of drinks, LED strips, 5 wire
# shelves per door with yellow price strips, and FULL front rows of 3D drinks (2-litres, 20 oz bottles, water, sports
# drinks, iced tea, juice, cans, tall energy cans), a vent grille below and two soda cases stored on top.
# on=True: interior + header glow and an area light inside the glass lights the room in front (light=True).
# Floor prop: root at the floor centre, front -Y; back against the wall at y = +0.4.
# Pivots: <name>_door0..2 at each door's hinge (left edge), rotate about Z (negative = opens toward the camera side, -Y; kw open=1 -> -100 deg).
import math, os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (2.1, 0.8, 2.3), 'anchor': 'floor centre, front -Y (back at y = +0.4 against a wall)',
        'animate': ['_door0', '_door1', '_door2'],
        'params': "on=True (interior + header glow), light=True (area light inside the glass when on, 'power' W), power=90, "
                  "open=(0, 0, 0) (per door 0..1 -> 0..100 deg about its hinge), cases=True (soda cases on top), seed=2"}

W, D, H = 2.1, 0.8, 2.1
FY = -D / 2
SIDE, MUL = 0.05, 0.03
ZB, ZT = 0.14, 1.82                     # door opening bottom / top
SW = (W - 2 * SIDE - 2 * MUL) / 3       # section width ~0.647
SHELF_Z = (0.17, 0.48, 0.79, 1.10, 1.41)

# per section, bottom shelf to top: (kind, colours)
PLAN = [
    [('2l', ('#4a1a10', '#3fae3a')), ('bottle', ('#4a1a10',)), ('bottle', ('#3fae3a', '#e8c21c')), ('can', ('#c41c2a',)), ('can', ('#9fb4c8', '#1f6fd1'))],
    [('2l', ('#8fd0f0',)), ('water', ('#8fd0f0',)), ('bottle', ('#1f7fe0', '#e0302a', '#f0c020')), ('tall', ('#15131a',)), ('tall', ('#1b5fc4', '#c9ced4'))],
    [('jug', ('#f4efe2',)), ('bottle', ('#b8661a',)), ('bottle', ('#f07a1c',)), ('can', ('#f07a1c', '#e8c21c')), ('can', ('#6a2fb0', '#d42c8a'))],
]
CAPS = {'#4a1a10': '#c41c2a', '#3fae3a': '#2f8a2a', '#e8c21c': '#2f8a2a', '#8fd0f0': '#1f6fd1', '#1f7fe0': '#f4efe2', '#e0302a': '#f4efe2',
        '#f0c020': '#1f6fd1', '#b8661a': '#2a2622', '#f07a1c': '#2fae52', '#f4efe2': '#c41c2a'}
LABEL = {'#4a1a10': '#c41c2a', '#3fae3a': '#f4efe2', '#e8c21c': '#2f8a2a', '#8fd0f0': '#f4efe2', '#1f7fe0': '#15131a', '#e0302a': '#15131a',
         '#f0c020': '#15131a', '#b8661a': '#f2e0a8', '#f07a1c': '#f4efe2', '#f4efe2': '#1f6fd1'}


def _tex(n): return os.path.join(TEX, n)


def build(cz, name='tk_cooler', on=True, light=True, power=90, open=(0, 0, 0), cases=True, seed=2):
    import random
    rnd = random.Random(seed)
    root = cz.empty(name)
    st = 'on' if on else 'off'

    def M(key, c, **k): return cz.toon(f'tk_cool_{key}', c, **k)
    def ML(key, c, emit_on=0.3, **k): return cz.toon(f'tk_cool_{key}_{st}', c, emit=emit_on if on else 0.02, **k)
    enamel = M('enamel', '#d3cfc5', tex='grain', tex_strength=0.05)
    blue = M('blue', '#123f96', tex='grain', tex_strength=0.05)
    frame = M('frame', '#26282e', tex='grain', tex_strength=0.03)
    chrome = M('chrome', '#c3c8cf', lift=0.5)
    wire = ML('wire', '#9aa3ad', 0.25)
    inner = cz.glow('tk_cool_inner_on', '#e4f3ff', 1.0) if on else M('inner_off', '#5a6670', tex='grain')

    # ---- cabinet
    for s in (-1, 1):
        cz.box(f'{name}_side{s:+d}', (SIDE, D, H), (s * (W / 2 - SIDE / 2), 0, 0), enamel, bevel=0.01, ol=0.01, parent=root, origin='bottom')
    for s in (-1, 1):     # printed side wraps (enamel + blue wave + ICE COLD), 1.3 mm off the sides
        cz.plane(f'{name}_sideart{s:+d}', D - 0.04, ZT - 0.04, (s * (W / 2 + 0.0013), 0, ZT / 2),
                 cz.toon('tk_cool_sidepanel', img=_tex('tk_cooler_sidepanel.png'), lift=0.7), rot=(90, 0, s * 90), parent=root)
    cz.box(name + '_back', (W - 0.02, 0.04, H), (0, D / 2 - 0.02, 0), enamel, bevel=0.004, ol=0.0, parent=root, origin='bottom')
    cz.box(name + '_head', (W, D, H - ZT), (0, 0, ZT), blue, bevel=0.012, ol=0.01, parent=root, origin='bottom')
    sign = cz.screen(name + '_signm', _tex('tk_cooler_header.png'), 1.1) if on else cz.toon('tk_cool_sign_off', img=_tex('tk_cooler_header.png'), lift=0.6)
    cz.plane(name + '_sign', W - 0.06, (H - ZT) - 0.04, (0, FY - 0.0013, ZT + (H - ZT) / 2), sign, parent=root)
    cz.box(name + '_base', (W - 0.02, D - 0.04, ZB), (0, 0.02, 0), M('basedark', '#2a2d33'), bevel=0.004, ol=0.008, parent=root, origin='bottom')
    cz.plane(name + '_grille', W - 0.12, ZB - 0.03, (0, FY + 0.04 - 0.0013, ZB / 2), cz.toon('tk_cool_grille', img=_tex('tk_cooler_grille.png'), lift=0.6), parent=root)
    for s in (-1, 1):
        cz.box(f'{name}_foot{s:+d}', (0.08, 0.08, 0.02), (s * (W / 2 - 0.08), FY + 0.1, 0), M('foot', '#18171b'), bevel=0.004, ol=0.003, parent=root, origin='bottom').location.z = -0.0
    # mullions (front, between doors) + interior dividers
    x0 = -W / 2 + SIDE
    for k in (1, 2):
        xm = x0 + k * SW + (k - 0.5) * MUL
        cz.box(f'{name}_mullion{k}', (MUL, 0.05, ZT - ZB), (xm, FY + 0.025, ZB), frame, bevel=0.003, ol=0.006, parent=root, origin='bottom')
        cz.box(f'{name}_divider{k}', (0.02, D - 0.12, ZT - ZB), (xm, 0.02, ZB), inner, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    cz.box(name + '_floor', (W - 2 * SIDE, D - 0.08, 0.01), (0, 0.0, ZB), inner, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    cz.box(name + '_ceil', (W - 2 * SIDE, D - 0.08, 0.01), (0, 0.0, ZT - 0.01), inner, bevel=0.0, ol=0.0, parent=root, origin='bottom')

    # ---- sections: back wall print, LED strip, shelves + drinks, door
    stripm = cz.toon('tk_cool_strip', img=_tex('tk_cooler_strip.png'), lift=0.75, emit=0.15 if on else 0.0)
    backm = cz.screen(name + '_backm', _tex('tk_cooler_back.png'), 1.0) if on else cz.toon('tk_cool_back_off', img=_tex('tk_cooler_back.png'), lift=0.45, tint='#6a7a88')
    for s in range(3):
        cx = x0 + s * (SW + MUL) + SW / 2
        cz.plane(f'{name}_backwall{s}', SW, ZT - ZB, (cx, D / 2 - 0.041 - 0.0013, (ZB + ZT) / 2), backm, parent=root)
        cz.box(f'{name}_led{s}', (SW - 0.06, 0.025, 0.018), (cx, FY + 0.09, ZT - 0.03), cz.glow('tk_cool_led', '#f4fbff', 5.0) if on else M('led_off', '#b8c2c8'), bevel=0.0, ol=0.0, parent=root)
        for j, z in enumerate(SHELF_Z):
            cz.box(f'{name}_shelf{s}_{j}', (SW - 0.01, D - 0.2, 0.012), (cx, 0.0, z - 0.012), wire, bevel=0.0, ol=0.003, parent=root, origin='bottom')
            cz.box(f'{name}_lip{s}_{j}', (SW - 0.01, 0.01, 0.028), (cx, -(D - 0.2) / 2 - 0.005, z - 0.018), wire, bevel=0.0, ol=0.003, parent=root, origin='bottom')
            cz.plane(f'{name}_price{s}_{j}', SW - 0.02, 0.022, (cx, -(D - 0.2) / 2 - 0.0113, z - 0.004), stripm, parent=root)
            kind, cols = PLAN[s][j]
            _row(cz, f'{name}_d{s}_{j}', root, kind, cols, cx, z, rnd, ML, M, chrome)
        _door(cz, name, root, s, x0 + s * (SW + MUL), frame, chrome, open[s] if s < len(open) else 0)
    # ---- stock on top
    if cases:
        cm = cz.toon('tk_cool_casem', '#c8955a', tex='paper', tex_strength=0.06)
        for k, (x, y, rz) in enumerate(((-0.55, 0.05, 6), (-0.2, 0.1, -4))):
            c = cz.box(f'{name}_case{k}', (0.42, 0.28, 0.13), (x, y, H), cm, rot=(0, 0, rz), bevel=0.004, ol=0.006, parent=root, origin='bottom')
            cz.plane(f'{name}_caseprint{k}', 0.36, 0.11, (0, -0.14 - 0.0013, 0.065), cz.toon('tk_cool_caseprint', img=_tex('tk_cooler_case.png'), lift=0.7), parent=c)
    if on and light:
        L = cz.light(name + '_light', 'AREA', (0, FY + 0.05, (ZB + ZT) / 2), rot=(-90, 0, 0), color='#e6f4ff', power=power, size=1.6, shadow=True)
        L.data.shape = 'RECTANGLE'; L.data.size = W - 0.2; L.data.size_y = ZT - ZB - 0.2
        L.parent = root
    return root


def _row(cz, nm, root, kind, cols, cx, z, rnd, ML, M, chrome):
    """A full front row of drinks on the shelf at z (two deep for small items)."""
    spec = {'2l': (0.05, 0.25, 0.108), 'bottle': (0.032, 0.2, 0.074), 'water': (0.032, 0.21, 0.074), 'can': (0.033, 0.122, 0.071),
            'tall': (0.028, 0.16, 0.064), 'jug': (0.07, 0.24, 0.15)}[kind]
    r, h, pitch = spec
    n = int((SW - 0.03) // pitch)
    span = (n - 1) * pitch
    deep = (-0.24, -0.24 + 2 * r + 0.012) if kind in ('can', 'tall', 'bottle', 'water') else (-0.22,)
    for row, yy in enumerate(deep):
        for i in range(n):
            x = cx - span / 2 + i * pitch + rnd.uniform(-0.003, 0.003)
            c = cols[(i // (2 if len(cols) > 1 and kind != 'tall' else 1)) % len(cols)] if kind != 'tall' else cols[i % len(cols)]
            body = ML('b' + kind + c[1:], c, 0.3 if kind != 'tall' else 0.12, tex='grain', tex_strength=0.03)
            k = f'{nm}_{row}_{i}'
            ol = 0.0025 if row == 0 else 0.0
            if kind in ('bottle', 'water', '2l'):
                bh = h * 0.68
                cz.cyl(k + '_body', r, bh, (x, yy, z), body, verts=20, bevel=0.006, ol=ol, parent=root)
                cz.cyl(k + '_sh', r, h * 0.22, (x, yy, z + bh), body, r2=r * 0.42, verts=20, ol=ol, parent=root)
                cz.cyl(k + '_cap', r * 0.46, h * 0.09, (x, yy, z + bh + h * 0.22), ML('cap' + CAPS.get(c, '#f4efe2')[1:], CAPS.get(c, '#f4efe2'), 0.15), verts=14, ol=ol * 0.8, parent=root)
                if row == 0:
                    cz.cyl(k + '_lab', r + 0.0012, bh * 0.4, (x, yy, z + bh * 0.3), ML('lab' + LABEL.get(c, '#f4efe2')[1:], LABEL.get(c, '#f4efe2'), 0.2), verts=20, ol=0.0, parent=root)
            elif kind in ('can', 'tall'):
                cz.cyl(k + '_body', r, h, (x, yy, z), body, verts=20, bevel=0.004, ol=ol, parent=root)
                cz.cyl(k + '_top', r * 0.86, 0.006, (x, yy, z + h), chrome, verts=16, ol=0.0, parent=root)
                if row == 0:
                    band = '#f4efe2' if c in ('#c41c2a', '#6a2fb0', '#1b5fc4') else ('#7dff3a' if c == '#15131a' else '#15131a')
                    cz.cyl(k + '_band', r + 0.0012, h * 0.22, (x, yy, z + h * 0.42), ML('band' + band[1:], band, 0.5 if band == '#7dff3a' else 0.2), verts=20, ol=0.0, parent=root)
            else:   # jug: chunky gallon with a handle bump and a cap
                cz.box(k + '_body', (2 * r, 2 * r, h), (x, yy, z), body, bevel=0.025, ol=ol, parent=root, origin='bottom')
                cz.cyl(k + '_cap', 0.022, 0.025, (x - 0.02, yy, z + h - 0.005), ML('capjug', '#c41c2a', 0.15), verts=14, ol=ol * 0.8, parent=root)
                if row == 0:
                    cz.box(k + '_lab', (2 * r - 0.03, 0.003, h * 0.35), (x, yy - r - 0.0015, z + h * 0.3), ML('labjug', '#1f6fd1', 0.2), bevel=0.0, ol=0.0, parent=root, origin='bottom')


def _door(cz, name, root, s, xl, frame, chrome, k):
    dw, dh = SW + 0.012, ZT - ZB
    pv = cz.empty(f'{name}_door{s}', (xl - 0.006, FY - 0.012, ZB), parent=root, size=0.06)
    pv.rotation_euler = (0, 0, math.radians(-100 * float(k)))
    st = 0.045
    for nm, (x, w) in (('l', (st / 2, st)), ('r', (dw - st / 2, st))):
        cz.box(f'{name}_door{s}_{nm}', (w, 0.035, dh), (x, 0, 0), frame, bevel=0.004, ol=0.006, parent=pv, origin='bottom')
    for nm, z, hh in (('b', 0, 0.07), ('t', dh - 0.06, 0.06)):
        cz.box(f'{name}_door{s}_{nm}', (dw - 2 * st + 0.002, 0.035, hh), (dw / 2, 0, z), frame, bevel=0.004, ol=0.006, parent=pv, origin='bottom')
    g = cz.plane(f'{name}_glass{s}', dw - 2 * st, dh - 0.13, (dw / 2, 0, 0.07 + (dh - 0.13) / 2),
                 cz.toon('tk_cool_glints', img=_tex('tk_cooler_glints.png'), alpha_clip=True, lift=0.9, emit=0.4), parent=pv)
    g.visible_shadow = False
    fr = cz.plane(f'{name}_glassfrost{s}', dw - 2 * st - 0.004, 0.2, (dw / 2, -0.0016, 0.07 + 0.1), cz.toon('tk_cool_frost', img=_tex('tk_cooler_frost.png'), alpha_clip=True, lift=0.85, emit=0.3), parent=pv)
    fr.visible_shadow = False
    # handle on the free edge, on two standoffs
    hx = dw - 0.065
    cz.box(f'{name}_door{s}_handle', (0.022, 0.024, 0.52), (hx, -0.06, 0.72), chrome, bevel=0.008, ol=0.004, parent=pv, origin='bottom')
    for zz in (0.75, 1.21):
        cz.box(f'{name}_door{s}_stand{zz:.2f}', (0.018, 0.045, 0.02), (hx, -0.035, zz), chrome, bevel=0.003, ol=0.003, parent=pv, origin='bottom')
    cz.plane(f'{name}_door{s}_pull', 0.08, 0.03, (hx - 0.07, -0.0017, 1.0), cz.toon('tk_cool_pull', img=_tex('tk_cooler_pull.png'), alpha_clip=True, lift=0.75), parent=pv)
    cz.plane(f'{name}_door{s}_cling', 0.2, 0.2, (dw / 2 - 0.05, -0.0017, 1.28 - 0.04 * s), cz.toon(f'tk_cool_cling{s}', img=_tex(f'tk_cooler_cling{s}.png'), alpha_clip=True, lift=0.75), rot=(90, (-6, 4, -3)[s], 0), parent=pv)
