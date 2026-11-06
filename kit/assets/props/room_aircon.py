# Wall-mounted split air conditioner, aged: a yellowed off-white body with rounded edges, an inset front panel, the
# bottom air outlet with its louvre flap hanging half open, a little green power LED, an embossed maker name, a taped
# energy-saving note (冷房 28℃ 節電中), dust grey on the underside, and the drain hose that runs down from its lower
# left end (kw hose = hose length, the set takes it into the wall). Wall prop: back at y = 0, centred on x = 0, z = 0,
# front toward -Y. Size 0.72 x 0.21 x 0.27 m (a small office unit).
import math

META = {'size': (0.72, 0.21, 0.27), 'anchor': 'back centre on the wall, centred on z = 0', 'animate': ['_flap'],
        'params': "flap=0..1 (louvre open), led=True (green power LED glowing), note=True, hose=0.3 (drain hose length, m)"}

TEX = 'assets/props/tex/'
W, D, H = 0.72, 0.21, 0.27


def build(cz, name='room_aircon', flap=0.45, led=True, note=True, hose=0.3):
    root = cz.empty(name)
    body = cz.toon(name + '_body', '#e4dcc6', tex='grain', tex_scale=1.5, tex_strength=0.05)
    panel = cz.toon(name + '_panel', '#eee8d8', tex='grain', tex_scale=2, tex_strength=0.03)
    dark = cz.toon(name + '_dark', '#3a3934')
    grey = cz.toon(name + '_grey', '#b9b3a2')
    # body: front face at y = -0.205
    cz.box(name + '_shell', (W, D - 0.01, H), (0, -D / 2, 0), body, bevel=0.03, ol=0.008, parent=root)
    # inset front panel (upper 3/4) with a seam line under it
    yf = -(D - 0.005)
    cz.box(name + '_front', (W - 0.06, 0.006, H - 0.1), (0, yf - 0.002, 0.03), panel, bevel=0.006, ol=0.003, parent=root)
    cz.box(name + '_seam', (W - 0.05, 0.004, 0.006), (0, yf - 0.001, -0.033), dark, bevel=0, ol=0, parent=root)
    # a yellowed streak band across the panel (years of sun)
    cz.box(name + '_yellow', (W - 0.07, 0.002, 0.02), (0, yf - 0.0058, 0.075), cz.toon(name + '_yel', '#d9cba0'), bevel=0, ol=0, parent=root)
    # air outlet: a dark slot along the underside front, the louvre flap on its pivot at the slot's front edge
    cz.box(name + '_outlet', (W - 0.1, 0.07, 0.012), (0, -0.14, -H / 2 + 0.004), dark, bevel=0.002, ol=0, parent=root)
    pv = cz.empty(name + '_flap', (0, yf + 0.012, -H / 2 + 0.002), parent=root)
    pv.rotation_euler.x = math.radians(-70 * cz.clamp(flap))
    cz.box(name + '_flapm', (W - 0.11, 0.075, 0.007), (0, 0.0375, -0.004), panel, bevel=0.002, ol=0.003, parent=pv)
    # grey dust shadow on the underside (seen from below)
    cz.box(name + '_dust', (W - 0.04, D - 0.05, 0.002), (0, -D / 2 + 0.01, -H / 2 - 0.0005), grey, bevel=0, ol=0, parent=root)
    # LED window + power LED
    cz.box(name + '_ledwin', (0.06, 0.004, 0.016), (W / 2 - 0.08, yf - 0.002, -0.06), dark, bevel=0.002, ol=0.0015, parent=root)
    cz.sphere(name + '_led', 0.0045, (W / 2 - 0.095, yf - 0.004, -0.06), cz.glow(name + '_ledm', '#5dff8a', 6.0) if led else dark, ol=0, parent=root)
    cz.sphere(name + '_led2', 0.0035, (W / 2 - 0.07, yf - 0.004, -0.06), cz.toon(name + '_ledoff', '#c79a3c'), ol=0, parent=root)
    # embossed maker name on the panel
    cz.plane(name + '_plate', 0.13, 0.0325, (-W / 2 + 0.12, yf - 0.0065, -0.012), cz.toon(name + '_platem', img=TEX + 'room_aircon_plate.png', alpha_clip=True, lift=0.7), parent=root)
    if note:   # taped note, a little crooked, two tape strips
        nt = cz.empty(name + '_note', (W / 2 - 0.17, yf - 0.0066, 0.035), parent=root); nt.rotation_euler.y = math.radians(-5)
        cz.plane(name + '_notep', 0.09, 0.06, (0, 0, 0), cz.toon(name + '_notem', img=TEX + 'room_aircon_note.png', lift=0.62), parent=nt)
        tape = cz.toon(name + '_tape', '#e7d9a6', lift=0.7)
        for s in (-1, 1):
            t = cz.box(f'{name}_tape{s}', (0.03, 0.0008, 0.012), (s * 0.04, -0.0008, 0.03), tape, bevel=0, ol=0, parent=nt)
            t.rotation_euler.y = math.radians(35 * s)
    if hose > 0:   # drain hose: from the lower left end straight down the wall, a clip halfway
        hm = cz.toon(name + '_hose', '#a9a596', tex='grain', tex_strength=0.05)
        cz.cyl(name + '_hose', 0.011, hose + 0.04, (-W / 2 + 0.045, -0.035, -H / 2 - hose), hm, verts=20, ol=0.0035, parent=root)
        cz.box(name + '_clip', (0.035, 0.03, 0.012), (-W / 2 + 0.045, -0.02, -H / 2 - hose * 0.55), grey, bevel=0.002, ol=0.002, parent=root)
    return root
