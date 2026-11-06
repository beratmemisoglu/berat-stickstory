# Torch: a wooden torch pole with rope bindings, an iron brazier bowl with glowing embers and a cartoon flame of three
# nested glowing teardrops (orange outside, yellow, a pale core) with a curling tip and a few sparks above it.
# mount='stand': a 1.8 m standing torch in a round base stone (floor prop: root at the floor centre).
# mount='wall' : a shorter torch in an iron wall bracket, tilted out from the wall (wall prop: back at y = 0, root at the
#                bracket plate centre, z = 0 there; the flame tops out ~0.75 m above it).
# The flame faces -Y: its inner layers sit toward the front (turn <name>_flame about Z to face a camera from the side).
# Animate: <name>_flame scale (flicker: e.g. z 0.9..1.12, x/y 0.95..1.05 per frame), <name>_flame0/1/2 scale (each
# layer on its own), <name>_spark0..2 location z (rising sparks), <name>_light energy (flicker, when light=True).
import math

META = {'size': (0.34, 0.34, 1.85), 'anchor': "stand: floor centre (flame top ~1.85, sparks to 2.04); wall: bracket plate centre, back at y = 0 (0.62 deep, z -0.32..1.05)",
        'animate': ['_flame (scale flicker, pivot at the bowl rim)', '_flame0/_flame1/_flame2 (scale)', '_spark0..2 (location)',
                    '_light (energy)'],
        'params': "mount='stand'|'wall', lit=True (flame + embers; False = a cold torch), light=True (a warm point "
                  "light at the flame), power=110 (W), size=1.0 (flame size)"}


def _teardrop(cz, name, H, R, mat, parent, loc=(0, 0, 0), curl=0.25, ol=0.0, depth=1.0):
    """Flame tongue: round bottom, pointed tip curling toward +X; base of the drop at loc, height H."""
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=28, rings=18)
    ub = min(0.45, R / H)                                  # the round bottom is a half ball of radius R
    for v in o.data.vertices:
        x, y, z = v.co
        u = (z + 1) / 2                                    # 0 bottom .. 1 top
        rad = math.hypot(x, y); cth, sth = (x / rad, y / rad) if rad > 1e-9 else (1.0, 0.0)
        if u < ub:
            a = u / ub * math.pi / 2
            r = R * math.sin(a); zz = ub * H * (1 - math.cos(a))
        else:
            r = R * ((1 - u) / (1 - ub)) ** 1.35; zz = H * u
        xo = curl * R * max(0.0, u - 0.45) ** 2 * 4      # the tip curls over
        v.co = (cth * r + xo, sth * r * depth, zz)
    o.data.update()
    return o


