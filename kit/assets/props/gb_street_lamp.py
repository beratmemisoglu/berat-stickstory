# Street lamp (BELL, 1800s town): a cast-iron gas lamp post in dark green-black iron. An octagonal stepped base, a
# fluted lower column with a collar, a slim upper shaft, the lamplighter's ladder bar (a crossbar with ball ends) under
# a flared capital, and a 4-sided lantern: a tapered base, four glass panes that widen to the top (lit: warm amber glow
# with a bright flame + burner painted on each pane, tex/make_gb_street_bits.py), slim corner posts, a pyramid roof
# with a rim, a vent cap and a ball finial.
# lit=True puts a warm POINT light <name>_light inside the lantern (power W). The glass, the lantern base and the capital
# do not cast shadows (they would black out the light pool under the lamp); the corner posts do (four soft spokes).
# Floor prop: root at the floor centre of the base; ~2.84 m tall; front = -Y (all four sides are the same).
import math, os, subprocess
import bmesh
from mathutils import Euler, Matrix, Vector

META = {'size': (0.66, 0.4, 2.84), 'anchor': 'floor centre of the base (z = 0); ladder bar along X at z 2.06 (0.66 wide); '
        'lantern glass z 2.31..2.60, light at z 2.47',
        'animate': ['_light (energy: flicker 0.9..1.05 x power)', '_lantern (empty at the lantern centre z 2.47: '
                    'parent glows / moths to it)'],
        'lights': ['_light (POINT, warm #ffa24a, only when lit)', '_pool (SPOT straight down, 120 deg, only when lit and pool > 0)'],
        'params': "lit=True (glowing panes + a warm point light), power=120 (W), color='#25332d' (iron), "
                  "pool=0.0 (W of an extra warm SPOT aimed down = a defined light pool on the street; 300-600 reads at night)"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')


def _tex(cz, fname):
    p = os.path.join(TEX, fname)
    if not os.path.exists(p):
        py = cz.py()
        try:
            subprocess.run([py, os.path.join(TEX, 'make_gb_street_bits.py')], timeout=120, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e:
            print('CZ gb_street_lamp: png failed', e)
    return p if os.path.exists(p) else None


def _lathe(cz, name, prof, mat, loc=(0, 0, 0), parent=None, ol=0.006, segs=24, smooth=True, turn=0.0):
    """Surface of revolution about Z: prof = [(r, z), ...] from the top pole to the bottom pole (first/last r = 0)."""
    n = len(prof)
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=segs, rings=n - 1)
    for v in o.data.vertices:
        x, y, z = v.co
        i = int(round(math.acos(max(-1.0, min(1.0, z))) / math.pi * (n - 1)))
        th = math.atan2(y, x) + turn
        r, zz = prof[i]
        v.co = (math.cos(th) * r, math.sin(th) * r, zz)
    if not smooth: o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    o.data.update()
    return o


def _multibox(cz, name, parts, mat, parent=None, bevel=0.0, ol=0.006):
    """Many boxes as ONE mesh (one outline): parts = [(size, loc, rot_degrees or a Matrix), ...]."""
    bm = bmesh.new()
    for size, loc, rot in parts:
        R = rot if isinstance(rot, Matrix) else Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
        m = Matrix.Translation(loc) @ R @ Matrix.Diagonal((size[0], size[1], size[2], 1))
        bmesh.ops.create_cube(bm, size=1, matrix=m)
    o = cz._mesh_obj(name, bm, mat, smooth=False)
    return cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, ol, bevel)


