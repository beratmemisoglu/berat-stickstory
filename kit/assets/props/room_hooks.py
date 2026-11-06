# Coat-hook rail by the door with what was left on it: a wooden rail with three brass hooks, a forgotten folded navy
# umbrella hanging by its crook from the right hook (strap and snap, metal tip) and an empty wire hanger on the left
# hook. Wall prop: back at y = 0, rail centred on x = 0, z = 0, front toward -Y. The umbrella hangs 0.72 m below.
import math
from mathutils import Vector

META = {'size': (0.40, 0.08, 0.80), 'anchor': 'back centre of the rail on the wall (z = 0 = rail centre)', 'animate': [],
        'params': "umbrella=True, hanger=True, umbrella_color='#2f3d5e'"}

HX = (-0.12, 0.0, 0.12)


def _seg(cz, nm, a, b, r, mat, parent, ol):
    """A capsule between points a and b (local to parent)."""
    a, b = Vector(a), Vector(b); d = b - a
    o = cz.capsule(nm, r, d.length + 2 * r, tuple(a - d.normalized() * r), mat, ol=ol, parent=parent)
    o.rotation_euler = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    return o


def build(cz, name='room_hooks', umbrella=True, hanger=True, umbrella_color='#2f3d5e'):
    root = cz.empty(name)
    wood = cz.toon(name + '_wood', '#7a5636', tex='wood', tex_scale=1.5, tex_strength=0.08)
    brass = cz.toon(name + '_brass', '#b8954c')
    cz.box(name + '_rail', (0.36, 0.022, 0.075), (0, -0.011, 0), wood, bevel=0.005, ol=0.005, parent=root)
    for i, x in enumerate(HX):
        cz.cyl(f'{name}_screw{i}', 0.005, 0.003, (x, -0.0235, 0.024), cz.toon(name + '_screwm', '#8d8f8f'), rot=(90, 0, 0), verts=12, ol=0.001, parent=root)
        _seg(cz, f'{name}_hook{i}', (x, -0.022, -0.012), (x, -0.075, -0.006), 0.0055, brass, root, 0.002)
        cz.sphere(f'{name}_hookball{i}', 0.009, (x, -0.078, -0.0), brass, ol=0.002, parent=root)
    if umbrella:
        x = HX[2]; nav = cz.toon(name + '_canopy', umbrella_color, tex='paper', tex_scale=0.6, tex_strength=0.06)
        hand = cz.toon(name + '_handle', '#5a3a26', tex='wood', tex_strength=0.06)
        # crook over the hook (half ring in the YZ plane around the hook arm), then the shaft down
        cy, cz_, r = -0.062, -0.006, 0.026
        pts = [(x, cy + r * math.cos(a), cz_ + r * math.sin(a)) for a in [math.radians(d) for d in (0, 40, 80, 120, 160, 200)]]
        for k in range(len(pts) - 1):
            _seg(cz, f'{name}_crook{k}', pts[k], pts[k + 1], 0.0085, hand, root, 0.0025)
        top = (x, cy + r, cz_)
        _seg(cz, name + '_shaft', top, (x, cy + r, cz_ - 0.12), 0.0085, hand, root, 0.0025)
        z0 = cz_ - 0.12
        cz.cyl(name + '_fold', 0.008, 0.52, (x, cy + r, z0 - 0.52), nav, verts=24, r2=0.034, ol=0.004, parent=root)
        cz.cyl(name + '_strap', 0.031, 0.022, (x, cy + r, z0 - 0.17), cz.toon(name + '_strapm', '#26324c'), verts=24, r2=0.029, ol=0.003, parent=root)
        cz.sphere(name + '_snap', 0.006, (x, cy + r - 0.03, z0 - 0.16), cz.toon(name + '_snapm', '#c9ccd0'), ol=0.0015, parent=root)
        cz.cyl(name + '_tip', 0.0045, 0.05, (x, cy + r, z0 - 0.57), cz.toon(name + '_tipm', '#a8acb2'), verts=12, ol=0.0015, parent=root)
    if hanger:
        x = HX[0]; wire = cz.toon(name + '_wire', '#9ea4aa')
        y = -0.03; hz = -0.03
        # hook loop over the hook arm, neck, two shoulders, the bar
        _seg(cz, name + '_hgA', (x, y - 0.03, 0.004), (x, y - 0.0, -0.01), 0.0022, wire, root, 0.0012)
        _seg(cz, name + '_hgB', (x, y, -0.01), (x, y, hz - 0.03), 0.0022, wire, root, 0.0012)
        _seg(cz, name + '_hgL', (x, y, hz - 0.03), (x - 0.13, y, hz - 0.16), 0.0024, wire, root, 0.0012)
        _seg(cz, name + '_hgR', (x, y, hz - 0.03), (x + 0.13, y, hz - 0.16), 0.0024, wire, root, 0.0012)
        _seg(cz, name + '_hgC', (x - 0.13, y, hz - 0.16), (x + 0.13, y, hz - 0.16), 0.0024, wire, root, 0.0012)
    return root
