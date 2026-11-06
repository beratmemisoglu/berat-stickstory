# BELL: the doctor's bed. A cherry-wood bed with four turned posts (ball finials), an arched headboard with raised
# panels and a carved medallion, a panelled footboard, side rails, a ticking mattress, a bottom sheet, two pillows
# leaning on the headboard, a bright patchwork quilt (tex/gb_bed_quilt.png) with the sheet turned down over it,
# and a nightstand at +X of the head end: drawer + brass knob, a book, spectacles, a brass candlestick with an
# unlit wax candle (the film owner adds the flame at META 'candle_top'). Optional doctor's bag and chamber pot.
# Floor prop: root at the floor centre of the bed, headboard at +Y, foot toward -Y.
# <name>_quilt = the quilt top (mesh); its drapes + turned-down sheet are its children: hide / move it with
# its children (hide_render / hide_viewport on [q] + q.children_recursive).
import math, os, subprocess

META = {'size': (1.95, 2.06, 1.48), 'anchor': 'floor centre of the bed (nightstand extends to x = +1.05); headboard +Y',
        'animate': ['_quilt'], 'mattress_z': 0.552, 'sit_at': (0.0, 0.48), 'pillow_y': 0.74,
        'candle_top': (0.85, 0.74, 0.912), 'nightstand': (0.83, 0.74, 0.65),
        'params': "quilt=True|False, bag=True (doctor's bag on the floor by the nightstand), pot=True (chamber pot under the bed), wood"}

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


def _post(cz, nm, x, y, h, wd, br, parent):
    cz.box(nm + '_block', (0.1, 0.1, 0.42), (x, y, 0), wd, bevel=0.012, ol=0.008, parent=parent, origin='bottom')
    cz.cyl(nm + '_foot', 0.055, 0.04, (x, y, 0.0), wd, bevel=0.01, ol=0.006, parent=parent, verts=24)
    cz.cyl(nm + '_shaft', 0.038, h - 0.42 - 0.06, (x, y, 0.42), wd, ol=0.007, parent=parent, verts=24)
    for j, zz in enumerate((0.44, h * 0.5 + 0.2, h - 0.11)):
        cz.cyl(f'{nm}_ring{j}', 0.05, 0.035, (x, y, zz), wd, bevel=0.01, ol=0.006, parent=parent, verts=24)
    cz.sphere(nm + '_ball', 0.06, (x, y, h - 0.02), wd, ol=0.007, parent=parent, segs=24, rings=12)


