# BELL: grandfather (long-case) clock, ~1.95 m. Dark walnut with painted grain: bracket feet, plinth with a raised
# panel, a waist (trunk) with a glazed door showing the brass pendulum + two weights on chains, a hood with brass-capped
# columns over a painted arched dial (tex/gb_clock_dial.png: roman numerals, a sleepy moon in the moon-phase arch,
# corner roses), cornice + broken-pediment bonnet with brass rosettes and finials.
# Floor prop: root at the floor centre, the dial faces -Y.
# Pivots: <name>_hour / <name>_minute (rotation_euler.y, 0 = 12 o'clock, POSITIVE = clockwise seen from the front,
# tested), <name>_pendulum (rotation_euler.y about its top, positive swings the bob toward -X = screen-left, tested).
import math, os, subprocess

META = {'size': (0.6, 0.38, 1.95), 'anchor': 'floor centre; dial faces -Y',
        'animate': ['_hour', '_minute', '_pendulum'],
        'params': "time=(h, m) sets the hands; swing=deg (pendulum angle, + = bob to screen-left); wood (hex)",
        'dial_z': 1.401, 'dial_y': -0.1425, 'pendulum_pivot_z': 1.17}

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
    """A box long in X whose wood grain runs along X (built long in local Y, turned 90 deg about Z)."""
    return cz.box(nm, (sy, sx, sz), loc, mat, rot=(0, 0, 90), **kw)


