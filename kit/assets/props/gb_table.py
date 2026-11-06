# BELL: rustic kitchen table, 1.3 x 0.8 m, top at 0.72 m. Four honey-pine planks with dark gaps and knots on four
# turned legs (square tops, bulb, rings, tapered feet), aprons with a small drawer + knob at the front.
# kw cloth=True: a red-white checked cloth (tex/gb_table_check.png) on the top, hanging 0.19 m on every side.
# kw items=True: a bread loaf + knife on a board, a stoneware jug with a blue band, two blue-white plates
# (tex/gb_hutch_plate.png), a pewter salt cellar.
# Floor prop: root at the floor centre, long side along X, the drawer side faces -Y.
import math, os, subprocess

META = {'size': (1.3, 0.8, 0.72), 'anchor': 'floor centre; long side along X; drawer side faces -Y',
        'animate': [], 'top_z': 0.72, 'top_z_cloth': 0.727,
        'params': "cloth=False|True (checked cloth, top_z becomes 0.727), items=True|False, wood (hex)",
        'item_spots': {'plate_a': (-0.05, -0.2), 'plate_b': (0.42, -0.18), 'jug': (0.3, 0.16), 'bread': (-0.36, 0.06)}}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _png(cz, what, fname):
    p = os.path.join(TEX, fname)
    if not os.path.exists(p):
        py = cz.py()
        try:
            subprocess.run([py, os.path.join(TEX, 'make_gb_interior.py'), what], timeout=90, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e: print('CZ gb png failed', what, e)
    return p if os.path.exists(p) else None


def hbox(cz, nm, sx, sy, sz, loc, mat, **kw):
    """Box long in X with the wood grain along X (built long in local Y, turned 90 deg about Z)."""
    return cz.box(nm, (sy, sx, sz), loc, mat, rot=(0, 0, 90), **kw)


def build(cz, name='gb_table', cloth=False, items=True, wood='#8a5a2b'):
    root = cz.empty(name)
    pm = [cz.toon(f'{name}_plank{i}m', c, tex='wood', tex_scale=6.0, tex_strength=0.17)
          for i, c in enumerate((wood, '#82532a', '#90602f', '#7d4f27'))]
    lg = cz.toon(name + '_legm', '#6a4020', tex='wood', tex_scale=8.0, tex_strength=0.15)
    dk = cz.toon(name + '_gapm', '#2e1e12')
    T = 0.72

    # ---- top: four planks with dark gaps underneath
    cz.box(name + '_under', (1.25, 0.77, 0.012), (0, 0, T - 0.05), dk, bevel=0, ol=0, parent=root, origin='bottom')
    for i, y in enumerate((-0.3, -0.1, 0.1, 0.3)):
        hbox(cz, f'{name}_plank{i}', 1.3, 0.196, 0.045, (0, y, T - 0.045), pm[i], bevel=0.008, ol=0.008, parent=root, origin='bottom')
    for i, (x, y, r) in enumerate(((-0.42, -0.31, 0.018), (0.18, 0.09, 0.013), (0.5, 0.3, 0.016))):   # knots
        cz.cyl(f'{name}_knot{i}', r, 0.0012, (x, y, T + 0.0003), cz.toon(name + '_knotm', '#5a3518'), ol=0, parent=root, verts=16)
    # ---- legs (turned) + aprons + drawer
    for i, (x, y) in enumerate([(-0.56, -0.31), (0.56, -0.31), (-0.56, 0.31), (0.56, 0.31)]):
        cz.box(f'{name}_legtop{i}', (0.075, 0.075, 0.15), (x, y, T - 0.045 - 0.15), lg, bevel=0.008, ol=0.007, parent=root, origin='bottom')
        cz.cyl(f'{name}_leg{i}', 0.028, 0.45, (x, y, 0.08), lg, ol=0.006, parent=root, verts=20)
        cz.sphere(f'{name}_legbulb{i}', 0.05, (x, y, 0.36), lg, ol=0.006, parent=root, segs=24, rings=12)
        for j, zz in enumerate((0.47, 0.22)):
            cz.cyl(f'{name}_legring{i}{j}', 0.042, 0.028, (x, y, zz), lg, bevel=0.008, ol=0.005, parent=root, verts=20)
        cz.cyl(f'{name}_legfoot{i}', 0.024, 0.08, (x, y, 0.0), lg, r2=0.032, ol=0.005, parent=root, verts=20)
    for k, y in (('f', -0.31), ('b', 0.31)):
        hbox(cz, f'{name}_apron_{k}', 1.05, 0.026, 0.12, (0, y, T - 0.045 - 0.12), lg, bevel=0.006, ol=0.007, parent=root, origin='bottom')
    for k, x in (('l', -0.56), ('r', 0.56)):
        cz.box(f'{name}_apron_{k}', (0.026, 0.55, 0.12), (x, 0, T - 0.045 - 0.12), lg, bevel=0.006, ol=0.007, parent=root, origin='bottom')
    hbox(cz, name + '_drawer', 0.32, 0.012, 0.085, (0.1, -0.329, T - 0.045 - 0.06), pm[1], bevel=0.005, ol=0.005, parent=root)
    cz.sphere(name + '_drawer_knob', 0.016, (0.1, -0.343, T - 0.105), lg, ol=0.003, parent=root, segs=16, rings=8)

    top = T
    if cloth:
        chk = _png(cz, 'check', 'gb_table_check.png')
        cm = cz.toon(name + '_clothm_gb_table_check', '#b8302a', img=chk, proj='box', proj_scale=2.1, lift=0.6) if chk else '#b8302a'
        cl = cz.empty(name + '_cloth', (0, 0, 0), parent=root)
        cz.box(name + '_cloth_top', (1.36, 0.86, 0.007), (0, 0, T), cm, bevel=0.003, ol=0.005, parent=cl, origin='bottom')
        hem = cz.toon(name + '_hemm', '#e8dfcf', tex='paper', tex_strength=0.04)
        # skirts flare 5 deg out from the table edge (straight ones read as a box) and end in a pale hem
        for k, (sz, lc, rot, hs) in {'f': ((1.36, 0.008, 0.2), (0, -0.434, T + 0.006), (-5, 0, 0), (1.36, 0.014, 0.02)),
                                     'b': ((1.36, 0.008, 0.2), (0, 0.434, T + 0.006), (5, 0, 0), (1.36, 0.014, 0.02)),
                                     'l': ((0.008, 0.86, 0.2), (-0.684, 0, T + 0.006), (0, 5, 0), (0.014, 0.86, 0.02)),
                                     'r': ((0.008, 0.86, 0.2), (0.684, 0, T + 0.006), (0, -5, 0), (0.014, 0.86, 0.02))}.items():
            sk = cz.box(f'{name}_cloth_{k}', sz, lc, cm, rot=rot, bevel=0.003, ol=0.005, parent=cl, origin='top')
            cz.box(f'{name}_cloth_{k}_hem', hs, (0, 0, -0.19), hem, bevel=0.004, ol=0.003, parent=sk)
        top = T + 0.007

    if items:
        it = cz.empty(name + '_items', (0, 0, top), parent=root)
        brd = cz.toon(name + '_boardm', '#a8743a', tex='wood', tex_scale=10.0, tex_strength=0.16)
        hbox(cz, name + '_board', 0.36, 0.24, 0.024, (-0.36, 0.06, 0.0), brd, bevel=0.006, ol=0.005, parent=it, origin='bottom')
        cz.cyl(name + '_board_handle', 0.04, 0.024, (-0.58, 0.06, 0.0), brd, bevel=0.004, ol=0.005, parent=it, verts=20)
        crust = cz.toon(name + '_crustm', '#8c4a1c', tex='grain', tex_scale=3.0, tex_strength=0.1)
        loaf = cz.capsule(name + '_loaf', 0.07, 0.27, (-0.495, 0.07, 0.024 + 0.066), crust, ol=0.006, parent=it)
        loaf.rotation_euler = (0, math.radians(90), 0)
        for j in range(3):
            cz.box(f'{name}_loaf_cut{j}', (0.012, 0.08, 0.008), (-0.43 + j * 0.065, 0.07, 0.024 + 0.066 + 0.066), cz.toon(name + '_cutm', '#e0b874'),
                   rot=(0, 0, 25), bevel=0.003, ol=0, parent=it)
        cz.box(name + '_knife_blade', (0.17, 0.028, 0.004), (-0.31, -0.03, 0.026), cz.toon(name + '_steelm', '#a9aaa4'), rot=(0, 0, -8), bevel=0.001, ol=0.002, parent=it, origin='bottom')
        cz.box(name + '_knife_handle', (0.1, 0.024, 0.018), (-0.18, -0.048, 0.026), cz.toon(name + '_khm', '#3e2616'), rot=(0, 0, -8), bevel=0.005, ol=0.003, parent=it, origin='bottom')
        # stoneware jug
        sw = cz.toon(name + '_stonem', '#d4c39c', tex='grain', tex_strength=0.06)
        bl = cz.toon(name + '_bandm', '#34558c')
        jx, jy = 0.3, 0.16
        cz.cyl(name + '_jug', 0.07, 0.15, (jx, jy, 0), sw, r2=0.05, bevel=0.01, ol=0.006, parent=it, verts=32)
        cz.cyl(name + '_jug_neck', 0.05, 0.06, (jx, jy, 0.148), sw, r2=0.06, ol=0.006, parent=it, verts=32)
        cz.cyl(name + '_jug_band', 0.066, 0.025, (jx, jy, 0.06), bl, r2=0.062, ol=0, parent=it, verts=32)
        cz.cyl(name + '_jug_in', 0.052, 0.003, (jx, jy, 0.207), cz.toon(name + '_juginm', '#4a3a2a'), ol=0, parent=it, verts=24)
        cz.box(name + '_jug_spout', (0.04, 0.03, 0.025), (jx - 0.06, jy, 0.192), sw, rot=(0, -20, 0), bevel=0.008, ol=0.004, parent=it)
        for j, (sz, lc) in enumerate((((0.05, 0.022, 0.02), (jx + 0.08, jy, 0.18)), ((0.02, 0.022, 0.12), (jx + 0.1, jy, 0.12)), ((0.05, 0.022, 0.02), (jx + 0.075, jy, 0.06)))):
            cz.box(f'{name}_jug_handle{j}', sz, lc, sw, bevel=0.008, ol=0.004, parent=it)
        # plates (blue-white) + salt cellar
        pp = _png(cz, 'plate', 'gb_hutch_plate.png')
        pmat = cz.toon(name + '_platem_gb_hutch_plate', '#e8e2d6', img=pp, lift=0.62, alpha_clip=True) if pp else '#e8e2d6'
        base = cz.toon(name + '_platebasem', '#e8e2d6', tex='grain', tex_strength=0.03)
        for j, (x, y) in enumerate(((-0.05, -0.2), (0.42, -0.18))):
            cz.cyl(f'{name}_plate{j}', 0.115, 0.014, (x, y, 0), base, r2=0.12, bevel=0.004, ol=0.005, parent=it, verts=40)
            cz.plane(f'{name}_plate{j}_art', 0.232, 0.232, (x, y, 0.0155), pmat, rot=(0, 0, 0), parent=it)
        pw = cz.toon(name + '_pewterm', '#8e8f8a', tex='grain', tex_strength=0.05)
        cz.cyl(name + '_salt_foot', 0.032, 0.012, (0.1, 0.06, 0), pw, ol=0.003, parent=it, verts=20)
        cz.cyl(name + '_salt', 0.022, 0.025, (0.1, 0.06, 0.012), pw, r2=0.03, ol=0.003, parent=it, verts=20)
        cz.cyl(name + '_salt_in', 0.026, 0.003, (0.1, 0.06, 0.036), cz.toon(name + '_saltwm', '#f0ece2'), ol=0, parent=it, verts=20)
    return root
