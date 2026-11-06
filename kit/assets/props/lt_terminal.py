# Card payment terminal on a swivel pole (LOTTERY counter, the beige box in the L03/L04 foreground): a chunky beige
# box (screen + keys toward -Y, the customer), a dark card slot on top, a grey pole on a round foot.
# Root = foot centre on the counter top (z = 0).

META = {'size': (0.26, 0.16, 0.42), 'anchor': 'foot centre on the counter top; keys face -Y', 'animate': [],
        'params': 'h=0.26 (box centre height), yaw=0'}


def build(cz, name='lt_terminal', h=0.26, yaw=0.0):
    import math
    root = cz.empty(name)
    beige = cz.toon(name + '_beige', '#a8987a', tex='grain', tex_strength=0.06)
    grey = cz.toon(name + '_grey', '#6a6e74', tex='grain', tex_strength=0.04)
    dark = cz.toon(name + '_dark', '#25272b')
    cz.cyl(name + '_foot', 0.07, 0.025, (0, 0, 0), grey, bevel=0.008, ol=0.004, parent=root, verts=32)
    cz.cyl(name + '_pole', 0.016, h - 0.1, (0, 0, 0.02), grey, ol=0.003, parent=root, verts=16)
    hd = cz.empty(name + '_head', (0, 0, h), parent=root); hd.rotation_euler = (math.radians(12), 0, math.radians(yaw))
    cz.box(name + '_box', (0.24, 0.14, 0.16), (0, 0, 0), beige, bevel=0.018, ol=0.007, parent=hd)
    cz.box(name + '_scr', (0.15, 0.006, 0.05), (0, -0.07, 0.035), cz.glow('lt_term_scr', '#8fd6b8', 0.9), bevel=0.002, ol=0.0, parent=hd)
    km = cz.toon(name + '_keym', '#efe6cf')
    for i in range(3):
        for j in range(3):
            cz.box(f'{name}_k{i}{j}', (0.03, 0.008, 0.018), (-0.04 + j * 0.04, -0.072, -0.012 - i * 0.026), km, bevel=0.003, ol=0.0015, parent=hd)
    cz.box(name + '_slot', (0.16, 0.03, 0.012), (0, 0.0, 0.08), dark, bevel=0.003, ol=0.0, parent=hd)
    return root
