# A red metal desk lamp (the investigation desk foreground): weighted round base, two-part arm, a deep cone shade with
# a glowing bulb inside. Floor prop on a desk top; the shade points toward -Y and down.
import math

META = {'size': (0.26, 0.42, 0.5), 'anchor': 'desk top, centre of the base; shade toward -Y', 'animate': [],
        'params': 'color=hex, glow=2.5'}


def build(cz, name='lo_desk_lamp', color='#d0362e', glow=2.5):
    root = cz.empty(name)
    rm = cz.toon(name + '_red', color, tex='grain', tex_strength=0.05)
    dk = cz.toon(name + '_dark', '#2a2622')
    cz.cyl(name + '_base', 0.11, 0.035, (0, 0.06, 0), rm, ol=0.006, parent=root, bevel=0.008)
    cz.cyl(name + '_arm1', 0.012, 0.32, (0, 0.06, 0.03), dk, rot=(-18, 0, 0), ol=0.004, parent=root, verts=12)
    top = (0, 0.06 - 0.32 * math.sin(math.radians(18)), 0.03 + 0.32 * math.cos(math.radians(18)))
    cz.sphere(name + '_joint', 0.022, top, rm, ol=0.004, parent=root, segs=16, rings=8)
    cz.cyl(name + '_arm2', 0.011, 0.2, top, dk, rot=(-100, 0, 0), ol=0.004, parent=root, verts=12)
    hx = (0, top[1] - 0.2 * math.sin(math.radians(100)), top[2] + 0.2 * math.cos(math.radians(100)))
    # rotation +145 about X points the cone's +Z toward -Y and down (tested in the viewer: -145 aimed it backwards)
    cz.cyl(name + '_shade', 0.035, 0.16, hx, rm, rot=(145, 0, 0), r2=0.12, ol=0.007, parent=root, verts=36)
    a = math.radians(145); dv = (0, -math.sin(a), math.cos(a))
    cz.sphere(name + '_bulb', 0.04, (hx[0], hx[1] + dv[1] * 0.1, hx[2] + dv[2] * 0.1), cz.glow(name + '_bulbm', '#fff1c8', glow), ol=0.0, parent=root, segs=16, rings=8)
    return root
