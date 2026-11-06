# Office desk (Japanese single-pedestal steel desk, modern colours): light wood top 1.4 x 0.7 at 0.72 m, steel panel
# leg on the left, three-drawer pedestal on the right, knee space between (centre x = -0.18, the worker sits at -Y).
# On top (clutter): monitor with a lit screen (<name>_screen), wireless keyboard, mouse on a pad with its cord to a
# cable grommet, pen cup, mug, coffee ring, paper stack with a pen, binders in a bookend, a tiny cactus, a sticky note
# on the monitor. Floor prop: root at the floor centre, front (worker side, screen side) faces -Y.
# Animate: <name>_drawer location.y (0 closed .. -0.3 open), <name>_monitor rotation_euler.z (turn the screen).
import math, os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (1.4, 0.7, 0.72),
        'anchor': 'floor centre, worker side -Y; knee space centred at x = -0.18 (put the chair at about (-0.18, -0.5)); '
                  'with the monitor the top of the prop is at 1.19 m',
        'animate': ['_drawer', '_monitor'],
        'params': "screen=None|png path (monitor picture; default tex/office_desk_screen.png, 16:9), "
                  "clutter=True|False (False = completely bare desk top), monitor=None|True|False (None = same as clutter; "
                  "False = no computer), drawer=0..1 (top drawer open), monitor_turn=0 (degrees about Z, + = screen "
                  "turns toward +X), top='#d6b48a' (wood), body='#b9bec4' (steel). Extra screen picture: "
                  "tex/office_desk_screen_off.png (switched off)"}

H, T = 0.72, 0.045          # desk height, top thickness
PX, PW, PD = 0.46, 0.42, 0.62   # pedestal centre x, width, depth
MX = -0.18                  # monitor / keyboard / knee space centre x


