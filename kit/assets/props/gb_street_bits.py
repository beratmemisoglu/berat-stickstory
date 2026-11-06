# Street dressing for the BELL town (1800s frontier / New England), one kind per instance (kw kind):
#   barrel     - a bulging wooden barrel, painted staves, 4 iron hoops, a recessed lid with a bung (seed: tin cup / rag on
#                top, stave tint, a slight lean)
#   crate      - a stack of 1-3 slatted crates with dark corner battens + a front brace and stencilled lettering
#                (seed picks the stack + words: FLOUR, NAILS, COFFEE, APPLES, SALT, LAMP OIL, SOAP; text= the top crate)
#   trough     - a plank horse trough on stout legs, iron end straps, night water with ripples (seed even: a hand pump)
#   hitch      - a hitching rail: two posts with caps, a round rail, iron tie rings, a rope tied on (seed: a bucket)
#   milkcan    - 1-3 galvanised milk churns (seed), lids, side handles, a dark band
#   cart_wheel - a 1.1 m spoked wagon wheel with an iron tyre leaning back (toward +Y) against a wall
#   bench      - a plank bench 1.5 m with a back rest (seed odd: a folded newspaper on the seat)
#   sign       - a hanging shop sign: painted board (text=, bg=, ink=; PNG by tex/make_gb_street_bits.py, cached by
#                content) on two chain links under an iron bracket arm with a ring ornament. mount='post' (own wooden
#                post on a stone footing, the arm along +X, sign faces -Y) or 'wall' (a plate on the wall plane y = 0, the
#                arm out toward -Y, sign faces +-X, double-sided).
# Floor props: root at the floor centre (sign: at the foot of the post / under the wall plate), front = -Y.
import hashlib, math, os, random, subprocess
import bmesh
from mathutils import Euler, Matrix, Vector

META = {'size': (1.6, 0.6, 0.6), 'sizes': {'barrel': (0.6, 0.6, 0.88), 'crate': (1.1, 0.6, 0.9), 'trough': (1.75, 0.62, 0.9),
        'hitch': (2.2, 0.2, 1.08), 'milkcan': (0.8, 0.5, 0.66), 'cart_wheel': (1.14, 0.3, 1.13), 'bench': (1.5, 0.5, 0.88),
        'sign': (1.45, 0.34, 2.77)},
        'anchor': 'floor centre (z = 0; hitch posts go 0.06 below it); sign post: root at the post foot, board centre at x 0.73 z 1.95 (bottom 1.73); sign wall: wall '
                  'plane y = 0, board centre at y -0.69 z 1.95',
        'animate': ['_sign (sign only: rotation_euler.x = swing about the arm, both mounts)',
                    '_wheel (cart_wheel: rotation_euler.y = roll about its axle)'],
        'params': "kind='barrel'|'crate'|'trough'|'hitch'|'milkcan'|'cart_wheel'|'bench'|'sign', seed=0, "
                  "text=None (sign: the board text, '\\n' = 2 lines, default 'GENERAL STORE'; crate: the top stencil), "
                  "bg='#2f4a3a' ink='#e8d9a8' (sign paint), mount='post'|'wall' (sign)"}

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
MAKER = os.path.join(TEX, 'make_gb_street_bits.py')
WORDS = ['FLOUR', 'NAILS', 'COFFEE', 'APPLES', 'SALT', 'LAMP OIL', 'SOAP', 'BEANS']