def build(cz, name='gb_street_lamp', lit=True, power=120.0, color='#25332d', pool=0.0):
    root = cz.empty(name)
    iron = cz.toon(name + '_iron', color, tex='grain', tex_scale=2.5, tex_strength=0.07)
    iron2 = cz.toon(name + '_iron2', '#1d2824', tex='grain', tex_scale=2.5, tex_strength=0.06)
    brass = cz.toon(name + '_brass', '#9a7a3c', tex='grain', tex_strength=0.05)

    # ---- base: octagonal, stepped (flat shaded facets)
    base = [(0, 0.40), (0.085, 0.40), (0.095, 0.37), (0.12, 0.33), (0.125, 0.26), (0.15, 0.22), (0.175, 0.19), (0.19, 0.15),
            (0.19, 0.08), (0.215, 0.06), (0.215, 0.0), (0, 0.0)]
    _lathe(cz, name + '_base', base, iron, parent=root, ol=0.009, segs=8, smooth=False, turn=math.pi / 8)
    # ---- fluted lower column (16 facets read as flutes) + collar
    col = [(0, 1.08), (0.062, 1.08), (0.064, 1.0), (0.068, 0.8), (0.072, 0.6), (0.078, 0.41), (0.0, 0.41)]
    _lathe(cz, name + '_column', col, iron, parent=root, ol=0.008, segs=16, smooth=False)
    collar = [(0, 1.16), (0.06, 1.16), (0.085, 1.13), (0.088, 1.1), (0.075, 1.07), (0.0, 1.07)]
    _lathe(cz, name + '_collar', collar, iron2, parent=root, ol=0.007, segs=20)
    # ---- upper shaft + a ring + the flared capital
    cz.cyl(name + '_shaft', 0.046, 1.0, (0, 0, 1.15), iron, r2=0.04, verts=20, ol=0.007, parent=root)
    ring = [(0, 1.74), (0.05, 1.74), (0.062, 1.72), (0.062, 1.69), (0.05, 1.67), (0, 1.67)]
    _lathe(cz, name + '_ring', ring, iron2, parent=root, ol=0.006, segs=20)
    cap = [(0, 2.245), (0.1, 2.245), (0.11, 2.235), (0.1, 2.215), (0.06, 2.19), (0.045, 2.14), (0.05, 2.11), (0.0, 2.11)]
    capital = _lathe(cz, name + '_capital', cap, iron2, parent=root, ol=0.007, segs=20)
    # ---- ladder bar (the lamplighter leans his ladder on it): crossbar + ball ends + a small brace each side
    cz.cyl(name + '_ladderbar', 0.018, 0.62, (0, 0, 2.06), iron, rot=(0, 90, 0), verts=12, ol=0.005, parent=root, origin='center')
    for sx in (-1, 1):
        cz.sphere(f'{name}_barball{"LR"[sx > 0]}', 0.032, (sx * 0.31, 0, 2.06), iron2, ol=0.005, parent=root, segs=14, rings=8)
    _multibox(cz, name + '_braces', [((0.016, 0.016, 0.19), (sx * 0.1, 0, 1.995), (0, sx * 43, 0)) for sx in (-1, 1)], iron,
              parent=root, bevel=0.0, ol=0.004)

    # ---- lantern
    lan = cz.empty(name + '_lantern', (0, 0, 2.47), parent=root)
    z0, z1 = 2.31, 2.60                 # glass bottom / top
    hb, ht = 0.14, 0.175                # half widths of the glass box at the bottom / top
    bottom = cz.cyl(name + '_lanbase', 0.09 * math.sqrt(2), z0 - 2.235, (0, 0, 2.235), iron2, r2=(hb + 0.02) * math.sqrt(2),
                    verts=4, ol=0.007, parent=root, rot=(0, 0, 45))
    plate = cz.box(name + "_lanplate", (2 * hb + 0.05, 2 * hb + 0.05, 0.025), (0, 0, z0 - 0.0125), iron, bevel=0.004, ol=0.006, parent=root)
    if lit:
        pm = cz.screen(name + '_panem', _tex(cz, 'gb_street_bits_pane_on.png'), strength=1.9)
    else:
        img = _tex(cz, 'gb_street_bits_pane_off.png')
        pm = cz.toon(name + '_panem', '#2a3440', img=img, lift=0.75) if img else cz.toon(name + '_panem', '#2a3440')
    hgt = z1 - z0; hm = (hb + ht) / 2
    glass = []
    for i in range(4):
        piv = cz.empty(f'{name}_side{i}', (0, 0, 0), parent=root); piv.rotation_euler = (0, 0, math.radians(90 * i))
        g = cz.plane(f'{name}_glass{i}', 2 * hm, hgt, (0, -hm - 0.002, (z0 + z1) / 2), pm, parent=piv)
        for v in g.data.vertices:                      # trapezoid, leaning out at the top
            k = 1 if v.co.y > 0 else -1
            v.co.x *= (ht if k > 0 else hb) / hm
            v.co.z += k * (ht - hb) / 2
        g.data.update(); glass.append(g)
    # corner posts follow the tapered edges
    parts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            a = Vector((sx * hb, sy * hb, z0)); b = Vector((sx * ht, sy * ht, z1))
            R = (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4()
            parts.append(((0.026, 0.026, (b - a).length + 0.02), tuple((a + b) / 2), R))
    _multibox(cz, name + '_posts', parts, iron, parent=root, bevel=0.0, ol=0.005)
    # top rim + pyramid roof + vent cap + finial
    cz.box(name + '_rim', (2 * ht + 0.05, 2 * ht + 0.05, 0.03), (0, 0, z1 + 0.015), iron, bevel=0.005, ol=0.007, parent=root)
    cz.cyl(name + '_roof', (ht + 0.06) * math.sqrt(2), 0.12, (0, 0, z1 + 0.03), iron, r2=0.05 * math.sqrt(2), verts=4,
           rot=(0, 0, 45), ol=0.008, parent=root)
    vent = [(0, 2.82), (0.035, 2.82), (0.06, 2.80), (0.06, 2.785), (0.04, 2.77), (0.04, 2.745), (0, 2.745)]
    _lathe(cz, name + '_vent', vent, iron2, parent=root, ol=0.005, segs=16)
    cz.sphere(name + '_finial', 0.026, (0, 0, 2.84), brass, ol=0.004, parent=root, segs=14, rings=8)
    # the gas tap under the lantern (brass key)
    cz.box(name + '_tap', (0.05, 0.012, 0.03), (0.0, -0.105, 2.2), brass, bevel=0.003, ol=0.003, parent=root)

    for o in glass + [bottom, capital, plate]:
        o.visible_shadow = False
    if lit:
        lt = cz.light(name + '_light', 'POINT', (0, 0, 2.47), color='#ffa24a', power=power, size=0.08)
        lt.parent = root
        if pool > 0:
            sp = cz.light(name + '_pool', 'SPOT', (0, 0, 2.47), rot=(0, 0, 0), color='#ff9a40', power=pool, size=0.15)
            sp.data.spot_size = math.radians(120); sp.data.spot_blend = 0.55
            sp.data.use_shadow = False   # shadowless fill: the post would print a 0.6 m dark disc under itself; _light keeps the shadows
            sp.parent = root          # a spot looks down -Z by default: straight onto the street
    return root
