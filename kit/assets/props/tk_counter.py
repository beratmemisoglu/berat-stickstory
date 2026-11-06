# Gas-station checkout counter (TICKETS): customer side -Y, the clerk stands behind at +Y.
# Speckled grey laminate top with a rounded edge, a green rubber counter mat ("THANK YOU! COME AGAIN") in the clear
# middle, a deep-red laminate front with a yellow / white / orange painted stripe, scuffs, a "LOTTERY SOLD HERE" and a
# "WE CARD" sticker, a recessed kick plate. Right: the POS (dark base, cash drawer + keypad on the clerk side, a lit
# screen facing the clerk, the hand-written "NO CHECKS!!" note taped on the customer side), a green "READY" pole display
# facing the customer, a card reader on a stand with its cable, a receipt printer with a curl of paper, a take-a-penny
# tray. Left: a mini gum rack, a tub of lighters, a jar of jerky sticks. Clerk side: open shelves with bag bundles, a
# receipt-roll box, a box of ticket packs, paper towels and a drop safe.
# Floor prop: root at the floor centre, front (customer side) -Y.
import math, os
from mathutils import Vector

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (2.24, 0.78, 0.8), 'anchor': 'floor centre, customer side -Y (clerk at +Y); POS monitor reaches height + 0.49',
        'top': 'z = height kw (default 0.8: the 1.3 m clerk shows from the belly up, like the reference; 1.0 hides him to the eyes)', 'clear': 'top x -0.45 .. 0.45, y -0.35 .. 0.30 is free (the mat, top surface z 1.006): cards, money, '
        'the dispenser or hands go there', 'clerk': 'stand the clerk at y ~ +0.6 (behind the open back shelves)',
        'animate': [], 'params': "mat=True, items=True (the impulse items and register stuff), screen='tex/tk_counter_pos.png' "
        "(the clerk's POS picture), pole='tex/tk_counter_pole.png' (customer display picture), height=0.8 (counter top z; the brief's 1.0 hides a 1.3 m clerk up to the eyes), shavings=False (silver scratch-off flakes + a coin on the mat, right of centre), impulse=True (gum rack, lighters, jerky jar on the left end; False frees x -1.1 .. -0.45), turn=0 (degrees about Z, for viewing the clerk side)"}

W, D, H = 2.2, 0.75, 1.0
FY = -D / 2
TOP_T = 0.045


def _tex(n): return os.path.join(TEX, n)


