# gb_house: the hero house of the BELL street set (1800s New England / frontier town). A 2-storey clapboard house,
# gable to the street: stone foundation, painted + worn clapboard (PNG, box projection), corner boards, rake + frieze
# trim, shingled roof with its own UVs (ISSUES 90), brick chimney, round attic vent. A deep porch across the front
# (floor z 0.42, 3 risers down to the street in the middle), turned posts, railings with balusters, lattice skirt, a
# shed porch roof with a haint-blue ceiling and a scalloped valance. The front door (panels, a glass light, brass knob)
# hangs on the pivot <name>_door and opens INTO the house. Five real window openings (glass, 2-over-2 sashes, casings,
# sills, louvered shutters, curtains) with a room box behind each: lit rooms glow (wallpaper emission + a warm point
# light <name>_winlight<i>, an oil-lamp silhouette); unlit rooms are dark blue-grey.
# Root: floor centre of the front wall line at street level (z 0 = street, wall face y = 0, house to +Y 3 m, porch to
# y -1.6, steps to y -2.0). Windows: 0 ground left, 1 ground right, 2 up left, 3 up middle, 4 up right.
# Windows lighting up one by one in a shot: build with switchable=True (every window + the hall gets its point light,
# 0 W while dark), then  cz._PROPS['gb_house'].switch(cz, '<name>', i, frame, on=True, ramp=4)  (i = 0-4 or 'hall').
# Each room / curtain / flame material has a Value node 'lit' (0..1) that switch() keys together with the light energy.
import hashlib, math, os, random, subprocess
import bpy, bmesh
from mathutils import Matrix, Vector

TEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tex')
W2 = 2.3                    # half width
DEP = 3.0                   # body depth
T = 0.15                    # wall thickness
PZ = 0.42                   # porch / ground floor
ZE = 4.72                   # eave height
A = math.radians(30)        # roof pitch
ZG = ZE + W2 * math.tan(A)  # gable apex (wall top under the ridge)
TH = 0.13                   # roof slab thickness
GWIN = [(-1.38, 1.0, 0.72, 1.35), (1.38, 1.0, 0.72, 1.35)]                      # cx, z0, w, h
UWIN = [(-1.45, 3.3, 0.62, 1.05), (0.0, 3.3, 0.62, 1.05), (1.45, 3.3, 0.62, 1.05)]
WINS = GWIN + UWIN
DOOR = (-0.45, 0.45, PZ, PZ + 2.0)
POSTS = (-2.18, -0.72, 0.72, 2.18)
PY = -1.48                  # post line

META = {'size': (5.68, 5.51, 6.97), 'anchor': 'floor centre of the front wall line at street level (z 0); wall face y = 0, body to y +3.0; '
        'porch floor z 0.42 from y 0 to -1.6, steps (x -0.65..0.65) to y -2.0; roof overhang to y -0.45 / +3.45, gutters to x +-2.84, chimney top z 6.97, ridge ~6.2',
        'porch_z': PZ, 'porch': (-W2, -1.6, W2, 0.0), 'door': (0.0, 0.0),
        'windows': [(cx, 0.0, round(z0 + h / 2, 3)) for cx, z0, w, h in WINS],
        'lamp_hook': (0.62, -1.15, 2.62),
        'animate': ['_door (rotation_euler.z: + = opens inward, toward +Y; door_open 1 = +95 deg)',
                    '_winlight<i> (point light energy; lit windows, or all with switchable=True)',
                    '_halllight (hall behind the door; when lit or switchable)',
                    "materials <name>_room<i>m / _curtain<i>m / _flame<i>m / _hallm / _doorpanem: Value node 'lit' 0..1 (switch())"],
        'parts': {'glass': '<name>_glass (front windows, transparent), <name>_sideglass, <name>_doorglass (cz.no_shadow finds them)'},
        'params': "lit=() window indices lit (0 ground L, 1 ground R, 2 up L, 3 up mid, 4 up R), color='#6f8fb3' siding, "
                  "trim='#efe6d2', seed=0 (dressing: flower box / broom / number plate / bench / lamp hook / milk cans / "
                  "rocking chair + door, shutter, curtain colours), door_open=0.0 (0..1), hall=None (lit hall behind the door; "
                  "None = lit when a ground window is lit), roof='#5b4f55', win_power=60 (W per window light), "
                  "switchable=False (True: lights for every window so switch() can light them up in a shot)"}


