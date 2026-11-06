# Extra desk-top items for the office desks (placed with the same root as an office_desk, rot 0: the coordinates are
# that desk's free spots, so nothing collides with its own clutter). Items (any subset):
#   'tray'     two-tier document tray with papers, back right (0.3, 0.235)
#   'books'    two lying hardback books + a tablet on them, back right (instead of the tray)
#   'daruma'   a red daruma doll (one eye painted in), front left (-0.48, -0.27)
#   'maneki'   a white beckoning cat with a red collar and a gold bell, front left (-0.48, -0.27)
#   'calendar' a tent desk calendar (tex/off_desk_calendar.png), left (-0.44, -0.02)
#   'bottle'   a green-tea PET bottle, right edge (0.655, 0.05)
#   'tissue'   a tissue box, back right (0.3, 0.25) (instead of the tray / books)
# Floor-referenced: the desk top is at z = 0.72. Front (the worker / camera side) is -Y.
import math, os

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
H = 0.72

META = {'size': (1.4, 0.7, 0.2), 'anchor': 'same root as the office_desk it dresses (desk top at z 0.72)', 'animate': [],
        'params': "items=('tray','daruma','calendar','bottle') any of tray|books|daruma|maneki|calendar|bottle"}


def build(cz, name='off_desk_extras', items=('tray', 'daruma', 'calendar', 'bottle')):
    root = cz.empty(name)

    def M(key, c, **k):
        return cz.toon(f'off_dx_{key}', c, **k)
    ink = M('ink', '#2a2622')
    paper = M('paper', '#f2efe6', tex='paper', tex_strength=0.03)
    if 'tray' in items:
        t = cz.empty(name + '_tray', (0.3, 0.235, H), parent=root); t.rotation_euler.z = math.radians(-3)
        fr = M('tray', '#3a3d44', tex='grain', tex_strength=0.03)
        for k, z in enumerate((0.0, 0.085)):
            cz.box(f'{name}_tray{k}', (0.3, 0.22, 0.012), (0, 0, z), fr, bevel=0.003, ol=0.004, parent=t, origin='bottom')
            cz.box(f'{name}_traylip{k}', (0.3, 0.012, 0.045), (0, -0.104, z), fr, bevel=0.003, ol=0.003, parent=t, origin='bottom')
            for j in range(3 - k):
                cz.box(f'{name}_tp{k}_{j}', (0.2, 0.2, 0.004), (0.01 * j, 0.005, z + 0.012 + 0.004 * j), paper, rot=(0, 0, 4 * j - 3), bevel=0, ol=0.002, parent=t, origin='bottom')
        for s in (-1, 1):
            cz.box(f'{name}_traypost{s}', (0.012, 0.012, 0.1), (s * 0.14, 0.09, 0.0), fr, bevel=0.002, ol=0.003, parent=t, origin='bottom')
    if 'books' in items:
        b = cz.empty(name + '_books', (0.3, 0.235, H), parent=root); b.rotation_euler.z = math.radians(8)
        for k, (c, w, d, h) in enumerate((('#2f8a55', 0.26, 0.19, 0.035), ('#d6463c', 0.23, 0.17, 0.03))):
            z = 0.035 * k
            cz.box(f'{name}_book{k}', (w, d, h), (0.01 * k, 0, z), M('book' + str(k), c, tex='grain'), rot=(0, 0, -6 * k), bevel=0.005, ol=0.004, parent=b, origin='bottom')
            cz.box(f'{name}_pages{k}', (w - 0.02, d - 0.012, h - 0.008), (0.01 * k + 0.006, -0.003, z + 0.004), paper, rot=(0, 0, -6 * k), bevel=0.001, ol=0.0, parent=b, origin='bottom')
        cz.box(name + '_tablet', (0.2, 0.14, 0.009), (0.0, 0.0, 0.066), M('tablet', '#33363d'), rot=(0, 0, 10), bevel=0.006, ol=0.003, parent=b, origin='bottom')
    if 'daruma' in items:
        d = cz.empty(name + '_daruma', (-0.48, -0.27, H), parent=root)
        red = M('daruma', '#d0302a', tex='grain', tex_strength=0.04)
        cz.sphere(name + '_drbody', 0.048, (0, 0, 0.05), red, scale=(1, 0.95, 1.08), ol=0.004, parent=d, segs=24, rings=12)
        cz.sphere(name + '_drface', 0.03, (0, -0.033, 0.062), M('cream', '#f4ecd8'), scale=(1, 0.45, 0.85), ol=0.002, parent=d, segs=18, rings=9)
        cz.sphere(name + '_dreye0', 0.0075, (-0.012, -0.047, 0.068), ink, ol=0.0, parent=d, segs=10, rings=5)
        cz.sphere(name + '_dreye1', 0.0075, (0.012, -0.047, 0.068), M('white', '#fbf8ef'), ol=0.0015, parent=d, segs=10, rings=5)
        cz.box(name + '_drgold', (0.035, 0.004, 0.012), (0, -0.046, 0.025), M('gold', '#e0b030'), bevel=0.002, ol=0.0, parent=d)
    if 'maneki' in items:
        m = cz.empty(name + '_maneki', (-0.48, -0.27, H), parent=root); m.rotation_euler.z = math.radians(15)
        wh = M('cat', '#f6f2e8', tex='grain', tex_strength=0.03)
        cz.capsule(name + '_catbody', 0.034, 0.075, (0, 0, 0), wh, scale=(1, 0.85, 1), ol=0.004, parent=m)
        cz.sphere(name + '_cathead', 0.036, (0, -0.004, 0.098), wh, scale=(1.05, 0.9, 0.92), ol=0.004, parent=m, segs=20, rings=10)
        for s in (-1, 1):
            cz.cyl(f'{name}_ear{s}', 0.012, 0.022, (s * 0.02, 0, 0.122), wh, r2=0.002, verts=10, ol=0.003, parent=m)
        cz.capsule(name + '_paw', 0.011, 0.05, (0.03, -0.015, 0.075), wh, ol=0.003, parent=m)
        cz.cyl(name + '_collar', 0.03, 0.008, (0, 0, 0.066), M('collar', '#d0302a'), verts=20, ol=0.0, parent=m)
        cz.sphere(name + '_bell', 0.009, (0, -0.031, 0.062), M('gold', '#e0b030'), ol=0.002, parent=m, segs=12, rings=6)
        for s in (-1, 1):
            cz.sphere(f'{name}_cateye{s}', 0.004, (s * 0.013, -0.035, 0.103), ink, ol=0.0, parent=m, segs=8, rings=4)
    if 'calendar' in items:
        c = cz.empty(name + '_cal', (-0.44, -0.02, H), parent=root); c.rotation_euler.z = math.radians(12)
        for s in (-1, 1):       # an A-frame: both cards hang from the ring at the top, their feet spread
            p = cz.empty(f'{name}_calp{s}', (0, 0, 0.1), parent=c); p.rotation_euler.x = math.radians(s * 16)
            cz.box(f'{name}_calcard{s}', (0.125, 0.003, 0.1), (0, 0, -0.05), M('calback' + str(s), '#c8463c' if s > 0 else '#f2efe6'), bevel=0.0, ol=0.002, parent=p, origin='center')
            if s < 0:
                cz.plane(name + '_calface', 0.12, 0.093, (0, -0.002, -0.05), cz.toon('off_dx_calm', img=os.path.join(TEX, 'off_desk_calendar.png'), tex='paper', tex_strength=0.02), parent=p)
        cz.cyl(name + '_calring', 0.004, 0.13, (-0.065, 0, 0.1), M('chrome', '#c9cdd2'), rot=(0, 90, 0), verts=8, ol=0.0, parent=c)
    if 'bottle' in items:
        b = cz.empty(name + '_bottle', (0.655, 0.05, H), parent=root)
        tea = M('tea', '#a9cf6a', tex='grain', tex_strength=0.03, emit=0.08)
        cz.cyl(name + '_btl', 0.03, 0.17, (0, 0, 0), tea, bevel=0.008, verts=24, ol=0.004, parent=b)
        cz.cyl(name + '_btlneck', 0.03, 0.03, (0, 0, 0.17), tea, r2=0.014, verts=24, ol=0.003, parent=b)
        cz.cyl(name + '_btlcap', 0.0145, 0.018, (0, 0, 0.2), M('cap', '#2f8a55'), verts=16, ol=0.003, parent=b)
        cz.cyl(name + '_btllabel', 0.0305, 0.07, (0, 0, 0.05), M('label', '#2f8a55', tex='grain'), verts=24, ol=0.0, parent=b)
        cz.cyl(name + '_btlstripe', 0.031, 0.015, (0, 0, 0.08), M('white', '#fbf8ef'), verts=24, ol=0.0, parent=b)
    if 'tissue' in items:
        cz.box(name + '_tissue', (0.22, 0.12, 0.08), (0.3, 0.25, H), M('tissue', '#e8dcff', tex='grain'), rot=(0, 0, 4), bevel=0.01, ol=0.004, parent=root, origin='bottom')
        cz.sphere(name + '_tissuepuff', 0.03, (0.3, 0.25, H + 0.085), M('white', '#fbf8ef'), scale=(1.2, 0.5, 0.7), ol=0.003, parent=root, segs=14, rings=7)
    return root
