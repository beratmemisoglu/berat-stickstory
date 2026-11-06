# Red wooden crate used as a nightstand (Kyle's bedroom; the fishbowl stands on it): a painted red box with soft
# bevels, darker plank grooves on the sides and the top, darker corner trims up the four edges and a top rim frame.
# Floor prop: root at the floor centre, front -Y. Top surface (where the bowl stands) at META['top'].
H = 0.36
META = {'size': (0.43, 0.43, H), 'anchor': 'floor centre; top surface z = 0.36 (stand ld_fishbowl at (0, 0, 0.36))',
        'animate': [], 'top': H, 'params': "color='#b8282c'"}


def build(cz, name='ld_crate', color='#a82226'):
    root = cz.empty(name)
    red = cz.toon(name + '_paint', color, tex='wood', tex_scale=2.0, tex_strength=0.07)
    dark = cz.toon(name + '_trimm', '#7e161c', tex='wood', tex_scale=2.0, tex_strength=0.05)
    groove = cz.toon(name + '_groove', '#6a1218')
    S = 0.42
    cz.box(name + '_body', (S, S, H), (0, 0, 0), red, bevel=0.01, ol=0.008, parent=root, origin='bottom')
    # corner trims (stop 8 mm under the top so nothing is coplanar with it)
    for k, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        cz.box(f'{name}_post{k}', (0.05, 0.05, H - 0.012), (sx * (S / 2 - 0.022), sy * (S / 2 - 0.022), 0.002), dark, bevel=0.006, ol=0.005, parent=root, origin='bottom')
    # bottom skirt band (front / back / sides), 3 mm proud
    for k, (sx, sy, x, y) in enumerate(((S - 0.1, 0.006, 0, -S / 2), (S - 0.1, 0.006, 0, S / 2), (0.006, S - 0.1, -S / 2, 0), (0.006, S - 0.1, S / 2, 0))):
        cz.box(f'{name}_skirt{k}', (sx, sy, 0.045), (x, y, 0.006), dark, bevel=0.002, ol=0.004, parent=root, origin='bottom')
    # plank grooves: two per side face (1.5 mm proud, no outline), three on the top (1.3 mm above it)
    for z in (0.15, 0.255):
        for k, (sx, sy, x, y) in enumerate(((S - 0.11, 0.003, 0, -S / 2 - 0.0005), (S - 0.11, 0.003, 0, S / 2 + 0.0005),
                                            (0.003, S - 0.11, -S / 2 - 0.0005, 0), (0.003, S - 0.11, S / 2 + 0.0005, 0))):
            cz.box(f'{name}_groove{k}_{int(z * 1000)}', (sx, sy, 0.007), (x, y, z), groove, bevel=0.0, ol=0.0, parent=root)
    for i, x in enumerate((-0.07, 0.07)):
        cz.box(f'{name}_topgroove{i}', (0.006, S - 0.05, 0.002), (x, 0, H + 0.0003), groove, bevel=0.0, ol=0.0, parent=root, origin='bottom')
    # a few nail heads on the front trims
    nail = cz.toon(name + '_nail', '#3a3030')
    for k, (x, z) in enumerate(((-0.19, 0.08), (-0.19, 0.3), (0.19, 0.08), (0.19, 0.3))):
        cz.cyl(f'{name}_nail{k}', 0.006, 0.003, (x, -S / 2 - 0.0035, z), nail, rot=(90, 0, 0), verts=10, ol=0.0, parent=root)
    return root