# ------------------------------------------------------------------ PNGs (venv, cached by the maker's content)
def _tex(cz):
    mk = os.path.join(TEX, 'make_gb_house.py')
    key = hashlib.sha1(open(mk, 'rb').read()).hexdigest()[:8]
    kinds = ('clap', 'shingle', 'lattice', 'wallpaper', 'louver', 'stone')
    paths = {k: os.path.join(TEX, f'gb_house_{k}_{key}.png') for k in kinds}
    if not all(os.path.exists(p) for p in paths.values()):
        py = cz.py()
        try:
            subprocess.run([py, mk, key], timeout=120, check=True, capture_output=True,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except Exception as e:
            print('CZ gb_house: png failed', e)
    return {k: (p if os.path.exists(p) else None) for k, p in paths.items()}


# ------------------------------------------------------------------ merged-mesh builder
class MB:
    """Many parts in one bmesh (one object, one outline): boxes, lathes, prisms, sheets; per-face material index; UVs in
    metres (dominant-axis planar unless a uv function is given)."""
    def __init__(self):
        self.bm = bmesh.new(); self.uv = self.bm.loops.layers.uv.new('UVMap')

    def _fin(self, faces, mat, uvf=None, uvs=1.0):
        for f in faces:
            f.material_index = mat; f.normal_update(); n = f.normal
            for lp in f.loops:
                co = lp.vert.co
                if uvf: u, v = uvf(co, n)
                else:
                    ax = max(range(3), key=lambda i: abs(n[i]))
                    u, v = ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
                lp[self.uv].uv = (u / uvs, v / uvs)
        return faces

    def box(self, c, s, mat=0, rot=None, uvf=None):
        M = Matrix.Translation(Vector(c))
        if rot: M = M @ rot
        M = M @ Matrix.Diagonal((s[0], s[1], s[2], 1.0))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)
        faces = list({f for v in r['verts'] for f in v.link_faces})
        return self._fin(faces, mat, uvf)

    def lathe(self, prof, c, seg=12, mat=0):
        bm = self.bm; rings = []
        for r, z in prof:
            rings.append([bm.verts.new((c[0] + r * math.cos(2 * math.pi * k / seg), c[1] + r * math.sin(2 * math.pi * k / seg), c[2] + z))
                          for k in range(seg)])
        fs = []
        for a, b in zip(rings, rings[1:]):
            for k in range(seg):
                fs.append(bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k])))
        fs.append(bm.faces.new(rings[0][::-1])); fs.append(bm.faces.new(rings[-1]))
        return self._fin(fs, mat)

    def prism(self, pts, a0, a1, axis='y', mat=0, uvf=None):
        """2-D outline pts extruded between a0..a1 along axis. axis 'y': pts are (x, z); 'x': pts are (y, z)."""
        bm = self.bm
        def P(p, a): return (p[0], a, p[1]) if axis == 'y' else (a, p[0], p[1])
        f0 = [bm.verts.new(P(p, a0)) for p in pts]; f1 = [bm.verts.new(P(p, a1)) for p in pts]
        fs = [bm.faces.new(f0), bm.faces.new(f1[::-1])]
        n = len(pts)
        for k in range(n):
            fs.append(bm.faces.new((f0[k], f0[(k + 1) % n], f1[(k + 1) % n], f1[k])))
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        return self._fin(fs, mat, uvf)

    def wall(self, x0, x1, z0, z1, holes, y0, t, mat=0):
        """A wall slab in the XZ plane (front face y0, depth t toward +Y) with rectangular holes (x0, x1, z0, z1)."""
        bm = self.bm
        xs = sorted(set([x0, x1] + [h[0] for h in holes] + [h[1] for h in holes]))
        zs = sorted(set([z0, z1] + [h[2] for h in holes] + [h[3] for h in holes]))
        F, B = {}, {}
        def V(d, i, j, y):
            if (i, j) not in d: d[(i, j)] = bm.verts.new((xs[i], y, zs[j]))
            return d[(i, j)]
        front, back = [], []
        for i in range(len(xs) - 1):
            for j in range(len(zs) - 1):
                cx, cz_ = (xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
                if any(h[0] < cx < h[1] and h[2] < cz_ < h[3] for h in holes): continue
                front.append(bm.faces.new((V(F, i, j, y0), V(F, i + 1, j, y0), V(F, i + 1, j + 1, y0), V(F, i, j + 1, y0))))
                back.append(bm.faces.new((V(B, i, j + 1, y0 + t), V(B, i + 1, j + 1, y0 + t), V(B, i + 1, j, y0 + t), V(B, i, j, y0 + t))))
        inv = {v: k for k, v in F.items()}
        sides = []
        for f in front:
            for e in f.edges:
                if len(e.link_faces) == 1:
                    a, b = e.verts; ka, kb = inv[a], inv[b]
                    sides.append(bm.faces.new((a, b, V(B, kb[0], kb[1], y0 + t), V(B, ka[0], ka[1], y0 + t))))
        fs = front + back + sides
        bmesh.ops.recalc_face_normals(bm, faces=fs)
        return self._fin(fs, mat)

    def sheet(self, grid, mat=0):
        """grid: rows of (x, y, z) points -> quads (a cloth / curtain)."""
        bm = self.bm
        vs = [[bm.verts.new(p) for p in row] for row in grid]
        fs = []
        for r0, r1 in zip(vs, vs[1:]):
            for k in range(len(r0) - 1):
                fs.append(bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k])))
        return self._fin(fs, mat)

    def obj(self, cz, name, mats, parent, ol=0.0, bevel=0.0, smooth=False, shadow=True):
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        if smooth: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
        for m in mats: me.materials.append(m)
        o = bpy.data.objects.new(name, me)
        cz.place(o, (0, 0, 0), (0, 0, 0), None, parent, ol, bevel, 2)
        if not shadow: o.visible_shadow = False
        return o


def _glass(cz, name, lit=False):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N, L = nt.nodes, nt.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial'); tr = N.new('ShaderNodeBsdfTransparent')
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = cz.col('#ffd9a0' if lit else '#6a7ca6')
    em.inputs['Strength'].default_value = 0.45
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.35
    mr = N.new('ShaderNodeMapRange'); mr.inputs['To Min'].default_value = 0.05; mr.inputs['To Max'].default_value = 0.28
    L.new(lw.outputs['Facing'], mr.inputs['Value'])
    mx = N.new('ShaderNodeMixShader'); L.new(mr.outputs['Result'], mx.inputs[0])
    L.new(tr.outputs[0], mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2]); L.new(mx.outputs[0], out.inputs['Surface'])
    m.surface_render_method = 'BLENDED'
    return m


