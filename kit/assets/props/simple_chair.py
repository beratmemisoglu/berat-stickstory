# Simple chair: a plain old office side chair. Four tubular steel legs with floor glides and side stretchers, the
# rear legs bending back into the backrest uprights, a padded seat (top at 0.46 m) on a seat pan, a small padded
# backrest, faded fabric (kw color). Old-chair details: an X of grey tape over a split in the seat, a rubber glide gone
# missing (front right: the bare tube tip shows), the office's torn asset tag on the back. 0.44 m wide: it pushes
# under a desk (the bare_desk knee hole is 0.73 m wide, its centre drawer bottom at 0.63 m).
# Floor prop: root at the floor centre, the seat front faces -Y. No moving parts (move / rotate the root).
import math, os

META = {'size': (0.44, 0.51, 0.82), 'anchor': 'floor centre; seat front faces -Y; seat top z = 0.46',
        'animate': [], 'params': "color (fabric, faded), frame (metal), tape=True|False (taped split in the seat)"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def build(cz, name='simple_chair', color='#9b6f66', frame='#4e4c48', tape=True):
    root = cz.empty(name)
    fab = cz.toon(name + '_fabricm', color, tex='grain', tex_scale=2.0, tex_strength=0.06)
    fr = cz.toon(name + '_framem', frame, tex='grain', tex_strength=0.03)
    pan = cz.toon(name + '_panm', '#3b3936')
    gl = cz.toon(name + '_glidem', '#2a2622')
    tp = cz.toon(name + '_tapem', '#b9b5aa', tex='paper', tex_strength=0.05)
    R = 0.0135                                          # tube radius (chunky)
    LX, YF, YB, ZP = 0.17, -0.155, 0.215, 0.385         # leg x, front / rear leg y, underside of the seat pan
    tilt = 9.0                                          # backrest lean (deg)

    # legs (with glides; the front-right glide is missing: the bare tube tip stands on the floor)
    for i, (x, y) in enumerate([(-LX, YF), (LX, YF), (-LX, YB), (LX, YB)]):
        missing = i == 1
        g = 0.0 if missing else 0.012
        if not missing:
            cz.cyl(f'{name}_glide{i}', R + 0.004, g, (x, y, 0), gl, bevel=0.002, ol=0.003, parent=root, verts=20)
        cz.cyl(f'{name}_leg{i}', R, ZP + 0.002 - g, (x, y, g), fr, ol=0.005, parent=root, verts=20)
    # side stretchers (front to rear) at 0.13 m
    for k, x in (('l', -LX), ('r', LX)):
        cz.cyl(f'{name}_stretch_{k}', R * 0.8, YB - YF, (x, YF, 0.13), fr, rot=(-90, 0, 0), ol=0.004, parent=root, verts=16)
    # rear legs bend back into the uprights: a ball at the bend, then the leaning tube
    up_len = 0.42                                       # ends just under the top of the backrest pad
    for k, x in (('l', -LX), ('r', LX)):
        cz.sphere(f'{name}_bend_{k}', R, (x, YB, ZP), fr, ol=0.005, parent=root, segs=16, rings=8)
        cz.cyl(f'{name}_upright_{k}', R, up_len, (x, YB, ZP), fr, rot=(-tilt, 0, 0), ol=0.005, parent=root, verts=20)
    # seat pan + cushion
    # (the cushion stops at y = 0.195, in front of the uprights: no tube goes through it)
    cz.box(name + '_pan', (0.40, 0.425, 0.022), (0, 0.0125, ZP + 0.011), pan, bevel=0.005, ol=0.005, parent=root)
    cz.box(name + '_seat', (0.44, 0.41, 0.055), (0, -0.01, ZP + 0.022 + 0.0275 - 0.002), fab, bevel=0.022, ol=0.007, parent=root)
    # backrest pad, in front of the uprights, leaning with them
    t = math.radians(tilt)
    zc = 0.72
    along = (zc - ZP) / math.cos(t)
    yc = YB + along * math.sin(t) - (R + 0.024)        # centre on the upright line, pushed forward by tube r + half the pad
    back = cz.box(name + '_back', (0.40, 0.048, 0.19), (0, yc, zc), fab, rot=(-tilt, 0, 0), bevel=0.02, ol=0.007, parent=root)
    # the office's asset tag on the back of the backrest (parented to the pad so it leans with it; 1.5 mm off its face)
    cz.plane(name + '_tag', 0.07, 0.033, (0.0, 0.0255, 0.025), cz.toon(name + '_tagm', img=os.path.join(TEX, 'simple_chair_tag.png'), alpha_clip=True),
             rot=(90, 0, 180), parent=back)
    # taped split in the seat: two crossed strips of grey tape just above the cushion top (no outline: it is a decal)
    if tape:
        zt = ZP + 0.022 + 0.055 - 0.002 + 0.0012
        for i, a in enumerate((32, -32)):
            cz.box(f'{name}_tape{i}', (0.12, 0.034, 0.001), (-0.08, -0.07, zt + i * 0.0012), tp, rot=(0, 0, a), bevel=0, ol=0, parent=root)
    return root