def build(cz, name='gb_bed', quilt=True, bag=True, pot=True, wood='#5a2f1c'):
    root = cz.empty(name)
    wd = cz.toon(name + '_woodm', wood, tex='wood', tex_scale=7.0, tex_strength=0.16)
    wl = cz.toon(name + '_panelm', '#7a4426', tex='wood', tex_scale=9.0, tex_strength=0.18)
    br = cz.toon(name + '_brassm', '#a87a26', tex='grain', tex_strength=0.06)
    qp = _png(cz, 'quilt', 'gb_bed_quilt.png'); tk = _png(cz, 'ticking', 'gb_bed_ticking.png')
    qm = cz.toon(name + '_quiltm_gb_bed_quilt', '#b8402f', img=qp, proj='box', proj_scale=0.58, lift=0.64) if qp else '#b8402f'
    tm = cz.toon(name + '_tickm_gb_bed_ticking', '#c9c0aa', img=tk, proj='box', proj_scale=3.0, lift=0.66) if tk else '#c9c0aa'
    sh = cz.toon(name + '_sheetm', '#e6dcc6', tex='paper', tex_strength=0.05, lift=0.55)
    pl = cz.toon(name + '_pillowm', '#ece2cc', tex='paper', tex_strength=0.05, lift=0.55)

    # ---- frame
    for k, (x, y, h) in {'hl': (-0.53, 0.97, 1.45), 'hr': (0.53, 0.97, 1.45), 'fl': (-0.53, -0.97, 0.98), 'fr': (0.53, -0.97, 0.98)}.items():
        _post(cz, f'{name}_post_{k}', x, y, h, wd, br, root)
    for k, x in (('l', -0.53), ('r', 0.53)):
        cz.box(f'{name}_rail_{k}', (0.05, 1.86, 0.17), (x, 0, 0.21), wd, bevel=0.01, ol=0.008, parent=root, origin='bottom')
    # headboard: lower panel + an arch rising above it, two raised panels, a carved medallion
    cz.box(name + '_head', (1.0, 0.055, 0.72), (0, 0.97, 0.38), wd, bevel=0.01, ol=0.009, parent=root, origin='bottom')
    cz.cyl(name + '_head_arch', 0.5, 0.045, (0, 0.97 + 0.0225, 0.85), wd, rot=(90, 0, 0), bevel=0.01, ol=0.009, parent=root, verts=64)
    for k, x in (('l', -0.25), ('r', 0.25)):
        cz.box(f'{name}_head_panel_{k}', (0.38, 0.014, 0.4), (x, 0.97 - 0.0335, 0.62), wl, bevel=0.012, ol=0.005, parent=root)
    hbox(cz, name + '_head_cap', 1.02, 0.07, 0.035, (0, 0.97, 1.1), wd, bevel=0.008, ol=0.006, parent=root, origin='bottom')
    cz.cyl(name + '_medallion', 0.085, 0.016, (0, 0.97 - 0.0225, 1.2), wl, rot=(90, 0, 0), bevel=0.006, ol=0.005, parent=root, verts=32)
    cz.cyl(name + '_medallion_c', 0.035, 0.012, (0, 0.97 - 0.0385, 1.2), br, rot=(90, 0, 0), bevel=0.003, ol=0.003, parent=root, verts=20)
    # footboard
    cz.box(name + '_foot', (1.0, 0.055, 0.46), (0, -0.97, 0.36), wd, bevel=0.01, ol=0.009, parent=root, origin='bottom')
    hbox(cz, name + '_foot_cap', 1.04, 0.08, 0.04, (0, -0.97, 0.82), wd, bevel=0.01, ol=0.007, parent=root, origin='bottom')
    for k, x in (('l', -0.25), ('r', 0.25)):
        cz.box(f'{name}_foot_panel_{k}', (0.38, 0.014, 0.28), (x, -0.97 - 0.0335, 0.59), wl, bevel=0.012, ol=0.005, parent=root)

    # ---- mattress, bottom sheet, pillows
    cz.box(name + '_mattress', (1.0, 1.88, 0.17), (0, 0, 0.375), tm, bevel=0.035, ol=0.007, parent=root, origin='bottom')
    cz.box(name + '_sheet', (1.02, 1.84, 0.012), (0, 0.0, 0.541), sh, bevel=0.005, ol=0.004, parent=root, origin='bottom')
    # slept-in rumples (hidden inside the quilt; they show when the quilt is hidden / thrown off)
    shd = cz.toon(name + '_sheetfoldm', '#e2d8c2', tex='paper', tex_strength=0.05, lift=0.55)
    # wide low ridges (fat capsules sunk into the mattress): thin ones read as sticks lying on the sheet
    for i, (x, y, ang, ln) in enumerate(((-0.22, 0.05, 18, 0.6), (0.12, -0.3, -14, 0.75), (-0.1, -0.62, 6, 0.55))):
        rr = cz.capsule(f'{name}_rumple{i}', 0.042, ln, (x - ln / 2 * math.cos(math.radians(ang)), y - ln / 2 * math.sin(math.radians(ang)), 0.527), shd, ol=0, parent=root)
        rr.rotation_euler = (0, math.radians(90), math.radians(ang))
    for k, x in (('l', -0.23), ('r', 0.23)):
        cz.box(f'{name}_pillow_{k}', (0.44, 0.15, 0.3), (x, 0.82, 0.69), pl, rot=(-22, 0, (-3 if x < 0 else 4)), bevel=0.06, ol=0.007, parent=root)

    # ---- quilt (own part) with drapes over both sides + the sheet turned down over its top edge
    if quilt:
        q = cz.box(name + '_quilt', (1.12, 1.4, 0.04), (0, -0.215, 0.553), qm, bevel=0.015, ol=0.008, parent=root, origin='bottom')
        q.location = (0, -0.215, 0.553)
        for k, s in (('l', -1), ('r', 1)):
            cz.box(f'{name}_quilt_drape_{k}', (0.03, 1.4, 0.3), (s * 0.578, 0.0, -0.27), qm, bevel=0.012, ol=0.008, parent=q, origin='bottom')
        cz.box(name + '_quilt_foldsheet', (1.14, 0.15, 0.045), (0, 0.66, 0.012), sh, bevel=0.018, ol=0.007, parent=q, origin='bottom')

    # ---- nightstand (+X of the head end) with candlestick, book, spectacles
    nx, ny = 0.83, 0.74
    ns = cz.empty(name + '_nightstand', (nx, ny, 0), parent=root)
    for i, (x, y) in enumerate([(-0.17, -0.15), (0.17, -0.15), (-0.17, 0.15), (0.17, 0.15)]):
        cz.cyl(f'{name}_ns_leg{i}', 0.022, 0.1, (x, y, 0), wd, r2=0.03, ol=0.005, parent=ns, verts=16)
    cz.box(name + '_ns_body', (0.4, 0.36, 0.52), (0, 0, 0.1), wd, bevel=0.01, ol=0.008, parent=ns, origin='bottom')
    hbox(cz, name + '_ns_top', 0.46, 0.42, 0.03, (0, 0, 0.62), wd, bevel=0.008, ol=0.007, parent=ns, origin='bottom')
    hbox(cz, name + '_ns_drawer', 0.34, 0.014, 0.13, (0, -0.186, 0.47), wl, bevel=0.006, ol=0.005, parent=ns)
    cz.sphere(name + '_ns_knob', 0.018, (0, -0.2, 0.47), br, ol=0.003, parent=ns, segs=16, rings=8)
    cz.box(name + '_ns_door', (0.34, 0.014, 0.28), (0, -0.186, 0.24), wl, bevel=0.008, ol=0.005, parent=ns)
    cz.sphere(name + '_ns_knob2', 0.014, (0.13, -0.2, 0.26), br, ol=0.003, parent=ns, segs=16, rings=8)
    zt = 0.65
    cz.cyl(name + '_cs_dish', 0.062, 0.014, (0.02, 0.0, zt), br, bevel=0.004, ol=0.004, parent=ns, verts=28)
    cz.cyl(name + '_cs_stem', 0.017, 0.06, (0.02, 0.0, zt + 0.014), br, ol=0.003, parent=ns, verts=16)
    cz.cyl(name + '_cs_cup', 0.027, 0.022, (0.02, 0.0, zt + 0.07), br, bevel=0.004, ol=0.003, parent=ns, verts=20)
    cz.cyl(name + '_cs_ring', 0.022, 0.008, (0.085, 0.0, zt + 0.003), br, rot=(90, 0, 0), ol=0.002, parent=ns, verts=16)
    wax = cz.toon(name + '_waxm', '#ece0c0', tex='grain', tex_strength=0.04, lift=0.55)
    cz.cyl(name + '_candle', 0.019, 0.16, (0.02, 0.0, zt + 0.09), wax, ol=0.003, parent=ns, verts=20)
    cz.sphere(name + '_candle_drip', 0.008, (0.036, -0.008, zt + 0.235), wax, ol=0.0, parent=ns, segs=10, rings=6)
    cz.cyl(name + '_wick', 0.0025, 0.012, (0.02, 0.0, zt + 0.25), cz.toon(name + '_wickm', '#2a2622'), ol=0, parent=ns, verts=8)
    cz.box(name + '_book', (0.16, 0.22, 0.045), (-0.1, 0.03, zt), cz.toon(name + '_bookm', '#7e2a26', tex='grain', tex_strength=0.05), rot=(0, 0, 12), bevel=0.006, ol=0.004, parent=ns, origin='bottom')
    cz.box(name + '_book_pages', (0.148, 0.206, 0.03), (-0.1 + 0.006, 0.03 - 0.003, zt + 0.0075), cz.toon(name + '_pagesm', '#e2d6b6', tex='paper'), rot=(0, 0, 12), bevel=0.002, ol=0.0, parent=ns, origin='bottom')
    for s in (-1, 1):
        cz.cyl(f'{name}_specs{s > 0}', 0.022, 0.004, (-0.1 + s * 0.028, -0.02, zt + 0.046), cz.toon(name + '_specm', '#b3a27a'), ol=0.002, parent=ns, verts=20)

    if bag:   # the doctor's black bag on the floor by the nightstand
        bg = cz.empty(name + '_bag', (0.86, 0.2, 0), parent=root)
        bm = cz.toon(name + '_bagm', '#2e2622', tex='grain', tex_strength=0.08)
        cz.box(name + '_bag_body', (0.36, 0.18, 0.2), (0, 0, 0), bm, bevel=0.03, ol=0.007, parent=bg, origin='bottom')
        cz.cyl(name + '_bag_top', 0.09, 0.36, (-0.18, 0, 0.2), bm, rot=(0, 90, 0), ol=0.007, parent=bg, verts=24)
        cz.box(name + '_bag_frame', (0.37, 0.03, 0.02), (0, 0, 0.29), br, bevel=0.005, ol=0.004, parent=bg)
        cz.box(name + '_bag_clasp', (0.04, 0.02, 0.04), (0, -0.09, 0.24), br, bevel=0.004, ol=0.003, parent=bg)
        cz.cyl(name + '_bag_handle', 0.012, 0.18, (-0.09, 0, 0.36), bm, rot=(0, 90, 0), ol=0.004, parent=bg, verts=12)
        for s in (-1, 1):
            cz.box(f'{name}_bag_hpost{s > 0}', (0.02, 0.02, 0.06), (s * 0.085, 0, 0.31), bm, bevel=0.004, ol=0.003, parent=bg, origin='bottom')
    if pot:   # enamel chamber pot peeking from under the bed
        pp = cz.empty(name + '_pot', (-0.25, -0.62, 0), parent=root)
        en = cz.toon(name + '_enamelm', '#e4ddd0', tex='grain', tex_strength=0.04)
        cz.cyl(name + '_pot_body', 0.11, 0.15, (0, 0, 0), en, r2=0.12, bevel=0.01, ol=0.005, parent=pp, verts=28)
        cz.cyl(name + '_pot_rim', 0.13, 0.02, (0, 0, 0.15), cz.toon(name + '_potrimm', '#3a5a94'), bevel=0.006, ol=0.004, parent=pp, verts=28)
        cz.cyl(name + '_pot_hole', 0.105, 0.004, (0, 0, 0.168), cz.toon(name + '_potinm', '#8f887c'), ol=0, parent=pp, verts=28)
    return root
