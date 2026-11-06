# Yellow A-frame floor sign (足元注意 / watch your step): two moulded panels hinged at the top handle, the printed face
# (tex/off_caution.png) on both, rubber feet. Floor prop: root at the floor centre, one face toward -Y.
import math, os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')

META = {'size': (0.42, 0.36, 0.68), 'anchor': 'floor centre, a face toward -Y', 'animate': [], 'params': 'none'}


def build(cz, name='off_floor_sign'):
    root = cz.empty(name)
    yel = cz.toon('off_fs_yellow', '#f2c230', tex='grain', tex_strength=0.04)
    blk = cz.toon('off_fs_black', '#2a2622')
    face = cz.toon('off_fs_face', img=os.path.join(TEX, 'off_caution.png'), lift=0.75)
    H, W, A = 0.64, 0.4, 14.0          # panel height, width, lean (deg from vertical)
    top = H * math.cos(math.radians(A)) + 0.0125     # hinge height that puts the feet on the floor
    for s in (-1, 1):
        p = cz.empty(f'{name}_side{s}', (0, 0, top), parent=root); p.rotation_euler.x = math.radians(s * A)
        cz.box(f'{name}_panel{s}', (W, 0.022, H), (0, 0, -H / 2), yel, bevel=0.012, ol=0.006, parent=p)
        cz.plane(f'{name}_face{s}', W - 0.05, (W - 0.05) * 620 / 400, (0, s * 0.0115, -H / 2 + 0.005), face,
                 rot=(90, 0, 0 if s < 0 else 180), parent=p)
        cz.box(f'{name}_foot{s}', (W + 0.01, 0.04, 0.025), (0, 0, -H + 0.0), blk, bevel=0.006, ol=0.004, parent=p)
    cz.box(name + '_handle', (W * 0.6, 0.05, 0.05), (0, 0, top + 0.012), yel, bevel=0.018, ol=0.005, parent=root)
    cz.box(name + '_grip', (W * 0.35, 0.052, 0.022), (0, 0, top + 0.017), blk, bevel=0.008, ol=0.0, parent=root)
    return root
