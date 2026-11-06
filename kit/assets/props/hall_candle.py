# Tall bronze pricket candle stand: a three-clawed foot on a domed base, a stem with three gold knops, a wide drip
# pan with a gold rim, a thick red candle with a wax drip, and a cartoon flame (two nested glowing teardrops). The set
# adds its own light at META['light_at'] (light=True puts a small warm point light there).
# Floor prop: root = floor centre; front -Y.
import math

META = {'size': (0.4, 0.4, 1.6), 'anchor': 'floor centre', 'animate': ['_flame (scale flicker, pivot at the wick)'],
        'light_at': 'z = height + 0.32', 'params': "height=1.25 (stand top), light=True, power=40"}


def build(cz, name='hall_candle', height=1.25, light=True, power=40.0):
    root = cz.empty(name)
    br = cz.toon('hall_bronze', '#9a6a34', tex='grain', tex_strength=0.06)
    gold = cz.toon('hall_gold', '#d2a23e', tex='grain', tex_scale=3.0, tex_strength=0.04)
    red = cz.toon('hall_candle_red', '#c42a22', tex='grain', tex_strength=0.03)
    from mathutils import Vector
    H = height
    for k in range(3):
        a = math.radians(-90 + 120 * k)
        c = cz.cyl(f'{name}_claw{k}', 0.035, 0.22, (0.05 * math.cos(a), 0.05 * math.sin(a), 0.1), br, r2=0.02, verts=10, ol=0.004, parent=root)
        d = Vector((math.cos(a), math.sin(a), -0.45)).normalized()
        c.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        cz.sphere(f'{name}_toe{k}', 0.035, (0.25 * math.cos(a), 0.25 * math.sin(a), 0.03), gold, ol=0.003, parent=root, segs=12, rings=6)
    cz.sphere(name + '_dome', 0.11, (0, 0, 0.1), br, scale=(1, 1, 0.7), ol=0.005, parent=root, segs=24, rings=12)
    cz.cyl(name + '_stem', 0.025, H - 0.15, (0, 0, 0.15), br, verts=14, ol=0.004, parent=root)
    for zz in (0.42, 0.75, H - 0.12):
        cz.sphere(f'{name}_knop{zz:.2f}', 0.045, (0, 0, zz), gold, scale=(1, 1, 0.75), ol=0.003, parent=root, segs=16, rings=8)
    cz.cyl(name + '_pan', 0.15, 0.03, (0, 0, H - 0.04), br, r2=0.17, verts=28, bevel=0.006, ol=0.005, parent=root)
    cz.cyl(name + '_panrim', 0.172, 0.012, (0, 0, H - 0.016), gold, verts=28, ol=0.0, parent=root)
    cz.cyl(name + '_candle', 0.045, 0.24, (0, 0, H - 0.01), red, verts=20, bevel=0.006, ol=0.004, parent=root)
    cz.sphere(name + '_drip', 0.02, (0.038, -0.02, H + 0.17), red, scale=(0.6, 0.6, 1.6), ol=0.002, parent=root, segs=10, rings=6)
    cz.cyl(name + '_wick', 0.004, 0.03, (0, 0, H + 0.23), cz.toon('hall_eye', '#2a2622'), verts=6, ol=0.0, parent=root)
    fl = cz.empty(name + '_flame', (0, 0, H + 0.245), parent=root)
    cz.sphere(name + '_flame0', 0.035, (0, 0, 0.05), cz.glow('hall_flame_out', '#ff9a2e', 6.0), scale=(1, 1, 2.0), ol=0.0, parent=fl, segs=14, rings=8)
    cz.sphere(name + '_flame1', 0.02, (0, -0.012, 0.04), cz.glow('hall_flame_in', '#fff2b0', 9.0), scale=(1, 1, 1.9), ol=0.0, parent=fl, segs=12, rings=6)
    if light:
        L = cz.light(name + '_light', 'POINT', (0, 0, H + 0.32), color='#ffb060', power=power, size=0.05, shadow=False)
        L.parent = root
    return root