def _head(cz, name, parent, lit, fs, light, power, pole_len, r_pole, bowl_r):
    """Pole (axis +Z from the parent's origin) with bindings, bowl, embers, flame, sparks, light."""
    wood = cz.toon(name + '_wood', '#5e3f2b', tex='wood', tex_scale=2.0, tex_strength=0.09)
    rope = cz.toon(name + '_rope', '#a37b48', tex='grain', tex_strength=0.05)
    iron = cz.toon(name + '_iron', '#3d3633', tex='grain', tex_scale=2.0, tex_strength=0.05)
    cz.cyl(name + '_pole', r_pole, pole_len, (0, 0, 0), wood, r2=r_pole * 0.86, verts=14, ol=0.006, parent=parent)
    for i, f in enumerate((0.8, 0.87)):
        cz.cyl(f'{name}_bind{i}', r_pole * 1.12, 0.035, (0, 0, pole_len * f), rope, verts=14, ol=0.004, parent=parent)
    zb = pole_len - 0.02
    bh = bowl_r * 0.85
    cz.cyl(name + '_bowl', bowl_r * 0.5, bh, (0, 0, zb), iron, r2=bowl_r, verts=24, bevel=0.008, ol=0.006, parent=parent)
    cz.cyl(name + '_rim', bowl_r + 0.008, 0.024, (0, 0, zb + bh - 0.012), iron, verts=24, bevel=0.006, ol=0.005, parent=parent)
    top = zb + bh + 0.012
    if lit:
        cz.cyl(name + '_embers', bowl_r * 0.9, 0.004, (0, 0, top - 0.0025), cz.glow(name + '_emberm', '#ff5a1c', 1.6),
               verts=24, ol=0.0, parent=parent)
        fl = cz.empty(name + '_flame', (0, 0, top - 0.01), parent=parent)
        layers = [('#ff7a1e', 2.0, 0.42, 0.135, 0.0, 0.0, 0.005), ('#ffb330', 2.3, 0.32, 0.092, -0.042, 0.02, 0.0),
                  ('#fff1a8', 2.6, 0.2, 0.052, -0.078, 0.03, 0.0)]
        for i, (c, st, H, R, yo, zo, ol) in enumerate(layers):
            pv = cz.empty(f'{name}_flame{i}', (0, yo * fs, zo * fs), parent=fl)
            _teardrop(cz, f'{name}_flame{i}_m', H * fs, R * fs, cz.glow(f'{name}_fl{i}', c, st), pv, curl=0.3 - 0.06 * i, ol=ol,
                      depth=0.5)      # flattened in Y: each inner layer stands out in front of the one behind it
        for i, (x, z, r) in enumerate(((0.05, 0.47, 0.016), (-0.045, 0.55, 0.012), (0.015, 0.62, 0.01))):
            cz.sphere(f'{name}_spark{i}', r * fs, (x * fs, -0.03, z * fs), cz.glow(name + '_sparkm', '#ffcf5a', 2.5), ol=0.0,
                      parent=fl, segs=10, rings=6)
        if light:
            lt = cz.light(name + '_light', 'POINT', (0, -0.06, top + 0.2 * fs), color='#ff9a3c', power=power, size=0.12)
            lt.parent = parent
    else:   # a cold torch: dark charred logs in the bowl
        char = cz.toon(name + '_char', '#2a2420', tex='grain', tex_strength=0.06)
        for i, a in enumerate((0, 60, 120)):
            cz.cyl(f'{name}_charlog{i}', 0.022, bowl_r * 1.6, (0, 0, top + 0.01), char, rot=(0, 90, a), verts=8, ol=0.004,
                   parent=parent, origin='center')
    return top


def build(cz, name='torch', mount='stand', lit=True, light=True, power=110.0, size=1.0):
    root = cz.empty(name)
    fs = float(size)
    if mount == 'wall':
        iron = cz.toon(name + '_iron', '#3d3633', tex='grain', tex_scale=2.0, tex_strength=0.05)
        cz.box(name + '_plate', (0.1, 0.025, 0.26), (0, -0.0125, 0), iron, bevel=0.006, ol=0.005, parent=root)
        for i, z in enumerate((0.09, -0.09)):
            cz.sphere(f'{name}_rivet{i}', 0.012, (0, -0.026, z), iron, ol=0.002, parent=root, segs=10, rings=6)
        cz.box(name + '_arm', (0.03, 0.2, 0.03), (0, -0.12, -0.06), iron, bevel=0.005, ol=0.005, parent=root)
        cz.box(name + '_brace', (0.025, 0.025, 0.17), (0, -0.075, -0.115), iron, rot=(-48, 0, 0), bevel=0.004, ol=0.004, parent=root)
        tilt = cz.empty(name + '_tilt', (0, -0.22, -0.06), parent=root)
        tilt.rotation_euler = (math.radians(18), 0, 0)      # top leans out toward -Y
        cz.cyl(name + '_collar', 0.05, 0.035, (0, 0, -0.0175), iron, verts=18, ol=0.004, parent=tilt)
        stick = cz.empty(name + '_stick', (0, 0, -0.26), parent=tilt)
        _head(cz, name, stick, lit, fs, light, power, 0.72, 0.034, 0.12)
    else:
        stone = cz.toon(name + '_stone', '#8d877c', tex='grain', tex_scale=1.5, tex_strength=0.06)
        cz.cyl(name + '_base', 0.17, 0.13, (0, 0, 0), stone, r2=0.13, verts=9, bevel=0.025, ol=0.007, parent=root)
        cz.cyl(name + '_wedge', 0.06, 0.04, (0, 0, 0.125), stone, r2=0.05, verts=7, bevel=0.01, ol=0.004, parent=root)
        pole = cz.empty(name + '_stick', (0, 0, 0.1), parent=root)
        _head(cz, name, pole, lit, fs, light, power, 1.2, 0.05, 0.15)
    return root