# ---------------------------------------------------------------- helpers
def _run(cz, *args):
    py = cz.py()
    try:
        subprocess.run([py, MAKER, *args], timeout=120, check=True, capture_output=True,
                       creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e:
        print('CZ gb_street_bits: png failed', e)


def _tex(cz, fname):
    p = os.path.join(TEX, fname)
    if not os.path.exists(p): _run(cz)
    return p if os.path.exists(p) else None


def _cached(cz, form, text, *extra):
    key = hashlib.sha1('|'.join((form, text) + extra).encode('utf8')).hexdigest()[:10]
    out = cz.gen_path(TEX, f'gb_street_bits_{form}_{key}.png')
    if not os.path.exists(out): _run(cz, form, text, out, *extra)
    return out if os.path.exists(out) else None


def _lathe(cz, name, prof, mat, loc=(0, 0, 0), parent=None, ol=0.006, segs=24, smooth=True):
    """Surface of revolution about Z: prof = [(r, z), ...] from the top pole to the bottom pole (first/last r = 0)."""
    n = len(prof)
    o = cz.sphere(name, 1.0, loc, mat, ol=ol, parent=parent, segs=segs, rings=n - 1)
    for v in o.data.vertices:
        x, y, z = v.co
        i = int(round(math.acos(max(-1.0, min(1.0, z))) / math.pi * (n - 1)))
        th = math.atan2(y, x); r, zz = prof[i]
        v.co = (math.cos(th) * r, math.sin(th) * r, zz)
    if not smooth: o.data.polygons.foreach_set('use_smooth', [False] * len(o.data.polygons))
    o.data.update()
    return o


def _band(r, zc, h):
    """Lathe profile of a ring band (an iron hoop) of radius r centred at zc."""
    return [(0, zc + h / 2), (r - 0.004, zc + h / 2), (r, zc + h / 2 - 0.006), (r, zc - h / 2 + 0.006), (r - 0.004, zc - h / 2),
            (0, zc - h / 2)]


def _mat4(rot):
    return rot if isinstance(rot, Matrix) else Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()


def _multibox(cz, name, parts, mat, parent=None, bevel=0.0, ol=0.006, loc=(0, 0, 0)):
    """Many boxes as ONE mesh (one outline): parts = [(size, loc, rot_degrees or a Matrix), ...]."""
    bm = bmesh.new()
    for size, pl, rot in parts:
        m = Matrix.Translation(pl) @ _mat4(rot) @ Matrix.Diagonal((size[0], size[1], size[2], 1))
        bmesh.ops.create_cube(bm, size=1, matrix=m)
    o = cz._mesh_obj(name, bm, mat, smooth=False)
    return cz.place(o, loc, (0, 0, 0), None, parent, ol, bevel)


def _ring(cz, name, r_in, r_out, depth, mat, loc=(0, 0, 0), parent=None, segs=40, ol=0.006, a0=0.0, a1=360.0):
    """A flat ring in the XZ plane (axis Y), square section r_in..r_out x depth (a wheel rim, a tyre, an iron ring).
    a0..a1 (degrees) < 360 makes an arc with end caps."""
    bm = bmesh.new()
    full = abs(a1 - a0) >= 359.9
    n = segs if full else segs + 1
    rings = []
    for i in range(n):
        a = math.radians(a0 + (a1 - a0) * i / segs)
        c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((r * c, y, r * s)) for r, y in ((r_in, -depth / 2), (r_out, -depth / 2), (r_out, depth / 2),
                                                                    (r_in, depth / 2))])
    for i in range(n if full else n - 1):
        A, B = rings[i], rings[(i + 1) % n]
        for k in range(4):
            bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))
    if not full:
        bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = cz._mesh_obj(name, bm, mat, smooth=False)
    return cz.place(o, loc, (0, 0, 0), None, parent, ol)


def _wood(cz, name, color='#6e4a2e', s=1.5):
    return cz.toon(name, color, tex='wood', tex_scale=s, tex_strength=0.09)


def _boards(cz, name, grey=False, tint=None):
    img = _tex(cz, 'gb_street_bits_boards_grey.png' if grey else 'gb_street_bits_boards.png')
    if not img: return _wood(cz, name, '#7d5a38')
    return cz.toon(name, img=img, proj='box', proj_scale=2.0, tint=tint, tex='grain', tex_strength=0.05)


def _iron(cz, name):
    return cz.toon(name, '#2c2a28', tex='grain', tex_scale=2.5, tex_strength=0.07)


