# Rubber stamp + a sheet of paper: a big, chunky office stamp (red-inked rubber die, grey foam, wooden mount with an
# index label, collar, neck and a round varnished knob with a red cap) and a personnel notice lying flat, with the
# rough red stamped mark (text kw) in its "HR DECISION" box. Prints: tex/make_rubber_stamp.py (any text: pass it there).
# Floor/desk prop: root at the floor centre of the footprint, the sheet reads upright from -Y.
# Pivot <name>_body: the centre of the die face (bottom of the stamp). Animate location (lift / press) and rotation.
# Default (lift=None): the stamp stands on the desk right of the sheet. lift=h: it hovers h metres above the mark,
# aligned with it (lift=0 = pressed onto the paper). <name>_mark: the ink on the paper; key hide_render to make it
# appear the moment the stamp comes up (kw stamped sets it).
# kw: text='FIRED', stamped=True, lift=None|metres, wood='#b9773f'.
import math, os, re

META = {'size': (0.36, 0.3, 0.15), 'anchor': 'floor centre of the footprint', 'animate': ['_body', '_mark'],
        'params': "text='FIRED', stamped=True|False, lift=None|metres, wood='#rrggbb'"}

TEX = 'assets/props/tex/'
SHEET = (-0.065, 0.0)          # sheet centre on the desk
MARK = (0.0, -0.049, -8.0)     # mark centre on the sheet (m) and its angle (deg)


def _png(cz, kind, text):
    f = f'rubber_stamp_{kind}_{re.sub(r"[^A-Z0-9]+", "_", text.upper()).strip("_")}.png'
    p = cz.made(os.path.join(cz.LAB, TEX), f, 'make_rubber_stamp.py', text)   # (any text: drawn the first time)
    if not p: raise FileNotFoundError(f'{f}: tex/make_rubber_stamp.py could not draw it')
    return p


def build(cz, name='rubber_stamp', text='FIRED', stamped=True, lift=None, wood='#b9773f'):
    root = cz.empty(name)
    # the sheet: a thin card, its print 1.2 mm above, the ink 1.2 mm above that
    PT = 0.0015
    sx, sy = SHEET
    cz.box(name + '_paper', (0.21, 0.297, PT), (sx, sy, PT / 2), cz.toon(name + '_paperm', '#e9e4d6', lift=0.45, tex='paper', tex_strength=0.03),
           bevel=0, ol=0.0012, parent=root)
    cz.plane(name + '_print', 0.209, 0.296, (sx, sy, PT + 0.0012), cz.toon(name + '_printm', img=TEX + 'rubber_stamp_paper.png', lift=0.45),
             rot=(0, 0, 0), parent=root)
    mx, my, ma = sx + MARK[0], sy + MARK[1], MARK[2]
    mk = cz.plane(name + '_mark', 0.12, 0.05, (mx, my, PT + 0.0024), cz.toon(f'{name}_ink_{text}', img=_png(cz, 'mark', text), alpha_clip=True, lift=0.45),
                  rot=(0, 0, ma), parent=root)
    mk.hide_render = mk.hide_viewport = not stamped
    # the stamp, built up from its die face at z = 0 of the pivot
    if lift is None:
        body = cz.empty(name + '_body', (0.115, 0.03, 0), parent=root); body.rotation_euler.z = math.radians(18)
    else:
        body = cz.empty(name + '_body', (mx, my, PT + 0.003 + float(lift)), parent=root); body.rotation_euler.z = math.radians(ma)
    cz.box(name + '_die', (0.12, 0.05, 0.006), (0, 0, 0.003), cz.toon(name + '_rubber', '#a8322b'), bevel=0.0012, ol=0.002, parent=body)
    cz.box(name + '_foam', (0.124, 0.054, 0.004), (0, 0, 0.008), cz.toon(name + '_foamm', '#4d5159'), bevel=0.001, ol=0.0015, parent=body)
    wm = cz.toon(name + '_wood', wood, tex='wood', tex_scale=13.0, tex_strength=0.08)
    cz.box(name + '_mount', (0.13, 0.062, 0.03), (0, 0, 0.025), wm, bevel=0.005, ol=0.004, parent=body)
    cz.plane(name + '_label', 0.1, 0.02, (0, -0.031 - 0.0012, 0.025), cz.toon(f'{name}_labelm_{text}', img=_png(cz, 'label', text), lift=0.7), parent=body)
    dark = cz.toon(name + '_wooddark', '#8a5530', tex='wood', tex_scale=13.0, tex_strength=0.06)
    cz.cyl(name + '_collar', 0.027, 0.008, (0, 0, 0.04), dark, verts=40, bevel=0.002, ol=0.003, parent=body)
    cz.cyl(name + '_neck', 0.016, 0.052, (0, 0, 0.047), wm, r2=0.013, verts=32, ol=0.003, parent=body)
    km = cz.toon(name + '_knobm', '#c98a4b', tex='wood', tex_scale=10.0, tex_strength=0.06)
    cz.sphere(name + '_knob', 0.034, (0, 0, 0.121), km, scale=(1, 1, 0.85), ol=0.004, parent=body)
    cz.sphere(name + '_cap', 0.011, (0, 0, 0.1495), cz.toon(name + '_capm', '#d63a30'), scale=(1, 1, 0.45), ol=0.002, parent=body, segs=24, rings=12)
    return root