def build(cz, name='gb_grandfather_clock', time=(2, 0), swing=0.0, wood='#4a2816'):
    root = cz.empty(name)
    wd = cz.toon(name + '_woodm', wood, tex='wood', tex_scale=7.0, tex_strength=0.16)
    wl = cz.toon(name + '_panelm', '#6b3a1f', tex='wood', tex_scale=9.0, tex_strength=0.2)    # lighter burl panels
    wi = cz.toon(name + '_innerm', '#24150c', tex='wood', tex_scale=5.0, tex_strength=0.12)
    br = cz.toon(name + '_brassm', '#a87a26', tex='grain', tex_strength=0.06)
    brl = cz.toon(name + '_brasslitm', '#e2bc5c', lift=0.8)
    ink = cz.toon(name + '_handm', '#1e1612', 0.8)
    chain = cz.toon(name + '_chainm', '#6e5a3a')

    # ---- feet, plinth
    for i, (x, y) in enumerate([(-0.25, -0.13), (0.25, -0.13), (-0.25, 0.13), (0.25, 0.13)]):
        cz.box(f'{name}_foot{i}', (0.09, 0.09, 0.05), (x, y, 0.0), wd, bevel=0.012, ol=0.006, parent=root, origin='bottom')
    cz.box(name + '_plinth', (0.56, 0.34, 0.24), (0, 0, 0.04), wd, bevel=0.012, ol=0.009, parent=root, origin='bottom')
    cz.box(name + '_plinth_panel', (0.38, 0.016, 0.15), (0, -0.172, 0.16), wl, bevel=0.008, ol=0.005, parent=root)
    hbox(cz, name + '_skirt', 0.60, 0.37, 0.035, (0, 0, 0.28), wd, bevel=0.01, ol=0.008, parent=root, origin='bottom')

    # ---- trunk: panels round a glazed opening (x +-0.14, z 0.45..1.12)
    z0, z1 = 0.315, 1.21
    H = z1 - z0
    cz.box(name + '_back', (0.44, 0.02, H), (0, 0.12, z0), wd, bevel=0.004, ol=0.008, parent=root, origin='bottom')
    for k, sx in (('l', -1), ('r', 1)):
        # built 0.26 along local X then turned: the side face gets vertical grain instead of blotches
        cz.box(f'{name}_side_{k}', (0.26, 0.02, H), (sx * 0.21, 0.0, z0), wd, rot=(0, 0, 90), bevel=0.004, ol=0.009, parent=root, origin='bottom')
        cz.box(f'{name}_stile_{k}', (0.08, 0.026, H), (sx * 0.18, -0.117, z0), wd, bevel=0.006, ol=0.008, parent=root, origin='bottom')
    hbox(cz, name + '_rail_bot', 0.30, 0.026, 0.135, (0, -0.117, z0), wd, bevel=0.006, ol=0.007, parent=root, origin='bottom')
    hbox(cz, name + '_rail_top', 0.30, 0.026, 0.09, (0, -0.117, 1.12), wd, bevel=0.006, ol=0.007, parent=root, origin='bottom')
    cz.box(name + '_interior', (0.38, 0.004, H), (0, 0.108, z0), wi, bevel=0, ol=0, parent=root, origin='bottom')
    # glazed door: a brass-edged bead frame proud of the stiles + glass shine strokes
    for k, (sz_, lc) in {'l': ((0.022, 0.012, 0.69), (-0.146, -0.136, 0.785)), 'r': ((0.022, 0.012, 0.69), (0.146, -0.136, 0.785)),
                         'b': ((0.314, 0.012, 0.022), (0, -0.136, 0.441)), 't': ((0.314, 0.012, 0.022), (0, -0.136, 1.129))}.items():
        cz.box(f'{name}_doorbead_{k}', sz_, lc, wl, bevel=0.004, ol=0.004, parent=root)
    glass = _png(cz, 'glass', 'gb_clock_glass.png')
    if glass:
        cz.plane(name + '_glass', 0.27, 0.665, (0, -0.133, 0.785), cz.toon(name + '_glassm_gb_clock_glass', img=glass, lift=0.9, alpha_clip=True), parent=root)
    cz.cyl(name + '_keyhole', 0.009, 0.006, (0.13, -0.142, 0.40), ink, rot=(90, 0, 0), ol=0, parent=root, verts=12)
    cz.box(name + '_keyhole_slot', (0.006, 0.006, 0.014), (0.13, -0.142, 0.39), ink, bevel=0, ol=0, parent=root)

    # ---- weights on chains (behind the pendulum) + pendulum
    for k, x in (('l', -0.09), ('r', 0.09)):
        cz.cyl(f'{name}_weight_{k}', 0.032, 0.18, (x, 0.07, 0.85), br, bevel=0.006, ol=0.004, parent=root, verts=24)
        cz.cyl(f'{name}_weightcap_{k}', 0.012, 0.03, (x, 0.07, 1.03), br, ol=0.002, parent=root, verts=12)
        for s in (-0.012, 0.012):
            cz.cyl(f'{name}_chain_{k}{s > 0}', 0.0035, 0.17, (x + s, 0.07, 1.04), chain, ol=0, parent=root, verts=8)
        cz.cyl(f'{name}_pulley_{k}', 0.02, 0.012, (x, 0.064, 1.05), br, rot=(90, 0, 0), ol=0.002, parent=root, verts=16)
    pv = cz.empty(name + '_pendulum', (0, 0.0, 1.17), parent=root)
    pv.rotation_euler = (0, math.radians(swing), 0)
    cz.box(name + '_rod', (0.016, 0.008, 0.52), (0, 0, -0.26), br, bevel=0.002, ol=0.003, parent=pv)
    cz.cyl(name + '_bob', 0.075, 0.022, (0, 0.011, -0.52), br, rot=(90, 0, 0), bevel=0.006, ol=0.006, parent=pv, verts=40)
    cz.cyl(name + '_bob_shine', 0.03, 0.002, (-0.022, -0.0115, -0.495), brl, rot=(90, 0, 0), ol=0, parent=pv, verts=24)

    # ---- hood: moulding, box, dial, columns, cornice, bonnet
    hbox(cz, name + '_waistcap', 0.50, 0.31, 0.04, (0, 0, z1), wd, bevel=0.01, ol=0.008, parent=root, origin='bottom')
    hz0, hz1 = 1.25, 1.65
    cz.box(name + '_hood', (0.48, 0.28, hz1 - hz0), (0, 0, hz0), wd, bevel=0.008, ol=0.009, parent=root, origin='bottom')
    dial = _png(cz, 'dial', 'gb_clock_dial.png')
    DW, DH, dz_top = 0.312, 0.39, 1.645
    cz.plane(name + '_dial', DW, DH, (0, -0.1425, dz_top - DH / 2),
             cz.toon(name + '_dialm_gb_clock_dial', '#ecdcb8', img=dial, lift=0.78) if dial else '#ecdcb8', parent=root)
    for k, sx in (('l', -1), ('r', 1)):
        cz.box(f'{name}_dialbead_{k}', (0.018, 0.012, DH + 0.01), (sx * (DW / 2 + 0.009), -0.144, dz_top - DH / 2), br, bevel=0.003, ol=0.003, parent=root)
        x = sx * 0.208
        cz.cyl(f'{name}_col_{k}', 0.02, hz1 - hz0 - 0.06, (x, -0.13, hz0 + 0.03), wl, ol=0.005, parent=root, verts=20)
        cz.cyl(f'{name}_colbase_{k}', 0.028, 0.03, (x, -0.13, hz0), br, bevel=0.004, ol=0.004, parent=root, verts=20)
        cz.cyl(f'{name}_colcap_{k}', 0.028, 0.03, (x, -0.13, hz1 - 0.03), br, bevel=0.004, ol=0.004, parent=root, verts=20)
    cz.box(name + '_dialbead_b', (DW + 0.036, 0.012, 0.018), (0, -0.144, dz_top - DH - 0.002), br, bevel=0.003, ol=0.003, parent=root)
    hbox(cz, name + '_cornice', 0.56, 0.34, 0.045, (0, 0, hz1), wd, bevel=0.01, ol=0.008, parent=root, origin='bottom')
    hbox(cz, name + '_cornice2', 0.60, 0.37, 0.03, (0, 0, hz1 + 0.045), wd, bevel=0.008, ol=0.008, parent=root, origin='bottom')
    ztop = hz1 + 0.075
    # broken pediment: two rising arms ending in brass rosettes, a centre plinth with the finial
    for k, sx in (('l', -1), ('r', 1)):
        arm = cz.box(f'{name}_arm_{k}', (0.23, 0.30, 0.055), (sx * 0.15, 0.0, ztop + 0.06), wd, rot=(0, sx * 24, 0), bevel=0.012, ol=0.008, parent=root)
        cz.box(f'{name}_armfill_{k}', (0.2, 0.28, 0.05), (sx * 0.18, 0.0, ztop + 0.02), wd, bevel=0.01, ol=0.0, parent=root)
        cz.cyl(f'{name}_rosette_{k}', 0.032, 0.014, (sx * 0.07, -0.153, ztop + 0.1), br, rot=(90, 0, 0), bevel=0.004, ol=0.004, parent=root, verts=20)
        cz.cyl(f'{name}_rosette_c_{k}', 0.012, 0.006, (sx * 0.07, -0.162, ztop + 0.1), brl, rot=(90, 0, 0), ol=0, parent=root, verts=12)
        cz.box(f'{name}_cplinth_{k}', (0.06, 0.07, 0.04), (sx * 0.265, -0.12, ztop), wd, bevel=0.008, ol=0.005, parent=root, origin='bottom')
        cz.sphere(f'{name}_cfinial_{k}', 0.026, (sx * 0.265, -0.12, ztop + 0.066), br, ol=0.004, parent=root, segs=20, rings=10)
    cz.box(name + '_plinth_c', (0.08, 0.1, 0.11), (0, 0.0, ztop), wd, bevel=0.01, ol=0.006, parent=root, origin='bottom')
    cz.sphere(name + '_finial', 0.04, (0, 0, ztop + 0.15), br, ol=0.005, parent=root, segs=24, rings=12)
    cz.cyl(name + '_finial_spike', 0.022, 0.07, (0, 0, ztop + 0.18), br, r2=0.002, ol=0.004, parent=root, verts=16)

    # ---- hands on their pivots (dial centre = chapter ring centre of the PNG)
    dz = dz_top - DH * 0.625
    h, m = time
    for nm, L, w, ang, dy in (('_hour', 0.082, 0.014, (h % 12 + m / 60.0) * 30.0, 0.005), ('_minute', 0.122, 0.009, m * 6.0, 0.009)):
        pv = cz.empty(name + nm, (0, -0.1425 - dy, dz), parent=root)
        pv.rotation_euler = (0, math.radians(ang), 0)
        cz.box(name + nm + '_bar', (w, 0.003, L), (0, 0, L / 2 - 0.018), ink, bevel=0.001, ol=0.0, parent=pv)
        s = 0.026 if nm == '_hour' else 0.018
        cz.box(name + nm + '_spade', (s, 0.003, s), (0, 0, L * 0.72), ink, rot=(0, 45, 0), bevel=0.001, ol=0.0, parent=pv)
    cz.cyl(name + '_arbor', 0.011, 0.012, (0, -0.1425 - 0.012, dz), br, rot=(90, 0, 0), ol=0, parent=root, verts=16)
    return root
