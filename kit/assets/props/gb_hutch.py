# BELL: kitchen hutch / Welsh dresser, 1.3 m wide, 1.9 m tall, back at y = 0 against the wall.
# Lower cupboard: plinth, two drawers with brass cup pulls, two panelled doors with knobs, a thick countertop holding
# three painted tin canisters (FLOUR, SUGAR, BEANS: tex/gb_hutch_<word>.png) and a brown crock with a wooden spoon.
# Upper rack: an oxblood board back, two shelves with plate rails and eight blue-white plates standing
# (tex/gb_hutch_plate.png), five cups on brass hooks under the lower shelf, a scalloped valance and a cornice.
# Floor prop: root at the floor centre of the back edge (back at y = 0, the front toward -Y).
import math, os, subprocess

META = {'size': (1.4, 0.52, 1.9), 'anchor': 'floor, centre of the BACK edge (y = 0 is the wall, front toward -Y)',
        'animate': [], 'counter_z': 0.86, 'counter_front_y': -0.5,
        'params': "wood (hex), back (rack back hex), plates=True|False, cups=True|False, jars=True|False"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _png(cz, what, fname):
    p = os.path.join(TEX, fname)
    if not os.path.exists(p):
        py = cz.py()
        try:
            subprocess.run([py, os.path.join(TEX, 'make_gb_interior.py'), what], timeout=90, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e: print('CZ gb png failed', what, e)
    return p if os.path.exists(p) else None


def hbox(cz, nm, sx, sy, sz, loc, mat, **kw):
    """Box long in X with the wood grain along X (built long in local Y, turned 90 deg about Z)."""
    return cz.box(nm, (sy, sx, sz), loc, mat, rot=(0, 0, 90), **kw)


def build(cz, name='gb_hutch', wood='#5e371c', back='#6a2a20', plates=True, cups=True, jars=True):
    root = cz.empty(name)
    wd = cz.toon(name + '_woodm', wood, tex='wood', tex_scale=7.0, tex_strength=0.16)
    wl = cz.toon(name + '_panelm', '#7c4a26', tex='wood', tex_scale=9.0, tex_strength=0.18)
    bk = cz.toon(name + '_backm', back, pattern=('planks', 0.155, 3.0, '#2a1610'), tex='grain', tex_strength=0.08)
    br = cz.toon(name + '_brassm', '#a87a26', tex='grain', tex_strength=0.06)

    # ---- lower cupboard
    cz.box(name + '_plinth', (1.3, 0.47, 0.08), (0, -0.235, 0), cz.toon(name + '_plinthm', '#3e2414', tex='wood', tex_scale=6.0, tex_strength=0.12),
           bevel=0.008, ol=0.008, parent=root, origin='bottom')
    cz.box(name + '_carcass', (1.26, 0.45, 0.74), (0, -0.225, 0.08), wd, bevel=0.008, ol=0.009, parent=root, origin='bottom')
    yf = -0.45
    for k, x in (('l', -0.305), ('r', 0.305)):
        cz.box(f'{name}_door_{k}', (0.57, 0.02, 0.52), (x, yf - 0.009, 0.4), wd, bevel=0.01, ol=0.007, parent=root)
        cz.box(f'{name}_door_panel_{k}', (0.43, 0.012, 0.37), (x, yf - 0.024, 0.4), wl, bevel=0.016, ol=0.005, parent=root)
        cz.sphere(f'{name}_door_knob_{k}', 0.022, (x + (-0.24 if x > 0 else 0.24), yf - 0.03, 0.42), br, ol=0.004, parent=root, segs=16, rings=8)
        hbox(cz, f'{name}_drawer_{k}', 0.57, 0.02, 0.115, (x, yf - 0.009, 0.735), wl, bevel=0.008, ol=0.006, parent=root)
        cz.box(f'{name}_pull_{k}', (0.09, 0.016, 0.03), (x, yf - 0.026, 0.735), br, bevel=0.006, ol=0.004, parent=root)
    hbox(cz, name + '_counter', 1.36, 0.52, 0.045, (0, -0.26, 0.82), wd, bevel=0.01, ol=0.009, parent=root, origin='bottom')
    ZC = 0.865
    for k, x in (('l', -0.633), ('r', 0.633)):   # side boards turned so the side faces get vertical grain, not blotches
        cz.box(f'{name}_sideboard_{k}', (0.44, 0.008, 0.72), (x, -0.225, 0.09), wd, rot=(0, 0, 90), bevel=0.003, ol=0.0, parent=root, origin='bottom')

    # ---- upper rack
    RD = 0.27
    ZT = 1.84
    for k, x in (('l', -0.635), ('r', 0.635)):
        cz.box(f'{name}_side_{k}', (RD, 0.03, ZT - ZC), (x, -RD / 2, ZC), wd, rot=(0, 0, 90), bevel=0.006, ol=0.008, parent=root, origin='bottom')
    cz.box(name + '_back', (1.24, 0.02, ZT - ZC), (0, -0.012, ZC), bk, bevel=0.003, ol=0.006, parent=root, origin='bottom')
    shelves = (1.17, 1.47)
    for j, zz in enumerate(shelves):
        hbox(cz, f'{name}_shelf{j}', 1.24, RD - 0.02, 0.028, (0, -RD / 2 - 0.01, zz), wd, bevel=0.006, ol=0.007, parent=root, origin='bottom')
        hbox(cz, f'{name}_rail{j}', 1.24, 0.016, 0.03, (0, -0.125, zz + 0.08), wl, bevel=0.005, ol=0.005, parent=root)
    hbox(cz, name + '_valance', 1.24, 0.022, 0.07, (0, -RD + 0.01, ZT - 0.07), wd, bevel=0.006, ol=0.007, parent=root, origin='bottom')
    for i in range(7):
        x = -0.54 + i * 0.18
        cz.cyl(f'{name}_scallop{i}', 0.045, 0.018, (x, -RD + 0.022, ZT - 0.07), wd, rot=(90, 0, 0), ol=0.006, parent=root, verts=24)
    hbox(cz, name + '_cornice', 1.4, RD + 0.06, 0.035, (0, -RD / 2 - 0.02, ZT), wd, bevel=0.01, ol=0.009, parent=root, origin='bottom')
    hbox(cz, name + '_cornice2', 1.34, RD + 0.03, 0.025, (0, -RD / 2 - 0.01, ZT + 0.035), wd, bevel=0.008, ol=0.008, parent=root, origin='bottom')

    # ---- plates standing on the shelves, leaning back 12 deg against the wall, held by the rail
    if plates:
        pp = _png(cz, 'plate', 'gb_hutch_plate.png')
        pm = cz.toon(name + '_platem_gb_hutch_plate', '#e8e2d6', img=pp, lift=0.62, alpha_clip=True) if pp else '#e8e2d6'
        pb = cz.toon(name + '_platebasem', '#e0dacd', tex='grain', tex_strength=0.03)
        tilt = 12.0; t = math.radians(tilt)
        n = (0.0, -math.cos(t), math.sin(t))    # plate face normal (forward, a bit up)
        for j, zz in enumerate(shelves):
            for i in range(4):
                r = (0.115 if (i + j) % 2 == 0 else 0.1) - 0.012 * j    # top shelf: smaller plates clear the valance
                x = -0.42 + i * 0.28
                cy, cz_ = -0.06 - 0.02, zz + 0.028 + r * math.cos(t) + 0.004
                cz.cyl(f'{name}_plate{j}{i}', r, 0.016, (x, cy, cz_), pb, rot=(90 - tilt, 0, 0), bevel=0.003, ol=0.005, parent=root, verts=40)
                d = 0.0175
                cz.plane(f'{name}_plate{j}{i}_art', 2 * r, 2 * r, (x, cy + n[1] * d, cz_ + n[2] * d), pm, rot=(90 - tilt, 0, 0), parent=root)

    # ---- cups on hooks under the lower shelf
    if cups:
        cm_ = [cz.toon(f'{name}_cup{k}m', c, tex='grain', tex_strength=0.04) for k, c in enumerate(('#e2dccd', '#3a5a94', '#e2dccd', '#b8443a', '#e2dccd'))]
        for i in range(5):
            x = -0.48 + i * 0.24
            zh = shelves[0]
            cz.box(f'{name}_hook{i}', (0.008, 0.008, 0.035), (x, -RD + 0.05, zh - 0.0175), br, bevel=0, ol=0.002, parent=root)
            cz.cyl(f'{name}_cup{i}', 0.04, 0.065, (x, -RD + 0.05, zh - 0.12), cm_[i], r2=0.045, bevel=0.005, ol=0.005, parent=root, verts=24)
            cz.box(f'{name}_cup{i}_handle', (0.012, 0.03, 0.045), (x, -RD + 0.05 + 0.04, zh - 0.08), cm_[i], bevel=0.005, ol=0.003, parent=root)
            cz.cyl(f'{name}_cup{i}_band', 0.0435, 0.012, (x, -RD + 0.05, zh - 0.075), cz.toon(name + '_cupbandm', '#34558c'), ol=0, parent=root, verts=24)

    # ---- tin canisters with labels + a crock on the counter
    if jars:
        tins = (('flour', '#2f5c46', -0.42), ('sugar', '#8a2a24', -0.25), ('beans', '#2c4a7a', -0.08))
        for word, c, x in tins:
            tm = cz.toon(f'{name}_tin_{word}m', c, tex='grain', tex_strength=0.06)
            h = 0.21 if word == 'flour' else 0.18 if word == 'sugar' else 0.15
            y = -0.36
            cz.box(f'{name}_tin_{word}', (0.15, 0.14, h), (x, y, ZC), tm, bevel=0.012, ol=0.006, parent=root, origin='bottom')
            cz.box(f'{name}_tin_{word}_lid', (0.16, 0.15, 0.03), (x, y, ZC + h), tm, bevel=0.01, ol=0.005, parent=root, origin='bottom')
            cz.sphere(f'{name}_tin_{word}_knob', 0.014, (x, y, ZC + h + 0.034), br, ol=0.003, parent=root, segs=12, rings=6)
            lp = _png(cz, 'labels', f'gb_hutch_{word}.png')
            if lp:
                cz.plane(f'{name}_tin_{word}_label', 0.12, 0.073, (x, y - 0.0713, ZC + h * 0.5),
                         cz.toon(f'{name}_labelm_gb_hutch_{word}', '#e6d9b4', img=lp, lift=0.7), parent=root)
        crock = cz.toon(name + '_crockm', '#8a5530', tex='grain', tex_strength=0.07)
        cz.cyl(name + '_crock', 0.085, 0.16, (0.32, -0.33, ZC), crock, r2=0.075, bevel=0.01, ol=0.006, parent=root, verts=32)
        cz.cyl(name + '_crock_rim', 0.08, 0.02, (0.32, -0.33, ZC + 0.16), cz.toon(name + '_crockrimm', '#d8c69a'), bevel=0.005, ol=0.004, parent=root, verts=32)
        cz.cyl(name + '_crock_in', 0.066, 0.003, (0.32, -0.33, ZC + 0.18), cz.toon(name + '_crockinm', '#3a2618'), ol=0, parent=root, verts=24)
        sp = cz.cyl(name + '_spoon', 0.008, 0.26, (0.34, -0.33, ZC + 0.1), cz.toon(name + '_spoonm', '#b08048', tex='wood', tex_scale=12.0), rot=(0, 18, 0), ol=0.003, parent=root, verts=10)
        cz.box(name + '_cloth', (0.2, 0.14, 0.012), (0.55, -0.37, ZC), cz.toon(name + '_teatowelm', '#d8cfb8', pattern=('tiles', 0.04, '#b8443a')), rot=(0, 0, -8), bevel=0.004, ol=0.004, parent=root, origin='bottom')
    return root
