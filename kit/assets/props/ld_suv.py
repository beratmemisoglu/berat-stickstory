# Kyle's red boxy SUV (the sunrise drive in the reference short): a chunky toy-like slab-sided SUV with a flat hood
# sloping to a tall blunt front, an OPEN cabin frame (thick red A/B/C pillars, thin red roof slab, silver roof rack),
# mustard wood-look door panels, a black grille slot, round grey headlights, a white-lavender bumper block with the
# "LUCKY 7" plate on its right (+X, screen right seen from the front), chunky black tyres in dark arches.
# Inside: dashboard, a big cream steering wheel on the driver side (+X), blue seats with headrests, a tackle box strapped
# into the passenger seat (-X) with a seatbelt and a scratch ticket, a rear-view mirror with fuzzy dice and a pine tree.
# Floor prop: root at the floor centre between the axles, the car's FRONT faces -Y. Textures: tex/make_ld_suv.py.
import math, os
import bpy, bmesh
from mathutils import Vector, Matrix

W = 0.875            # half body width (body 1.75 m)
R_T = 0.33           # tyre radius
TW = 0.28            # tyre width
XT = 0.75            # tyre centre x
YF, YR = -0.95, 1.05 # axles
BELT = 0.95          # beltline / hood top at the cowl
HOOD_F = 0.88        # hood top at the front edge
ROOF = 1.7775        # roof bar centre height (bars ROOF -/+ 0.0375)
RK = ROOF + 0.0375   # top of the roof frame: rack starts here
SEAT = (0.38, 0.30, 0.78)       # driver seat cushion top centre
HUB = (0.38, 0.0, 1.07)         # steering wheel hub
RIM_R = 0.17
TILT = 25.0                     # wheel plane from vertical (top leans forward, axis points up-back at the driver)

