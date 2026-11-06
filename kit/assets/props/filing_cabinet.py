# Filing cabinet: 4-drawer steel cabinet, each drawer with a paper label in a metal holder and a bar handle; a key lock
# on the top rail and a sticky note on drawer 2. The top drawer is a real drawer (box + hanging folders) in a real
# cavity, on its own pivot <name>_drawer1: animate location.y from 0 (closed) to -TRAVEL (fully open, toward -Y).
# Floor prop: root at the floor centre, front faces -Y.
import math

TRAVEL = 0.40
META = {'size': (0.46, 0.6, 1.3), 'anchor': 'floor centre, front -Y',
        'animate': ['_drawer1'],
        'params': 'drawer=0..1 (top drawer pulled out, pivot location.y = -0.40 * drawer), body/front colours, '
                  'note=True (sticky note on drawer 2)'}

W, D, H = 0.46, 0.6, 1.3
SIDE = 0.03                     # side panel thickness
Z0, ZTOP = 0.04, 1.275          # shell bottom (above the dark plinth) / shell top (under the cap)
SLOT_LO, SLOT_HI = 0.07, 1.25   # the four drawer fronts share this band
FRONT_H, FRONT_T = 0.272, 0.026
TEX = 'assets/props/tex/'


def build(cz, name='filing_cabinet', drawer=0.0, body='#8e9fab', front='#a9b8c1', handle='#3a3f47', note=True):
    root = cz.empty(name)
    bm = cz.toon(name + '_body', body, tex='grain', tex_strength=0.04)
    fm = cz.toon(name + '_front', front, tex='grain', tex_strength=0.035)
    hm = cz.toon(name + '_handle', handle, 0.7)
    metal = cz.toon(name + '_holder', '#7f8b93', 0.7)
    dark = cz.toon(name + '_dark', '#2a2622')
    y0 = -D / 2                                      # shell front face
    pitch = (SLOT_HI - SLOT_LO) / 4
    zc = [SLOT_HI - pitch * (i + 0.5) for i in range(4)]   # drawer centres, top first
    open_lo, open_hi = zc[0] - 0.125, zc[0] + 0.125         # the top drawer's opening in the shell

    # ---- shell: two full-height side panels (no seams on the sides), a solid block under the top drawer,
    # back + front rail around the top drawer's cavity, an overhanging top cap and a dark recessed plinth
    for s in (-1, 1):
        cz.box(f'{name}_side{"LR"[s > 0]}', (SIDE, D, ZTOP - Z0), (s * (W / 2 - SIDE / 2), 0, Z0), bm, bevel=0.012, ol=0.008, parent=root, origin='bottom')
    iw = W - 2 * SIDE + 0.004                        # inner parts tuck 2 mm into the side panels (no gaps)
    cz.box(name + '_block', (iw, D, open_lo - Z0), (0, 0, Z0), bm, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    cz.box(name + '_back', (iw, 0.03, ZTOP - open_lo), (0, D / 2 - 0.015, open_lo), bm, bevel=0, ol=0, parent=root, origin='bottom')
    cz.box(name + '_backin', (iw - 0.002, 0.004, ZTOP - open_lo - 0.004), (0, D / 2 - 0.032, open_lo), dark, bevel=0, ol=0, parent=root, origin='bottom')
    cz.box(name + '_rail', (iw, 0.03, ZTOP - open_hi), (0, y0 + 0.015, open_hi), bm, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    cz.box(name + '_cavity', (iw, D - 0.06, 0.004), (0, 0, open_lo - 0.002), dark, bevel=0, ol=0, parent=root)   # dark cavity floor
    cz.box(name + '_cap', (W + 0.016, D + 0.016, 0.032), (0, 0, ZTOP - 0.006), bm, bevel=0.012, ol=0.008, parent=root, origin='bottom')
    # plinth without outline: its hull would reach below the floor (bounds z < 0)
    cz.box(name + '_plinth', (W - 0.05, D - 0.05, Z0 + 0.004), (0, 0, 0), dark, bevel=0.004, ol=0.0, parent=root, origin='bottom')
    # key lock on the top rail (round barrel + key slot)
    lz = (open_hi + ZTOP) / 2 + 0.003
    cz.cyl(name + '_lock', 0.012, 0.012, (W / 2 - 0.075, y0, lz), cz.toon(name + '_chrome', '#d6dadc', 0.7), rot=(90, 0, 0), verts=24, bevel=0.003, ol=0.003, parent=root)
    cz.box(name + '_keyslot', (0.004, 0.003, 0.013), (W / 2 - 0.075, y0 - 0.0125, lz), dark, bevel=0, ol=0, parent=root)

    # ---- drawers
    for i, z in enumerate(zc, 1):
        if i == 1:
            par = cz.empty(name + '_drawer1', (0, 0, z), parent=root)
            par.location.y = -TRAVEL * cz.clamp(float(drawer))
            zz = 0.0
        else:
            par, zz = root, z
        fy = y0 - 0.0015 - FRONT_T / 2               # front panel stands 1.5 mm proud of the shell
        cz.box(f'{name}_front{i}', (W - 0.036, FRONT_T, FRONT_H), (0, fy, zz), fm, bevel=0.009, ol=0.006, parent=par)
        face = fy - FRONT_T / 2                       # the drawer front's outer face (y)
        # label holder: metal plate, paper label 1.5 mm in front, two lips over the label's edges
        lz = zz + 0.062
        cz.box(f'{name}_holder{i}', (0.116, 0.006, 0.064), (0, face - 0.003, lz), metal, bevel=0.002, ol=0.002, parent=par)
        cz.plane(f'{name}_label{i}', 0.096, 0.048, (0, face - 0.0075, lz),
                 cz.toon(f'{name}_labelm{i}', img=TEX + f'filing_cabinet_label{i}.png', lift=0.55), parent=par)
        for s in (-1, 1):
            cz.box(f'{name}_lip{i}{"BT"[s > 0]}', (0.116, 0.005, 0.009), (0, face - 0.0095, lz + s * 0.0275), metal, bevel=0.0015, ol=0.0, parent=par)
        # bar handle on two posts
        hz = zz - 0.04
        for s in (-1, 1):
            cz.cyl(f'{name}_post{i}{"LR"[s > 0]}', 0.009, 0.03, (s * 0.07, face + 0.001, hz), hm, rot=(90, 0, 0), verts=16, ol=0.003, parent=par)
        hb = cz.capsule(f'{name}_handle{i}', 0.0135, 0.19, (-0.095, face - 0.03, hz), hm, ol=0.004, parent=par)
        hb.rotation_euler = (0, math.radians(90), 0)

        if i == 1:   # the real drawer box behind the top front, with hanging folders
            bw, bd, bh = W - 2 * SIDE - 0.02, 0.46, 0.2
            by = y0 + bd / 2 - 0.0015                 # front of the box just behind the front panel
            bz = -0.115                               # box bottom relative to the drawer centre
            inner = cz.toon(name + '_inner', '#8d9aa3', tex='grain', tex_strength=0.04)
            for s in (-1, 1):
                cz.box(f'{name}_dside{"LR"[s > 0]}', (0.012, bd, bh), (s * (bw / 2 - 0.006), by, bz), inner, bevel=0.003, ol=0.004, parent=par, origin='bottom')
            cz.box(name + '_dback', (bw, 0.012, bh), (0, by + bd / 2 - 0.006, bz), inner, bevel=0.003, ol=0.004, parent=par, origin='bottom')
            cz.box(name + '_dbottom', (bw - 0.004, bd - 0.004, 0.012), (0, by, bz), inner, bevel=0.0, ol=0.0, parent=par, origin='bottom')
            cols = ['#e3c27e', '#6f9fd1', '#e3c27e', '#d9675b', '#e3c27e', '#7fb37a', '#e3c27e']
            for k, c in enumerate(cols):
                fy2 = by - bd / 2 + 0.05 + k * 0.055
                tilt = (-4, 3, -2, 5, -3, 2, -5)[k]
                fd = cz.box(f'{name}_folder{k}', (bw - 0.04, 0.008, 0.175), (0, fy2, bz + 0.012), cz.toon(f'{name}_fold_{c[1:]}', c, tex='paper', tex_strength=0.04),
                            rot=(tilt, 0, 0), bevel=0.002, ol=0.003, parent=par, origin='bottom')
                tx = (-0.11, 0.0, 0.11, -0.05, 0.07, -0.12, 0.03)[k]
                cz.box(f'{name}_tab{k}', (0.06, 0.008, 0.03), (tx, 0, 0.175), cz.toon(f'{name}_fold_{c[1:]}', c), bevel=0.002, ol=0.003, parent=fd, origin='bottom')
            # cardboard file box drawer liner under the folders is skipped: the folders fill the drawer

    if note:   # a sticky note on drawer 2, a little crooked, 1.5 mm in front of the front panel
        face2 = y0 - 0.0015 - FRONT_T
        n = cz.plane(name + '_note', 0.072, 0.072, (0.135, face2 - 0.0015, zc[1] + 0.06),
                     cz.toon(name + '_notem', img=TEX + 'filing_cabinet_note.png', lift=0.55), rot=(90, -9, 0), parent=root)
    return root