# ---------------------------------------------------------------- kinds
def _barrel(cz, name, root, rnd, loc=(0, 0, 0), H=0.86, R0=0.235, R1=0.285):
    tint = (rnd.uniform(0.85, 1.05),) * 3
    img = _tex(cz, 'gb_street_bits_staves.png')
    st = cz.toon(name + '_staves', img=img, proj='box', proj_scale=1.6, tint=tint, tex='grain', tex_strength=0.05) if img \
        else _wood(cz, name + '_staves', '#7a4b2c')
    lidm = _wood(cz, name + '_lidm', '#5e3c24', 2.0)
    iron = _iron(cz, name + '_hoop')
    piv = cz.empty(name + '_body', loc, parent=root)
    piv.rotation_euler = (math.radians(rnd.uniform(-2, 2)), math.radians(rnd.uniform(-2, 2)), math.radians(rnd.uniform(0, 360)))
    rad = lambda z: R0 + (R1 - R0) * math.sin(math.pi * z / H)
    prof = [(0, H - 0.035), (R0 - 0.04, H - 0.035), (R0 - 0.025, H), (R0, H)]
    prof += [(rad(H * (1 - t / 10)), H * (1 - t / 10)) for t in range(1, 10)]
    prof += [(R0, 0.0), (R0 - 0.03, 0.0), (0, 0.0)]
    _lathe(cz, name + '_barrel', prof, st, parent=piv, ol=0.009, segs=28)
    for i, t in enumerate((0.07, 0.3, 0.7, 0.93)):
        _lathe(cz, f'{name}_hoop{i}', _band(rad(H * t) + 0.007, H * t, 0.045), iron, parent=piv, ol=0.005, segs=28)
    cz.cyl(name + '_lid', R0 - 0.04, 0.012, (0, 0, H - 0.04), lidm, verts=28, ol=0.0, parent=piv)
    cz.cyl(name + '_bung', 0.03, 0.018, (0.09, 0.04, H - 0.03), cz.toon(name + '_bungm', '#3e2a1c'), verts=12, ol=0.003, parent=piv)
    top = rnd.choice(('cup', 'rag', 'none'))
    if top == 'cup':
        tin = cz.toon(name + '_tin', '#8b918f', tex='grain', tex_strength=0.06)
        cz.cyl(name + '_cup', 0.05, 0.085, (-0.07, -0.05, H - 0.035), tin, r2=0.055, verts=18, ol=0.004, parent=piv)
        cz.box(name + '_cuphandle', (0.012, 0.05, 0.05), (-0.07, -0.115, H + 0.01), tin, bevel=0.003, ol=0.003, parent=piv)
        cz.cyl(name + '_cupin', 0.043, 0.002, (-0.07, -0.05, H + 0.0505), cz.toon(name + '_cupdark', '#2b2b2b'), verts=18, ol=0.0,
               parent=piv)
    elif top == 'rag':
        rag = cz.toon(name + '_ragm', '#9a3b30', tex='paper', tex_strength=0.05)
        o = cz.box(name + '_rag', (0.26, 0.2, 0.03), (0.0, 0.0, H - 0.02), rag, rot=(0, 0, 25), bevel=0.012, ol=0.004, parent=piv)
        o.modifiers.new('sub', 'SUBSURF').levels = 1
        o.modifiers.move(len(o.modifiers) - 1, 0)
        for v in o.data.vertices:          # droop over the rim
            if abs(v.co.x) > 0.1: v.co.z -= 0.05 * (abs(v.co.x) - 0.1) / 0.03
        o.data.update()


def _crate(cz, name, root, rnd, text=None):
    words = rnd.sample(WORDS, 3)
    if text: words[0] = text
    n = rnd.choice((1, 2, 2, 3))
    batt = _wood(cz, name + '_batten', '#4f3420', 2.0)
    specs = [((0.62, 0.48, 0.44), (0, 0, 0), rnd.uniform(-4, 4))]
    if n >= 2: specs.append(((0.54, 0.44, 0.4), (rnd.uniform(-0.05, 0.05), rnd.uniform(-0.02, 0.04), 0.44), rnd.uniform(-12, 12)))
    if n >= 3: specs.append(((0.5, 0.42, 0.36), (0.66, 0.06, 0.0), rnd.uniform(10, 25)))
    order = [1, 0, 2] if n >= 2 else [0]          # the top crate gets words[0] (the one text= names)
    for k, (size, pos, rz) in enumerate(specs):
        w, d, h = size
        piv = cz.empty(f'{name}_crate{k}', pos, parent=root); piv.rotation_euler = (0, 0, math.radians(rz))
        bm = _boards(cz, f'{name}_boards{k % 2}', grey=(k % 2 == 1))
        cz.box(f'{name}_box{k}', (w - 0.02, d - 0.02, h - 0.01), (0, 0, 0.005), bm, bevel=0.006, ol=0.009, parent=piv, origin='bottom')
        t = 0.05; p = 0.012
        parts = []
        for sx in (-1, 1):
            for sy in (-1, 1):
                parts.append(((t, t, h), (sx * (w / 2 - t / 2), sy * (d / 2 - t / 2), h / 2), (0, 0, 0)))
        for sy in (-1, 1):
            for z in (t / 2, h - t / 2):
                parts.append(((w - 2 * t + 0.004, t, t), (0, sy * (d / 2 - t / 2), z), (0, 0, 0)))
        for sx in (-1, 1):
            for z in (t / 2, h - t / 2):
                parts.append(((t, d - 2 * t + 0.004, t), (sx * (w / 2 - t / 2), 0, z), (0, 0, 0)))
        _multibox(cz, f'{name}_battens{k}', parts, batt, parent=piv, bevel=0.004, ol=0.006)
        # stencil on the front boards (under the battens' edges), no outline, 1.5 mm proud
        img = _cached(cz, 'stencil', words[order.index(k)] if k in order else words[k % 3], '#2a1d14')
        if img:
            sm = cz.toon(f'{name}_stencil{k}', img=img, lift=0.7, alpha_clip=True)
            cz.plane(f'{name}_stencilp{k}', w - 2 * t - 0.04, (w - 2 * t - 0.04) / 2, (0, -(d / 2 - 0.01) - 0.0015, h / 2), sm, parent=piv)
        # a nail or two (dark dots) on the battens
        for i, sx in enumerate((-1, 1)):
            cz.sphere(f'{name}_nail{k}{i}', 0.008, (sx * (w / 2 - t / 2), -d / 2 - 0.0005, h - t / 2), cz.toon(name + '_nailm', '#3a3330'),
                      ol=0.0, parent=piv, segs=8, rings=5)


