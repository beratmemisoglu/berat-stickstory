# Customer display on a pole (LOTTERY counter): a chunky charcoal monitor box with a thick bezel, its green screen
# (film/lottery/tex/st_monitor_ready.png / st_monitor_win.png, lit) facing -Y, a short neck on a round pole, a weighted
# round foot. Root = the foot's centre on the counter top (z = 0). screen='ready'|'win'|'off'. The screen material is
# named <name>_scr_<screen>; a shot swaps screens by changing the plane's material (part <name>_screen).
import os

META = {'size': (0.36, 0.14, 0.5), 'anchor': 'foot centre on the counter top, screen faces -Y',
        'animate': ['_screen (swap material: lt_monitor_mat(cz, name, kind))'], 'params': "screen='ready'|'win'|'off', h=0.32 (screen centre height), tilt=8"}
TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'film', 'lottery', 'tex')


def screen_mat(cz, name, kind):
    if kind == 'off': return cz.toon(name + '_scr_off', '#0c1512')
    img = os.path.join(TEX, f'st_monitor_{kind}.png')
    import bpy
    m = bpy.data.materials.get(name + '_scr_' + kind)
    return m or cz.screen(name + '_scr_' + kind, img, 1.25)


def build(cz, name='lt_monitor', screen='ready', h=0.32, tilt=8):
    root = cz.empty(name)
    body = cz.toon(name + '_bodym', '#2f343b', tex='grain', tex_strength=0.05)
    metal = cz.toon(name + '_metalm', '#5d636b', tex='grain', tex_strength=0.04)
    cz.cyl(name + '_foot', 0.085, 0.03, (0, 0, 0), body, r2=0.075, bevel=0.01, ol=0.005, parent=root, verts=40)
    cz.cyl(name + '_pole', 0.018, h - 0.07, (0, 0.015, 0.028), metal, ol=0.004, parent=root, verts=20)
    head = cz.empty(name + '_headpv', (0, 0.015, h - 0.04), parent=root)
    import math
    head.rotation_euler.x = math.radians(tilt)
    cz.box(name + '_neck', (0.06, 0.05, 0.05), (0, 0.03, 0.0), body, bevel=0.01, ol=0.004, parent=head)
    cz.box(name + '_box', (0.34, 0.11, 0.2), (0, -0.01, 0.06), body, bevel=0.02, ol=0.007, parent=head)
    cz.box(name + '_bezel', (0.3, 0.01, 0.15), (0, -0.064, 0.065), cz.toon(name + '_bezelm', '#191c21'), bevel=0.006, ol=0.0, parent=head)
    cz.plane(name + '_screen', 0.27, 0.13, (0, -0.0705, 0.065), screen_mat(cz, name, screen), rot=(90, 0, 0), parent=head)
    cz.sphere(name + '_led', 0.006, (0.12, -0.066, 0.0), cz.glow('lt_led_green', '#5cff9a', 3.0), ol=0.0, parent=head, segs=10, rings=6)
    # the back carries a vent grille (the clerk's side)
    for i in range(4):
        cz.box(f'{name}_vent{i}', (0.2, 0.004, 0.008), (0, 0.047, 0.03 + 0.025 * i), cz.toon(name + '_ventm', '#22262c'), bevel=0, ol=0.0, parent=head)
    return root
