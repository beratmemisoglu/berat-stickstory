# Office coat stand with an umbrella stand beside it: weighted round base, chrome pole, a ring of six hooks with ball
# ends at the top, a navy coat and a beige scarf hanging, a tote bag; the umbrella stand (+X, 0.35 m away) holds three
# umbrellas (two clear-vinyl conbini umbrellas and a navy one) with J handles. Floor prop: root at the pole's foot.
import math

META = {'size': (0.75, 0.5, 1.8), 'anchor': 'floor centre of the coat stand; umbrella stand at x +0.38', 'animate': [],
        'params': 'umbrellas=True, coat=True'}


def build(cz, name='off_coat_rack', umbrellas=True, coat=True):
    root = cz.empty(name)
    chrome = cz.toon('off_cr_chrome', '#c4c9ce', tex='grain', tex_strength=0.03)
    dark = cz.toon('off_cr_dark', '#2e3136')
    cz.cyl(name + '_base', 0.2, 0.035, (0, 0, 0), dark, r2=0.17, verts=40, bevel=0.01, ol=0.006, parent=root)
    cz.cyl(name + '_pole', 0.018, 1.72, (0, 0, 0.035), chrome, verts=16, ol=0.005, parent=root)
    cz.sphere(name + '_cap', 0.032, (0, 0, 1.77), chrome, ol=0.004, parent=root, segs=20, rings=10)
    for k in range(6):
        a = k * math.pi / 3 + 0.3
        p = cz.empty(f'{name}_hk{k}', (0, 0, 1.62), parent=root); p.rotation_euler = (0, 0, a)
        h = cz.cyl(f'{name}_hook{k}', 0.01, 0.17, (0.0, 0, 0), chrome, rot=(0, 55, 0), verts=10, ol=0.003, parent=p)
        cz.sphere(f'{name}_hookball{k}', 0.017, (0.17 * math.sin(math.radians(55)), 0, 0.17 * math.cos(math.radians(55))), chrome, ol=0.003, parent=p, segs=14, rings=7)
    if coat:
        navy = cz.toon('off_cr_coat', '#2b3a5c', tex='grain', tex_strength=0.06)
        # the coat hangs off the -Y hook: shoulders, a long body, a collar
        cz.capsule(name + '_coat', 0.13, 0.85, (0.02, -0.17, 0.82), navy, scale=(1.25, 0.5, 1), ol=0.007, parent=root)
        cz.box(name + '_collar', (0.16, 0.04, 0.08), (0.02, -0.24, 1.58), cz.toon('off_cr_collar', '#22304d'), rot=(-15, 0, 0), bevel=0.02, ol=0.004, parent=root)
        cz.capsule(name + '_scarf', 0.035, 0.55, (0.12, -0.255, 1.02), cz.toon('off_cr_scarf', '#d9b77a', tex='grain', tex_strength=0.06), ol=0.004, parent=root)
        bag = cz.toon('off_cr_bag', '#c8734a', tex='grain', tex_strength=0.05)
        cz.box(name + '_bag', (0.07, 0.3, 0.34), (0.17, 0.08, 1.12), bag, rot=(0, 0, 60), bevel=0.02, ol=0.005, parent=root)
        a = cz.empty(name + '_strap_a', (0.17, -0.02, 1.28), parent=root)
        b = cz.empty(name + '_strap_b', (0.13, 0.02, 1.62), parent=root)
        c = cz.empty(name + '_strap_c', (0.19, 0.16, 1.28), parent=root)
        cz.outline(cz.limb(name + '_strap', a, b, c, 0.008, bag, root), 0.003)
    if umbrellas:
        ux = 0.42
        cz.cyl(name + '_ustand', 0.12, 0.45, (ux, 0, 0), cz.toon('off_cr_ustand', '#5b6068', tex='grain', tex_strength=0.04), r2=0.13, verts=32, bevel=0.006, ol=0.006, parent=root)
        cz.cyl(name + '_ustand_in', 0.11, 0.002, (ux, 0, 0.451), dark, verts=32, ol=0.0, parent=root)
        clear = cz.toon('off_cr_vinyl', '#dfeaee', tex='grain', tex_strength=0.04, emit=0.1)
        for k, (dx, dy, tx, ty, mat) in enumerate(((-0.04, -0.03, -12, 6, clear), (0.04, 0.02, 10, -8, clear),
                                                   (0.0, 0.05, 4, 12, cz.toon('off_cr_navyu', '#2b3a5c', tex='grain')))):
            p = cz.empty(f'{name}_um{k}', (ux + dx, dy, 0.03), parent=root); p.rotation_euler = (math.radians(ty), math.radians(tx), 0)
            cz.cyl(f'{name}_umb{k}', 0.045, 0.62, (0, 0, 0.12), mat, r2=0.02, verts=8, ol=0.004, parent=p)
            cz.cyl(f'{name}_shaft{k}', 0.006, 0.88, (0, 0, 0.0), chrome, verts=8, ol=0.0, parent=p)
            ha = cz.empty(f'{name}_h{k}_a', (0, 0, 0.86), parent=p)
            hb = cz.empty(f'{name}_h{k}_b', (0.0, 0, 1.0), parent=p)
            hc = cz.empty(f'{name}_h{k}_c', (0.09, 0, 0.95), parent=p)
            cz.outline(cz.limb(f'{name}_handle{k}', ha, hb, hc, 0.012, cz.toon('off_cr_handle' + str(k), ('#f2efe6', '#2a2622', '#8a5a32')[k]), p), 0.003)
    return root