def _trough(cz, name, root, rnd, pump=True):
    L, W, H = 1.6, 0.58, 0.48          # body; legs lift it 0.14
    z0 = 0.14
    bm = _boards(cz, name + '_planks', tint=(0.92, 0.95, 1.0))
    rim = _wood(cz, name + '_rimm', '#4f3420', 2.0)
    iron = _iron(cz, name + '_iron')
    t = 0.06
    _multibox(cz, name + '_body', [((L, W, t), (0, 0, z0 + t / 2), (0, 0, 0)),
                                   ((L, t, H), (0, -(W / 2 - t / 2), z0 + H / 2), (0, 0, 0)),
                                   ((L, t, H), (0, W / 2 - t / 2, z0 + H / 2), (0, 0, 0)),
                                   ((t, W - 2 * t, H), (-(L / 2 - t / 2), 0, z0 + H / 2), (0, 0, 0)),
                                   ((t, W - 2 * t, H), (L / 2 - t / 2, 0, z0 + H / 2), (0, 0, 0))], bm, parent=root, bevel=0.008, ol=0.009)
    _multibox(cz, name + '_rim', [((L + 0.04, 0.08, 0.04), (0, sy * (W / 2 - 0.02), z0 + H + 0.02), (0, 0, 0)) for sy in (-1, 1)]
              + [((0.08, W - 0.08, 0.04), (sx * (L / 2 - 0.02), 0, z0 + H + 0.02), (0, 0, 0)) for sx in (-1, 1)],
              rim, parent=root, bevel=0.006, ol=0.007)
    _multibox(cz, name + '_legs', [((0.12, 0.14, z0 + 0.02), (sx * (L / 2 - 0.16), sy * (W / 2 - 0.1), (z0 + 0.02) / 2), (0, 0, 0))
                                   for sx in (-1, 1) for sy in (-1, 1)], rim, parent=root, bevel=0.01, ol=0.007)
    # iron straps around the ends (front, back and under: three flat bands each end)
    parts = []
    for sx in (-1, 1):
        x = sx * (L / 2 - 0.13)
        parts += [((0.06, 0.012, H + 0.05), (x, -W / 2 - 0.006, z0 + (H + 0.05) / 2), (0, 0, 0)),
                  ((0.06, 0.012, H + 0.05), (x, W / 2 + 0.006, z0 + (H + 0.05) / 2), (0, 0, 0))]
    _multibox(cz, name + '_straps', parts, iron, parent=root, bevel=0.002, ol=0.004)
    for i, (sx, z) in enumerate([(sx, z) for sx in (-1, 1) for z in (z0 + 0.1, z0 + H - 0.06)]):
        cz.sphere(f'{name}_rivet{i}', 0.012, (sx * (L / 2 - 0.13), -W / 2 - 0.013, z), iron, ol=0.0, parent=root, segs=10, rings=6)
    # water: a UV card, slight glow so it glints at night
    img = _tex(cz, 'gb_street_bits_water.png')
    wm = cz.toon(name + '_waterm', '#2a5a64', img=img, lift=0.8, emit=0.25) if img else cz.toon(name + '_waterm', '#2a5a64', emit=0.2)
    cz.plane(name + '_water', L - 2 * t - 0.004, W - 2 * t - 0.004, (0, 0, z0 + H - 0.07), wm, rot=(0, 0, 0), parent=root)
    if rnd.random() < 0.5:   # a leaf floating
        cz.plane(name + '_leaf', 0.07, 0.04, (0.3, 0.05, z0 + H - 0.068), cz.toon(name + '_leafm', '#8a5a24'), rot=(0, 0, 35), parent=root)
    if pump:   # cast-iron hand pump at the left end
        pm = cz.toon(name + '_pumpm', '#2f3b36', tex='grain', tex_strength=0.06)
        px = -L / 2 - 0.12
        cz.box(name + '_pumpbase', (0.22, 0.22, 0.08), (px, 0, 0), pm, bevel=0.012, ol=0.007, parent=root, origin='bottom')
        body = [(0, 1.12), (0.05, 1.12), (0.075, 1.09), (0.075, 1.04), (0.065, 1.02), (0.065, 0.3), (0.085, 0.27), (0.085, 0.08),
                (0, 0.08)]
        _lathe(cz, name + '_pump', body, pm, loc=(px, 0, 0), parent=root, ol=0.008, segs=18)
        cz.cyl(name + '_spout', 0.032, 0.3, (px + 0.04, 0, 0.86), pm, r2=0.026, rot=(0, 72, 0), verts=14, ol=0.006, parent=root)
        cz.box(name + '_handle', (0.5, 0.028, 0.034), (px - 0.22, 0, 1.17), pm, rot=(0, -18, 0), bevel=0.008, ol=0.006, parent=root)
        cz.sphere(name + '_knob', 0.03, (px - 0.46, 0, 1.25), pm, ol=0.005, parent=root, segs=12, rings=8)
        cz.box(name + '_link', (0.03, 0.03, 0.14), (px + 0.0, 0, 1.12), pm, bevel=0.005, ol=0.005, parent=root)