META = {'size': (1.86, 3.36, 1.905),
        'anchor': 'floor centre between the axles (axles at y -0.95 / +1.05); front (bumper) faces -Y; driver sits on +X '
                  '(the character\'s left when facing -Y), passenger seat -X; hood top 0.88 (front) .. 0.95 (cowl = '
                  'beltline), windshield base y -0.335, roof slab underside 1.76, rack top 1.905',
        'animate': ['_wheelFL', '_wheelFR', '_wheelRL', '_wheelRR', '_steer', '_dice', '_tree'],
        'driver': {'seat': SEAT, 'wheel': HUB, 'wheel_r': RIM_R, 'tilt': TILT,
                   'axis': (0.0, round(math.cos(math.radians(TILT)), 4), round(math.sin(math.radians(TILT)), 4)),
                   'head': (SEAT[0], 0.385, SEAT[2] + 0.65),
                   'note': 'seat = cushion top centre; wheel = hub centre; axis = wheel normal pointing at the driver '
                           '(up-back); rim at wheel_r around the hub in the plane normal to axis; torso fits at y ~0.385'},
        'params': "color='#c42228' (body), steer=0 (deg, + = counter-clockwise seen by the driver), spin=0 (deg, all "
                  "four wheels about X, + = rolling forward), swing=0 (deg, dice + tree about X), cargo=True (tackle "
                  "box + belt + ticket on the passenger seat). Pivots: <name>_wheelFL/RL on +X (driver side), "
                  "_wheelFR/RR on -X, rotation_euler.x; <name>_steer rotation_euler.z (its parent carries the tilt); "
                  "<name>_dice / _tree rotation_euler.x (swing) and .y (sideways)"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def T(n): return os.path.join(TEX, f'ld_suv_{n}.png')


def build(cz, name='ld_suv', color='#c42228', steer=0.0, spin=0.0, swing=0.0, cargo=True, ghost=False):
    root = cz.empty(name)

    def M(key, c, **k):
        return cz.toon(f'ld_suv_{key}_{c.lstrip("#")}', c, **k)

    red = M('body', color, tex='grain', tex_scale=2.0, tex_strength=0.05)
    redi = M('bodyin', _shade(color, 0.82), tex='grain', tex_scale=2.0, tex_strength=0.04)
    dark = M('dark', '#2a2426', tex='grain', tex_strength=0.03)
    tyre = M('tyre', '#1e1a1e', tex='grain', tex_scale=3.0, tex_strength=0.05)
    hubm = M('hub', '#8f8b98')
    hubl = M('hubl', '#b9b5c4')
    silver = M('silver', '#c3c4d0')
    bump = M('bumper', '#e9e2ec', tex='grain', tex_strength=0.03)
    lamp = M('lamp', '#bdb8cc')
    wood = M('wood', '#c98a2b', tex='wood', tex_scale=1.0, tex_strength=0.10)
    blue = M('seat', '#2f6fd0', tex='grain', tex_scale=2.5, tex_strength=0.05)
    navy = M('headrest', '#24407a', tex='grain', tex_strength=0.04)
    grey = M('seatpanel', '#b9b6c4', tex='grain', tex_scale=3.0, tex_strength=0.05)
    cream = M('rim', '#d9c28f', tex='grain', tex_strength=0.04)
    brown = M('tackle', '#8a5530', tex='grain', tex_scale=2.0, tex_strength=0.06)
    brownd = M('tackle_lid', '#6e4224', tex='grain', tex_strength=0.05)
    belt = M('belt', '#2c4fa8')
    pink = M('dice', '#d68bc6', tex='grain', tex_scale=8.0, tex_strength=0.10)
    orange = M('marker', '#e8892a', emit=0.25)
    tail = M('tail', '#d4282e', emit=0.35)
    mirror = M('mirrorglass', '#8fa0bc', lift=0.75)
    floor = M('floor', '#3a3034', tex='grain', tex_strength=0.04)

    def B(part, size, loc, mat, bevel=0.01, ol=0.006, rot=(0, 0, 0), parent=root):
        return cz.box(f'{name}_{part}', size, loc, mat, rot=rot, bevel=bevel, ol=ol, parent=parent)

    def BX(part, x0, x1, y0, y1, z0, z1, mat, bevel=0.02, ol=0.009, parent=root):
        return B(part, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat, bevel, ol, parent=parent)

    def beam(part, a, b, w, t, mat, nrm=(0, -1, 0), ol=0.006, bevel=0.006, parent=root, ext=0.0):
        """Box of section w x t from a to b (extended by ext at both ends); its t side faces nrm."""
        a, b = Vector(a), Vector(b); z = (b - a).normalized()
        n = Vector(nrm); y = (n - n.dot(z) * z)
        y = y.normalized() if y.length > 1e-6 else z.orthogonal().normalized()
        x = y.cross(z)
        rot = Matrix((x, y, z)).transposed().to_euler()
        L = (b - a).length + 2 * ext
        return B(part, (w, t, L), tuple((a + b) / 2), mat, bevel, ol, rot=tuple(math.degrees(r) for r in rot), parent=parent)

    def decal(part, w, h, loc, png, rot=(90, 0, 0), clip=True, lift=0.62, parent=root):
        mat = cz.toon(f'ld_suv_{part}_{os.path.basename(png)}', img=png, alpha_clip=clip, lift=lift)
        return cz.plane(f'{name}_{part}', w, h, loc, mat, rot=rot, parent=parent)

    # ------------------------------------------------------------ nose (y -1.50 .. -0.33)
    lid = BX('hood', -W, W, -1.50, -0.33, 0.80, BELT, red, bevel=0.025, ol=0.010)
    for v in lid.data.vertices:                 # hood slopes down to the front
        if v.co.z > 0 and v.co.y < 0: v.co.z -= (BELT - HOOD_F)
    BX('front', -W, W, -1.50, -1.32, 0.28, 0.80, red, bevel=0.02, ol=0.010)
    BX('cowl', -W, W, -0.58, -0.33, 0.28, 0.80, red, bevel=0.02, ol=0.009)
    BX('core_f', -0.60, 0.60, -1.32, -0.58, 0.30, 0.80, red, bevel=0.0, ol=0.0)
    # ------------------------------------------------------------ cabin tub (y -0.33 .. 1.50)
    for s in (-1, 1):
        sx = 'L' if s > 0 else 'R'
        x0, x1 = sorted((s * 0.80, s * W))
        BX(f'side{sx}', x0, x1, -0.33, 0.68, 0.28, BELT, red, bevel=0.02, ol=0.010)
        BX(f'rarch{sx}', x0, x1, 0.68, 1.42, 0.70, BELT, red, bevel=0.02, ol=0.010)
        BX(f'farch{sx}', *sorted((s * 0.60, s * W)), -1.32, -0.58, 0.70, 0.80, red, bevel=0.0, ol=0.0)
        BX(f'tub{sx}', *sorted((s * 0.58, s * 0.80)), 0.68, 1.42, 0.45, 0.74, redi, bevel=0.02, ol=0.007)
        for yy, k in ((YF, 'f'), (YR, 'r')):     # dark wheel wells + red fender flare above each tyre
            BX(f'well{k}{sx}', *sorted((s * 0.58, s * 0.85)), yy - 0.37, yy + 0.37, 0.30, 0.705, dark, bevel=0.0, ol=0.0)
            BX(f'flare{k}{sx}', *sorted((s * (W - 0.004), s * (W + 0.02))), yy - 0.40, yy + 0.40, 0.695, 0.79, red, bevel=0.012, ol=0.008)
        # mustard wood door panel set into the slab side, hinges, handle
        pan = B(f'door{sx}', (0.50, 0.016, 0.90), (s * (W + 0.006), 0.17, 0.645), wood, bevel=0.006, ol=0.006,
                rot=(0, -90, -90))
        BX(f'hingeA{sx}', *sorted((s * (W + 0.012), s * (W + 0.03))), -0.31, -0.26, 0.78, 0.84, dark, bevel=0.004, ol=0.004)
        BX(f'hingeB{sx}', *sorted((s * (W + 0.012), s * (W + 0.03))), -0.31, -0.26, 0.46, 0.52, dark, bevel=0.004, ol=0.004)
        BX(f'handle{sx}', *sorted((s * (W + 0.012), s * (W + 0.034))), 0.40, 0.54, 0.80, 0.83, silver, bevel=0.006, ol=0.004)
        # side markers (orange front, red rear)
        BX(f'markf{sx}', *sorted((s * W, s * (W + 0.012))), -1.47, -1.37, 0.60, 0.65, orange, bevel=0.004, ol=0.003)
        BX(f'markr{sx}', *sorted((s * W, s * (W + 0.012))), 1.40, 1.47, 0.60, 0.65, tail, bevel=0.004, ol=0.003)
        # mud on the lower sills (decals, no outline)
        rz = -90 if s < 0 else 90
        decal(f'mud{sx}', 1.24, 0.15, (s * (W + 0.0015), 0.05, 0.355), T('mud'), rot=(90, 0, rz))
        decal(f'mudf{sx}', 0.17, 0.10, (s * (W + 0.0015), -1.41, 0.33), T('mud'), rot=(90, 0, rz))
        decal(f'mudr{sx}', 0.07, 0.09, (s * (W + 0.0015), 1.46, 0.33), T('mud'), rot=(90, 0, rz))
        # side mirror on the cowl at the A-pillar base, glass facing back
        beam(f'mirarm{sx}', (s * (W - 0.01), -0.30, BELT + 0.015), (s * (W + 0.10), -0.27, BELT + 0.08), 0.03, 0.03, red, ol=0.004)
        BX(f'mirror{sx}', *sorted((s * (W + 0.07), s * (W + 0.17))), -0.33, -0.23, BELT + 0.04, BELT + 0.16, red, bevel=0.012, ol=0.006)
        BX(f'mirglass{sx}', *sorted((s * (W + 0.08), s * (W + 0.16))), -0.23, -0.2285, BELT + 0.05, BELT + 0.15, mirror, bevel=0.0, ol=0.0)
    BX('floor', -0.80, 0.80, -0.33, 0.68, 0.28, 0.45, floor, bevel=0.0, ol=0.0)
    BX('floor_r', -0.58, 0.58, 0.68, 1.42, 0.30, 0.45, floor, bevel=0.0, ol=0.0)
    BX('rear', -W, W, 1.42, 1.50, 0.28, BELT, red, bevel=0.02, ol=0.010)
    BX('chassis', -0.58, 0.58, -1.32, 1.42, 0.22, 0.30, dark, bevel=0.01, ol=0.006)
    # dent: two shading crescents on the passenger-side rear quarter
    decal('dent', 0.16, 0.10, (-(W + 0.0015), 1.20, 0.86), T('dent'), rot=(90, 0, -90))

    # ------------------------------------------------------------ front face
    B('grille', (0.78, 0.03, 0.18), (0, -1.512, 0.63), dark, bevel=0.012, ol=0.006)
    for s in (-1, 1):
        sx = 'L' if s > 0 else 'R'
        cz.cyl(f'{name}_lamp{sx}', 0.15, 0.035, (s * 0.615, -1.50, 0.63), lamp, rot=(90, 0, 0), verts=14, bevel=0.008, ol=0.007, parent=root)
        decal(f'lens{sx}', 0.27, 0.27, (s * 0.615, -1.5365, 0.63), T('lens'))
        BX(f'blink{sx}', *sorted((s * 0.79, s * 0.86)), -1.515, -1.50, 0.49, 0.54, orange, bevel=0.004, ol=0.003)
    BX('bumper', -0.93, 0.93, -1.63, -1.43, 0.22, 0.41, bump, bevel=0.022, ol=0.010)
    for s in (-1, 1):
        cz.cyl(f'{name}_bbolt{"L" if s > 0 else "R"}', 0.018, 0.008, (s * 0.80, -1.63, 0.315), silver, rot=(90, 0, 0), verts=12, ol=0.003, parent=root)
    BX('plate', 0.23, 0.59, -1.642, -1.63, 0.23, 0.40, M('platebk', '#f4f2ec'), bevel=0.004, ol=0.004)
    decal('platefx', 0.34, 0.17, (0.41, -1.6435, 0.315), T('plate'), lift=0.72)

    # ------------------------------------------------------------ rear face
    for s in (-1, 1):
        sx = 'L' if s > 0 else 'R'
        BX(f'tail{sx}', *sorted((s * 0.62, s * 0.80)), 1.50, 1.52, 0.66, 0.90, tail, bevel=0.008, ol=0.005)
    BX('rbumper', -0.90, 0.90, 1.46, 1.58, 0.24, 0.40, bump, bevel=0.02, ol=0.009)
    BX('spmount', -0.10, 0.10, 1.50, 1.54, 0.58, 0.78, dark, bevel=0.006, ol=0.005)
    cz.cyl(f'{name}_spare', 0.27, 0.18, (0, 1.53, 0.68), tyre, rot=(-90, 0, 0), verts=36, bevel=0.03, ol=0.009, parent=root)
    cz.cyl(f'{name}_sparehub', 0.13, 0.02, (0, 1.705, 0.68), hubm, rot=(-90, 0, 0), verts=24, bevel=0.004, ol=0.005, parent=root)
    cz.cyl(f'{name}_sparecap', 0.05, 0.02, (0, 1.72, 0.68), hubl, rot=(-90, 0, 0), verts=16, ol=0.004, parent=root)
    # dangling exhaust pipe + its wire hanger
    beam('exhaust', (-0.48, 1.25, 0.25), (-0.50, 1.70, 0.215), 0.07, 0.07, M('pipe', '#5c5860'), ol=0.005, bevel=0.02)
    cz.cyl(f'{name}_exhend', 0.028, 0.01, (-0.50, 1.705, 0.215), dark, rot=(-90, 0, 0), verts=16, ol=0.0, parent=root)
    beam('hanger', (-0.48, 1.45, 0.30), (-0.49, 1.47, 0.24), 0.008, 0.008, dark, ol=0.0, bevel=0.0)

    # ------------------------------------------------------------ wheels (pivots spin about X)
    for tag, s, yy in (('FL', 1, YF), ('FR', -1, YF), ('RL', 1, YR), ('RR', -1, YR)):
        pv = cz.empty(f'{name}_wheel{tag}', (s * XT, yy, R_T), parent=root, size=0.2)
        pv.rotation_euler.x = math.radians(spin)
        cz.cyl(f'{name}_tyre{tag}', R_T, TW, (0, 0, 0), tyre, rot=(0, 90, 0), verts=40, bevel=0.035, ol=0.010, parent=pv, origin='center')
        ox = s * TW / 2
        cz.cyl(f'{name}_hub{tag}', 0.17, 0.02, (ox, 0, 0), hubm, rot=(0, 90, 0), verts=28, bevel=0.005, ol=0.006, parent=pv, origin='center')
        cz.cyl(f'{name}_cap{tag}', 0.06, 0.03, (ox + s * 0.012, 0, 0), hubl, rot=(0, 90, 0), verts=16, bevel=0.006, ol=0.004, parent=pv, origin='center')
        for k in range(5):
            a = math.radians(90 + 72 * k)
            cz.cyl(f'{name}_lug{tag}{k}', 0.017, 0.02, (ox + s * 0.012, 0.105 * math.cos(a), 0.105 * math.sin(a)), dark,
                   rot=(0, 90, 0), verts=8, ol=0.0, parent=pv, origin='center')

    # ------------------------------------------------------------ open cabin frame
    BX('cowlbar', -W, W, -0.37, -0.30, BELT - 0.02, BELT + 0.035, red, bevel=0.012, ol=0.009)
    zb = BELT + 0.005                                     # windshield / A-pillar base
    for s in (-1, 1):
        sx = 'L' if s > 0 else 'R'
        xc = s * 0.8375
        beam(f'apillar{sx}', (xc, -0.335, zb), (xc, -0.06, ROOF), 0.075, 0.075, red, ol=0.009, bevel=0.012, ext=0.03)
        BX(f'bpillar{sx}', xc - 0.0375, xc + 0.0375, 0.64, 0.715, BELT - 0.02, ROOF, red, bevel=0.01, ol=0.009)
        BX(f'cpillar{sx}', xc - 0.0375, xc + 0.0375, 1.42, 1.495, BELT - 0.02, ROOF, red, bevel=0.01, ol=0.009)
        BX(f'roofrail{sx}', xc - 0.0375, xc + 0.0375, -0.10, 1.495, ROOF - 0.0375, RK, red, bevel=0.012, ol=0.009)
    BX('header', -W, W, -0.10, -0.025, ROOF - 0.0375, RK, red, bevel=0.012, ol=0.009)
    BX('rheader', -W, W, 1.42, 1.495, ROOF - 0.0375, RK, red, bevel=0.012, ol=0.009)
    BX('roof', -0.80, 0.80, -0.025, 1.42, ROOF - 0.0175, ROOF + 0.0175, red, bevel=0.006, ol=0.006)
    # roof rack: black cross feet, silver side rails, a silver crossbar sticking out on the passenger side
    for yy, k in ((0.06, 'a'), (1.30, 'b')):
        BX(f'rackfoot{k}', -0.86, 0.86, yy - 0.035, yy + 0.035, RK, RK + 0.025, dark, bevel=0.008, ol=0.006)
    for s in (-1, 1):
        BX(f'rackrail{"L" if s > 0 else "R"}', s * 0.66 - 0.024, s * 0.66 + 0.024, -0.16, 1.52, RK + 0.025, RK + 0.058, silver, bevel=0.008, ol=0.006)
    B('rackbar', (1.62, 0.045, 0.03), (-0.07, 0.10, RK + 0.073), silver, bevel=0.008, ol=0.006, rot=(0, 0, -2.5))
    # windshield: faint tint + soft white glints (blended), no outline, no shadow
    rake = math.degrees(math.atan2(-0.06 + 0.335, ROOF - zb))
    glen = math.hypot(0.275, ROOF - zb) - 0.05
    g = cz.plane(f'{name}_glass', 1.60, glen, (0, -0.1975, (zb + ROOF) / 2), _glass(cz, 'ld_suv_glass_mat', T('glass')), rot=(90 - rake, 0, 0), parent=root)
    g.visible_shadow = False

    # ------------------------------------------------------------ dashboard + controls (kept under the beltline so the
    # wheel, the driver and the passenger cargo read through the windshield)
    BX('dash', -0.80, 0.80, -0.33, -0.08, 0.45, BELT, dark, bevel=0.02, ol=0.008)
    BX('dashtop', -0.78, 0.78, -0.29, -0.08, BELT - 0.01, BELT + 0.025, dark, bevel=0.012, ol=0.006)
    for k, dx in enumerate((-0.07, 0.07)):
        cz.cyl(f'{name}_dial{k}', 0.04, 0.006, (0.38 + dx, -0.0785, 0.87), M('dial', '#efe6cc', lift=0.8), rot=(-90, 0, 0), verts=20, ol=0.003, parent=root)
        beam(f'needle{k}', (0.38 + dx, -0.071, 0.87), (0.38 + dx + 0.022, -0.071, 0.892), 0.006, 0.003, tail, ol=0.0, bevel=0.0)
    BX('glovebox', -0.62, -0.18, -0.0815, -0.075, 0.76, 0.88, M('glove', '#3b3437'), bevel=0.006, ol=0.004)
    BX('console', -0.11, 0.11, -0.10, 0.48, 0.45, 0.60, dark, bevel=0.015, ol=0.006)
    beam('gear', (0, 0.02, 0.60), (0, 0.06, 0.76), 0.022, 0.022, M('gearstick', '#4a4448'), ol=0.004, bevel=0.005)
    cz.sphere(f'{name}_gearknob', 0.035, (0, 0.062, 0.775), M('knob', '#e9e2ec'), ol=0.004, parent=root, segs=20, rings=10)
    # steering: column + tilted wheel (the tilt lives on _steercol, the spin on _steer.rotation_euler.z)
    ax = Vector((0, math.cos(math.radians(TILT)), math.sin(math.radians(TILT))))
    col = cz.empty(f'{name}_steercol', HUB, parent=root, size=0.1)
    col.rotation_euler.x = math.radians(TILT - 90)
    st = cz.empty(f'{name}_steer', (0, 0, 0), parent=col, size=0.15)
    st.rotation_euler.z = math.radians(steer)
    beam('column', tuple(Vector(HUB) - ax * 0.30), tuple(Vector(HUB) - ax * 0.03), 0.05, 0.05, dark, ol=0.005, bevel=0.01)
    _ring(cz, f'{name}_rim', RIM_R, 0.022, cream, st, ol=0.006)
    cz.cyl(f'{name}_hubw', 0.06, 0.05, (0, 0, -0.025), M('whub', '#3b3538'), verts=24, bevel=0.01, ol=0.005, parent=st, origin='center')
    cz.cyl(f'{name}_horn', 0.035, 0.012, (0, 0, 0.026), M('horn', '#8f8b98'), verts=20, ol=0.003, parent=st, origin='center')
    for k, a in enumerate((0, 120, 240)):
        r = math.radians(a - 90)
        beam(f'spoke{k}', (0.05 * math.cos(r), 0.05 * math.sin(r), 0), (0.155 * math.cos(r), 0.155 * math.sin(r), 0),
             0.03, 0.016, M('spokem', '#3b3538'), nrm=(0, 0, 1), ol=0.004, bevel=0.004, parent=st)

    # ------------------------------------------------------------ seats
    for s in (1, -1):
        sx = 'D' if s > 0 else 'P'
        x = s * SEAT[0]
        B(f'seatbase{sx}', (0.40, 0.36, SEAT[2] - 0.12 - 0.45), (x, 0.32, (SEAT[2] - 0.12 + 0.45) / 2), dark, bevel=0.01, ol=0.006)
        B(f'cushion{sx}', (0.52, 0.48, 0.12), (x, SEAT[1], SEAT[2] - 0.06), blue, bevel=0.03, ol=0.008)
        bk = cz.empty(f'{name}_back{sx}', (x, 0.62, SEAT[2] - 0.02), parent=root)
        bk.rotation_euler.x = math.radians(-10)
        B(f'seatback{sx}', (0.52, 0.14, 0.62), (0, 0, 0.31), blue, bevel=0.03, ol=0.008, parent=bk)
        B(f'seatpanel{sx}', (0.34, 0.012, 0.40), (0, -0.072, 0.30), grey, bevel=0.006, ol=0.0, parent=bk)
        for px in (-0.09, 0.09):
            B(f'hrpost{sx}{px > 0:d}', (0.018, 0.018, 0.08), (px, 0.0, 0.645), silver, bevel=0.0, ol=0.003, parent=bk)
        B(f'headrest{sx}', (0.32, 0.12, 0.17), (0, 0.0, 0.76), navy, bevel=0.03, ol=0.007, parent=bk)
    # rear bench
    BX('benchbase', -0.56, 0.56, 1.00, 1.40, 0.45, 0.52, dark, bevel=0.01, ol=0.006)
    BX('bench', -0.56, 0.56, 0.98, 1.40, 0.52, 0.65, blue, bevel=0.03, ol=0.008)
    BX('benchback', -0.56, 0.56, 1.30, 1.42, 0.65, 1.06, blue, bevel=0.03, ol=0.008)

    # ------------------------------------------------------------ passenger cargo: tackle box, seatbelt, ticket
    if cargo:
        xp = -SEAT[0]
        th = 0.28                                                    # box height (lid on top): its top half shows above the beltline
        BX('tackle', xp - 0.18, xp + 0.18, 0.28, 0.52, SEAT[2], SEAT[2] + th, brown, bevel=0.015, ol=0.007)
        BX('tacklelid', xp - 0.186, xp + 0.186, 0.274, 0.526, SEAT[2] + th - 0.03, SEAT[2] + th + 0.025, brownd, bevel=0.012, ol=0.006)
        BX('latch', xp - 0.025, xp + 0.025, 0.266, 0.276, SEAT[2] + th - 0.05, SEAT[2] + th - 0.01, silver, bevel=0.003, ol=0.003)
        for px in (-0.07, 0.07):
            BX(f'tpost{px > 0:d}', xp + px - 0.012, xp + px + 0.012, 0.39, 0.41, SEAT[2] + th + 0.025, SEAT[2] + th + 0.06, dark, bevel=0.0, ol=0.003)
        BX('thandle', xp - 0.085, xp + 0.085, 0.385, 0.415, SEAT[2] + th + 0.055, SEAT[2] + th + 0.08, dark, bevel=0.008, ol=0.004)
        zt = SEAT[2] + th + 0.035                                    # strap crosses the lid's front top edge
        buck = (xp, 0.262, SEAT[2] + 0.085)
        for side, (xa, xc) in enumerate(((xp - 0.15, xp - 0.075), (xp + 0.15, xp + 0.075))):
            a = (xa, 0.655, SEAT[2] + 0.52); c = (xc, 0.262, zt)
            beam(f'beltA{side}', a, c, 0.042, 0.007, belt, nrm=(0, -1, 0.6), ol=0.004, bevel=0.0, ext=0.01)
            beam(f'beltB{side}', c, buck, 0.042, 0.007, belt, nrm=(0, -1, 0), ol=0.004, bevel=0.0, ext=0.01)
        BX('buckle', xp - 0.035, xp + 0.035, 0.252, 0.262, buck[2] - 0.028, buck[2] + 0.028, silver, bevel=0.004, ol=0.003)
        decal('ticket', 0.075, 0.112, (xp - 0.105, 0.2715, SEAT[2] + 0.14), T('ticket'), rot=(90, -8, 0), lift=0.72)

    # ------------------------------------------------------------ rear-view mirror, fuzzy dice, pine tree
    zm = ROOF - 0.0175                                   # roof slab underside
    beam('mirstem', (0, 0.0, zm), (0, -0.03, zm - 0.085), 0.025, 0.025, dark, ol=0.004, bevel=0.004)
    BX('rvmirror', -0.13, 0.13, -0.05, -0.01, zm - 0.16, zm - 0.085, dark, bevel=0.015, ol=0.006)
    BX('rvglass', -0.115, 0.115, -0.01, -0.0085, zm - 0.1475, zm - 0.0975, mirror, bevel=0.0, ol=0.0)
    dv = cz.empty(f'{name}_dice', (-0.11, -0.03, zm - 0.16), parent=root, size=0.05)
    dv.rotation_euler.x = math.radians(swing)
    for k, (dx, ln, rz) in enumerate(((-0.025, 0.10, 18), (0.022, 0.13, -12))):
        beam(f'dstring{k}', (0, 0, 0), (dx, 0, -ln), 0.004, 0.004, M('string', '#f2efe6'), ol=0.0, bevel=0.0, parent=dv)
        B(f'die{k}', (0.058, 0.058, 0.058), (dx, 0, -ln - 0.029), pink, bevel=0.014, ol=0.004, rot=(8, 6, rz), parent=dv)
    tr = cz.empty(f'{name}_tree', (-0.035, -0.03, zm - 0.16), parent=root, size=0.05)
    tr.rotation_euler.x = math.radians(swing * 0.8)
    beam('tstring', (0, 0, 0), (0, 0, -0.05), 0.003, 0.003, M('string', '#f2efe6'), ol=0.0, bevel=0.0, parent=tr)
    decal('treecard', 0.085, 0.128, (0, -0.002, -0.05 - 0.058), T('tree'), rot=(90, 0, 4), parent=tr)

    if ghost:   # QA stand-in for the scene builder's seated driver, built ONLY from META['driver']
        d = META['driver']; hx, hy, hz = d['head']; gm = M('ghost', '#7c8a99')
        cz.capsule(f'{name}_gtorso', 0.165, hz - 0.24 - d['seat'][2] + 0.02, (hx, hy, d['seat'][2]), gm, ol=0.006, parent=root)
        cz.sphere(f'{name}_ghead', 0.24, (hx, hy, hz), M('ghosthead', '#f2efe6'), ol=0.008, parent=root)
        axv = Vector(d['axis']); upv = Vector((0, -axv.z, axv.y))
        for s in (-1, 1):
            sh = Vector((hx + s * 0.15, hy, hz - 0.30))
            hand = Vector(d['wheel']) + Vector((s * d['wheel_r'] * 0.8, 0, 0)) + upv * d['wheel_r'] * 0.6
            beam(f'garm{s}', tuple(sh), tuple(hand), 0.04, 0.04, M('ghostarm', '#2a2622'), ol=0.0, bevel=0.0)
            cz.sphere(f'{name}_ghand{s}', 0.04, tuple(hand), M('ghosthead', '#f2efe6'), ol=0.004, parent=root, segs=16, rings=8)
            beam(f'gleg{s}', (hx + s * 0.09, hy - 0.02, d['seat'][2] + 0.05), (hx + s * 0.09, -0.12, d['seat'][2] + 0.04), 0.06, 0.06,
                 M('ghostarm', '#2a2622'), ol=0.0, bevel=0.0)
    return root


def _glass(cz, name, png):
    """Transparent BSDF mixed with a faint emission by the PNG's alpha (tint ~0.12, glint stripes up to ~0.5)."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N, L = nt.nodes, nt.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial')
    tx = N.new('ShaderNodeTexImage'); tx.image = cz.image(png); tx.interpolation = 'Linear'; tx.extension = 'EXTEND'
    tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = 1.0
    L.new(tx.outputs['Color'], em.inputs['Color'])
    mx = N.new('ShaderNodeMixShader')
    L.new(tx.outputs['Alpha'], mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    return m


def _ring(cz, name, R, r, mat, parent, ol=0.006, seg=48, rseg=12):
    """Torus in the local XY plane (steering-wheel rim), smooth shaded, inked."""
    bm = bmesh.new(); rows = []
    for i in range(seg):
        a = 2 * math.pi * i / seg; ca, sa = math.cos(a), math.sin(a); row = []
        for j in range(rseg):
            b = 2 * math.pi * j / rseg
            rr = R + r * math.cos(b)
            row.append(bm.verts.new((rr * ca, rr * sa, r * math.sin(b))))
        rows.append(row)
    for i in range(seg):
        for j in range(rseg):
            i2, j2 = (i + 1) % seg, (j + 1) % rseg
            bm.faces.new((rows[i][j], rows[i2][j], rows[i2][j2], rows[i][j2]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return cz.place(cz._mesh_obj(name, bm, mat), (0, 0, 0), (0, 0, 0), None, parent, ol)


def _shade(hexc, k):
    h = hexc.lstrip('#')
    return '#' + ''.join(f'{max(0, min(255, int(int(h[i:i + 2], 16) * k))):02x}' for i in (0, 2, 4))
