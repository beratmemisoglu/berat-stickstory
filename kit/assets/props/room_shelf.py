# Dusty wall shelf left behind in the bare room: a wooden board on two steel L brackets (screws), a grey dust film on
# top, two old lever-arch binders standing and a third leaning on them (faded navy / maroon / mustard, finger holes,
# handwritten spine labels H12 庶務 / H13 議事録 / H10 雑件, dust on their tops) and a yellowed stack of papers.
# Wall prop: back at y = 0, centred on x = 0; anchor z = 0 is the board's TOP surface (things stand on z = 0).
import math

META = {'size': (0.5, 0.24, 0.35), 'anchor': 'back centre on the wall; z = 0 = the board top (binders stand on it)',
        'animate': [], 'params': "binders=3 (0..3), papers=True, board='#9a7448'"}

TEX = 'assets/props/tex/'
W, D, T = 0.5, 0.24, 0.025
BIND = (('#3e5a86', 0), ('#8c3a3a', 1), ('#c79a3a', 2))     # faded navy, maroon, mustard + their label print


def _binder(cz, name, parent, loc, rot_y, color, label):
    bw, bd, bh = 0.07, 0.23, 0.31
    pv = cz.empty(name, loc, parent=parent); pv.rotation_euler.y = math.radians(rot_y)
    cover = cz.toon(name + '_cover', color, tex='paper', tex_scale=0.5, tex_strength=0.06)
    cz.box(name + '_body', (bw, bd, bh), (0, -bd / 2, 0), cover, bevel=0.004, ol=0.004, parent=pv, origin='bottom')
    # pages showing at the back half of the top (a cream block) + dust on the top
    cz.box(name + '_dust', (bw - 0.004, bd - 0.006, 0.0015), (0, -bd / 2, bh + 0.0004), cz.toon('room_dust', '#cfc8b2', lift=0.7), bevel=0, ol=0, parent=pv)
    # spine: label card, finger hole with a metal ring, a metal edge strip at the bottom
    yf = -bd - 0.0015
    cz.plane(name + '_label', 0.046, 0.15, (0, yf - 0.004, bh * 0.62), cz.toon(f'room_binder_lbl{label}', img=f'{TEX}room_binder_label{label}.png', lift=0.66), parent=pv)
    cz.cyl(name + '_ring', 0.016, 0.002, (0, yf, 0.075), cz.toon('room_binder_metal', '#a6a9ad'), rot=(90, 0, 0), verts=24, ol=0.0015, parent=pv)
    cz.cyl(name + '_hole', 0.011, 0.002, (0, yf - 0.0012, 0.075), cz.toon('room_binder_hole', '#2a2622'), rot=(90, 0, 0), verts=24, ol=0, parent=pv)
    cz.box(name + '_edge', (bw + 0.002, bd + 0.002, 0.008), (0, -bd / 2, 0.0), cz.toon('room_binder_metal', '#a6a9ad'), bevel=0.001, ol=0.002, parent=pv, origin='bottom')
    return pv


def build(cz, name='room_shelf', binders=3, papers=True, board='#9a7448'):
    root = cz.empty(name)
    wood = cz.toon(name + '_wood', board, tex='wood', tex_scale=1.2, tex_strength=0.08)
    metal = cz.toon(name + '_metal', '#6c7076')
    cz.box(name + '_board', (W, D, T), (0, -D / 2, -T / 2), wood, bevel=0.004, ol=0.006, parent=root)
    cz.box(name + '_dustfilm', (W - 0.012, D - 0.012, 0.0012), (0, -D / 2, 0.0003), cz.toon('room_dust', '#cfc8b2', lift=0.7), bevel=0, ol=0, parent=root)
    for s in (-1, 1):
        x = s * 0.17
        cz.box(f'{name}_upr{s}', (0.022, 0.006, 0.15), (x, -0.003, -T - 0.075), metal, bevel=0.002, ol=0.003, parent=root)
        cz.box(f'{name}_arm{s}', (0.022, 0.17, 0.006), (x, -0.09, -T - 0.003), metal, bevel=0.002, ol=0.003, parent=root)
        g = cz.box(f'{name}_gus{s}', (0.008, 0.16, 0.006), (x, -0.06, -T - 0.06), metal, bevel=0.001, ol=0.002, parent=root)
        g.rotation_euler.x = math.radians(-38)
        for z in (-T - 0.04, -T - 0.12):
            cz.cyl(f'{name}_screw{s}{z:.2f}', 0.005, 0.004, (x, -0.007, z), cz.toon(name + '_screw', '#9aa0a6'), rot=(90, 0, 0), verts=12, ol=0.001, parent=root)
    xs = [(-0.16, 0.0, 0.0), (-0.085, 0.0, 0.0), (0.079, 0.0108, -18.0)]
    for i in range(min(3, binders)):
        x, z, ry = xs[i]
        _binder(cz, f'{name}_bind{i}', root, (x, -0.005, z), ry, BIND[i][0], BIND[i][1])   # the 3rd leans on the 2nd
    if papers:
        pm = cz.toon(name + '_paper', '#e3d9bd', tex='paper', tex_strength=0.05)
        for k in range(3):
            o = cz.box(f'{name}_pap{k}', (0.11, 0.17, 0.008), (0.19 + 0.004 * k, -0.1 - 0.003 * k, 0.004 + 0.008 * k), pm, bevel=0.001, ol=0.002, parent=root)
            o.rotation_euler.z = math.radians((-4, 3, -2)[k])
        cz.box(name + '_papdust', (0.105, 0.16, 0.0012), (0.198, -0.106, 0.0285), cz.toon('room_dust', '#cfc8b2', lift=0.7), bevel=0, ol=0, parent=root).rotation_euler.z = math.radians(-2)
    return root