def _hitch(cz, name, root, rnd):
    wood = _wood(cz, name + '_woodm', '#6b4a30', 1.8)
    dark = _wood(cz, name + '_capm', '#4a3220', 2.0)
    iron = _iron(cz, name + '_iron')
    S = 1.0
    for sx in (-1, 1):
        k = 'LR'[sx > 0]
        cz.box(f'{name}_post{k}', (0.13, 0.13, 1.06), (sx * S, 0, -0.06), wood, bevel=0.012, ol=0.009, parent=root, origin='bottom')
        if sx > 0:   # a horseshoe nailed on for luck (open end up)
            _ring(cz, name + '_horseshoe', 0.04, 0.058, 0.012, iron, (sx * S, -0.072, 0.4), root, segs=16, ol=0.003, a0=-60, a1=240)
        cz.box(f'{name}_cap{k}', (0.17, 0.17, 0.05), (sx * S, 0, 1.0), dark, bevel=0.012, ol=0.007, parent=root, origin='bottom')
        cz.cyl(f'{name}_capknob{k}', 0.045, 0.03, (sx * S, 0, 1.05), dark, verts=14, ol=0.005, parent=root)
        _ring(cz, f'{name}_tiering{k}', 0.05, 0.065, 0.016, iron, (sx * S, -0.075, 0.68), root, segs=20, ol=0.004)
        cz.box(f'{name}_staple{k}', (0.03, 0.02, 0.03), (sx * S, -0.07, 0.75), iron, bevel=0.004, ol=0.003, parent=root)
    cz.cyl(name + '_rail', 0.055, 2 * S + 0.24, (0, 0, 0.9), wood, rot=(0, 90, 0), verts=16, ol=0.009, parent=root, origin='center')
    # rope tied round the rail: three wraps + a hanging end
    rope = cz.toon(name + '_ropem', '#b08a52', tex='grain', tex_strength=0.06)
    x0 = rnd.uniform(-0.4, 0.3)
    for i in range(3):
        _ring(cz, f'{name}_wrap{i}', 0.052, 0.075, 0.028, rope, (x0 + i * 0.03, 0, 0.9), root, segs=18, ol=0.003).rotation_euler = (0, 0, math.radians(90 + 8))
    cz.cyl(name + '_ropeend', 0.016, 0.42, (x0 + 0.03, -0.06, 0.48), rope, r2=0.014, rot=(8, 0, 0), verts=10, ol=0.004, parent=root)
    if rnd.random() < 0.6:   # a wooden bucket by the left post
        bk = _wood(cz, name + '_bucketm', '#7a5230', 2.0)
        prof = [(0, 0.3), (0.13, 0.3), (0.145, 0.32), (0.155, 0.32), (0.13, 0.0), (0, 0.0)]
        _lathe(cz, name + '_bucket', prof, bk, loc=(-S + 0.32, -0.22, 0), parent=root, ol=0.007, segs=20)
        for i, z in enumerate((0.07, 0.24)):
            _lathe(cz, f'{name}_bhoop{i}', _band(0.13 + 0.025 * z / 0.32 + 0.006, z, 0.03), iron, loc=(-S + 0.32, -0.22, 0),
                   parent=root, ol=0.004, segs=20)
        cz.cyl(name + '_bucketwater', 0.14, 0.004, (-S + 0.32, -0.22, 0.27), cz.toon(name + '_bw', '#2a5a64', emit=0.2), verts=20,
               ol=0.0, parent=root)


