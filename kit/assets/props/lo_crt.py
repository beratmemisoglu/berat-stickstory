# Beige office CRT computer (the prize window's claims terminal): a deep tapered monitor on a swivel foot, a screen with
# a teal claims app (cz.screen, glows), a sticky note on the side, a keyboard in front with key rows. Faces -Y.
import os

META = {'size': (0.44, 0.62, 0.42), 'anchor': 'floor (desk top) centre of the monitor foot; screen faces -Y',
        'animate': [], 'params': 'keyboard=True, screen=png (default film/lottery/tex/lo_crt.png), beige=hex'}


def build(cz, name='lo_crt', keyboard=True, screen=None, beige='#d9cfae'):
    root = cz.empty(name)
    tex = os.path.join(cz.LAB, 'film', 'lottery', 'tex')
    bm = cz.toon(name + '_beige', beige, tex='grain', tex_strength=0.05)
    dk = cz.toon(name + '_dark', '#8f8770', tex='grain', tex_strength=0.04)
    # foot + neck
    cz.cyl(name + '_foot', 0.12, 0.025, (0, 0.02, 0), bm, ol=0.005, parent=root, bevel=0.006)
    cz.box(name + '_neck', (0.12, 0.1, 0.05), (0, 0.03, 0.045), dk, bevel=0.01, ol=0.005, parent=root)
    # case: a front bezel box + a tapered back (two boxes)
    cz.box(name + '_bezel', (0.42, 0.06, 0.36), (0, -0.07, 0.25), bm, bevel=0.02, ol=0.008, parent=root)
    cz.box(name + '_body', (0.38, 0.22, 0.32), (0, 0.07, 0.245), bm, bevel=0.03, ol=0.008, parent=root)
    cz.box(name + '_back', (0.26, 0.14, 0.22), (0, 0.24, 0.24), dk, bevel=0.03, ol=0.007, parent=root)
    for i in range(6):   # vents on the back
        cz.box(f'{name}_vent{i}', (0.2, 0.004, 0.008), (0, 0.312, 0.18 + i * 0.022), cz.toon(name + '_ventm', '#5a5444'), bevel=0, ol=0, parent=root)
    cz.box(name + '_glassrim', (0.34, 0.01, 0.27), (0, -0.103, 0.26), cz.toon(name + '_rim', '#3a3a34'), bevel=0.012, ol=0.004, parent=root)
    scr = screen or os.path.join(tex, 'lo_crt.png')
    if os.path.exists(scr):
        cz.plane(name + '_screen', 0.31, 0.235, (0, -0.1095, 0.26), cz.screen(name + '_scrm', scr, 1.1), rot=(90, 0, 0), parent=root)
    cz.box(name + '_led', (0.012, 0.006, 0.012), (0.17, -0.102, 0.1), cz.glow(name + '_ledm', '#5dff8a', 3), bevel=0, ol=0, parent=root)
    st = os.path.join(tex, 'lo_sticky.png')
    if os.path.exists(st):
        cz.plane(name + '_sticky', 0.07, 0.07, (0.192, -0.02, 0.2), cz.toon(name + '_stickym', img=st, lift=0.75), rot=(90, -6, 90), parent=root)
    if keyboard:
        cz.box(name + '_kb', (0.4, 0.14, 0.025), (0, -0.24, 0.0125), bm, bevel=0.006, ol=0.005, parent=root)
        km = cz.toon(name + '_keys', '#efe8d2')
        for r in range(4):
            cz.box(f'{name}_keyrow{r}', (0.34, 0.022, 0.008), (0, -0.29 + r * 0.03, 0.029), km, bevel=0.002, ol=0.002, parent=root)
    return root