def _litmat(cz, name, fac, img=None, dark='#2c3250', warm='#ffb878', emit=0.9, lift_dark=1.5, lift_lit=0.62, glow=False,
            base='#ffffff', off='#2a2a34'):
    """A room surface (or flame / pane with glow=True) that blends dark <-> lamp-lit by the Value node 'lit' (0..1, keyable:
    see switch()). img/base = the surface (wallpaper / curtain colour); dark/warm tints; emission = lit * emit."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; N, L = nt.nodes, nt.links; N.clear()
    out = N.new('ShaderNodeOutputMaterial')
    v = N.new('ShaderNodeValue'); v.name = v.label = 'lit'; v.outputs[0].default_value = fac
    def math_(op, a, b):
        n = N.new('ShaderNodeMath'); n.operation = op
        for k, x in enumerate((a, b)):
            if isinstance(x, (int, float)): n.inputs[k].default_value = x
            else: L.new(x, n.inputs[k])
        return n.outputs[0]
    if glow:
        e1 = N.new('ShaderNodeEmission'); e1.inputs['Color'].default_value = cz.col('#ffb24a'); L.new(math_('MULTIPLY', v.outputs[0], emit), e1.inputs['Strength'])
        e0 = N.new('ShaderNodeEmission'); e0.inputs['Color'].default_value = cz.col(off); L.new(math_('SUBTRACT', 1.0, v.outputs[0]), e0.inputs['Strength'])
        ad = N.new('ShaderNodeAddShader'); L.new(e1.outputs[0], ad.inputs[0]); L.new(e0.outputs[0], ad.inputs[1]); L.new(ad.outputs[0], out.inputs['Surface'])
        return m
    if img:
        t = N.new('ShaderNodeTexImage'); t.image = cz.image(img); t.interpolation = 'Cubic'; b = t.outputs['Color']
    else:
        r = N.new('ShaderNodeRGB'); r.outputs[0].default_value = cz.col(base); b = r.outputs[0]
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; L.new(v.outputs[0], mx.inputs[0])
    mx.inputs[6].default_value = cz.col(dark); mx.inputs[7].default_value = cz.col(warm)
    tint = N.new('ShaderNodeVectorMath'); tint.operation = 'MULTIPLY'; L.new(b, tint.inputs[0]); L.new(mx.outputs[2], tint.inputs[1])
    dif = N.new('ShaderNodeBsdfDiffuse'); s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs[0], s2r.inputs[0])
    gam = N.new('ShaderNodeGamma'); L.new(s2r.outputs['Color'], gam.inputs['Color'])
    L.new(math_('MULTIPLY_ADD', v.outputs[0], lift_lit - lift_dark) if False else math_('ADD', math_('MULTIPLY', v.outputs[0], lift_lit - lift_dark), lift_dark), gam.inputs['Gamma'])
    sh = N.new('ShaderNodeVectorMath'); sh.operation = 'MULTIPLY'; L.new(tint.outputs[0], sh.inputs[0]); L.new(gam.outputs[0], sh.inputs[1])
    e1 = N.new('ShaderNodeEmission'); L.new(sh.outputs[0], e1.inputs['Color']); e1.inputs['Strength'].default_value = 1.0
    e2 = N.new('ShaderNodeEmission'); L.new(tint.outputs[0], e2.inputs['Color']); L.new(math_('MULTIPLY', v.outputs[0], emit), e2.inputs['Strength'])
    ad = N.new('ShaderNodeAddShader'); L.new(e1.outputs[0], ad.inputs[0]); L.new(e2.outputs[0], ad.inputs[1]); L.new(ad.outputs[0], out.inputs['Surface'])
    return m


def switch(cz, name, which, frame, on=True, ramp=4, power=60.0):
    """Light window `which` (0-4, or 'hall') of house `name` up (on=True) or out over frames frame..frame+ramp: keys the room,
    curtain, lamp-flame materials' 'lit' value and the point light energy. Build the house with switchable=True so every
    window has its light (an unlit window starts at 0 W)."""
    import bpy
    tags = ['hallm', 'doorpanem'] if which == 'hall' else [f'room{which}m', f'curtain{which}m', f'flame{which}m']
    a, b = (0.0, 1.0) if on else (1.0, 0.0)
    for t in tags:
        m = bpy.data.materials.get(f'{name}_{t}')
        if not m: continue
        s = m.node_tree.nodes['lit'].outputs[0]
        s.default_value = a; s.keyframe_insert('default_value', frame=frame)
        s.default_value = b; s.keyframe_insert('default_value', frame=frame + ramp)
    lo = bpy.data.objects.get(f'{name}_halllight' if which == 'hall' else f'{name}_winlight{which}')
    if lo:
        pw = power * (0.8 if which == 'hall' else 1.0)
        lo.data.energy = a * pw; lo.data.keyframe_insert('energy', frame=frame)
        lo.data.energy = b * pw; lo.data.keyframe_insert('energy', frame=frame + ramp)


def _shade(c, k):
    c = c.lstrip('#'); return '#' + ''.join(f'{max(0, min(255, int(int(c[i:i + 2], 16) * k))):02x}' for i in (0, 2, 4))


def build(cz, name='gb_house', lit=(), color='#6f8fb3', trim='#efe6d2', seed=0, door_open=0.0, hall=None,
          roof='#5b4f55', win_power=60.0, switchable=False):
    lit = tuple(int(i) for i in (lit if isinstance(lit, (list, tuple)) else (lit,)))
    rng = random.Random(seed)
    tx = _tex(cz)
    root = cz.empty(name)

    # ---------------- materials
    siding = cz.toon(name + '_siding', color, img=tx['clap'], proj='box', proj_scale=0.5, tint=_shade(color, 0.9),
                     tex='grain', tex_scale=1.5, tex_strength=0.05)
    trim_m = cz.toon(name + '_trim', trim, tex='grain', tex_scale=2.0, tex_strength=0.05)
    trim_d = cz.toon(name + '_trim2', _shade(trim, 0.78), tex='grain', tex_strength=0.05)
    stone = cz.toon(name + '_stone', '#8a847c', img=tx['stone'], proj='box', proj_scale=1.0, tint='#9a948a')
    shingle = cz.toon(name + '_shingle', roof, img=tx['shingle'], tint=roof)
    deck = cz.toon(name + '_deck', '#6f675c', pattern=('planks', 1.4, 0.13, '#2e2824'), tex='wood', tex_scale=2.0, tex_strength=0.07)
    haint = cz.toon(name + '_ceiling', '#7fa8b0', pattern=('planks', 2.4, 0.11, '#4a6a70'), tex='grain', tex_strength=0.04)
    lattice = cz.toon(name + '_lattice', '#e6dccb', img=tx['lattice'], tint=trim)
    doorc = rng.choice(['#7a2f2a', '#2f4a3a', '#3b3354', '#6a4a2a'])
    shutc = rng.choice(['#2f4a3a', '#273a4f', '#3d2b2b', '#4a4a3a'])
    curc = rng.choice(['#e3d3b0', '#c9584a', '#d8c290', '#9a5a7a'])
    door_m = cz.toon(name + '_doorm', doorc, tex='wood', tex_scale=1.5, tex_strength=0.07)
    door_d = cz.toon(name + '_doorm2', _shade(doorc, 0.75), tex='wood', tex_scale=1.5, tex_strength=0.07)
    brass = cz.toon(name + '_brass', '#c9a24a')
    louver = cz.toon(name + '_louver', shutc, img=tx['louver'], proj='box', proj_scale=2.0, tint=shutc)
    brick = cz.toon(name + '_brick', '#8a4535', pattern=('planks', 0.24, 0.085, '#3a2620'), tex='grain', tex_strength=0.06)
    dark = cz.toon(name + '_iron', '#2a2622')
    floor_m = cz.toon(name + '_roomfloor', '#5a3a28', tex='wood', tex_strength=0.08)
    furn = cz.toon(name + '_furn', '#2a1d18')
    glass_m = _glass(cz, name + '_glassm')

    # ---------------- foundation + walls
    mb = MB()
    mb.box((0, DEP / 2, 0.21), (2 * W2 + 0.06, DEP + 0.04, 0.42), 0)
    mb.obj(cz, name + '_foundation', [stone], root, ol=0.009, bevel=0.02)

    mb = MB()
    holes = [DOOR] + [(cx - w / 2, cx + w / 2, z0, z0 + h) for cx, z0, w, h in WINS]
    mb.wall(-W2, W2, 0.40, ZE, [(DOOR[0], DOOR[1], 0.40, DOOR[3])] + holes[1:], 0.0, T)
    mb.prism([(-W2, ZE - 0.02), (W2, ZE - 0.02), (0, ZG)], 0.0, T, 'y')                     # front gable
    mb.prism([(-W2, ZE - 0.02), (W2, ZE - 0.02), (0, ZG)], DEP - T, DEP, 'y')               # back gable
    mb.box((0, DEP - T / 2, (0.40 + ZE) / 2), (2 * W2, T, ZE - 0.40))                       # back wall
    for sx in (-1, 1):
        mb.box((sx * (W2 - T / 2), DEP / 2, (0.40 + ZE) / 2), (T, DEP - 0.02, ZE - 0.40))
    mb.obj(cz, name + '_walls', [siding], root, ol=0.010)

    # ---------------- trim: corner boards, frieze, rake boards, casings, sills, heads, door frame, side window frames
    tb = MB()
    for sx in (-1, 1):
        tb.box((sx * (W2 - 0.055), -0.025, (0.40 + ZE) / 2), (0.15, 0.05, ZE - 0.40))         # front corner boards
        tb.box((sx * (W2 + 0.025), 0.055, (0.40 + ZE) / 2), (0.05, 0.15, ZE - 0.40))
        tb.box((sx * (W2 + 0.025), DEP - 0.055, (0.40 + ZE) / 2), (0.05, 0.15, ZE - 0.40))    # back corners
        tb.box((sx * (W2 + 0.03), DEP / 2, ZE - 0.12), (0.06, DEP, 0.24))                    # side frieze
    tb.box((0, -0.03, ZE - 0.1), (2 * W2 + 0.06, 0.06, 0.2))                                 # front frieze under the gable
    tb.box((0, -0.05, ZE + 0.02), (2 * W2 + 0.16, 0.1, 0.06))                                # its cap
    L = (W2 + 0.42) / math.cos(A)
    for sx in (-1, 1):                                                                        # rake boards on the roof's front edge
        R = Matrix.Rotation(sx * A, 4, 'Y')
        cxr = sx * (W2 + 0.42) / 2; czr = ZG - (W2 + 0.42) / 2 * math.tan(A) - 0.02
        tb.box((cxr, -0.43, czr), (L, 0.06, 0.2), rot=R)
        tb.box((cxr, DEP + 0.43, czr), (L, 0.06, 0.2), rot=R)
    for cx, z0, w, h in WINS:                                                                 # window casings
        tb.box((cx - w / 2 - 0.05, -0.02, z0 + h / 2), (0.1, 0.05, h))
        tb.box((cx + w / 2 + 0.05, -0.02, z0 + h / 2), (0.1, 0.05, h))
        tb.box((cx, -0.025, z0 + h + 0.08), (w + 0.24, 0.05, 0.16))                           # head
        tb.box((cx, -0.05, z0 + h + 0.175), (w + 0.34, 0.1, 0.04), 1)                         # cornice cap
        tb.box((cx, -0.05, z0 - 0.03), (w + 0.28, 0.12, 0.06))                                # sill
        tb.box((cx, -0.02, z0 - 0.1), (w + 0.1, 0.04, 0.09), 1)                               # apron
        for k in range(4):                                                                    # reveal linings
            pass
    x0, x1, z0, z1 = DOOR
    tb.box((x0 - 0.06, -0.025, (z0 + z1) / 2 + 0.04), (0.12, 0.05, z1 - z0 + 0.08))           # door casing
    tb.box((x1 + 0.06, -0.025, (z0 + z1) / 2 + 0.04), (0.12, 0.05, z1 - z0 + 0.08))
    tb.box((0, -0.03, z1 + 0.1), (1.18, 0.06, 0.2)); tb.box((0, -0.06, z1 + 0.22), (1.3, 0.12, 0.05), 1)
    tb.box((0, 0.0, PZ + 0.012), (0.9, 0.16, 0.024), 1)                                       # threshold
    for sx in (-1, 1):                                                                        # side window frames (decals, not openings)
        for zc, hh in ((1.75, 1.3), (3.85, 1.05)):
            tb.box((sx * (W2 + 0.03), 1.5, zc), (0.05, 0.86, hh + 0.2))
    tb.obj(cz, name + '_trimset', [trim_m, trim_d], root, ol=0.007, bevel=0.008)

    # window reveals (the cut through the wall) in the trim colour, inside the openings
    rv = MB()
    for cx, z0, w, h in WINS:
        rv.box((cx, 0.075, z0 + 0.01), (w, T - 0.01, 0.02)); rv.box((cx, 0.075, z0 + h - 0.01), (w, T - 0.01, 0.02))
        rv.box((cx - w / 2 + 0.01, 0.075, z0 + h / 2), (0.02, T - 0.01, h)); rv.box((cx + w / 2 - 0.01, 0.075, z0 + h / 2), (0.02, T - 0.01, h))
    for sx in (-1, 1):
        rv.box((sx * 0.44, 0.075, (z0 + z1) / 2), (0.02, T - 0.01, z1 - z0));
    rv.box((0, 0.075, z1 - 0.01), (0.9, T - 0.01, 0.02))
    rv.obj(cz, name + '_reveals', [trim_d], root, ol=0.0)

    # ---------------- sashes + glass + shutters + side-window glass
    sb, gb_, sh, sg = MB(), MB(), MB(), MB()
    for i, (cx, z0, w, h) in enumerate(WINS):
        ys = 0.05
        fr = 0.05
        sb.box((cx, ys, z0 + fr / 2 + 0.01), (w, 0.04, fr)); sb.box((cx, ys, z0 + h - fr / 2 - 0.01), (w, 0.04, fr))
        sb.box((cx - w / 2 + fr / 2, ys, z0 + h / 2), (fr, 0.04, h)); sb.box((cx + w / 2 - fr / 2, ys, z0 + h / 2), (fr, 0.04, h))
        sb.box((cx, ys - 0.01, z0 + h / 2), (w, 0.05, 0.05))                                   # meeting rail
        sb.box((cx, ys, z0 + h / 2), (0.03, 0.035, h))                                         # muntin (2-over-2)
        gb_.box((cx, ys + 0.012, z0 + h / 2), (w - 0.02, 0.004, h - 0.02))
        sw = 0.30 if i < 2 else 0.28
        for sx in (-1, 1):
            xs = cx + sx * (w / 2 + 0.1 + 0.025 + sw / 2)
            sh.box((xs, -0.035, z0 + h / 2), (sw, 0.04, h + 0.06))
            sh.box((xs, -0.058, z0 + h / 2), (sw - 0.07, 0.006, 0.05), 1)                       # mid rail
    for sx in (-1, 1):
        for zc, hh in ((1.75, 1.3), (3.85, 1.05)):
            sg.box((sx * (W2 + 0.058), 1.5, zc), (0.004, 0.68, hh))
            sb.box((sx * (W2 + 0.06), 1.5, zc), (0.03, 0.04, hh)); sb.box((sx * (W2 + 0.06), 1.5, zc), (0.03, 0.68, 0.05))
    sb.obj(cz, name + '_sashes', [trim_m], root, ol=0.005, bevel=0.004)
    sh.obj(cz, name + '_shutters', [louver, cz.toon(name + '_shutrail', _shade(shutc, 0.8))], root, ol=0.007, bevel=0.006)
    g = gb_.obj(cz, name + "_glass", [glass_m], root, ol=0.0, shadow=False)
    sg.obj(cz, name + "_sideglass", [cz.toon(name + "_sidepane", "#243044", lift=0.7)], root, ol=0.0, shadow=False)

    # ---------------- rooms behind the windows (open toward the window), curtains, lamp silhouettes, lights
    lp = MB()
    for i, (cx, z0, w, h) in enumerate(WINS):
        on = i in lit
        fac = 1.0 if on else 0.0
        rm, cl, fl = MB(), MB(), MB()
        rw, rd = w + 0.7, 0.85
        y0, y1 = T, T + rd
        zb, zt = z0 - 0.45, z0 + h + 0.3
        rm.box((cx, y1 + 0.02, (zb + zt) / 2), (rw, 0.04, zt - zb), 0)                       # back wall
        rm.box((cx - rw / 2 - 0.02, (y0 + y1) / 2, (zb + zt) / 2), (0.04, rd, zt - zb), 0)
        rm.box((cx + rw / 2 + 0.02, (y0 + y1) / 2, (zb + zt) / 2), (0.04, rd, zt - zb), 0)
        rm.box((cx, (y0 + y1) / 2, zt + 0.02), (rw + 0.08, rd, 0.04), 0)
        rm.box((cx, (y0 + y1) / 2, zb - 0.02), (rw + 0.08, rd, 0.04), 1)
        # curtains: two gathered panels tied back at 45 % height, inside the glass
        for sx in (-1, 1):
            grid = []
            for r in range(7):
                k = r / 6; z = z0 + h + 0.08 - k * (h + 0.06)
                tie = 0.42
                wd = w * (0.34 - 0.2 * k / 0.58) if k < 0.58 else w * (0.14 + 0.1 * (k - 0.58) / 0.42)
                xo = cx + sx * (w / 2 + 0.06)
                row = []
                for c in range(9):
                    t = c / 8; x = xo - sx * t * (wd + 0.06)
                    y = T + 0.06 + 0.025 * math.sin(t * math.pi * 4)
                    row.append((x, y, z))
                grid.append(row)
            cl.sheet(grid)
        cl.box((cx, T + 0.05, z0 + h + 0.1), (w + 0.22, 0.03, 0.12))                           # valance
        # oil lamp on a little table, its font a dark silhouette in front of the glowing wall + a glowing chimney
        tx_ = cx + w * (0.2 if i % 2 == 0 else -0.2)
        ly = T + 0.42
        tt = z0 + 0.02                                                                          # table top just under the sill line
        lp.box((tx_, ly, tt - 0.02), (0.46, 0.34, 0.04)); lp.box((tx_, ly, (tt + zb) / 2), (0.07, 0.07, tt - zb))
        lp.lathe([(0.0, 0), (0.12, 0.0), (0.13, 0.04), (0.06, 0.1), (0.1, 0.16), (0.08, 0.2), (0.04, 0.22), (0.0, 0.22)],
                 (tx_, ly, tt), 12)
        fl.lathe([(0.0, 0), (0.05, 0.0), (0.095, 0.07), (0.1, 0.12), (0.06, 0.2), (0.04, 0.3), (0.0, 0.3)], (tx_, ly, tt + 0.21), 12)
        rm.obj(cz, f'{name}_room{i}', [_litmat(cz, f'{name}_room{i}m', fac, tx['wallpaper']), floor_m], root, ol=0.0)
        cl.obj(cz, f'{name}_curtain{i}', [_litmat(cz, f'{name}_curtain{i}m', fac, None, dark=_shade(curc, 0.42), warm=curc,
                                                   emit=0.9, base='#ffffff')], root, ol=0.0)
        fl.obj(cz, f'{name}_flame{i}', [_litmat(cz, f'{name}_flame{i}m', fac, glow=True, emit=6.0)], root, ol=0.0, shadow=False)
        if on or switchable:
            lamp = cz.light(f'{name}_winlight{i}', 'POINT', (tx_, ly - 0.05, tt + 0.5), color='#ffb466', power=win_power * fac, size=0.12)
            lamp.parent = root
    # hall behind the door
    hall = (0 in lit or 1 in lit) if hall is None else bool(hall)
    hfac = 1.0 if hall else 0.0
    rm = MB()
    rm.box((0, T + 1.62, PZ + 1.1), (1.3, 0.04, 2.3), 0)
    rm.box((-0.63, T + 0.8, PZ + 1.1), (0.04, 1.62, 2.3), 0); rm.box((0.63, T + 0.8, PZ + 1.1), (0.04, 1.62, 2.3), 0)
    rm.box((0, T + 0.8, PZ + 2.27), (1.3, 1.62, 0.04), 0); rm.box((0, T + 0.8, PZ - 0.01), (1.3, 1.62, 0.02), 1)
    rm.obj(cz, name + '_hall', [_litmat(cz, name + '_hallm', hfac, tx['wallpaper'], emit=0.45), floor_m], root, ol=0.0)
    lp.box((-0.47, T + 1.35, PZ + 0.6), (0.14, 0.34, 1.2))                                    # hall stand on the left
    lp.lathe([(0.0, 0), (0.1, 0.0), (0.12, 0.08), (0.0, 0.1)], (-0.47, T + 1.35, PZ + 1.2), 8)   # a hat on it
    for k in range(8):                                                                          # stairs up on the right (sawtooth)
        lp.box((0.36, T + 0.75 + k * 0.12, PZ + 0.11 + k * 0.22), (0.46, 0.13, 0.24))
    for k in range(5):
        lp.box((0.13, T + 0.75 + k * 0.24, PZ + 0.62 + k * 0.44), (0.03, 0.03, 0.66))           # balusters
    ang = math.atan2(0.44, 0.24)
    lp.box((0.13, T + 0.75 + 0.48, PZ + 0.95 + 0.88), (0.05, 0.96 / math.cos(ang) + 0.1, 0.05), rot=Matrix.Rotation(ang, 4, 'X'))   # handrail
    if hall or switchable:
        hl = cz.light(name + '_halllight', 'POINT', (0, T + 1.0, PZ + 1.9), color='#ffb466', power=win_power * 0.8 * hfac, size=0.15)
        hl.parent = root
    lp.obj(cz, name + '_furniture', [furn], root, ol=0.004)

    # ---------------- door leaf on its hinge pivot (opens inward = +Y)
    piv = cz.empty(name + '_door', (DOOR[0] + 0.01, 0.055, PZ), parent=root)
    db = MB()
    lw, lh = 0.88, 1.98
    db.box((lw / 2, 0.0, lh / 2), (lw, 0.05, lh), 0)
    for (px, pz, pw, ph) in ((0.23, 0.42, 0.3, 0.55), (0.65, 0.42, 0.3, 0.55), (0.23, 1.12, 0.3, 0.42), (0.65, 1.12, 0.3, 0.42)):
        db.box((px, -0.03, pz), (pw, 0.02, ph), 1); db.box((px, -0.042, pz), (pw - 0.07, 0.01, ph - 0.07), 0)
        db.box((px, 0.03, pz), (pw, 0.02, ph), 1)
    db.box((0.44, -0.03, 1.62), (0.74, 0.02, 0.42), 1)                                        # glass light frame
    db.obj(cz, name + '_leaf', [door_m, door_d], piv, ol=0.007, bevel=0.006)
    gl = MB(); gl.box((0.44, -0.043, 1.62), (0.6, 0.004, 0.3)); gl.box((0.44, 0.043, 1.62), (0.6, 0.004, 0.3))
    gl.obj(cz, name + '_doorglass', [_litmat(cz, name + '_doorpanem', hfac, glow=True, emit=1.8)], piv, ol=0.0, shadow=False)
    hw = MB()
    hw.box((0.44, -0.045, 1.62), (0.03, 0.01, 0.3)); hw.box((0.78, -0.03, 0.92), (0.05, 0.02, 0.16))
    cz.sphere(name + '_knobball', 0.04, (0.78, -0.075, 0.95), brass, ol=0.003, parent=piv, segs=16, rings=8)
    for zz in (0.25, 1.7):
        hw.box((0.0, -0.03, zz), (0.03, 0.03, 0.12))
    hw.obj(cz, name + '_knob', [brass], piv, ol=0.003)
    piv.rotation_euler.z = math.radians(95.0 * max(0.0, min(1.0, float(door_open))))

    # ---------------- roof: two shingled slabs with their own UVs (rows along the ridge), ridge cap, chimney, attic vent
    rb = MB()
    xe = W2 + 0.42
    def uvr(co, n):
        if n.z > 0.5: return (co.y, -abs(co.x) / math.cos(A))
        ax = max(range(3), key=lambda i: abs(n[i])); return ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
    for sx in (-1, 1):
        nx, nz = sx * math.sin(A), math.cos(A)
        p0 = (0.0, ZG); p1 = (sx * xe, ZG - xe * math.tan(A))
        pts = [p0, p1, (p1[0] + nx * TH, p1[1] + nz * TH), (p0[0] + nx * TH, p0[1] + nz * TH)]
        rb.prism(pts, -0.45, DEP + 0.45, 'y', 0, uvr)
    rb.box((0, DEP / 2, ZG + TH / math.cos(A) - 0.02), (0.16, DEP + 0.95, 0.16), 1, rot=Matrix.Rotation(math.radians(45), 4, 'Y'))
    rb.obj(cz, name + '_roof', [shingle, cz.toon(name + '_ridge', _shade(roof, 0.7))], root, ol=0.010)
    ch = MB()
    cxc, cyc = 1.15, 2.1
    zr = ZG - cxc * math.tan(A)
    ch.box((cxc, cyc, (zr - 0.3 + ZG + 0.75) / 2), (0.52, 0.62, ZG + 0.75 - zr + 0.3), 0)
    ch.box((cxc, cyc, ZG + 0.8), (0.64, 0.74, 0.1), 1); ch.box((cxc, cyc, ZG + 0.88), (0.5, 0.6, 0.06), 1)
    ch.obj(cz, name + '_chimney', [brick, dark], root, ol=0.009, bevel=0.01)
    vent = MB()
    zv = ZE + 0.62
    vent.box((0, -0.03, zv), (0.62, 0.06, 0.5), 0); vent.box((0, -0.065, zv), (0.5, 0.02, 0.38), 1)
    for k in range(4):
        vent.box((0, -0.08, zv - 0.14 + k * 0.095), (0.48, 0.02, 0.04), 0)
    vent.obj(cz, name + '_vent', [trim_m, dark], root, ol=0.006, bevel=0.006)
    # fish-scale shingles in the front gable (rows with scalloped lower edges, each upper row 2 mm proud of the one below)
    fs_ = MB()
    zrow, rh, k = ZE + 0.1, 0.16, 0
    while zrow + 0.06 < ZG - 0.05:
        zb_, zt_ = zrow, min(zrow + rh + 0.05, ZG)
        xb_ = (ZG - zb_) / math.tan(A) - 0.01; xt_ = max(0.008, (ZG - zt_) / math.tan(A) - 0.01)
        n = max(2, int(2 * xb_ / 0.15)); pts = [(-xt_, zt_), (-xb_, zb_)]
        sw_ = 2 * xb_ / n
        for s in range(n):
            for j in range(1, 6):
                t = j / 6; pts.append((-xb_ + sw_ * (s + t), zb_ - 0.06 * math.sin(math.pi * t)))
            pts.append((-xb_ + sw_ * (s + 1), zb_))
        pts.append((xt_, zt_))
        y0_ = -0.025 - 0.002 * k
        fs_.prism(pts, y0_, y0_ + 0.025, 'y', k % 2)
        zrow += rh; k += 1
    fs_.obj(cz, name + '_gableshingles', [cz.toon(name + '_scale1', _shade(color, 0.82), tex='grain', tex_strength=0.06),
                                          cz.toon(name + '_scale2', _shade(color, 0.74), tex='grain', tex_strength=0.06)],
            root, ol=0.003)
    # gutters along both eaves + a downspout down each side wall near the front (offset elbow to the wall)
    gu = MB()
    xg = W2 + 0.42 + 0.05; zg = ZG - (W2 + 0.42) * math.tan(A) - 0.03
    for sx in (-1, 1):
        gu.box((sx * xg, DEP / 2, zg), (0.11, DEP + 0.9, 0.1))
        gu.box((sx * xg, DEP / 2, zg + 0.055), (0.13, DEP + 0.9, 0.02), 1)                      # rolled lip
        ys = 0.3
        gu.box((sx * xg, ys, zg - 0.12), (0.07, 0.07, 0.16))
        ang = math.atan2(xg - (W2 + 0.07), 0.3)
        gu.box((sx * (xg + W2 + 0.07) / 2, ys, zg - 0.33), (0.07, 0.07, math.hypot(xg - W2 - 0.07, 0.3)), rot=Matrix.Rotation(sx * ang, 4, 'Y'))
        gu.box((sx * (W2 + 0.07), ys, (zg - 0.48) / 2 + 0.02), (0.075, 0.075, zg - 0.48))          # pipe down to the ground
        gu.box((sx * (W2 + 0.12), ys, 0.06), (0.17, 0.09, 0.07))                                   # shoe
        for zz in (1.2, 2.6, 3.8):
            gu.box((sx * (W2 + 0.045), ys, zz), (0.03, 0.11, 0.03), 1)                             # straps
    gu.obj(cz, name + '_gutters', [cz.toon(name + '_tin2', '#4f5458', tex='grain', tex_strength=0.06), dark], root, ol=0.005, bevel=0.004)

    # ---------------- porch: deck, skirt + lattice, steps, posts, railings, beam, valance, roof + haint-blue ceiling
    pb = MB()
    pb.box((0, -0.8, PZ - 0.04), (2 * W2, 1.62, 0.08), 0)                                    # deck
    pb.box((0, -0.8 - 0.81 - 0.02, PZ - 0.06), (2 * W2 + 0.02, 0.05, 0.12), 1)               # nosing board
    pb.box((0, -0.55, 0.14), (1.3, 0.1, 0.28), 0) if False else None
    pb.box((0, -1.7, 0.14), (1.3, 0.2, 0.28), 0); pb.box((0, -1.9, 0.07), (1.3, 0.2, 0.14), 0)   # steps
    pb.box((0, -1.8, 0.27), (1.34, 0.04, 0.025), 1); pb.box((0, -2.0, 0.13), (1.34, 0.04, 0.025), 1)
    for sx in (-1, 1):
        pb.prism([(-1.6, 0.0), (-2.02, 0.0), (-1.6, 0.42)], sx * 0.65, sx * 0.71, 'x', 1)       # stringers
    pb.obj(cz, name + '_porch', [deck, trim_m], root, ol=0.008, bevel=0.006)
    lb = MB()
    for xa, xb in ((-W2 + 0.02, -0.72), (0.72, W2 - 0.02)):
        lb.box(((xa + xb) / 2, -1.59, PZ - 0.21), (xb - xa, 0.02, 0.34))
    for sx in (-1, 1):
        lb.box((sx * (W2 - 0.01), -0.8, PZ - 0.21), (0.02, 1.58, 0.34))
    lb.obj(cz, name + '_skirt', [lattice], root, ol=0.004)
    po = MB()
    prof = [(0.085, 0), (0.085, 0.3), (0.06, 0.34), (0.072, 0.42), (0.05, 0.55), (0.055, 1.55), (0.072, 1.7), (0.05, 1.8),
            (0.065, 1.9), (0.085, 1.95), (0.085, 2.2)]
    for x in POSTS:
        po.lathe(prof, (x, PY, PZ), 12)
    po.obj(cz, name + '_posts', [trim_m], root, ol=0.008, smooth=True)
    rl = MB()
    ZT = PZ + 0.82
    runs = [((-2.1, PY), (-0.8, PY)), ((0.8, PY), (2.1, PY)), ((-2.18, -1.4), (-2.18, -0.08)), ((2.18, -1.4), (2.18, -0.08))]
    for (ax_, ay), (bx, by) in runs:
        ln = math.hypot(bx - ax_, by - ay); along_x = abs(bx - ax_) > 0.01
        mx_, my = (ax_ + bx) / 2, (ay + by) / 2
        sz = (ln, 0.09, 0.06) if along_x else (0.09, ln, 0.06)
        rl.box((mx_, my, ZT), sz); rl.box((mx_, my, PZ + 0.1), (sz[0], sz[1], 0.05))
        n = int(ln / 0.11)
        for k in range(n):
            t = (k + 0.5) / n
            rl.box((ax_ + (bx - ax_) * t, ay + (by - ay) * t, (ZT + PZ + 0.1) / 2), (0.035, 0.035, ZT - PZ - 0.1))
    rl.obj(cz, name + '_railing', [trim_m], root, ol=0.005, bevel=0.004)
    pr = MB()
    zc = 2.84
    pr.box((0, PY, zc - 0.11), (2 * W2 + 0.1, 0.14, 0.22), 1)                                 # beam
    for x in POSTS:                                                                            # brackets
        for sx in (-1, 1):
            if abs(x + sx * 0.25) > W2 + 0.05: continue
            pr.prism([(x + sx * 0.06, zc - 0.22), (x + sx * 0.3, zc - 0.22), (x + sx * 0.06, zc - 0.46)], PY - 0.02, PY + 0.02, 'y', 1)
    # scalloped valance under the beam
    pts = [(-W2, zc - 0.22)]
    n = 22
    for k in range(n):
        xa_ = -W2 + 2 * W2 * k / n; xb_ = -W2 + 2 * W2 * (k + 1) / n
        for j in range(1, 6):
            t = j / 6; pts.append((xa_ + (xb_ - xa_) * t, zc - 0.22 - 0.07 - 0.05 * math.sin(math.pi * t)))
        pts.append((xb_, zc - 0.29))
    pts.append((W2, zc - 0.22))
    pr.prism(pts, PY - 0.075, PY - 0.055, 'y', 1)
    # shed roof: a wedge (flat underside = ceiling), shingles on top (UV rows along X)
    def uvp(co, n):
        if n.z > 0.5: return (co.x, co.y * 1.004)
        ax = max(range(3), key=lambda i: abs(n[i])); return ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
    wedge = pr.prism([(0.0, zc), (-1.85, zc), (-1.85, zc + 0.09), (0.0, zc + 0.30)], -W2 - 0.12, W2 + 0.12, 'x', 0, uvp)
    for f in wedge:
        if f.normal.z < -0.5: f.material_index = 2
        elif abs(f.normal.z) < 0.5: f.material_index = 1
    pr.obj(cz, name + '_porchroof', [shingle, trim_m, haint], root, ol=0.009, bevel=0.005)

    # ---------------- seed dressing
    items = rng.sample(['flowers', 'broom', 'plate', 'bench', 'hook', 'cans', 'rocker'], 3)
    if seed == 0: items = ['flowers', 'rocker', 'hook']
    dr = MB(); dmats = [trim_m, cz.toon(name + '_straw', '#b8923e', tex='grain', tex_strength=0.08),
                         cz.toon(name + '_wood', '#6a4630', tex='wood', tex_strength=0.08), cz.toon(name + '_tin', '#8f969a'),
                         cz.toon(name + '_bloomr', '#b8323a'), cz.toon(name + '_bloomy', '#d9a52a'), cz.toon(name + '_leaf', '#3f6a34')]
    if 'flowers' in items:
        cx, z0, w, h = GWIN[rng.randrange(2)]
        dr.box((cx, -0.17, z0 - 0.17), (w + 0.16, 0.22, 0.2), 0)
        for k in range(7):
            fx = cx - w / 2 + 0.02 + k * (w - 0.04) / 6
            dr.box((fx, -0.17, z0 - 0.03), (0.09, 0.09, 0.1), 6)
            dr.lathe([(0.0, 0), (0.05, 0.01), (0.055, 0.04), (0.0, 0.06)], (fx + 0.02, -0.19 + 0.03 * (k % 2), z0 + 0.02), 8, 4 + k % 2)
    if 'broom' in items:
        bx = 0.72
        dr.box((bx, -0.22, PZ + 0.62), (0.03, 0.03, 1.15), 2, rot=Matrix.Rotation(math.radians(-8), 4, 'Y'))
        dr.lathe([(0.03, 0), (0.12, 0.02), (0.1, 0.32), (0.04, 0.42), (0.0, 0.42)], (bx - 0.06, -0.22, PZ), 10, 1)
    if 'plate' in items:
        dr.box((0.75, -0.04, PZ + 1.55), (0.2, 0.03, 0.14), 3)
    if 'bench' in items:
        bx = -1.4
        dr.box((bx, -0.35, PZ + 0.43), (1.1, 0.36, 0.05), 2); dr.box((bx, -0.18, PZ + 0.72), (1.1, 0.04, 0.22), 2)
        for sx in (-1, 1):
            dr.box((bx + sx * 0.48, -0.35, PZ + 0.21), (0.05, 0.3, 0.42), 2); dr.box((bx + sx * 0.48, -0.2, PZ + 0.5), (0.05, 0.04, 0.6), 2)
    if 'cans' in items:
        for k, (x, y) in enumerate(((0.9, -1.3), (1.12, -1.36))):
            dr.lathe([(0.0, 0), (0.15, 0), (0.15, 0.38), (0.07, 0.48), (0.07, 0.54), (0.09, 0.55), (0.09, 0.59), (0.0, 0.6)], (x, y, PZ), 12, 3)
    if 'rocker' in items:
        rx, ry = 1.45, -0.6
        dr.box((rx, ry, PZ + 0.44), (0.46, 0.44, 0.05), 2)
        for k in range(5):
            dr.box((rx - 0.18 + k * 0.09, ry + 0.2, PZ + 0.78), (0.04, 0.03, 0.62), 2, rot=Matrix.Rotation(math.radians(-10), 4, 'X'))
        dr.box((rx, ry + 0.25, PZ + 1.1), (0.5, 0.05, 0.07), 2)
        for sx in (-1, 1):
            dr.box((rx + sx * 0.21, ry, PZ + 0.62), (0.04, 0.42, 0.04), 2)
            for k in range(6):                                                                    # curved rocker
                a0 = math.radians(-35 + k * 14); r = 0.8
                yy = ry + r * math.sin(a0); zz = PZ + 0.06 + r * (1 - math.cos(a0))
                dr.box((rx + sx * 0.21, yy, zz), (0.04, 0.16, 0.04), 2, rot=Matrix.Rotation(a0, 4, 'X'))
            for yy in (-0.16, 0.16):
                dr.box((rx + sx * 0.21, ry + yy, PZ + 0.25), (0.04, 0.04, 0.4), 2)
    dmats.append(cz.toon(name + '_mat', '#6a3226', tex='paper', tex_strength=0.1))
    dr.box((0, -0.36, PZ + 0.008), (0.84, 0.48, 0.016), 7)                                   # doormat
    dr.box((0, -0.36, PZ + 0.017), (0.6, 0.3, 0.004), 2)                                     # its woven centre
    hook = cz.empty(name + '_lamphook', META['lamp_hook'], parent=root)
    if 'hook' in items or True:
        hx, hy, hz = META['lamp_hook']
        dr.box((hx, hy, zc - 0.03), (0.08, 0.08, 0.04), 3); dr.box((hx, hy, hz + 0.1), (0.015, 0.015, 0.18), 3)
    if dr.bm.faces: dr.obj(cz, name + '_dressing', dmats, root, ol=0.005, bevel=0.004)
    else: dr.bm.free()
    return root