def _milkcan(cz, name, root, rnd):
    tin = cz.toon(name + '_tin', '#7c878c', tex='grain', tex_scale=2.0, tex_strength=0.08)
    band = cz.toon(name + '_band', '#3c4448', tex='grain', tex_strength=0.05)
    n = rnd.choice((1, 2, 3, 3))
    spots = [(0, 0), (0.37, 0.06), (-0.2, 0.3)][:n]
    for k, (x, y) in enumerate(spots):
        s = 1.0 if k == 0 else rnd.uniform(0.86, 0.98)
        piv = cz.empty(f'{name}_can{k}', (x, y, 0), parent=root); piv.rotation_euler = (0, 0, math.radians(rnd.uniform(0, 360)))
        # a churn: wide body, round shoulder, SHORT neck, a mushroom lid wider than the neck, a bead at the foot
        P = [(0, 0.585), (0.07, 0.585), (0.115, 0.575), (0.13, 0.558), (0.13, 0.545), (0.105, 0.54), (0.098, 0.53), (0.098, 0.49),
             (0.12, 0.47), (0.15, 0.445), (0.168, 0.415), (0.175, 0.38), (0.175, 0.07), (0.185, 0.055), (0.185, 0.0), (0.0, 0.0)]
        P = [(r * s, z * s) for r, z in P]
        _lathe(cz, f'{name}_body{k}', P, tin, parent=piv, ol=0.007, segs=28)
        _lathe(cz, f'{name}_bandA{k}', _band(0.181 * s, 0.3 * s, 0.05 * s), band, parent=piv, ol=0.004, segs=28)
        _lathe(cz, f'{name}_lidband{k}', _band(0.133 * s, 0.552 * s, 0.018 * s), band, parent=piv, ol=0.003, segs=28)
        cz.cyl(f'{name}_knob{k}', 0.035 * s, 0.035 * s, (0, 0, 0.58 * s), band, r2=0.025 * s, verts=14, ol=0.004, parent=piv)
        for sx in (-1, 1):      # handles: flat iron loops standing out from the neck at shoulder height
            _ring(cz, f'{name}_handle{k}{"LR"[sx > 0]}', 0.04 * s, 0.056 * s, 0.026 * s, band, (sx * 0.112 * s, 0, 0.5 * s),
                  piv, segs=10, ol=0.003, a0=-80 if sx > 0 else 100, a1=80 if sx > 0 else 260)
        if rnd.random() < 0.5:   # a painted dairy number on the body
            img = _cached(cz, 'stencil', rnd.choice(('No 3', 'No 7', 'DAIRY', 'No 12')), '#8f2b22')
            if img:
                card = cz.plane(f'{name}_mark{k}', 0.2 * s, 0.1 * s, (0, -0.175 * s - 0.0015, 0.2 * s),
                                cz.toon(f'{name}_markm{k}', img=img, lift=0.7, alpha_clip=True), parent=piv)
                bmc = bmesh.new(); bmc.from_mesh(card.data)
                bmesh.ops.subdivide_edges(bmc, edges=[e for e in bmc.edges if abs(e.verts[0].co.y - e.verts[1].co.y) < 1e-6],
                                          cuts=8, use_grid_fill=True)
                bmc.to_mesh(card.data); bmc.free()
                R = 0.175 * s
                for v in card.data.vertices:       # wrap the card round the body (local -z = world +y = into the can)
                    a = v.co.x / R; v.co.x = math.sin(a) * (R + 0.0015); v.co.z = -(1 - math.cos(a)) * (R + 0.0015)
                card.data.update()


