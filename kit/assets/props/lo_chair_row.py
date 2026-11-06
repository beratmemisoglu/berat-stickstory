# A row of airport-style waiting chairs: moulded plastic shells (seat + back, rolled front lip, ribbed back) in
# alternating colours on a black steel beam with T-legs and floor feet. The row runs along X, the sitters face -Y.
# Seat top at z 0.45; seat i centre at x = (i - (n - 1) / 2) * pitch.
import math

META = {'size': (2.3, 0.62, 0.86), 'anchor': 'floor centre of the row; sitters face -Y; seat top z 0.45',
        'animate': [], 'params': "n=4, pitch=0.58, colors=['#d8564f','#169c98',...] (one per seat, cycles)"}


def build(cz, name='lo_chair_row', n=4, pitch=0.58, colors=None):
    root = cz.empty(name)
    colors = colors or ['#d8564f', '#169c98']
    stl = cz.toon(name + '_steel', '#2c2e36', tex='grain', tex_strength=0.04)
    ft = cz.toon(name + '_foot', '#4a4d57')
    L = (n - 1) * pitch + 0.5
    cz.box(name + '_beam', (L, 0.07, 0.06), (0, 0.04, 0.33), stl, bevel=0.01, ol=0.006, parent=root)
    for k in range(n + 1):
        x = -L / 2 + 0.06 + k * (L - 0.12) / n
        if k not in (0, n) and k % 2: continue
        cz.box(f'{name}_leg{k}', (0.05, 0.05, 0.32), (x, 0.04, 0.16), stl, bevel=0.008, ol=0.005, parent=root)
        cz.box(f'{name}_feet{k}', (0.08, 0.5, 0.035), (x, 0.02, 0.0175), stl, bevel=0.01, ol=0.005, parent=root)
        for sy in (-1, 1):
            cz.box(f'{name}_pad{k}{sy}', (0.09, 0.06, 0.02), (x, 0.02 + sy * 0.25, 0.01), ft, bevel=0.006, ol=0.003, parent=root)
    for i in range(n):
        x = (i - (n - 1) / 2) * pitch
        c = colors[i % len(colors)]
        sm = cz.toon(f'{name}_shell{i % len(colors)}', c, tex='grain', tex_strength=0.05)
        dk = cz.toon(f'{name}_rib{i % len(colors)}', _dark(c))
        cz.box(f'{name}_arm{i}', (0.035, 0.36, 0.035), (x - pitch / 2 + 0.02, 0.0, 0.375), stl, bevel=0.006, ol=0.004, parent=root) if i == 0 else None
        cz.box(f'{name}_brk{i}', (0.06, 0.3, 0.05), (x, 0.0, 0.37), stl, bevel=0.008, ol=0.004, parent=root)
        # seat pan with a rolled front lip
        cz.box(f'{name}_seat{i}', (pitch - 0.06, 0.44, 0.045), (x, -0.02, 0.425), sm, bevel=0.018, ol=0.007, parent=root)
        cz.cyl(f'{name}_lip{i}', 0.03, pitch - 0.07, (x - (pitch - 0.07) / 2, -0.235, 0.418), sm, rot=(0, 90, 0), ol=0.006, parent=root, verts=20)
        # back: tilted 12 deg, two ribs across it
        bk = cz.box(f'{name}_back{i}', (pitch - 0.06, 0.04, 0.42), (x, 0.215, 0.66), sm, rot=(-12, 0, 0), bevel=0.018, ol=0.007, parent=root)
        for r in range(3):
            z = 0.56 + r * 0.1
            cz.box(f'{name}_brib{i}_{r}', (pitch - 0.14, 0.006, 0.012), (x, 0.215 - 0.022 - (z - 0.66) * math.tan(math.radians(12)), z), dk, rot=(-12, 0, 0), bevel=0, ol=0, parent=root)
        for r in range(2):
            cz.box(f'{name}_srib{i}_{r}', (pitch - 0.14, 0.012, 0.004), (x, -0.13 + r * 0.17, 0.4485), dk, bevel=0, ol=0, parent=root)
        cz.box(f'{name}_post{i}', (0.05, 0.05, 0.22), (x, 0.2, 0.43), stl, rot=(-12, 0, 0), bevel=0.006, ol=0.004, parent=root)
    return root


def _dark(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    return '#%02x%02x%02x' % tuple(int(v * 0.72) for v in c)
