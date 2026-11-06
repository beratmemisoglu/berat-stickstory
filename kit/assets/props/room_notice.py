# A paper notice taped to a wall: a card-thin sheet with its print (any PNG), three strips of yellowed tape (two top
# corners, one bottom-left); the bottom-right corner came unstuck, so the sheet tilts off the wall a little at the
# bottom (a thin shadow line under it). Wall prop: back at y = 0, centred on x = 0, z = 0, front toward -Y.
import math

META = {'size': (0.21, 0.02, 0.297), 'anchor': 'back centre on the wall, centred on z = 0', 'animate': [],
        'params': "img='assets/props/tex/room_notice_quiet.png', w=0.21, h=0.297, tilt=-2 (deg, crooked), lift_deg=3"}


def build(cz, name='room_notice', img='assets/props/tex/room_notice_quiet.png', w=0.21, h=0.297, tilt=-2.0, lift_deg=3.0):
    root = cz.empty(name)
    pv = cz.empty(name + '_sheet', (0, -0.002, h / 2), parent=root)      # hinge along the top edge
    pv.rotation_euler = (math.radians(-lift_deg), math.radians(tilt), 0)
    paper = cz.toon(name + '_paper', '#e4dcc4', tex='paper', tex_strength=0.04)
    cz.box(name + '_card', (w, 0.0012, h), (0, 0, -h / 2), paper, bevel=0, ol=0.0016, parent=pv)
    base = img.split('/')[-1].split('.')[0]
    cz.plane(name + '_print', w - 0.002, h - 0.002, (0, -0.0034, -h / 2), cz.toon('room_notice_' + base, img=img, lift=0.62), parent=pv)
    tape = cz.toon('room_notice_tape', '#e3d29a', lift=0.7)
    for i, (x, z, a) in enumerate(((-w / 2 + 0.01, -0.008, 40), (w / 2 - 0.01, -0.008, -40), (-w / 2 + 0.01, -h + 0.01, -35))):
        t = cz.box(f'{name}_tape{i}', (0.045, 0.0008, 0.016), (x, -0.0042, z), tape, bevel=0, ol=0, parent=pv)
        t.rotation_euler.y = math.radians(a)
    return root