def _cart_wheel(cz, name, root, rnd):
    wood = _wood(cz, name + '_woodm', '#7a5432', 1.6)
    hubm = _wood(cz, name + '_hubm', '#5a3a24', 2.0)
    iron = _iron(cz, name + '_iron')
    R = 0.55
    tilt = cz.empty(name + '_lean', (0, 0, 0), parent=root); tilt.rotation_euler = (math.radians(-12), 0, 0)
    wh = cz.empty(name + '_wheel', (0, 0, R + 0.012), parent=tilt)
    _ring(cz, name + '_tyre', R - 0.025, R + 0.012, 0.075, iron, (0, 0, 0), wh, segs=48, ol=0.007)
    _ring(cz, name + '_felloe', R - 0.1, R - 0.022, 0.07, wood, (0, 0, 0), wh, segs=48, ol=0.008)
    parts = []; off = 7 + rnd.uniform(0, 30)
    for i in range(12):
        a = 360 / 12 * i + off           # spin baked into the spokes (a rotated empty inflates the bounds)
        r0, r1 = 0.08, R - 0.09
        c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
        parts.append(((r1 - r0, 0.04, 0.045), ((r0 + r1) / 2 * c, 0, (r0 + r1) / 2 * s), (0, -a, 0)))
    _multibox(cz, name + '_spokes', parts, wood, parent=wh, bevel=0.006, ol=0.006)
    cz.cyl(name + '_hub', 0.095, 0.24, (0, 0, 0), hubm, rot=(90, 0, 0), verts=20, bevel=0.01, ol=0.007, parent=wh, origin='center')
    for i, y in enumerate((-0.1, 0.1)):
        cz.cyl(f'{name}_hubband{i}', 0.1, 0.03, (0, y, 0), iron, rot=(90, 0, 0), verts=20, ol=0.004, parent=wh, origin='center')
    cz.cyl(name + '_axlehole', 0.04, 0.004, (0, -0.121, 0), cz.toon(name + '_dark', '#1e1a18'), rot=(90, 0, 0), verts=14, ol=0.0,
           parent=wh, origin='center')



def _bench(cz, name, root, rnd):
    L = 1.5
    seat = _boards(cz, name + '_planks')
    frame = _wood(cz, name + '_framem', '#4f3420', 2.0)
    _multibox(cz, name + '_seat', [((L, 0.125, 0.045), (0, -0.16 + i * 0.135, 0.44), (0, 0, 0)) for i in range(3)], seat,
              parent=root, bevel=0.008, ol=0.008)
    _multibox(cz, name + '_back', [((L, 0.03, 0.12), (0, 0.205 + 0.03 * i, 0.6 + i * 0.17), (-10, 0, 0)) for i in range(2)], seat,
              parent=root, bevel=0.008, ol=0.008)
    parts = []
    for sx in (-1, 1):
        x = sx * (L / 2 - 0.14)
        parts += [((0.07, 0.07, 0.42), (x, -0.17, 0.21), (0, 0, 0)),           # front leg
                  ((0.07, 0.07, 0.88), (x, 0.2, 0.44), (-8, 0, 0)),           # back leg + back post
                  ((0.06, 0.4, 0.06), (x, 0.0, 0.39), (0, 0, 0)),             # seat rail
                  ((0.05, 0.36, 0.05), (x, 0.0, 0.12), (0, 0, 0))]            # low stretcher
    parts.append(((L - 0.28, 0.05, 0.06), (0, 0.0, 0.12), (0, 0, 0)))          # long stretcher
    _multibox(cz, name + '_frame', parts, frame, parent=root, bevel=0.008, ol=0.008)
    if rnd.randrange(2) == 1:
        pap = cz.toon(name + '_paperm', '#d8cfb4', tex='paper', tex_strength=0.06)
        cz.box(name + '_paper', (0.3, 0.22, 0.012), (rnd.uniform(-0.4, 0.4), -0.05, 0.469), pap, rot=(0, 0, rnd.uniform(-20, 20)),
               bevel=0.002, ol=0.003, parent=root)
        lines = [((0.24, 0.035, 0.002), (0, 0.065, 0.007), (0, 0, 0))]                      # headline
        lines += [((0.105, 0.008, 0.002), (sx * 0.062, 0.02 - 0.022 * i, 0.007), (0, 0, 0)) for sx in (-1, 1) for i in range(5)]
        _multibox(cz, name + '_paperlines', lines, cz.toon(name + '_inkm', '#4a4438'), parent=bpy_obj(cz, name + '_paper'), ol=0.0)


def bpy_obj(cz, n):
    return cz.find(n)


