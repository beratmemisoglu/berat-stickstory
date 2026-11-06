# Corridor cork notice board: an aluminium-framed cork panel (Flow cork texture), papers pinned at slight angles (a
# meeting-room booking sheet, a pink year-end party flyer, a yellow safety poster, a notice memo), coloured push pins,
# a curled corner. Wall prop: back at y = 0, centred on x = 0, z = 0, front toward -Y. 0.9 x 0.6 m.
import math

META = {'size': (0.9, 0.04, 0.6), 'anchor': 'back centre on the wall, centred on z = 0', 'animate': [], 'params': 'papers=True'}

TEX = 'assets/props/tex/'
PAPERS = [  # png, w, h, x, z, tilt
    ('room_board_0', 0.24, 0.18, -0.27, 0.1, -3), ('room_board_1', 0.15, 0.2, 0.02, 0.12, 4),
    ('room_board_2', 0.16, 0.213, 0.26, 0.06, -2), ('room_board_3', 0.17, 0.17, -0.12, -0.15, 5),
    ('room_board_0', 0.2, 0.15, 0.2, -0.17, 2)]
PINS = ('#d23a2e', '#2f7ad0', '#f2c230', '#3aa860', '#e86aa8')


def build(cz, name='room_notice_board', papers=True):
    root = cz.empty(name)
    frame = cz.toon(name + '_frame', '#b8bcc0', tex='grain', tex_strength=0.03)
    cork = cz.toon(name + '_cork', img='assets/tex/corkboard.png', proj='box', proj_scale=3.0, tint='#e0b890')
    cz.box(name + '_cork', (0.86, 0.014, 0.56), (0, -0.007, 0), cork, bevel=0, ol=0.004, parent=root)
    for s in (-1, 1):
        cz.box(f'{name}_fh{s}', (0.9, 0.024, 0.022), (0, -0.012, s * 0.289), frame, bevel=0.004, ol=0.004, parent=root)
        cz.box(f'{name}_fv{s}', (0.022, 0.024, 0.58), (s * 0.439, -0.012, 0), frame, bevel=0.004, ol=0.004, parent=root)
    if papers:
        for i, (png, w, h, x, z, a) in enumerate(PAPERS):
            pv = cz.empty(f'{name}_p{i}', (x, -0.0155 - 0.0012 * (i % 2), z), parent=root); pv.rotation_euler.y = math.radians(a)
            cz.box(f'{name}_card{i}', (w, 0.0008, h), (0, 0, 0), cz.toon(name + '_paper', '#ebe6d6'), bevel=0, ol=0.0014, parent=pv)
            cz.plane(f'{name}_print{i}', w - 0.002, h - 0.002, (0, -0.0028, 0), cz.toon(f'{name}_{png}', img=f'{TEX}{png}.png', lift=0.62), parent=pv)
            cz.sphere(f'{name}_pin{i}', 0.008, (0, -0.0075, h / 2 - 0.016), cz.toon(f'{name}_pinm{i}', PINS[i % len(PINS)]), ol=0.0015, parent=pv)
    return root