def build(cz, name='office_desk', screen=None, clutter=True, monitor=None, drawer=0.0, monitor_turn=0.0, top='#d6b48a', body='#b9bec4'):
    if monitor is None: monitor = clutter
    root = cz.empty(name)

    def M(key, c, **k):      # materials shared by every desk with the same colours
        return cz.toon(f'office_desk_{key}_{c.lstrip("#")}', c, **k)

    wood = M('wood', top, tex='wood', tex_scale=1.2, tex_strength=0.05)
    steel = M('steel', body, tex='grain', tex_strength=0.03)
    dark = M('dark', '#3a3d44', tex='grain', tex_strength=0.03)
    hole = M('hole', '#2a2622')

    # ---- desk body
    # (built 90 degrees turned: the wood texture bands along object X, so the grain now runs along the desk's length)
    cz.box(name + '_top', (0.7, 1.4, T), (0, 0, H - T / 2), wood, rot=(0, 0, 90), bevel=0.012, ol=0.01, parent=root)
    cz.box(name + '_foot', (0.075, 0.64, 0.022), (-0.635, 0, 0), dark, bevel=0.006, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_leg', (0.05, 0.62, H - T - 0.022), (-0.635, 0, 0.022), steel, bevel=0.008, ol=0.008, parent=root, origin='bottom')
    cz.box(name + '_modesty', (0.86, 0.02, 0.4), (MX, 0.27, H - T - 0.4), steel, bevel=0.005, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_plinth', (PW - 0.03, PD - 0.04, 0.05), (PX, 0.01, 0), dark, bevel=0.005, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_pedestal', (PW, PD, H - T - 0.05), (PX, 0, 0.05), steel, bevel=0.008, ol=0.008, parent=root, origin='bottom')
    fy = -PD / 2 - 0.011        # drawer fronts: 22 mm thick, proud of the pedestal face
    front = M('front', _shade(body, 1.06), tex='grain', tex_strength=0.03)
    for i, (z0, z1) in enumerate(((0.065, 0.3), (0.315, 0.515))):
        cz.box(f'{name}_front{i}', (PW - 0.024, 0.022, z1 - z0), (PX, fy, (z0 + z1) / 2), front, bevel=0.006, ol=0.006, parent=root)
        cz.box(f'{name}_handle{i}', (0.15, 0.02, 0.022), (PX, fy - 0.02, z1 - 0.035), dark, bevel=0.006, ol=0.004, parent=root)
    # top drawer on its own slide (dark cavity behind its front shows when it opens)
    cz.plane(name + '_cavity', PW - 0.05, 0.12, (PX, -PD / 2 - 0.0015, 0.595), hole, parent=root)
    dr = cz.empty(name + '_drawer', (PX, 0, 0), parent=root)
    dr.location.y = -0.3 * cz.clamp(drawer)
    cz.box(name + '_drawer_body', (PW - 0.06, 0.5, 0.1), (0, -PD / 2 + 0.251, 0.6), M('inner', _shade(body, 0.85)), bevel=0.004, ol=0.004, parent=dr)
    cz.plane(name + '_drawer_in', PW - 0.09, 0.47, (0, -PD / 2 + 0.251, 0.6515), hole, rot=(0, 0, 0), parent=dr)
    cz.box(name + '_front2', (PW - 0.024, 0.022, 0.13), (0, fy, 0.595), front, bevel=0.006, ol=0.006, parent=dr)
    cz.box(name + '_handle2', (0.15, 0.02, 0.022), (0, fy - 0.02, 0.625), dark, bevel=0.006, ol=0.004, parent=dr)
    cz.cyl(name + '_lock', 0.009, 0.006, (0.15, fy - 0.011, 0.63), M('chrome', '#d0d3d6'), rot=(90, 0, 0), verts=16, ol=0.002, parent=dr)

    if monitor: _computer(cz, name, root, M, dark, hole, screen, clutter).rotation_euler.z = math.radians(monitor_turn)
    if clutter: _clutter(cz, name, root, M, dark, hole)
    return root


def _computer(cz, name, root, M, dark, hole, screen, clutter):
    mon = cz.empty(name + '_monitor', (MX, 0.13, H), parent=root)
    cz.box(name + '_mbase', (0.26, 0.17, 0.018), (0, 0.02, 0), dark, bevel=0.007, ol=0.006, parent=mon, origin='bottom')
    cz.box(name + '_mneck', (0.065, 0.032, 0.2), (0, 0.075, 0.012), dark, bevel=0.006, ol=0.006, parent=mon, origin='bottom')
    cz.box(name + '_mback', (0.34, 0.05, 0.22), (0, 0.075, 0.29), dark, bevel=0.02, ol=0.007, parent=mon)
    cz.box(name + '_bezel', (0.58, 0.045, 0.35), (0, 0.035, 0.295), M('bezel', '#33363d', tex='grain', tex_strength=0.03), bevel=0.012, ol=0.008, parent=mon)
    png = screen or os.path.join(TEX, 'office_desk_screen.png')
    cz.plane(name + '_screen', 0.52, 0.2925, (0, 0.011, 0.307), cz.screen(name + '_screenm', png, strength=1.15), parent=mon)
    cz.box(name + '_led', (0.014, 0.004, 0.007), (0.25, 0.0105, 0.14), cz.glow('office_desk_led', '#6dff8a', 3.0), bevel=0, ol=0, parent=mon)
    if clutter:
        cz.plane(name + '_sticky', 0.08, 0.08, (0.24, 0.0095, 0.42), cz.toon('office_desk_stickym', img=os.path.join(TEX, 'office_desk_sticky.png'),
                 tex='paper', tex_strength=0.03), rot=(90, -8, 0), parent=mon)
    # wireless keyboard
    cz.box(name + '_kbd', (0.44, 0.15, 0.024), (MX, -0.16, H), M('kbd', '#cfcac0', tex='grain', tex_strength=0.03), bevel=0.006, ol=0.006, parent=root, origin='bottom')
    cz.plane(name + '_keys', 0.42, 0.13, (MX, -0.16, H + 0.0255), cz.toon('office_desk_keysm', img=os.path.join(TEX, 'office_desk_keys.png')), rot=(0, 0, 0), parent=root)
    # mouse on a pad, its cord to the grommet
    cz.box(name + '_pad', (0.22, 0.19, 0.004), (0.17, -0.17, H), M('pad', '#3f8f8c', tex='grain', tex_strength=0.04), bevel=0.0015, ol=0.003, parent=root, origin='bottom')
    cz.sphere(name + '_mouse', 0.05, (0.17, -0.18, H + 0.023), M('mouse', '#e8e4da', tex='grain', tex_strength=0.03), scale=(0.62, 1.0, 0.42), ol=0.004, parent=root, segs=32, rings=16)
    cz.cyl(name + '_wheel', 0.008, 0.007, (0.1665, -0.15, H + 0.038), dark, rot=(0, 90, 0), verts=16, ol=0, parent=root)
    cz.cyl(name + '_grommet', 0.028, 0.003, (0.0, 0.29, H), dark, verts=32, ol=0.003, parent=root)
    cz.cyl(name + '_grommet_in', 0.018, 0.0012, (0.0, 0.29, H + 0.003), hole, verts=32, ol=0, parent=root)
    cable = M('cable', '#2f3136')
    a = cz.empty(name + '_cord_a', (0.17, -0.125, H + 0.0105), parent=root)
    b = cz.empty(name + '_cord_b', (0.05, 0.14, H + 0.004), parent=root)
    c = cz.empty(name + '_cord_c', (0.0, 0.29, H + 0.008), parent=root)
    cz.limb(name + '_cord', a, b, c, 0.005, cable, root)
    a = cz.empty(name + '_mcable_a', (0.05, 0.095, 0.2), parent=mon)
    b = cz.empty(name + '_mcable_b', (-0.08, 0.34, H + 0.06), parent=root)
    c = cz.empty(name + '_mcable_c', (-0.01, 0.29, H + 0.008), parent=root)
    cz.limb(name + '_mcable', a, b, c, 0.007, cable, root)
    return mon


def _clutter(cz, name, root, M, dark, hole):
    # pen cup with two pens, a pencil and a ruler
    cup = cz.empty(name + '_cup', (0.55, 0.2, H), parent=root)
    cz.cyl(name + '_cupbody', 0.042, 0.105, (0, 0, 0), M('cup', '#e0a63a', tex='grain', tex_strength=0.04), bevel=0.004, ol=0.006, parent=cup)
    cz.cyl(name + '_cupin', 0.034, 0.002, (0, 0, 0.105), hole, ol=0, parent=cup)
    for i, (c1, c2, dx, dy, rx, ry, L, v) in enumerate((('#3a63c4', '#24407e', -0.012, 0.01, -10, -8, 0.16, 12),
                                                         ('#d6463c', '#8e2a24', 0.014, 0.008, -6, 12, 0.15, 12),
                                                         ('#f2c230', '#e88a96', 0.0, -0.014, 12, 2, 0.155, 6))):
        pv = cz.empty(f'{name}_pen{i}', (dx, dy, 0.03), parent=cup)
        pv.rotation_euler = (math.radians(rx), math.radians(ry), 0)
        cz.cyl(f'{name}_pen{i}_body', 0.0075, L, (0, 0, 0), M('pen' + str(i), c1), verts=v, ol=0.003, parent=pv)
        cz.cyl(f'{name}_pen{i}_cap', 0.0085, 0.028, (0, 0, L - 0.02), M('pencap' + str(i), c2), verts=v, ol=0.003, parent=pv)
    # mug with coffee and a curved handle
    mug = cz.empty(name + '_mug', (0.37, 0.08, H), parent=root)
    mug.rotation_euler.z = math.radians(-35)
    red = M('mug', '#d65a4a', tex='grain', tex_strength=0.04)
    cz.cyl(name + '_mugbody', 0.04, 0.095, (0, 0, 0), red, bevel=0.004, ol=0.006, parent=mug)
    cz.cyl(name + '_coffee', 0.034, 0.002, (0, 0, 0.0945), M('coffee', '#5b3a26'), ol=0, parent=mug)
    a = cz.empty(name + '_mh_a', (0.034, 0, 0.078), parent=mug)
    b = cz.empty(name + '_mh_b', (0.1, 0, 0.05), parent=mug)
    c = cz.empty(name + '_mh_c', (0.034, 0, 0.022), parent=mug)
    h = cz.limb(name + '_mughandle', a, b, c, 0.009, red, mug)
    cz.outline(h, 0.004)
    # coffee ring left by an earlier mug
    cz.plane(name + '_ring', 0.095, 0.095, (0.25, 0.04, H + 0.0012), cz.toon('office_desk_ringm', img=os.path.join(TEX, 'office_desk_ring.png'), alpha_clip=True),
             rot=(0, 0, 25), parent=root)
    # paper stack with a printed page and a pen on it
    paper = M('paper', '#f2efe6', tex='paper', tex_strength=0.03)
    st = cz.empty(name + '_papers', (0.5, -0.13, H), parent=root)
    st.rotation_euler.z = math.radians(-8)
    for i, ang in enumerate((3, -4, 1)):
        cz.box(f'{name}_sheet{i}', (0.21, 0.297, 0.003), (0, 0, 0.0035 * i), paper, rot=(0, 0, ang), bevel=0, ol=0.002, parent=st, origin='bottom')
    cz.plane(name + '_doc', 0.2, 0.283, (0, 0, 0.0035 * 2 + 0.0042), cz.toon('office_desk_docm', img=os.path.join(TEX, 'office_desk_doc.png'), tex='paper', tex_strength=0.03),
             rot=(0, 0, 1), parent=st)
    pen = cz.empty(name + '_lpen', (-0.06, -0.06, 0.0115 + 0.0075), parent=st)
    pen.rotation_euler = (0, math.radians(90), math.radians(32))
    cz.cyl(name + '_lpen_body', 0.0075, 0.15, (0, 0, 0), M('pen0', '#3a63c4'), verts=12, ol=0.003, parent=pen)
    cz.cyl(name + '_lpen_cap', 0.0085, 0.028, (0, 0, 0.13), M('pencap0', '#24407e'), verts=12, ol=0.003, parent=pen)
    # three binders (spines toward the worker) on an L bookend, back-left corner
    metal = M('bookend', '#9aa0a6', tex='grain', tex_strength=0.03)
    cz.box(name + '_bookend_foot', (0.15, 0.14, 0.004), (-0.608, 0.19, H), metal, bevel=0.001, ol=0.003, parent=root, origin='bottom')
    cz.box(name + '_bookend', (0.008, 0.14, 0.2), (-0.5355, 0.19, H + 0.004), metal, bevel=0.002, ol=0.004, parent=root, origin='bottom')
    for i, (c, hh) in enumerate((('#3f6fb5', 0.31), ('#d6463c', 0.28), ('#4f9a6a', 0.31))):
        x = -0.66 + i * 0.0485
        cz.box(f'{name}_binder{i}', (0.046, 0.26, hh), (x, 0.19, H + 0.004), M('binder' + str(i), c, tex='grain', tex_strength=0.04), bevel=0.006, ol=0.006, parent=root, origin='bottom')
        cz.plane(f'{name}_label{i}', 0.03, 0.085, (x, 0.19 - 0.13 - 0.0015, H + hh - 0.075), paper, parent=root)
        cz.cyl(f'{name}_pull{i}', 0.0105, 0.0015, (x, 0.19 - 0.13, H + 0.07), hole, rot=(90, 0, 0), verts=20, ol=0, parent=root)
    # tiny cactus in a pot, front-left corner
    pot = cz.empty(name + '_cactus', (-0.6, -0.22, H), parent=root)
    cz.cyl(name + '_pot', 0.034, 0.05, (0, 0, 0), M('pot', '#c8734a', tex='grain', tex_strength=0.05), r2=0.04, bevel=0.003, ol=0.005, parent=pot)
    cz.cyl(name + '_soil', 0.034, 0.002, (0, 0, 0.05), M('soil', '#5a4030'), ol=0, parent=pot)
    green = M('cactus', '#5f9e4e', tex='grain', tex_strength=0.05)
    cz.capsule(name + '_cactus_body', 0.02, 0.085, (0, 0, 0.035), green, ol=0.004, parent=pot)
    cz.capsule(name + '_cactus_arm', 0.011, 0.04, (0.022, 0, 0.065), green, ol=0.003, parent=pot)
    cz.sphere(name + '_flower', 0.008, (0, 0, 0.122), M('flower', '#e86a8a'), ol=0.002, parent=pot, segs=16, rings=8)


def _shade(hexc, k):
    h = hexc.lstrip('#')
    return '#' + ''.join(f'{max(0, min(255, int(int(h[i:i + 2], 16) * k))):02x}' for i in (0, 2, 4))