def _sign(cz, name, root, rnd, text, bg, ink, mount):
    wood = _wood(cz, name + '_postm', '#5e412a', 1.8)
    iron = _iron(cz, name + '_iron')
    frame = _wood(cz, name + '_framem', '#3e2a1c', 2.0)
    stone = cz.toon(name + '_stone', '#7d786e', tex='grain', tex_strength=0.07)
    AZ, AL = 2.3, 1.25                      # arm height, arm length
    BW, BH = 1.05, 0.39                     # board (the PNG's 2.7:1)
    arm = cz.empty(name + '_arm', (0, 0, 0), parent=root)
    if mount == 'wall':
        arm.rotation_euler = (0, 0, math.radians(-90))      # the arm's +X now points to -Y (out of the wall)
        cz.box(name + '_plate', (0.08, 0.03, 0.58), (0.0, -0.015, AZ + 0.17), iron, bevel=0.005, ol=0.006, parent=root)
        x0 = 0.03
    else:
        cz.box(name + '_footing', (0.34, 0.34, 0.16), (0, 0, 0), stone, bevel=0.03, ol=0.008, parent=root, origin='bottom')
        cz.box(name + '_post', (0.15, 0.15, 2.6), (0, 0, 0.12), wood, bevel=0.014, ol=0.009, parent=root, origin='bottom')
        cz.box(name + '_postcap', (0.2, 0.2, 0.05), (0, 0, 2.72), frame, bevel=0.012, ol=0.007, parent=root, origin='bottom')
        x0 = 0.075
    # bracket: the arm, a diagonal brace, a ring ornament in the corner, a curl at the tip
    cz.box(name + '_armbar', (AL, 0.035, 0.035), (x0 + AL / 2, 0, AZ), iron, bevel=0.005, ol=0.006, parent=arm)
    d = Vector((0.55, 0, -0.4))                # brace ABOVE the arm (below it would cut through the board)
    R = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    _multibox(cz, name + '_brace', [((0.025, 0.03, d.length), (x0 + 0.275, 0, AZ + 0.2), R)], iron, parent=arm, ol=0.005)
    _ring(cz, name + '_ornament', 0.085, 0.105, 0.022, iron, (x0 + 0.15, 0, AZ + 0.12), arm, segs=28, ol=0.004)
    _ring(cz, name + '_curl', 0.04, 0.056, 0.022, iron, (x0 + AL + 0.03, 0, AZ - 0.025), arm, segs=16, ol=0.004, a0=-200, a1=110)
    # the hanging board (pivot on the arm: swings about X)
    cx = x0 + 0.1 + (BW + 0.06) / 2
    sg = cz.empty(name + '_sign', (cx, 0, AZ - 0.02), parent=arm)
    sg.rotation_euler = (0, math.radians(rnd.uniform(-3, 3)), 0)
    for i, sx in enumerate((-1, 1)):
        for j in range(2):
            lk = _ring(cz, f'{name}_link{i}{j}', 0.016, 0.026, 0.008, iron, (sx * (BW / 2 - 0.12), 0, -0.035 - j * 0.045), sg,
                       segs=12, ol=0.002)
            if j == 1: lk.rotation_euler = (0, 0, math.radians(90))
    top = -0.1
    cz.box(name + '_board', (BW + 0.06, 0.055, BH + 0.06), (0, 0, top - (BH + 0.06) / 2), frame, bevel=0.012, ol=0.009, parent=sg)
    img = _cached(cz, 'sign', text, bg, ink)
    pm = cz.toon(name + '_paint', bg, img=img, lift=0.75, tex='grain', tex_strength=0.04) if img else cz.toon(name + '_paint', bg)
    for k, (y, rz) in enumerate(((-0.0291, 0), (0.0291, 180))):
        cz.plane(f'{name}_face{k}', BW, BH, (0, y, top - (BH + 0.06) / 2), pm, rot=(90, 0, rz), parent=sg)


# ---------------------------------------------------------------- build
def build(cz, name='gb_street_bits', kind='barrel', seed=0, text=None, bg='#2f4a3a', ink='#e8d9a8', mount='post'):
    root = cz.empty(name)
    rnd = random.Random(f'{kind}|{seed}')
    if kind == 'barrel': _barrel(cz, name, root, rnd)
    elif kind == 'crate': _crate(cz, name, root, rnd, text)
    elif kind == 'trough': _trough(cz, name, root, rnd, pump=(int(seed) % 2 == 0))
    elif kind == 'hitch': _hitch(cz, name, root, rnd)
    elif kind == 'milkcan': _milkcan(cz, name, root, rnd)
    elif kind == 'cart_wheel': _cart_wheel(cz, name, root, rnd)
    elif kind == 'bench': _bench(cz, name, root, rnd)
    elif kind == 'sign': _sign(cz, name, root, rnd, text or 'GENERAL STORE', bg, ink, mount)
    else: raise ValueError('gb_street_bits: unknown kind ' + str(kind))
    return root
