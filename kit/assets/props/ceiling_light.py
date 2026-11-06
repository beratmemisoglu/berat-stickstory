# Ceiling light. kind='panel': a recessed 1.2 x 0.6 m fluorescent office troffer, flush with the ceiling: an off-white
# metal trim, a glowing prismatic diffuser set 2 cm up into it (two brighter tube bands, a darker rim, one dead fly)
# and the small green emergency-light indicator Japanese office fittings carry. kind='pendant': a simple industrial
# enamel dome on a cord (canopy, strain relief, stepped dome with a rolled lip, bright inside, a bare glowing bulb
# poking out below) for the bare room; it swings about the canopy.
# Root = the ceiling attachment point (the ceiling surface is z = 0); everything hangs toward -Z. Long side of the
# panel along X. There is NO light object: the set adds its own lamp under it; this is only the glowing surface
# (on=False: the same fitting switched off, lit by the scene like any other surface).
# Flicker / dimming: keyframe the emission strength of material <name>_glow (diffuser: <name>_diffm) or swap on=.
import math

META = {'size': (1.2, 0.6, 0.035), 'size_pendant': (0.41, 0.41, 'drop + 0.39'),
        'anchor': 'ceiling attachment point (top centre), hangs toward -Z',
        'animate': ['_swing (pendant: rotation_euler.x / .y in radians about the canopy, e.g. +-0.15 sway)'],
        'params': "kind='panel'|'pendant', on=True, drop=0.7 (pendant cord length, m), shade='#3d4a46', "
                  "swing=0.0 (pendant tilt in degrees about X, for a static pose)"}


def build(cz, name='ceiling_light', kind='panel', on=True, drop=0.7, shade='#3d4a46', swing=0.0):
    root = cz.empty(name)
    if kind == 'pendant':
        pv = _pendant(cz, name, root, on, drop, shade)
        pv.rotation_euler = (math.radians(swing), 0, 0)
    else:
        _panel(cz, name, root, on)
    return root


def _panel(cz, name, root, on):
    L, Wd, tw, th = 1.2, 0.6, 0.045, 0.035
    trim = cz.toon(name + '_trimm', '#ebe7dc', tex='grain', tex_scale=2.0, tex_strength=0.03)
    for sy in (-1, 1):
        cz.box(f'{name}_trim{"FB"[sy > 0]}', (L, tw, th), (0, sy * (Wd / 2 - tw / 2), -th / 2), trim, bevel=0.008,
               ol=0.005, parent=root)
    for sx in (-1, 1):
        cz.box(f'{name}_trim{"LR"[sx > 0]}', (tw, Wd - 2 * tw, th), (sx * (L / 2 - tw / 2), 0, -th / 2), trim,
               bevel=0.008, ol=0.005, parent=root)
    # a dark backing a hair above the diffuser so nothing of the ceiling shows at grazing angles
    cz.box(name + '_back', (L - 0.04, Wd - 0.04, 0.006), (0, 0, -0.006), cz.toon(name + '_backm', '#8a8f92'),
           bevel=0, ol=0, parent=root)
    if on:
        dm = cz.screen(name + '_diffm', 'assets/props/tex/ceiling_light_diffuser.png', 1.0)
    else:
        dm = cz.toon(name + '_diffm', '#dddddd', img='assets/props/tex/ceiling_light_diffuser_off.png')
    # diffuser recessed 1.3 cm above the trim's lower face, its edges tucked into the trim
    cz.plane(name + '_diffuser', L - 2 * tw + 0.02, Wd - 2 * tw + 0.02, (0, 0, -0.022), dm, rot=(180, 0, 0), parent=root)
    # emergency-light indicator (green LED) on one end of the trim
    led = cz.glow(name + '_ledm', '#3ddc84', 2.0) if on else cz.toon(name + '_ledm', '#5f8f6f')
    cz.cyl(name + '_ledring', 0.016, 0.004, (L / 2 - tw / 2, 0, -th - 0.004), cz.toon(name + '_ledringm', '#c9c5ba'),
           verts=24, ol=0.002, parent=root)
    cz.cyl(name + '_led', 0.008, 0.003, (L / 2 - tw / 2, 0, -th - 0.0065), led, verts=16, ol=0, parent=root)


def _pendant(cz, name, root, on, drop, shade):
    sm = cz.toon(name + '_shadem', shade, tex='grain', tex_scale=3.0, tex_strength=0.04)
    dark = cz.toon(name + '_cordm', '#2a2622')
    cz.cyl(name + '_canopy', 0.065, 0.035, (0, 0, -0.035), sm, verts=32, bevel=0.008, ol=0.005, parent=root)
    pv = cz.empty(name + '_swing', (0, 0, -0.02), parent=root)
    # strain relief + cord (chunky, never a realistic hair-thin cable)
    cz.cyl(name + '_relief', 0.016, 0.04, (0, 0, -0.055), dark, verts=16, ol=0.003, parent=pv)
    cz.cyl(name + '_cord', 0.009, drop, (0, 0, -drop), dark, verts=12, ol=0.003, parent=pv)
    # socket neck, a flattened half-sphere dome whose lower half hides inside a short flared skirt, a rolled lip
    # (one seam only: stacked frustums drew an ink ring at every joint and read as a beehive)
    z = -drop
    cz.cyl(name + '_neck', 0.032, 0.06, (0, 0, z - 0.06), sm, verts=24, bevel=0.006, ol=0.004, parent=pv)
    zc = z - 0.159
    cz.sphere(name + '_dome', 0.184, (0, 0, zc), sm, scale=(1, 1, 0.62), ol=0.005, parent=pv, segs=48, rings=24)
    cz.cyl(name + '_skirt', 0.198, 0.128, (0, 0, zc - 0.125), sm, r2=0.186, verts=48, ol=0.005, parent=pv)
    cz.cyl(name + '_lip', 0.204, 0.014, (0, 0, zc - 0.133), sm, verts=48, bevel=0.005, ol=0.005, parent=pv)
    zb = zc - 0.133
    # bright enamel inside (seen from below) and the bulb poking out under it
    inner = cz.glow(name + '_glow', '#ffe6ad', 1.15) if on else cz.toon(name + '_glow', '#e4ddca')
    cz.cyl(name + '_inside', 0.186, 0.004, (0, 0, zb - 0.0035), inner, verts=48, ol=0, parent=pv)
    bulb = cz.glow(name + '_bulbm', '#fff3cc', 3.0) if on else cz.toon(name + '_bulbm', '#ece6d4', emit=0.05)
    cz.sphere(name + '_bulb', 0.058, (0, 0, zb - 0.022), bulb, ol=0.0 if on else 0.003, parent=pv, segs=32, rings=16)
    return pv