def _segment(cz, nm, a, b, r, mat, parent, ol):
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.capsule(nm, r, d.length + 2 * r, tuple(a - d.normalized() * r), mat, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def build(cz, name='tk_counter', mat=True, items=True, screen=None, pole=None, shavings=False, height=0.8, impulse=True, turn=0):
    import random
    rnd = random.Random(7)
    H = float(height)              # counter top height (the stripe + stickers follow it)
    root = cz.empty(name)

    def M(key, c, **k): return cz.toon(f'tk_ctr_{key}', c, **k)
    lam = M('lam', '#7e1a1f', tex='grain', tex_strength=0.05)
    top = M('top', '#959a98', pattern=('speckle', 1.6, '#5f6462'), tex='grain', tex_strength=0.05)
    kick = M('kick', '#2a2622', tex='grain', tex_strength=0.06)
    mel = M('mel', '#c9c1b0', tex='grain', tex_strength=0.05)
    dark = M('dark', '#2e3036', tex='grain', tex_strength=0.04)
    mid = M('mid', '#5b5f68', tex='grain', tex_strength=0.04)
    chrome = M('chrome', '#c3c8cf', lift=0.5)
    black = M('black', '#18171b')

    def P(nm, w, h, loc, img, rot=(90, 0, 0), parent=None, lift=0.72, clip=False):
        return cz.plane(f'{name}_{nm}', w, h, loc, cz.toon('tk_ctr_' + os.path.splitext(img)[0], img=_tex(img), lift=lift, alpha_clip=clip), rot=rot, parent=parent or root)

    # ---- carcass: front panel, end panels, kick plate, top with a rounded edge
    cz.box(name + '_front', (W, 0.03, H - TOP_T - 0.1), (0, FY + 0.015, 0.1), lam, bevel=0.004, ol=0.009, parent=root, origin='bottom')
    P('frontprint', W - 0.02, H - TOP_T - 0.1, (0, FY - 0.0013, 0.1 + (H - TOP_T - 0.1) / 2), 'tk_counter_front.png', lift=0.68)
    for s in (-1, 1):
        cz.box(f'{name}_end{s:+d}', (0.035, D - 0.03, H - TOP_T), (s * (W / 2 - 0.0175), 0.0, 0), lam, bevel=0.006, ol=0.009, parent=root, origin='bottom')
    cz.box(name + '_kick', (W - 0.07, 0.03, 0.1), (0, FY + 0.045, 0), kick, bevel=0.003, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_top', (W + 0.04, D + 0.03, TOP_T), (0, -0.015, H - TOP_T), top, bevel=0.018, ol=0.009, parent=root, origin='bottom')
    # stickers above the stripe
    P('lottery', 0.36, 0.18, (-0.55, FY - 0.0026, H - 0.17), 'tk_counter_lottery.png', clip=True)
    P('wecard', 0.15, 0.125, (-0.24, FY - 0.0026, H - 0.16), 'tk_counter_card.png', rot=(90, 4, 0), clip=True)
    P('camera', 0.2, 0.11, (0.62, FY - 0.0026, H - 0.14), 'tk_counter_camera.png', rot=(90, -3, 0), clip=True)

    # ---- clerk side: deck, shelf, dividers, stock
    cz.box(name + '_deck', (W - 0.07, D - 0.06, 0.03), (0, 0.0, 0.1), mel, bevel=0.003, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_shelf', (W - 0.07, D - 0.1, 0.025), (0, 0.02, 0.52), mel, bevel=0.003, ol=0.005, parent=root, origin='bottom')
    for x in (-0.5, 0.5):
        cz.box(f'{name}_div{x:+.1f}', (0.025, D - 0.06, H - TOP_T - 0.13), (x, 0.0, 0.13), mel, bevel=0.003, ol=0.005, parent=root, origin='bottom')
    if items:
        bagm = M('bag', '#ece9e0', tex='paper', tex_strength=0.05)
        for k, x in enumerate((-0.85, -0.6)):
            cz.box(f'{name}_bags{k}', (0.22, 0.26, 0.13), (x, 0.12, 0.545), bagm, rot=(0, 0, 4 - 8 * k), bevel=0.02, ol=0.004, parent=root, origin='bottom')
            P(f'bagsprint{k}', 0.15, 0.1, (x + 0.004 * (1 - 2 * k), 0.12 + 0.131 + 0.0013, 0.61), 'tk_counter_bags.png', rot=(90, 0, 180 + 4 - 8 * k), lift=0.7)
        card = M('card', '#c8955a', tex='paper', tex_strength=0.06)
        cz.box(name + '_rollbox', (0.28, 0.24, 0.16), (-0.25, 0.1, 0.13), card, rot=(0, 0, -5), bevel=0.003, ol=0.005, parent=root, origin='bottom')
        for k in range(3):
            cz.cyl(f'{name}_roll{k}', 0.035, 0.06, (-0.33 + k * 0.08, 0.05, 0.29), M('rollp', '#f2efe6'), verts=20, ol=0.003, parent=root)
        cz.cyl(name + '_towels', 0.06, 0.24, (-0.2, 0.16, 0.606), M('towel', '#f0ece2', tex='paper', tex_strength=0.06), rot=(0, 90, 0), verts=24, ol=0.004, parent=root).location.x = -0.32
        for k, c in enumerate(('#c41c35', '#1b5fc4', '#c98a0c', '#23883a', '#6a28a8')):
            cz.box(f'{name}_pack{k}', (0.11, 0.07, 0.035), (0.2 + (k % 3) * 0.003, 0.14, 0.545 + k * 0.036), M('pack' + str(k), c, tex='grain'), rot=(0, 0, rnd.uniform(-8, 8)), bevel=0.003, ol=0.003, parent=root, origin='bottom')
        # lower left: a shrink-wrapped 6-pack of water and a sleeve of cups; upper right: first-aid box, binder, tape
        water = M('water', '#6fb6e6', lift=0.55, emit=0.12)
        for k in range(6):
            x, y = -0.92 + (k % 3) * 0.075, 0.08 + (k // 3) * 0.075
            cz.cyl(f'{name}_water{k}', 0.035, 0.19, (x, y, 0.13), water, verts=20, bevel=0.008, ol=0.003, parent=root)
            cz.cyl(f'{name}_watercap{k}', 0.013, 0.02, (x, y, 0.32), M('watercap', '#2f6fd1'), verts=12, ol=0.002, parent=root)
        cz.box(name + '_waterwrap', (0.235, 0.16, 0.06), (-0.845, 0.1175, 0.18), M('wrap', '#d6eef7', lift=0.5), bevel=0.02, ol=0.003, parent=root, origin='bottom')
        for k in range(2):
            cz.cyl(f'{name}_cups{k}', 0.04, 0.26, (-0.64 + 0.0, 0.06 + k * 0.09, 0.13), M('cupsleeve', '#e9e3d2', tex='paper'), r2=0.046, verts=20, ol=0.003, parent=root)
        aid = cz.box(name + '_firstaid', (0.24, 0.13, 0.16), (0.72, 0.17, 0.545), M('aid', '#efebe2', tex='grain'), rot=(0, 0, -6), bevel=0.012, ol=0.004, parent=root, origin='bottom')
        redc = M('aidred', '#c41c2a')
        cz.box(name + '_aidx', (0.07, 0.003, 0.022), (0, 0.0665, 0.08), redc, bevel=0, ol=0, parent=aid)
        cz.box(name + '_aidy', (0.022, 0.003, 0.07), (0, 0.0665, 0.08), redc, bevel=0, ol=0, parent=aid)
        cz.box(name + '_binder', (0.05, 0.26, min(0.3, H - TOP_T - 0.56)), (0.95, 0.05, 0.545), M('binder', '#1b4fa8', tex='grain'), rot=(0, -6, 0), bevel=0.006, ol=0.004, parent=root, origin='bottom')
        cz.cyl(name + '_tape', 0.04, 0.03, (0.57, 0.25, 0.545), M('tapeacc', '#cfc39c'), verts=24, ol=0.003, parent=root)
        cz.cyl(name + '_tapehole', 0.022, 0.0305, (0.57, 0.25, 0.545), M('tapehole', '#6a5a3a'), verts=20, ol=0.0, parent=root)
        cz.box(name + '_safe', (0.34, 0.32, 0.36), (0.78, 0.06, 0.13), M('safe', '#4a4f57', tex='grain'), bevel=0.012, ol=0.006, parent=root, origin='bottom')
        P('safefront', 0.3, 0.3, (0.78, 0.06 + 0.16 + 0.0013, 0.31), 'tk_counter_safe.png', rot=(90, 0, 180), lift=0.7)

    # ---- counter mat (clear area)
    if mat:
        cz.box(name + '_mat', (0.9, 0.44, 0.006), (0, -0.1, H), M('mat', '#1d4a38', pattern=('tiles', 0.012, '#143326')), bevel=0.003, ol=0.003, parent=root, origin='bottom')
        P('matprint', 0.82, 0.383, (0, -0.1, H + 0.006 + 0.0012), 'tk_counter_mat.png', rot=(0, 0, 0), clip=True, lift=0.6)

    root.rotation_euler.z = math.radians(turn)
    if not items:
        return root
    Z = H
    # ---- POS: base + drawer + keypad (clerk side), screen facing the clerk, NO CHECKS note on the customer side
    px, py = 0.8, 0.1
    cz.box(name + '_posbase', (0.4, 0.34, 0.11), (px, py, Z), dark, bevel=0.012, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_drawer', (0.36, 0.016, 0.075), (px, py + 0.17 + 0.006, Z + 0.05), mid, bevel=0.004, ol=0.004, parent=root)
    cz.box(name + '_drawerslot', (0.12, 0.006, 0.012), (px, py + 0.186, Z + 0.07), black, bevel=0.0, ol=0.0, parent=root)
    cz.cyl(name + '_key', 0.01, 0.006, (px + 0.13, py + 0.184, Z + 0.045), chrome, rot=(-90, 0, 0), verts=16, ol=0.002, parent=root)
    kp = cz.box(name + '_keypad', (0.3, 0.13, 0.02), (px, py + 0.09, Z + 0.12), mid, rot=(-9, 0, 0), bevel=0.004, ol=0.004, parent=root)
    cz.plane(name + '_keys', 0.28, 0.115, (0, 0, 0.0113), cz.toon('tk_ctr_keypadm', img=_tex('tk_counter_keypad.png'), lift=0.7), rot=(0, 0, 180), parent=kp)
    cz.cyl(name + '_neck', 0.022, 0.14, (px, py - 0.06, Z + 0.11), dark, verts=20, ol=0.004, parent=root)
    mon = cz.box(name + '_monitor', (0.34, 0.04, 0.24), (px, py - 0.06, Z + 0.36), dark, rot=(12, 0, 0), bevel=0.01, ol=0.006, parent=root)
    cz.plane(name + '_posscreen', 0.3, 0.205, (0, 0.02 + 0.0013, 0.004), cz.screen(name + '_posscreenm', screen or _tex('tk_counter_pos.png'), 1.15), rot=(90, 0, 180), parent=mon)
    cz.box(name + '_monlogo', (0.06, 0.004, 0.014), (0, -0.0215, -0.09), chrome, bevel=0.0, ol=0.0, parent=mon)
    P('nochecks', 0.13, 0.087, (px - 0.07, py - 0.17 - 0.0015, Z + 0.058), 'tk_counter_nochecks.png', rot=(90, -4, 0), clip=True, lift=0.75)
    # receipt printer with a curl of paper
    cz.box(name + '_printer', (0.15, 0.18, 0.11), (0.53, 0.24, Z), dark, bevel=0.015, ol=0.005, parent=root, origin='bottom')
    cz.box(name + '_printerslot', (0.1, 0.012, 0.004), (0.53, 0.19, Z + 0.11), black, bevel=0.0, ol=0.0, parent=root)
    rc = cz.empty(name + '_receiptpv', (0.53, 0.19, Z + 0.112), parent=root); rc.rotation_euler = (math.radians(-14), 0, 0)
    cz.plane(name + '_receipt', 0.08, 0.15, (0, 0, 0.075), cz.toon('tk_ctr_receiptm', img=_tex('tk_counter_receipt.png'), lift=0.65), rot=(90, 0, 180), parent=rc)
    rc2 = cz.empty(name + '_receiptpv2', (0, 0, 0.15), parent=rc); rc2.rotation_euler = (math.radians(-55), 0, 0)
    cz.plane(name + '_receipt2', 0.08, 0.05, (0, 0, 0.025), cz.toon('tk_ctr_receiptm', img=_tex('tk_counter_receipt.png')), rot=(90, 0, 180), parent=rc2)
    # customer pole display
    qx, qy = 0.97, -0.17
    cz.cyl(name + '_polebase', 0.05, 0.014, (qx, qy, Z), dark, verts=24, bevel=0.004, ol=0.004, parent=root)
    cz.cyl(name + '_pole', 0.012, 0.3, (qx, qy, Z + 0.014), mid, verts=16, ol=0.003, parent=root)
    pd = cz.box(name + '_poledisp', (0.25, 0.055, 0.085), (qx - 0.04, qy, Z + 0.35), dark, rot=(-6, 0, 0), bevel=0.008, ol=0.005, parent=root)
    cz.plane(name + '_polescreen', 0.22, 0.07, (0, -0.0275 - 0.0013, 0), cz.screen(name + '_polescreenm', pole or _tex('tk_counter_pole.png'), 1.15), parent=pd)
    # card reader on a stand + its cable to the POS
    rx, ry = 0.55, -0.25
    cz.cyl(name + '_readbase', 0.055, 0.012, (rx, ry, Z), dark, verts=24, bevel=0.004, ol=0.004, parent=root)
    cz.cyl(name + '_readpole', 0.013, 0.12, (rx, ry, Z + 0.012), mid, verts=16, ol=0.003, parent=root)
    rh = cz.box(name + '_reader', (0.105, 0.035, 0.165), (rx, ry, Z + 0.2), dark, rot=(-24, 0, 0), bevel=0.01, ol=0.005, parent=root)
    cz.plane(name + '_readface', 0.09, 0.15, (0, -0.0175 - 0.0013, 0), cz.toon('tk_ctr_readerm', img=_tex('tk_counter_reader.png'), emit=0.25, lift=0.7), parent=rh)
    cz.box(name + '_readslot', (0.07, 0.01, 0.008), (0, -0.01, -0.086), black, bevel=0.0, ol=0.002, parent=rh)
    pts = [(rx + 0.02, ry + 0.045, Z + 0.007), (rx + 0.06, ry + 0.16, Z + 0.007), (rx + 0.1, ry + 0.25, Z + 0.007), (px - 0.2, py - 0.08, Z + 0.03)]
    for k in range(len(pts) - 1):
        _segment(cz, f'{name}_cable{k}', pts[k], pts[k + 1], 0.006, black, root, 0.002)
    # take-a-penny tray + tent card
    tx, ty = 0.74, -0.31
    cz.box(name + '_penny', (0.12, 0.08, 0.016), (tx, ty, Z), M('pennytray', '#3a2a22', tex='grain'), bevel=0.006, ol=0.004, parent=root, origin='bottom')
    for k in range(7):
        c = '#b8763a' if k % 3 else '#c9ced4'
        cz.cyl(f'{name}_coin{k}', 0.0095, 0.002, (tx + rnd.uniform(-0.04, 0.04), ty + rnd.uniform(-0.022, 0.022), Z + 0.016 + 0.002 * (k % 2)),
               M('coin' + c[1:], c, lift=0.55), verts=16, ol=0.0015, parent=root)
    tc = cz.box(name + '_tent', (0.11, 0.006, 0.04), (tx, ty + 0.052, Z + 0.02), M('tent', '#f4efe2'), rot=(-12, 0, 0), bevel=0.0015, ol=0.003, parent=root)
    cz.plane(name + '_tentprint', 0.104, 0.036, (0, -0.003 - 0.0013, 0), cz.toon('tk_ctr_pennym', img=_tex('tk_counter_penny.png'), lift=0.7), parent=tc)

    # service bell, clerk-side left of the mat
    bx, by = -0.53, 0.17
    cz.cyl(name + '_bellbase', 0.042, 0.014, (bx, by, Z), black, verts=24, bevel=0.004, ol=0.003, parent=root)
    cz.sphere(name + '_bell', 0.036, (bx, by, Z + 0.012), M('bell', '#d9b44a', lift=0.5), ol=0.003, parent=root, segs=32, rings=16)
    cz.cyl(name + '_bellpin', 0.006, 0.014, (bx, by, Z + 0.046), chrome, verts=10, ol=0.0015, parent=root)
    cz.sphere(name + '_bellknob', 0.009, (bx, by, Z + 0.062), black, ol=0.0015, parent=root, segs=12, rings=8)
    # scratch-off shavings + a scratching coin on the mat (kw shavings: the clear area is otherwise empty)
    if shavings and mat:
        sh = M('shaving', '#a9aeb6', lift=0.6)
        for k in range(36):
            a, r = rnd.uniform(0, 6.283), abs(rnd.gauss(0, 0.05))
            cz.box(f'{name}_shaving{k}', (rnd.uniform(0.004, 0.009), rnd.uniform(0.003, 0.006), 0.0008),
                   (0.22 + r * math.cos(a) * 1.4, -0.2 + r * math.sin(a), H + 0.0082 + 0.0006 * (k % 3)), sh, rot=(0, 0, rnd.uniform(0, 180)), bevel=0.0, ol=0.0, parent=root)
        cz.cyl(name + '_scratchcoin', 0.012, 0.0018, (0.31, -0.25, H + 0.008), M('coin_c9ced4', '#c9ced4', lift=0.55), verts=20, ol=0.0012, parent=root)
    # ---- impulse items on the left (impulse=False leaves x -1.1 .. -0.45 free, e.g. for a display)
    if not impulse:
        return root
    # mini gum rack: three stepped tiers of packs between black side plates
    gx, gy = -0.9, -0.25
    for s in (-1, 1):
        cz.box(f'{name}_gumside{s:+d}', (0.012, 0.16, 0.19), (gx + s * 0.136, gy + 0.05, Z), black, bevel=0.003, ol=0.004, parent=root, origin='bottom')
    for k in range(3):
        y, z = gy + k * 0.05, Z + 0.005 + k * 0.06
        cz.box(f'{name}_gumshelf{k}', (0.26, 0.055, 0.008), (gx, y, z), black, bevel=0.002, ol=0.003, parent=root, origin='bottom')
        cz.box(f'{name}_gumrow{k}', (0.25, 0.03, 0.058), (gx, y - 0.005, z + 0.008), black, bevel=0.002, ol=0.003, parent=root, origin='bottom')
        P(f'gumface{k}', 0.25, 0.059, (gx, y - 0.02 - 0.0013, z + 0.008 + 0.029), f'tk_counter_gum{k}.png', lift=0.72)
    # tub of lighters
    lx, ly = -0.62, -0.28
    tub = M('tub', '#1b4fa8', tex='grain')
    cz.box(name + '_lightertub', (0.095, 0.095, 0.08), (lx, ly, Z), tub, bevel=0.008, ol=0.004, parent=root, origin='bottom')
    cz.box(name + '_lightertubin', (0.08, 0.08, 0.002), (lx, ly, Z + 0.08), black, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    P('lighterlabel', 0.085, 0.042, (lx, ly - 0.0475 - 0.0013, Z + 0.04), 'tk_counter_lighters.png', lift=0.7)
    cols = ('#e0302a', '#ffd23a', '#2fae52', '#d42c8a', '#1fa3e0', '#f07a1c', '#7a3fd0', '#e0302a', '#23c4b0')
    for k in range(9):
        i, j = k % 3, k // 3
        x, y = lx + (i - 1) * 0.026, ly + (j - 1) * 0.024
        pv = cz.empty(f'{name}_lighter{k}', (x, y, Z + 0.035), parent=root, size=0.01)
        pv.rotation_euler = (math.radians(rnd.uniform(-7, 7)), math.radians(rnd.uniform(-7, 7)), math.radians(rnd.uniform(-10, 10)))
        hgt = 0.072 + rnd.uniform(-0.006, 0.006)
        cz.box(f'{name}_lighter{k}_b', (0.021, 0.011, hgt), (0, 0, 0), M('lt' + cols[k][1:], cols[k], emit=0.05), bevel=0.003, ol=0.0018, parent=pv, origin='bottom')
        cz.box(f'{name}_lighter{k}_h', (0.0215, 0.0115, 0.012), (0, 0, hgt), chrome, bevel=0.002, ol=0.0015, parent=pv, origin='bottom')
        cz.box(f'{name}_lighter{k}_t', (0.008, 0.006, 0.004), (0.005, 0, hgt - 0.002), M('ltred', '#c41c2a'), bevel=0.0, ol=0.0, parent=pv, origin='bottom').location.y = -0.006
    # jar of jerky sticks
    jx, jy = -0.74, -0.04
    cz.cyl(name + '_jar', 0.058, 0.13, (jx, jy, Z), M('jar', '#9fcfd6', lift=0.5, emit=0.08), verts=36, bevel=0.006, ol=0.004, parent=root)
    cz.cyl(name + '_jarrim', 0.061, 0.012, (jx, jy, Z + 0.124), M('jarrim', '#c03a2a'), verts=36, bevel=0.003, ol=0.003, parent=root)
    cz.cyl(name + '_jarin', 0.053, 0.002, (jx, jy, Z + 0.136), M('jarin', '#5a2a1a'), verts=36, ol=0.0, parent=root)
    cz.cyl(name + '_jarband', 0.0595, 0.05, (jx, jy, Z + 0.035), M('jarband', '#8e1f1c'), verts=36, ol=0.0, parent=root)
    P('jerkylabel', 0.07, 0.035, (jx, jy - 0.0595 - 0.0016, Z + 0.06), 'tk_counter_jerky.png', lift=0.7)
    for k in range(11):
        a = 2 * math.pi * k / 11 + 0.3
        rr = 0.03 if k % 2 else 0.018
        pv = cz.empty(f'{name}_stick{k}', (jx + rr * math.cos(a), jy + rr * math.sin(a), Z + 0.01), parent=root, size=0.01)
        pv.rotation_euler = (math.radians(-8 * math.sin(a)), math.radians(8 * math.cos(a)), 0)
        c = ('#a8231a', '#6e2a16', '#c9541c')[k % 3]
        hgt = 0.19 + rnd.uniform(-0.012, 0.012)
        cz.cyl(f'{name}_stick{k}_m', 0.0068, hgt, (0, 0, 0), M('jk' + c[1:], c), verts=12, ol=0.0018, parent=pv)
        cz.cyl(f'{name}_stick{k}_tip', 0.0071, 0.016, (0, 0, hgt - 0.03), M('jktip', '#f2e6c8'), verts=12, ol=0.0, parent=pv)
    return root
