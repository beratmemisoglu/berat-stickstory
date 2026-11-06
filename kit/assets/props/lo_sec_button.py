# The red SECURITY push button at the prize window: a brushed grey metal box with a printed SECURITY + hazard-stripe
# front, a dark collar and a red dome button on the pivot <name>_btn (press: location.z down 0.012). kw lit=0..1 makes
# the dome glow (the alarm).
import os

META = {'size': (0.22, 0.15, 0.13), 'anchor': 'desk top, centre of the box bottom; label faces -Y',
        'animate': ['_btn'], 'params': 'lit=0..1 (dome emission), press=0..1 (dome pushed in)'}


def build(cz, name='lo_sec_button', lit=0.0, press=0.0):
    root = cz.empty(name)
    gm = cz.toon(name + '_metal', '#a9b0b8', tex='grain', tex_strength=0.05)
    cz.box(name + '_box', (0.22, 0.15, 0.08), (0, 0, 0.04), gm, bevel=0.012, ol=0.006, parent=root)
    cz.box(name + '_lip', (0.2, 0.13, 0.012), (0, 0, 0.086), cz.toon(name + '_lipm', '#8b929b'), bevel=0.004, ol=0.004, parent=root)
    lab = os.path.join(cz.LAB, 'film', 'lottery', 'tex', 'lo_security.png')
    if os.path.exists(lab):
        cz.plane(name + '_label', 0.2, 0.072, (0, -0.0765, 0.041), cz.toon(name + '_labm', img=lab, lift=0.78), rot=(90, 0, 0), parent=root)
    cz.cyl(name + '_collar', 0.042, 0.02, (0, 0.0, 0.09), cz.toon(name + '_collarm', '#2b2a2e'), ol=0.004, parent=root, verts=32)
    pv = cz.empty(name + '_btn', (0, 0, 0.11 - 0.012 * press), parent=root)
    red = cz.toon(name + '_red', '#d8282c', emit=1.8 * lit) if lit else cz.toon(name + '_red', '#d8282c')
    d = cz.sphere(name + '_dome', 0.036, (0, 0, -0.006), red, ol=0.005, parent=pv, segs=32, rings=16)
    d.data.transform(__import__('mathutils').Matrix.Diagonal((1, 1, 0.62, 1)))
    cz.sphere(name + '_shine', 0.008, (-0.012, -0.012, 0.012), cz.glow(name + '_shinem', '#ffd6d0', 1.4), ol=0, parent=pv, segs=10, rings=6)
    for sx in (-1, 1):   # screws
        cz.cyl(f'{name}_screw{sx}', 0.006, 0.003, (sx * 0.085, -0.055, 0.092), cz.toon(name + '_screwm', '#5d636b'), ol=0, parent=root, verts=12)
    return root
