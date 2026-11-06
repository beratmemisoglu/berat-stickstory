# Office chair: 5-star base on casters, gas lift, padded seat (top at 0.47 m), reclined backrest on a curved support,
# padded armrests. Everything above the gas-lift shroud (piston, mechanism, seat, back, arms) hangs on the pivot empty
# <name>_swivel on the Z axis: animate its rotation_euler.z to turn the chair (0 = facing -Y).
# Floor prop: root at the floor centre under the column, the sitter faces -Y.
import math

META = {'size': (0.69, 0.66, 0.99),
        'anchor': 'floor centre under the gas lift; seat top at z = 0.47, seat centre at (0, -0.01); faces -Y',
        'animate': ['_swivel'],
        'params': "color='#4a6a9a' (seat + back cushions), frame='#2f3136' (base, shells, arms), turn=0 (degrees, "
                  "initial swivel about Z, + = counter-clockwise from above)"}

PIV = 0.30    # swivel pivot height (top of the gas-lift shroud)


def build(cz, name='office_chair', color='#4a6a9a', frame='#2f3136', turn=0.0):
    root = cz.empty(name)

    def M(key, c, **k):
        return cz.toon(f'office_chair_{key}_{c.lstrip("#")}', c, **k)

    fr = M('frame', frame, tex='grain', tex_strength=0.03)
    wheel = M('wheel', '#232428', tex='grain', tex_strength=0.03)
    hub = M('hubcap', '#8e939a')
    chrome = M('chrome', '#c9cdd2')
    cush = M('cushion', color, tex='grain', tex_scale=2.0, tex_strength=0.05)
    pad = M('pad', _shade(frame, 1.35), tex='grain', tex_strength=0.03)

    # ---- static base: hub, five arms, casters, gas-lift shroud
    cz.cyl(name + '_hub', 0.055, 0.075, (0, 0, 0.06), fr, r2=0.045, bevel=0.006, ol=0.006, parent=root)
    for k in range(5):
        a = math.radians(90 + 72 * k); d = (math.cos(a), math.sin(a))
        cz.box(f'{name}_leg{k}', (0.27, 0.05, 0.036), (0.16 * d[0], 0.16 * d[1], 0.09), fr, rot=(0, 0, math.degrees(a)), bevel=0.012, ol=0.006, parent=root)
        cz.box(f'{name}_fork{k}', (0.04, 0.038, 0.034), (0.275 * d[0], 0.275 * d[1], 0.06), fr, rot=(0, 0, math.degrees(a)), bevel=0.008, ol=0.005, parent=root)
        rw = 0.3
        cz.cyl(f'{name}_wheel{k}', 0.032, 0.03, (rw * d[0], rw * d[1], 0.032), wheel, rot=(0, 90, math.degrees(a)), verts=28, bevel=0.006, ol=0.005, parent=root, origin='center')
        cz.cyl(f'{name}_wheelcap{k}', 0.015, 0.003, ((rw + 0.015) * d[0], (rw + 0.015) * d[1], 0.032), hub, rot=(0, 90, math.degrees(a)), verts=20, ol=0, parent=root)
    cz.cyl(name + '_shroud', 0.033, PIV - 0.13, (0, 0, 0.13), fr, verts=32, bevel=0.004, ol=0.005, parent=root)

    # ---- swivel: everything that turns
    sw = cz.empty(name + '_swivel', (0, 0, PIV), parent=root)
    sw.rotation_euler.z = math.radians(turn)

    def P(x, y, z): return (x, y, z - PIV)

    cz.cyl(name + '_piston', 0.02, 0.1, P(0, 0, 0.28), chrome, verts=24, ol=0.004, parent=sw)
    cz.box(name + '_mech', (0.2, 0.22, 0.045), P(0, 0, 0.3825), fr, bevel=0.01, ol=0.006, parent=sw)
    cz.box(name + '_lever', (0.12, 0.014, 0.014), P(0.15, -0.04, 0.385), fr, bevel=0.004, ol=0.004, parent=sw)
    cz.sphere(name + '_knob', 0.017, P(0.215, -0.04, 0.385), pad, ol=0.004, parent=sw, segs=20, rings=10)
    # seat: dark shell under a soft cushion, top at 0.47
    cz.box(name + '_shell', (0.44, 0.42, 0.028), P(0, -0.01, 0.402), fr, bevel=0.01, ol=0.006, parent=sw)
    cz.box(name + '_seat', (0.5, 0.47, 0.066), P(0, -0.01, 0.437), cush, bevel=0.026, ol=0.008, parent=sw)
    # backrest support: one curved bar from under the seat up behind the back
    a = cz.empty(name + '_bs_a', P(0, 0.12, 0.385), parent=sw)
    b = cz.empty(name + '_bs_b', P(0, 0.37, 0.37), parent=sw)
    c = cz.empty(name + '_bs_c', P(0, 0.315, 0.73), parent=sw)
    cz.outline(cz.limb(name + '_backbar', a, b, c, 0.026, fr, sw), 0.005)
    # backrest (reclined 8 degrees): cushion with a plastic back shell
    bk = cz.empty(name + '_back', P(0, 0.27, 0.78), parent=sw)
    bk.rotation_euler.x = math.radians(-8)
    cz.box(name + '_backpad', (0.44, 0.075, 0.42), (0, 0, 0), cush, bevel=0.032, ol=0.008, parent=bk)
    cz.box(name + '_backshell', (0.41, 0.03, 0.39), (0, 0.03, 0), fr, bevel=0.012, ol=0.006, parent=bk)
    # armrests: curved posts from under the seat to padded rests
    for s in (-1, 1):
        a = cz.empty(f'{name}_arm{s}_a', P(s * 0.14, 0.0, 0.385), parent=sw)
        b = cz.empty(f'{name}_arm{s}_b', P(s * 0.35, 0.0, 0.36), parent=sw)
        c = cz.empty(f'{name}_arm{s}_c', P(s * 0.31, 0.02, 0.645), parent=sw)
        cz.outline(cz.limb(f'{name}_armpost{s}', a, b, c, 0.02, fr, sw), 0.005)
        cz.box(f'{name}_armpad{s}', (0.07, 0.27, 0.036), P(s * 0.31, 0.0, 0.656), pad, bevel=0.015, ol=0.006, parent=sw)
    return root


def _shade(hexc, k):
    h = hexc.lstrip('#')
    return '#' + ''.join(f'{max(0, min(255, int(int(h[i:i + 2], 16) * k))):02x}' for i in (0, 2, 4))
