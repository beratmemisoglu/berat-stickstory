# props_r1.py - builder r1's helpers for the roof film shots R01-R13 (wraps the shared house.py, never edits it).
# World (sun / storm), ground + grass + trees, rain streaks, splashes, puddles, drips, flowing-water curtains,
# x-ray overlays, single shingles, the fish flank, the membrane roll, the eroding trench, and the whip camera.
import bpy, bmesh, math, os, random, sys
import numpy as np
from mathutils import Vector, Quaternion, Matrix, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cz, mega as M
import house as H

FPS = 30
T = lambda f: (f - 1) / FPS                     # frame -> seconds
W, D, WALL, OVER, PITCH = H.W, H.D, H.WALL, H.OVER, H.PITCH
RISE = (D / 2) * math.tan(math.radians(PITCH))
EAVE_Z = WALL - OVER * math.tan(math.radians(PITCH))          # bottom edge of the pitched deck
SLOPE_LEN = (D / 2 + OVER) / math.cos(math.radians(PITCH))


def ss(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)
def ramp(t, a, b): return ss((t - a) / max(1e-6, b - a))


# ---------------------------------------------------------------- mesh helper
def mesh(name, verts, faces, mat=None, loc=(0, 0, 0), parent=None, smooth=False, uvs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(int(i) for i in f) for f in faces])
    me.update()
    if smooth: me.shade_smooth()
    if uvs is not None:
        uv = me.uv_layers.new(name='UVMap')
        for poly in me.polygons:
            for li in poly.loop_indices:
                uv.data[li].uv = uvs[me.loops[li].vertex_index]
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if parent: ob.parent = parent
    if mat: me.materials.append(mat)
    return ob


def _mat(name):
    m = bpy.data.materials.get(name)
    if m: return m, None
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    return m, (nt, o)


def no_shadow(ob):
    try: ob.visible_shadow = False
    except Exception: pass


# ---------------------------------------------------------------- materials (house.mats with r1's texture fixes)
TEX = lambda n: os.path.join(cz.LAB, 'assets', 'mega', n)


def mats(wet=False):
    """house.mats(), with the textures re-pointed: the shared roof_wood/shingle/grass files were saved off by one
    by Flow (roof_wood.png holds stone, roof_shingle.png wood, roof_grass.png shingles). r1_* are correct copies."""
    mt = H.mats()
    mt['wood'] = M.pbr('r1_wood', '#a8774a', rough=0.55, img=TEX('r1_wood.png'), scale=0.55, bump=0.15, bump_scale=30)
    mt['wood_dark'] = M.pbr('r1_wood_dark', '#6b4a30', rough=0.6, img=TEX('r1_wood.png'), scale=0.55, tint='#6a4c36')
    mt['floor'] = M.pbr('r1_floor', '#7a5a3c', rough=0.45, img=TEX('r1_wood.png'), scale=0.45, tint='#9a7a5a')
    mt['shingle'] = M.pbr('r1_shingle', '#4a4e55', rough=0.8, img=TEX('r1_shingle.png'), scale=0.27, tint='#c8b8b0', bump=0.3, bump_scale=60)
    mt['grass'] = M.pbr('r1_grassm', '#4f7d32', rough=0.9, img=TEX('r1_grass.png'), scale=0.28, tint='#b8c8a0')
    mt['stone'] = M.pbr('r1_stone', '#9a948a', rough=0.85, img=TEX('r1_stone.png'), scale=0.42, bump=0.5, bump_scale=6)
    mt['membrane'] = M.pbr('r1_membrane', '#2b2d33', rough=0.42, bump=0.25, bump_scale=45, noise=0.35, spec=0.6)
    if wet:   # rain-soaked: darker, glossier timber and stone
        mt['wood'] = M.pbr('r1_wood_wet', '#a8774a', rough=0.42, img=TEX('r1_wood.png'), scale=0.55, tint='#8a7462', spec=0.35)
        mt['stone'] = M.pbr('r1_stone_wet', '#9a948a', rough=0.45, img=TEX('r1_stone.png'), scale=0.42, bump=0.5, bump_scale=6, tint='#8c8478')
        mt['shingle'] = M.pbr('r1_shingle_wet', '#4a4e55', rough=0.4, img=TEX('r1_shingle.png'), scale=0.27, tint='#988a86', bump=0.3, bump_scale=60, spec=0.35)
    return mt


# ---------------------------------------------------------------- world
def world(f1, storm=None, sun_elev=34, sun_rot=215, mb=0.5, **kw):
    """M.setup + optional storm keys [(t, 0..1)]: the sky darkens + greys, the sun dims, a cloud deck fades in."""
    if storm and 'sun_disc' not in kw: kw['sun_disc'] = False
    if not storm:   # the Everest look: lower, harder sun (longer shadows), deeper sky
        sun_elev = min(sun_elev, 25); kw.setdefault('sky_sat', 2.0); kw.setdefault('sun_power', 4.3); kw.setdefault('haze', 0.1); kw.setdefault('light_k', 0.9); kw.setdefault('exposure', -0.3)
    warm = not storm
    sc = M.setup(f1, sun_elev=sun_elev, sun_rot=sun_rot, mb=mb, **kw)
    if storm:
        nt = sc.world.node_tree
        bgs = [n for n in nt.nodes if n.type == 'BACKGROUND']
        hss = [n for n in nt.nodes if n.type == 'HUE_SAT']
        sun = bpy.data.objects['sun'].data
        b0 = [b.inputs[1].default_value for b in bgs]; h0 = [h.inputs['Saturation'].default_value for h in hss]
        e0 = sun.energy
        deck = cloud_deck()
        cm = deck.data.materials[0]; gate = cm.node_tree.nodes['gate']
        for t, s in storm:
            f = round(t * FPS) + 1
            for b, v in zip(bgs, b0):
                b.inputs[1].default_value = v * (1 - 0.72 * s); b.inputs[1].keyframe_insert('default_value', frame=f)
            for h, v in zip(hss, h0):
                h.inputs['Saturation'].default_value = v * (1 - 0.75 * s); h.inputs['Saturation'].keyframe_insert('default_value', frame=f)
            sun.energy = e0 * (1 - 0.8 * s); sun.keyframe_insert('energy', frame=f)
            gate.outputs[0].default_value = s; gate.outputs[0].keyframe_insert('default_value', frame=f)
    if warm: bpy.data.objects['sun'].data.color = (1.0, 0.88, 0.74)     # golden key, as the enriched targets
    return sc


def cloud_deck(z=55, size=2200):
    """A dark storm-cloud layer (noise alpha) high over the hill, faded by the 'gate' value."""
    m, n = _mat('r1_clouds')
    if n:
        nt, o = n
        m.surface_render_method = 'BLENDED'
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (0.012, 0.02, 0.012)
        nt.links.new(tc.outputs['Object'], mp.inputs[0])
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 10; nz.inputs['Roughness'].default_value = 0.62
        nt.links.new(mp.outputs[0], nz.inputs[0])
        cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[1].position = 0.7
        cr.color_ramp.elements[0].color = (0.03, 0.035, 0.045, 1); cr.color_ramp.elements[1].color = (0.18, 0.2, 0.24, 1)
        nt.links.new(nz.outputs['Fac'], cr.inputs[0])
        al = nt.nodes.new('ShaderNodeMapRange'); al.inputs[1].default_value = 0.3; al.inputs[2].default_value = 0.55
        nt.links.new(nz.outputs['Fac'], al.inputs[0])
        g = nt.nodes.new('ShaderNodeValue'); g.name = 'gate'; g.outputs[0].default_value = 0
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
        nt.links.new(al.outputs[0], mul.inputs[0]); nt.links.new(g.outputs[0], mul.inputs[1])
        em = nt.nodes.new('ShaderNodeEmission'); nt.links.new(cr.outputs[0], em.inputs[0]); em.inputs[1].default_value = 1.0
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(mul.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], o.inputs[0])
    ob = M.heightfield('clouds', 2 * size, 64, lambda X, Y: -((X * X + Y * Y) / (size * size)) * (z + 260), mat=m, loc=(0, 0, z), smooth=True)   # a dome: its rim sinks below the horizon
    no_shadow(ob)
    return ob


# ---------------------------------------------------------------- ground
def ground(mt, trench=None, grass=True, trees=True, seed=3):
    """The hill (house.hill) + grass blades + stones + a few trees. trench=(x0, x1, y0, y1): faces removed there."""
    hl = H.hill(mt)
    if trench:
        x0, x1, y0, y1 = trench
        bm = bmesh.new(); bm.from_mesh(hl.data)
        kill = [f for f in bm.faces if x0 < f.calc_center_median().x < x1 and y0 < f.calc_center_median().y < y1]
        bmesh.ops.delete(bm, geom=kill, context='FACES'); bm.to_mesh(hl.data); bm.free()
    out = dict(hill=hl, trees=[])
    if grass: out['grass'] = grass_blades(mt, seed=seed, hole=trench)
    out['stones'] = stones(mt, seed=seed)
    if trees:
        r = random.Random(seed)
        spots = [(-11, 6.5, 6.2), (12.5, 7.5, 7.0), (-14, -4, 5.4), (15, -6, 5.0), (-7, 13, 6.6), (6, 15, 5.8), (19, 3, 6.4), (-20, 2, 7.2)]
        for i, (x, y, h) in enumerate(spots):
            out['trees'].append(tree(f'tree{i}', (x, y, 0), h, mt, seed=seed + i))
        for i in range(36):   # far woods on the hills (detail density)
            a = r.uniform(0, 6.283); d = r.uniform(28, 75); x, y = d * math.cos(a), d * math.sin(a)
            z = float(hl.data.vertices[0].co.z) * 0
            out['trees'].append(tree(f'ftree{i}', (x, y, _hill_z(hl, x, y)), r.uniform(6, 10), mt, seed=seed + 50 + i))
    return out


def bake_mods(ob):
    """Apply the modifier stack into the mesh (a displaced leaf blob under a moving camera rendered as a see-through
    ghost with motion blur: EEVEE re-evaluated the deform per blur step)."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear(); ob.data = me


def _hill_z(hl, x, y):
    """Ground height of the hill at (x, y) (ray cast straight down, local = world: the hill sits at the origin)."""
    ok, loc, nrm, idx = hl.ray_cast(Vector((x, y, 200)), Vector((0, 0, -1)))
    return loc.z - 0.2 if ok else 0.0


def grass_blades(mt, n=60000, r0=4.7, r1=24, seed=3, hole=None):
    """Thousands of thin blades (one joined mesh) around the house pad."""
    rng = np.random.default_rng(seed)
    a = rng.uniform(0, 2 * np.pi, n * 2); rr = np.sqrt(rng.uniform(r0 ** 2, r1 ** 2, n * 2))
    X = rr * np.cos(a); Y = rr * np.sin(a)
    keep = ~((np.abs(X) < W / 2 + 0.3) & (np.abs(Y) < D / 2 + 0.3))
    keep &= ~((np.abs(X) < W / 2 + 0.2) & (np.abs(np.abs(Y) - (D / 2 + 0.6)) < 0.5))     # no blades through the wall bushes
    if hole: keep &= ~((X > hole[0] - 0.1) & (X < hole[1] + 0.1) & (Y > hole[2] - 0.1) & (Y < hole[3] + 0.1))
    X, Y = X[keep][:n], Y[keep][:n]; n = len(X)
    h = rng.uniform(0.12, 0.32, n); wdt = rng.uniform(0.012, 0.022, n); th = rng.uniform(0, 2 * np.pi, n)
    lean = rng.uniform(-0.08, 0.08, (n, 2))
    c, s = np.cos(th), np.sin(th)
    v = np.zeros((n, 3, 3))
    v[:, 0] = np.stack([X - c * wdt, Y - s * wdt, np.zeros(n)], 1)
    v[:, 1] = np.stack([X + c * wdt, Y + s * wdt, np.zeros(n)], 1)
    v[:, 2] = np.stack([X + lean[:, 0], Y + lean[:, 1], h], 1)
    verts = v.reshape(-1, 3); faces = np.arange(n * 3).reshape(n, 3)
    gm = M.pbr('r1_blade', '#3a6224', rough=0.7, noise=0.7, scale=0.15, bump=0.2)
    ob = mesh('grass_blades', verts, faces, gm)
    return ob


def stones(mt, n=40, seed=5):
    r = random.Random(seed); obs = []
    for i in range(n):
        a = r.uniform(0, 6.283); d = r.uniform(5.2, 16)
        x, y = d * math.cos(a), d * math.sin(a)
        if abs(x) < W / 2 + 0.5 and abs(y) < D / 2 + 0.5: continue
        s = r.uniform(0.05, 0.16)
        ob = cz.sphere(f'stone{i}', 1.0, (x, y, s * 0.15), M.pbr('r1_pebble', '#6a655c', rough=0.8, noise=0.5, bump=0.5), scale=(s * r.uniform(0.8, 1.4), s, s * 0.6), ol=0, segs=10, rings=6)
        ob.rotation_euler = (0, 0, r.uniform(0, 6.28)); obs.append(ob)
    return M.join('stones', obs)


_TREE_MATS = {}


def tree(name, loc, h, mt, seed=1):
    """Trunk + branches + clumped leaf blobs. Returns dict(root, top) - rotate root/top to bend in the wind."""
    if not _TREE_MATS:
        _TREE_MATS['bark'] = M.pbr('r1_bark', '#4a3626', rough=0.85, bump=0.6, bump_scale=14, noise=0.4)
        _TREE_MATS['leaf'] = M.pbr('r1_leaf', '#2f5a22', rough=0.55, img=TEX('r1_leaves.png'), scale=0.55, bump=0.7, bump_scale=14, tint='#c8d8b0')
    r = random.Random(seed)
    root = cz.empty(name, loc)
    trunk = cz.cyl(name + '_trunk', 0.16 * h / 6, h * 0.55, (0, 0, 0), _TREE_MATS['bark'], verts=12, ol=0, parent=root, r2=0.1 * h / 6)
    top = cz.empty(name + '_top', (0, 0, h * 0.5), parent=root)
    blobs = []
    for k in range(16):
        a = r.uniform(0, 6.283); d = r.uniform(0, h * 0.18); z = r.uniform(0, h * 0.42)
        s = r.uniform(0.16, 0.27) * h * (1 - z / (h * 0.95))
        b = cz.sphere(f'{name}_b{k}', 1.0, (d * math.cos(a), d * math.sin(a), z), _TREE_MATS['leaf'], scale=(s, s, s * 0.85), ol=0, segs=14, rings=8)
        M.displace(b, strength=s * 0.35, scale=0.6 / max(0.3, s)); bake_mods(b)
        blobs.append(b)
    for k in range(4):
        a = k * 1.57 + r.uniform(-0.3, 0.3)
        br = cz.cyl(f'{name}_br{k}', 0.045 * h / 6, h * 0.25, (0, 0, h * 0.35), _TREE_MATS['bark'], rot=(55, 0, math.degrees(a)), verts=8, ol=0, parent=root)
    for b in blobs: b.parent = top
    return dict(root=root, top=top)


def bend_trees(trees, f0, f1, gust, dirv=(1, 0)):
    """gust(t) 0..1: lean every tree downwind with flutter."""
    ang = math.atan2(dirv[1], dirv[0])
    for i, tr in enumerate(trees):
        ph = i * 1.7
        def rot(t, ph=ph, k=1.0):
            g = gust(t); fl = math.sin(t * 9 + ph) * 0.25 + math.sin(t * 15.3 + ph * 2) * 0.12
            a = (g * (1 + fl)) * 9 * k
            return (-a * math.sin(ang) * 0 + a * -math.sin(ang), a * math.cos(ang), 0) if False else (a * math.sin(ang) * -1 * 0 + -a * math.sin(ang) * 0, a, 0)
        M.bake_path(tr['root'], f0, f1, rot=lambda t, ph=ph: (0, gust(t) * (12 + 4 * math.sin(t * 9 + ph)), math.degrees(ang)))
        M.bake_path(tr['top'], f0, f1, rot=lambda t, ph=ph: (0, gust(t) * (16 + 7 * math.sin(t * 11 + ph)), 0))


def leaves(n, center, f0, f1, wind=(9, 0, 0), seed=4, gust=None):
    """Small leaf cards blown across the frame on noisy paths."""
    lm = M.pbr('r1_leafcard', '#5d7a22', rough=0.6, noise=0.5)
    lm2 = M.pbr('r1_leafcard2', '#9a7a20', rough=0.6, noise=0.5)
    r = random.Random(seed); obs = []
    base = mesh('leafbase', [(-0.09, -0.05, 0), (0.09, -0.05, 0), (0.1, 0.05, 0), (-0.07, 0.06, 0)], [(0, 1, 2, 3)], lm)
    base.hide_render = True
    for i in range(n):
        ob = bpy.data.objects.new(f'leaf{i}', base.data); bpy.context.scene.collection.objects.link(ob)
        ob.material_slots[0].link = 'OBJECT'; ob.material_slots[0].material = lm if r.random() < 0.6 else lm2
        p0 = Vector(center) + Vector((r.uniform(-30, 5), r.uniform(-10, 10), r.uniform(0.3, 8)))
        sp = r.uniform(0.6, 1.3); ph = [r.uniform(0, 9) for _ in range(6)]
        def pos(t, p0=p0, sp=sp, ph=ph):
            tt = t - T(f0)
            return (p0.x + wind[0] * sp * tt + math.sin(tt * 3 + ph[0]) * 0.6, p0.y + wind[1] * sp * tt + math.sin(tt * 2.3 + ph[1]) * 0.8,
                    p0.z + wind[2] * tt + math.sin(tt * 4.1 + ph[2]) * 0.5)
        M.bake_path(ob, f0, f1, pos=pos, rot=lambda t, ph=ph: (t * 400 + ph[3] * 40, t * 300 + ph[4] * 40, t * 200))
        obs.append(ob)
    return obs


# ---------------------------------------------------------------- water + weather materials
def rain_mat(name='r1_rain', strength=0.9, alpha=0.32):
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'BLENDED'
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = (0.78, 0.84, 0.92, 1); em.inputs[1].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = alpha
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def puddle_mat(name='r1_puddle', color='#1a2229', sheen='#5c6a7a', sheen_k=0.3, alpha=0.78):
    """Standing water without ray tracing: a dark see-through film (the wet surface shows through) whose rim and
    grazing angles light up with a sky-coloured sheen (fake fresnel reflection), rippled by raindrop noise."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'BLENDED'
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = cz.col(color)
    p.inputs['Roughness'].default_value = 0.03; p.inputs['Specular IOR Level'].default_value = 1.0
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 9; nz.inputs['Detail'].default_value = 4
    nt.links.new(tc.outputs['Object'], nz.inputs[0])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.12
    nt.links.new(nz.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.25; nt.links.new(b.outputs[0], lw.inputs['Normal'])
    sh = nt.nodes.new('ShaderNodeMapRange'); sh.inputs[1].default_value = 0.0; sh.inputs[2].default_value = 1.0
    sh.inputs[3].default_value = 0.35; sh.inputs[4].default_value = 1.0
    nt.links.new(lw.outputs['Facing'], sh.inputs[0])
    em = nt.nodes.new('ShaderNodeMath'); em.operation = 'MULTIPLY'; em.inputs[1].default_value = sheen_k
    nt.links.new(sh.outputs[0], em.inputs[0])
    p.inputs['Emission Color'].default_value = cz.col(sheen); nt.links.new(em.outputs[0], p.inputs['Emission Strength'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = alpha
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(p.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def flow_mat(name, f0, f1, speed=3.0, axis='Z', color=(0.75, 0.85, 0.95), alpha=0.55, stretch=(60, 60, 1.5), sign=1, strength=0.35, mud=False, streak=False):
    """Flowing water: streaky noise in object coords that scrolls along `axis` (keyed offset) - a pouring curtain or a
    sheet running down the roof. Glossy + a little emission so it reads in shadow."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'BLENDED'
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    sc = {'X': (stretch[2], stretch[0], stretch[1]), 'Y': (stretch[0], stretch[2], stretch[1]), 'Z': stretch}[axis]
    mp.inputs['Scale'].default_value = sc
    nt.links.new(tc.outputs['Object'], mp.inputs[0])
    idx = 'XYZ'.index(axis)
    for f in (f0 - 2, f1 + 2):
        v = [0, 0, 0]; v[idx] = sign * speed * (f - f0) / FPS
        mp.inputs['Location'].default_value = v; mp.inputs['Location'].keyframe_insert('default_value', frame=f)
    try:
        for fc in m.node_tree.animation_data.action.fcurves:
            for k in fc.keyframe_points: k.interpolation = 'LINEAR'
    except Exception:
        try:
            for lay in m.node_tree.animation_data.action.layers:
                for st in lay.strips:
                    for cb in st.channelbags:
                        for fc in cb.fcurves:
                            for k in fc.keyframe_points: k.interpolation = 'LINEAR'
        except Exception as e: print('CZ flow linear', e)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = 4
    nt.links.new(mp.outputs[0], nz.inputs[0])
    cr = nt.nodes.new('ShaderNodeMapRange'); cr.inputs[1].default_value = 0.52 if streak else 0.42; cr.inputs[2].default_value = 0.64 if streak else 0.7
    nt.links.new(nz.outputs['Fac'], cr.inputs[0])
    a = nt.nodes.new('ShaderNodeMath'); a.operation = 'MULTIPLY_ADD'; a.inputs[1].default_value = alpha; a.inputs[2].default_value = alpha * (0.06 if streak else 0.35)
    nt.links.new(cr.outputs[0], a.inputs[0])
    g = nt.nodes.new('ShaderNodeValue'); g.name = 'gate'; g.outputs[0].default_value = 1.0
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; nt.links.new(a.outputs[0], mul.inputs[0]); nt.links.new(g.outputs[0], mul.inputs[1])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.05
    col = (0.25, 0.17, 0.1) if mud else color
    p.inputs['Base Color'].default_value = (*col, 1)
    p.inputs['Emission Color'].default_value = (*col, 1); p.inputs['Emission Strength'].default_value = strength
    p.inputs['Specular IOR Level'].default_value = 1.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mul.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(p.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def gate_keys(mat, keys):
    g = mat.node_tree.nodes['gate']
    for t, v in keys:
        g.outputs[0].default_value = v; g.outputs[0].keyframe_insert('default_value', frame=round(t * FPS) + 1)


# ---------------------------------------------------------------- rain / splashes / puddles / drips
def rain(name, center, size, f0, f1, n=4000, speed=11.0, wind=(0.0, 0.0), length=0.55, top=12.0, seed=1, width=0.006, mat=None, hole=None):
    """Thin stretched streak cards (crossed pairs) in one tall column that falls the whole shot - no wrap pops.
    wind=(vx, vy) m/s tilts the streaks and drifts the column."""
    rng = np.random.default_rng(seed)
    dur = (f1 - f0 + 4) / FPS
    hz = top + speed * dur
    cx, cy, cz0 = center
    ex = abs(wind[0]) * dur; ey = abs(wind[1]) * dur
    X = rng.uniform(-size[0] / 2 - ex, size[0] / 2 + ex, n); Y = rng.uniform(-size[1] / 2 - ey, size[1] / 2 + ey, n)
    Z = rng.uniform(0, hz, n)
    dv = np.array([wind[0], wind[1], -speed]); dv = dv / np.linalg.norm(dv)
    L = length * rng.uniform(0.6, 1.3, n)
    verts, faces = [], []
    for i in range(n):
        if hole and hole[0] < X[i] + cx < hole[1] and hole[2] < Y[i] + cy < hole[3]: continue
        p = np.array([X[i], Y[i], Z[i]]); q = p + dv * L[i]
        k = len(verts)
        verts += [p + (width, 0, 0), p - (width, 0, 0), q - (width, 0, 0), q + (width, 0, 0),
                  p + (0, width, 0), p - (0, width, 0), q - (0, width, 0), q + (0, width, 0)]
        faces += [(k, k + 1, k + 2, k + 3), (k + 4, k + 5, k + 6, k + 7)]
    ob = mesh(name, verts, faces, mat or rain_mat())
    no_shadow(ob)
    t0 = T(f0)
    # start with the column's bottom at the ground (cz0) - the falling column spans exactly the visible height
    M.bake_path(ob, f0, f1, pos=lambda t: (cx - size[0] * 0 + wind[0] * (t - t0) - wind[0] * dur / 2,
                                           cy + wind[1] * (t - t0) - wind[1] * dur / 2, cz0 - speed * (t - t0)))
    return ob


_CROWN = {}


def crown_mesh(mat):
    if 'me' in _CROWN: return _CROWN['me']
    verts, faces = [], []
    for k in range(16):
        a = k * 2 * math.pi / 9
        c, s = math.cos(a), math.sin(a)
        b = Vector((c * 0.03, s * 0.03, 0)); tp = Vector((c * 0.07, s * 0.07, 0.07))
        side = Vector((-s, c, 0)) * 0.006
        i = len(verts); verts += [b - side, b + side, tp + side * 0.4, tp - side * 0.4]; faces.append((i, i + 1, i + 2, i + 3))
    # ring
    i0 = len(verts)
    for k in range(16):
        a = k * 2 * math.pi / 16
        verts += [(math.cos(a) * 0.035, math.sin(a) * 0.035, 0.002), (math.cos(a) * 0.05, math.sin(a) * 0.05, 0.002)]
    for k in range(16):
        j = (k + 1) % 16; faces.append((i0 + 2 * k, i0 + 2 * j, i0 + 2 * j + 1, i0 + 2 * k + 1))
    ob = mesh('crown_src', verts, faces, mat); ob.hide_render = True; ob.hide_viewport = True
    _CROWN['me'] = ob.data
    return ob.data


def splashes(name, sampler, f0, f1, n=80, life=5, size=1.0, seed=2, mat=None, rate=None, f_on=None):
    """n splash slots; each pops a little crown at sampler(rng)->(x,y,z) every `life` frames at a random phase.
    Relocation happens while the crown is scaled to 0 (no blur trail)."""
    mat = mat or rain_mat('r1_splash', strength=1.0, alpha=0.38)
    me = crown_mesh(mat)
    r = random.Random(seed); obs = []
    for i in range(n):
        ob = bpy.data.objects.new(f'{name}{i}', me); bpy.context.scene.collection.objects.link(ob); no_shadow(ob)
        ph = r.randrange(life + 2); per = life + r.randrange(3)
        pts = {}
        for f in range(f0 - 1, f1 + 2):
            cyc = (f - f0 + ph) // per; k = ((f - f0 + ph) % per) / per
            if cyc not in pts:
                rr = random.Random(seed * 1000 + i * 97 + cyc); pts[cyc] = (sampler(rr), rr.uniform(0.6, 1.3))
            p, s = pts[cyc]
            sc = size * s * (math.sin(k * math.pi) ** 0.6) * (0.4 + k) if (f_on is None or f >= f_on) else 0.0
            ob.location = p; ob.keyframe_insert('location', frame=f)
            ob.scale = (sc, sc, sc * (1.2 - k * 0.6)); ob.keyframe_insert('scale', frame=f)
            # constant interpolation for location so relocation is a jump at scale ~0
        ad = ob.animation_data
        try:
            fcs = ad.action.fcurves
        except Exception:
            fcs = [fc for lay in ad.action.layers for st in lay.strips for cb in st.channelbags for fc in cb.fcurves]
        for fc in fcs:
            for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT' if fc.data_path == 'location' else 'LINEAR'
        obs.append(ob)
    return obs


def blob(name, r, seed=1, n=10):
    """An irregular puddle outline disc (unit scale = r)."""
    rr = random.Random(seed); verts = [(0, 0, 0)]
    pts = 40; ph = [rr.uniform(0, 6) for _ in range(4)]
    for k in range(pts):
        a = k * 2 * math.pi / pts
        d = r * (1 + 0.22 * math.sin(3 * a + ph[0]) + 0.12 * math.sin(5 * a + ph[1]) + 0.07 * math.sin(9 * a + ph[2]))
        verts.append((d * math.cos(a), d * math.sin(a), 0))
    faces = [(0, k + 1, (k + 1) % pts + 1) for k in range(pts)]
    return verts, faces


def puddles(name, spots, f0, f1, z, mat=None, parent=None, grow=None):
    """spots [(x, y, r, t_start, t_full)]: glossy dark water blobs that spread from nothing."""
    mat = mat or puddle_mat()
    obs = []
    for i, (x, y, r, a, b) in enumerate(spots):
        v, fcs = blob(f'{name}{i}', r, seed=i + 3)
        ob = mesh(f'{name}{i}', v, fcs, mat, loc=(x, y, z), parent=parent)
        M.bake_path(ob, f0, f1, scale=lambda t, a=a, b=b: (max(0.001, ss((t - a) / (b - a))), max(0.001, ss((t - a) / (b - a))) * 0.9, 1))
        obs.append(ob)
    return obs


def drop_mat(name='r1_dropglass'):
    """A falling water drop without ray tracing: mostly see-through, glossy blue-white rim (fresnel) and a sun highlight."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'BLENDED'
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = (0.2, 0.34, 0.5, 1)
    p.inputs['Roughness'].default_value = 0.03; p.inputs['Specular IOR Level'].default_value = 1.0
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.5
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs[3].default_value = 0.05; mr.inputs[4].default_value = 0.6
    nt.links.new(lw.outputs['Fresnel'], mr.inputs[0])
    p.inputs['Emission Color'].default_value = (0.75, 0.86, 1.0, 1)
    em = nt.nodes.new('ShaderNodeMath'); em.operation = 'MULTIPLY'; em.inputs[1].default_value = 0.35
    nt.links.new(lw.outputs['Fresnel'], em.inputs[0]); nt.links.new(em.outputs[0], p.inputs['Emission Strength'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mr.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(p.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def drop_mesh(mat):
    ob = cz.sphere('drop_src', 1.0, (0, 0, -100), mat, ol=0, segs=10, rings=6)
    ob.data.transform(Matrix.Diagonal((0.022, 0.022, 0.045, 1.0)))     # bake the drop size into the mesh
    ob.hide_render = True
    return ob.data


def drips(name, sources, z_floor, f0, f1, mat, every=(10, 22), seed=3, g=9.8, splash_n=0):
    """Drops that form under each source point (x, y, z) and fall with gravity to z_floor, repeating."""
    me = drop_mesh(mat)
    r = random.Random(seed); obs = []; hits = []
    for i, (x, y, z) in enumerate(sources):
        f = f0 - r.randrange(every[1])
        while f < f1:
            fall = math.sqrt(2 * (z - z_floor) / g) * FPS
            ob = bpy.data.objects.new(f'{name}{len(obs)}', me); bpy.context.scene.collection.objects.link(ob); no_shadow(ob)
            hang = r.randrange(6, 12)
            fs, fe = f + hang, f + hang + fall
            for ff in range(max(f0 - 1, f), min(f1 + 2, int(fe) + 2)):
                if ff < fs: zz = z - 0.03; sc = max(0.0, min(1.0, (ff - f) / hang))
                else:
                    tt = (ff - fs) / FPS; zz = z - 0.03 - 0.5 * g * tt * tt; sc = 1.0
                vis = ff < fe
                ob.location = (x, y, max(z_floor, zz)); ob.keyframe_insert('location', frame=ff)
                s = max(0.001, sc) if vis else 0.001
                ob.scale = (s, s, s * (1 + (0.8 if ff >= fs else 0))); ob.keyframe_insert('scale', frame=ff)
            hits.append(((x, y, z_floor), fe))
            obs.append(ob)
            f += r.randrange(*every)
    return obs, hits


def splash_at(name, hits, f0, f1, mat, size=1.2):
    """A crown on each (point, frame) hit."""
    me = crown_mesh(mat); obs = []
    for i, (p, fh) in enumerate(hits):
        fh = int(fh)
        if fh > f1 or fh < f0 - 6: continue
        ob = bpy.data.objects.new(f'{name}{i}', me); bpy.context.scene.collection.objects.link(ob); no_shadow(ob)
        ob.location = p
        for ff in range(max(f0 - 1, fh - 1), min(f1 + 2, fh + 8)):
            k = (ff - fh) / 7
            s = 0.001 if k < 0 or k > 1 else size * (0.4 + k) * math.sin(k * math.pi) ** 0.5
            ob.scale = (s, s, s * (1.3 - k)); ob.keyframe_insert('scale', frame=ff)
        if fh - 1 > f0: ob.scale = (0.001,) * 3; ob.keyframe_insert('scale', frame=f0 - 1)
        obs.append(ob)
    return obs


# ---------------------------------------------------------------- curtains (water pouring off an edge)
def curtain(name, p0, p1, v0, f0, f1, mat, drop=3.0, n=26, seed=4, g=9.8, width=0.05, thick=0.9):
    """Ribbons of falling water from the edge p0-p1: each ribbon follows the ballistic arc from the edge with
    horizontal speed v0 (vector), down `drop` metres. The flow texture (flow_mat, axis Z) makes them pour."""
    r = random.Random(seed); p0, p1 = Vector(p0), Vector(p1); v0 = Vector(v0)
    verts, faces = [], []
    side = (p1 - p0).normalized()
    for i in range(n):
        u = (i + r.uniform(0.1, 0.9)) / n
        o = p0.lerp(p1, u); wv = width * r.uniform(0.5, 1.6) * thick
        vv = v0 * r.uniform(0.7, 1.2)
        steps = 14; k0 = len(verts)
        tmax = math.sqrt(2 * drop / g)
        for s in range(steps + 1):
            tt = tmax * s / steps
            c = o + vv * tt + Vector((0, 0, -0.5 * g * tt * tt))
            w = wv * (1 + 1.5 * s / steps)
            verts += [c - side * w, c + side * w]
        for s in range(steps):
            a = k0 + 2 * s; faces.append((a, a + 1, a + 3, a + 2))
    ob = mesh(name, verts, faces, mat); no_shadow(ob)
    return ob


# ---------------------------------------------------------------- x-ray overlays
def xray_over(objs, mat, grow=1.02, name='xr'):
    """Linked-data copies of objs with the x-ray material per object, parented to each original (follows its
    animation), a hair bigger so it sits over the surface."""
    out = []
    for o in objs:
        if o is None or o.type != 'MESH': continue
        c = bpy.data.objects.new(f'{name}_{o.name}', o.data); bpy.context.scene.collection.objects.link(c)
        for sl in c.material_slots: sl.link = 'OBJECT'; sl.material = mat
        if not c.material_slots:
            c.data.materials.append(mat)
        c.parent = o; c.matrix_parent_inverse = Matrix.Identity(4)
        c.scale = (grow, grow, grow); no_shadow(c)
        out.append(c)
    return out


def pulse(t0, up=0.12, hold=0.5, down=0.4, peak=1.0, base=0.0):
    """x-ray keys: rise on the word at t0, hold, ease out."""
    return [(t0 - up, base), (t0, peak), (t0 + hold, peak * 0.85), (t0 + hold + down, base)]


# ---------------------------------------------------------------- shingles
def shingle_row_spec(s, i, n=16, ns=22):
    """Per house.py: list of (loc, size, rot_deg) for row i (0 = bottom) on slope s (-1 front, +1 back)."""
    k = 1 - (i + 0.5) / n
    y = s * (k * (D / 2 + OVER + 0.1))
    z = WALL + RISE - k * (D / 2 + OVER + 0.1) * math.tan(math.radians(PITCH)) + 0.22
    ang = math.radians(PITCH) * -s
    out = []
    for j in range(ns):
        x = -W / 2 - OVER + (j + 0.5 + 0.5 * (i % 2)) * (W + 2 * OVER) / ns
        if x > W / 2 + OVER: continue
        out.append(((x, y, z), ((W + 2 * OVER) / ns - 0.015, SLOPE_LEN / n * 1.6, 0.025), (math.degrees(ang) + s * 3, 0, 0)))
    return out


def slope_basis(s=-1):
    """Unit vectors on slope s: down-slope (toward the eave), across (x), and the outward normal."""
    a = math.radians(PITCH)
    down = Vector((0, s * math.cos(a), -math.sin(a)))
    nrm = Vector((0, s * math.sin(a), math.cos(a)))
    return down, Vector((1, 0, 0)), nrm


def slope_point(s, u, x, lift=0.0):
    """Point on the deck top of slope s at fraction u from ridge (0) to eave (1), across x."""
    a = math.radians(PITCH)
    y = s * u * (D / 2 + OVER)
    z = WALL + RISE - u * (D / 2 + OVER) * math.tan(a) + 0.185
    return Vector((x, y, z)) + slope_basis(s)[2] * lift


# ---------------------------------------------------------------- fish flank (the match cut)
def fish_flank(name, center, rot, rows=16, cols=26, pitch_r=0.34, pitch_c=0.4, s=-1):
    """Overlapping fish scales on a gently bulging surface, laid out like the shingle rows (bottom row first, each
    row lapped over the one below). Silver -> blue-grey back, lateral line, an iridescent sheen."""
    m, n = _mat('r1_fishscale')
    if n:
        nt, o = n
        p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Metallic'].default_value = 0.85; p.inputs['Roughness'].default_value = 0.18
        tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['Object'], sep.inputs[0])
        cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].position = 0.0; cr.color_ramp.elements[1].position = 1.0
        cr.color_ramp.elements[0].color = (0.82, 0.86, 0.88, 1); cr.color_ramp.elements[1].color = (0.12, 0.2, 0.26, 1)
        e = cr.color_ramp.elements.new(0.55); e.color = (0.55, 0.62, 0.6, 1)
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs[1].default_value = -2.6; mr.inputs[2].default_value = 2.6
        nt.links.new(sep.outputs[1], mr.inputs[0]); nt.links.new(mr.outputs[0], cr.inputs[0])
        lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.4
        ir = nt.nodes.new('ShaderNodeValToRGB'); ir.color_ramp.elements[0].color = (1, 0.85, 0.95, 1); ir.color_ramp.elements[1].color = (0.55, 1.0, 0.9, 1)
        nt.links.new(lw.outputs['Facing'], ir.inputs[0])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 0.6
        nt.links.new(cr.outputs[0], mx.inputs[6]); nt.links.new(ir.outputs[0], mx.inputs[7])
        nt.links.new(mx.outputs[2], p.inputs['Base Color']); nt.links.new(p.outputs[0], o.inputs[0])
    root = cz.empty(name, center); root.rotation_euler = [math.radians(a) for a in rot]
    verts, faces = [], []
    # one scale: a half-disc cupped plate pointing down-slope (local -y), rows stack upward (+y), each over the lower
    segs = 10
    for i in range(rows):
        for j in range(cols):
            cx = (j - cols / 2 + 0.5 * (i % 2)) * pitch_c; cy = (i - rows / 2) * pitch_r
            bulge = 0.25 * math.cos(cy / (rows * pitch_r) * math.pi) - 0.0
            k0 = len(verts)
            rr = pitch_c * 0.62
            verts.append((cx, cy + rr * 0.35, bulge + 0.02 * i * 0 + 0.0))
            for k in range(segs + 1):
                a = math.pi + k * math.pi / segs          # lower half-circle
                px = cx + rr * math.cos(a); py = cy + rr * 0.95 * math.sin(a)
                lift = 0.035 + 0.03 * (1 - abs(math.cos(a)))
                verts.append((px, py, bulge + lift))
            verts.append((cx + rr, cy + rr * 0.35, bulge)); verts.append((cx - rr, cy + rr * 0.35, bulge))
            for k in range(segs):
                faces.append((k0, k0 + 1 + k, k0 + 2 + k))
    # a backing so no gaps show
    bw, bh = cols * pitch_c * 0.6, rows * pitch_r * 0.6
    m = M.pbr('r1_fishtex', '#8a9aa8', rough=0.22, metal=0.55, img=TEX('r1_fish.png'), scale=0.21, spec=0.8)
    ob = mesh(name + '_scales', verts, faces, m, parent=root, smooth=True)
    back = cz.box(name + '_skin', (cols * pitch_c + 1, rows * pitch_r + 1, 0.05), (0, 0, 0.12), M.pbr('r1_fishskin', '#8a9aa8', rough=0.22, metal=0.55, img=TEX('r1_fish.png'), scale=0.21), bevel=0, ol=0, parent=root)
    return dict(root=root, scales=ob, parts=[ob, back])


# ---------------------------------------------------------------- membrane roll
def membrane_roll(name, s, f0, f1, t_a, t_b, mat, x0=-W / 2 - OVER, x1=W / 2 + OVER, lift=0.03):
    """A dark sheet unrolling from the ridge to the eave on slope s between t_a and t_b, with the shrinking roll at
    its leading edge. Returns dict(sheet, roll, pivot)."""
    down, across, nrm = slope_basis(s)
    piv = cz.empty(name + '_piv', slope_point(s, 0.0, 0, lift))
    piv.rotation_euler = Matrix((across, -down if False else down, nrm)).transposed().to_euler() if False else (0, 0, 0)
    # orient: local +y = down-slope, local z = normal
    Mx = Matrix((-across, down, nrm)).transposed()     # right-handed: (-x) x down = normal
    piv.rotation_euler = Mx.to_euler()
    L = SLOPE_LEN + 0.05
    sheet = mesh(name + '_sheet', [(x0, 0, 0), (x1, 0, 0), (x1, 1, 0), (x0, 1, 0)], [(0, 1, 2, 3)], mat, parent=piv)
    bev = sheet.modifiers.new('solid', 'SOLIDIFY'); bev.thickness = 0.008
    roll = cz.cyl(name + '_roll', 0.2, x1 - x0, (x0, 0, 0), M.pbr('r1_rollmat', '#1c1d22', rough=0.16, spec=0.8, bump=0.15, bump_scale=30), rot=(0, 90, 0), verts=48, ol=0, parent=piv)
    core = cz.cyl(name + '_core', 0.06, x1 - x0 + 0.06, (0, 0, -0.03), M.pbr('r1_core', '#a88a5a', rough=0.7), verts=16, ol=0, parent=roll)
    def frac(t): return ss((t - t_a) / (t_b - t_a))
    M.bake_path(sheet, f0, f1, scale=lambda t: (1, max(0.002, frac(t) * L), 1))
    def rpos(t):
        k = frac(t); r = 0.08 + 0.37 * (1 - k)
        return (x0, k * L, r)
    def rsc(t):
        k = frac(t); r = 0.08 + 0.37 * (1 - k)
        return (r / 0.2, r / 0.2, 1)
    M.bake_path(roll, f0, f1, pos=rpos, scale=rsc)
    rim = M.xray(name + '_rim', alpha=0.12, strength=1.6)
    xray_over([roll], rim, grow=1.06, name=name + 'xr')
    return dict(sheet=sheet, roll=roll, pivot=piv)


# ---------------------------------------------------------------- the trench along the front wall
def trench(name, f0, f1, t_a, t_b, x0=-W / 2 - 0.6, x1=W / 2 + 0.6, y_mid=-D / 2 - 0.75, half=0.7, depth=0.6, seed=6):
    """Ground strip in front of the wall that erodes into a muddy trench (shape key 'dug' 0 -> 1), with a muddy water
    stream rising in the bottom. The hill must have this rectangle removed (ground(trench=...))."""
    rng = random.Random(seed)
    nx, ny = 90, 22
    y0, y1 = y_mid - half - 0.25, y_mid + half + 0.25
    y0, y1 = y0 - 1.0, y1 + 1.0; nx, ny = 110, 34
    xs = np.linspace(x0 - 1.0, x1 + 1.0, nx); ys = np.linspace(y0, y1, ny)
    verts = [(x, y, 0.004) for y in ys for x in xs]
    faces = [(j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i) for j in range(ny - 1) for i in range(nx - 1)]
    mud = M.pbr('r1_mud', '#5a3a20', rough=0.78, bump=1.6, bump_scale=7, noise=0.7, spec=0.22)
    turf = H.mats()['grass'] if False else bpy.data.materials.get('r1_grassm')
    ob = mesh(name, verts, faces, turf, smooth=True)
    ob.data.materials.append(mud)
    # material: mud where the dug depth is large -> assign per face by distance from the centre line
    for p in ob.data.polygons:
        c = p.center
        p.material_index = 1 if abs(c.y - y_mid) < half * 1.05 else 0
    dm = ob.modifiers.new('lumps', 'DISPLACE'); tx = bpy.data.textures.new(name + '_lumps', 'CLOUDS'); tx.noise_scale = 0.18; dm.texture = tx; dm.strength = 0.09; dm.mid_level = 0.5
    ob.shape_key_add(name='Basis')
    sk = ob.shape_key_add(name='dug')
    for k, v in enumerate(sk.data):
        x, y, _ = verts[k]
        d = abs(y - y_mid) / half
        taper = ss(min(x - x0, x1 - x) / 0.8) if x0 < x < x1 else 0.0
        prof = max(0.0, 1 - d * d) * depth * taper * (0.8 + 0.25 * math.sin(x * 2.1) + 0.12 * math.sin(x * 7.3 + 1))
        rim = 0.08 * math.exp(-((d - 1.15) ** 2) / 0.03) * (0.6 + 0.4 * math.sin(x * 5.0))
        v.co = (x, y, -prof + rim * taper)
    for f in range(f0 - 1, f1 + 2):
        sk.value = ss((T(f) - t_a) / (t_b - t_a)); sk.keyframe_insert('value', frame=f)
    # muddy water in the bottom
    wm = flow_mat('r1_mudflow', f0, f1, speed=1.2, axis='X', alpha=0.95, stretch=(4, 18, 1.0), mud=True, strength=0.3)
    wat = mesh(name + '_water', [(x0 + 0.9, y_mid - 0.25, 0), (x1 - 0.9, y_mid - 0.25, 0), (x1 - 0.9, y_mid + 0.25, 0), (x0 + 0.9, y_mid + 0.25, 0)], [(0, 1, 2, 3)], wm)
    M.bake_path(wat, f0, f1, pos=lambda t: (0, 0, -depth * 0.85 * ss((t - t_a) / (t_b - t_a)) + 0.12 * ss((t - t_a - 0.4) / (t_b - t_a))),
                scale=lambda t: (1, 0.2 + 1.6 * ss((t - t_a) / (t_b - t_a)), 1))
    # clods of mud flung out
    clods = []
    for i in range(40):
        x = rng.uniform(x0 + 0.3, x1 - 0.3); s = rng.uniform(0.03, 0.09)
        side = rng.choice((-1, 1)); y = y_mid + side * half * rng.uniform(1.0, 1.6)
        c = cz.sphere(f'{name}_clod{i}', 1.0, (x, y, 0.0), mud, scale=(s, s * 0.8, s * 0.6), ol=0, segs=8, rings=5)
        ta = rng.uniform(t_a, t_b)
        M.bake_path(c, f0, f1, scale=lambda t, ta=ta, s=s: tuple(max(0.001, v * ss((t - ta) / 0.3)) for v in (s, s * 0.8, s * 0.6)))
        clods.append(c)
    return dict(ground=ob, water=wat, clods=clods, y_mid=y_mid)


# ---------------------------------------------------------------- camera with whips


def dress(hs, mt, stage, sunny=True, seed=11):
    """Round 3 enrich elements (from the enriched r01 / r09 targets): dressed stone lintels + door step, timber barge
    boards on the gable rakes, bushes along the walls, fair-weather cloud cards in the sky."""
    r = random.Random(seed)
    lint = M.pbr('r1_lintel', '#b8ae9c', rough=0.8, bump=0.4, bump_scale=12, noise=0.3)
    obs = []
    for y, xs in ((-D / 2 + H.T / 2, (-2.2, 0.0, 2.2)), (D / 2 - H.T / 2, (-2.0, 2.0))):
        for x in xs:
            zt = 2.15 if abs(x) < 0.1 and y < 0 else 2.1
            obs.append(cz.box(f'lint{x}{y}', (1.35, H.T + 0.06, 0.16), (x, y, zt + 0.08), lint, bevel=0.015, ol=0))
    obs.append(cz.box('step', (1.4, 0.5, 0.14), (0, -D / 2 - 0.22, 0.07), lint, bevel=0.02, ol=0))
    M.join('lintels', obs)
    # chunky timber window frames + sills on the outside faces, a planked door (enriched r02 / r07 / r10 / r11)
    fr = M.pbr('r1_frame', '#7a5636', rough=0.55, img=TEX('r1_wood.png'), scale=1.6, tint='#6a4c34', bump=0.2, bump_scale=40)
    fo = []
    wins = [(x, -D / 2 - 0.02, 'x', 1.1, 1.0, 2.1) for x in (-2.2, 2.2)] + [(x, D / 2 + 0.02, 'x', 1.1, 1.0, 2.1) for x in (-2.0, 2.0)] \
        + [(-W / 2 - 0.02, 0.0, 'y', 1.0, 1.0, 2.0)]
    for (u, v, ax, w, z0, z1) in wins:
        def bx(nm, sx, sz, du, z):
            size = (sx, 0.09, sz) if ax == 'x' else (0.09, sx, sz)
            loc = (u + du, v, z) if ax == 'x' else (u, v + du, z)
            fo.append(cz.box(nm, size, loc, fr, bevel=0.012, ol=0))
        k = f'{u:.1f}{v:.1f}'
        bx('wt' + k, w + 0.16, 0.09, 0, z1 + 0.04); bx('wb' + k, w + 0.24, 0.07, 0, z0 - 0.02)
        bx('wl' + k, 0.09, z1 - z0 + 0.1, -w / 2 - 0.04, (z0 + z1) / 2); bx('wr' + k, 0.09, z1 - z0 + 0.1, w / 2 + 0.04, (z0 + z1) / 2)
        bx('wm' + k, w, 0.05, 0, (z0 + z1) / 2 + 0.1)
    for j in range(5):
        fo.append(cz.box(f'plank{j}', (0.012, 0.02, 2.05), (-0.4 + j * 0.2, -D / 2 - 0.1, 1.05), mt['wood_dark'], bevel=0, ol=0))
    fo.append(cz.box('doorframe_t', (1.18, 0.1, 0.1), (0, -D / 2 - 0.03, 2.2), fr, bevel=0.012, ol=0))
    for sx in (-0.55, 0.55): fo.append(cz.box(f'doorframe{sx}', (0.09, 0.1, 2.2), (sx, -D / 2 - 0.03, 1.1), fr, bevel=0.012, ol=0))
    # board shutters beside the front windows (enriched r12)
    sh_m = M.pbr('r1_shutter', '#5a4632', rough=0.6, img=TEX('r1_wood.png'), scale=1.4, tint='#6a5038')
    for x in (-2.2, 2.2):
        for sx in (-1, 1):
            fo.append(cz.box(f'shut{x}{sx}', (0.5, 0.05, 1.2), (x + sx * 0.92, -D / 2 - 0.05, 1.55), sh_m, bevel=0.01, ol=0))
    M.join('frames', fo)
    # ground debris along the walls: stones, twigs, weeds
    deb = []
    twig = M.pbr('r1_twig', '#5a4430', rough=0.8, noise=0.4)
    peb = M.pbr('r1_pebble2', '#7a746a', rough=0.75, noise=0.5, bump=0.6)
    for i in range(70):
        side = r.choice((-1, 1)); along = r.uniform(-5.2, 5.2)
        if r.random() < 0.5: x, y = along, side * (D / 2 + r.uniform(0.15, 1.6))
        else: x, y = side * (W / 2 + r.uniform(0.15, 1.6)), along * 0.7
        if r.random() < 0.6:
            s = r.uniform(0.03, 0.09)
            o = cz.sphere(f'deb{i}', 1.0, (x, y, s * 0.3), peb, scale=(s * 1.3, s, s * 0.6), ol=0, segs=8, rings=5)
        else:
            o = cz.cyl(f'deb{i}', 0.008, r.uniform(0.15, 0.45), (x, y, 0.01), twig, rot=(90, 0, r.uniform(0, 180)), verts=6, ol=0)
        deb.append(o)
    M.join('debris', deb)
    # a few dark conifers on the far slopes (enriched r12)
    con = M.pbr('r1_conifer', '#1f3a1c', rough=0.7, img=TEX('r1_leaves.png'), scale=1.2, tint='#6a8a60', bump=0.5)
    cn = []
    for i in range(18):
        a = r.uniform(0, 6.283); d = r.uniform(32, 70); x, y = d * math.cos(a), d * math.sin(a); hh = r.uniform(6, 11)
        for k in range(3):
            cn.append(cz.cyl(f'con{i}_{k}', hh * (0.22 - 0.06 * k), hh * 0.45, (x, y, hh * 0.25 * k - 0.3), con, r2=0.02, verts=10, ol=0))
    M.join('conifers', cn)
    if stage in ('gable', 'shingles', 'full'):
        bb = mt['wood_dark']
        for x in (-W / 2 - OVER - 0.02, W / 2 + OVER + 0.02):
            for s in (-1, 1):
                a = slope_point(s, 0.0, x, 0.06); b = slope_point(s, 1.0, x, 0.06)
                c = (a + b) / 2; L = (b - a).length
                cz.box(f'barge{x}{s}', (0.05, L, 0.24), tuple(c), bb, rot=(H.PITCH * -s, 0, 0), bevel=0.01, ol=0)
    bush = M.pbr('r1_bush', '#33602a', rough=0.6, img=TEX('r1_leaves.png'), scale=0.8, bump=0.6, bump_scale=16, tint='#b0c8a0')
    for mm in (bush, _TREE_MATS.get('leaf')):
        if mm:
            try: mm.surface_render_method = 'DITHERED'
            except Exception: pass
    bs = []
    for i in range(14):
        side = r.choice((-1, 1)); x = r.uniform(-3.6, 3.6)
        if abs(x) < 0.9 and side < 0: continue
        y = side * (D / 2 + 0.45 + r.uniform(0, 0.3)); s = r.uniform(0.28, 0.5)
        b = cz.sphere(f'bush{i}', 1.0, (x, y, s * 0.55), bush, scale=(s * 1.3, s, s * 0.8), ol=0, segs=16, rings=10)
        M.displace(b, strength=0.12, scale=0.6); bake_mods(b); bs.append(b)
    if sunny:
        cm = M.cloud_mat('r1_cloud', TEX('clouds.png'), strength=1.4)
        for i in range(9):
            a = r.uniform(0, 6.283); d = r.uniform(140, 260)
            p = cz.plane(f'cloudc{i}', r.uniform(90, 160), r.uniform(30, 50), (d * math.cos(a), d * math.sin(a), r.uniform(35, 70)), cm, rot=(90, 0, math.degrees(a) + 90))
            no_shadow(p)


def _turn(eye, tgt, yaw, dip):
    """Target rotated about the eye: yaw degrees around world Z, then tipped down by dip degrees."""
    d = Vector(tgt) - Vector(eye)
    d = Quaternion((0, 0, 1), math.radians(yaw)) @ d
    side = d.cross(Vector((0, 0, 1)))
    if side.length > 1e-6: d = Quaternion(side.normalized(), math.radians(-dip)) @ d
    return Vector(eye) + d


def fly(keys, f0, f1, whip_in=True, whip_out=True, n=6, deg=42, dip=8, lens_lo=18, lens_hi=35, name='cam', delay=0, **kw):
    """Round 3 camera: M.Flight v2 ONLY (time-continuous spline, smoothed). The shot's own keys are spread over
    f0+n .. f1-n; the house whip is two extra Flight keys: the entry key at f0 looks deg degrees LEFT of the first
    view (so the picture is already sliding left and settles), the exit key at f1 looks deg degrees RIGHT and dips
    (picture smears right->left and slightly up, matched across every cut). Lenses clamped to 18-35 mm."""
    K = [list(k) for k in keys]
    for k in K:
        if len(k) < 4: k.append(24)
        k[3] = max(lens_lo, min(lens_hi, k[3]))
    ta, tb = K[0][0], K[-1][0]
    a = T(f0 + n + delay) if whip_in else T(f0); b = T(f1 - n) if whip_out else T(f1)
    for k in K: k[0] = a + (k[0] - ta) / max(1e-6, tb - ta) * (b - a)
    out = []
    if whip_in:
        e0, t0 = Vector(K[0][1]), Vector(K[0][2]); v = (Vector(K[1][1]) - e0) if len(K) > 1 else Vector((0, 0, 0))
        out.append((T(f0), tuple(e0 - v * 0.08), tuple(_turn(e0, t0, deg, -dip)), K[0][3]) + tuple(K[0][4:5]))
    out += [tuple(k) for k in K]
    if whip_out:
        e1, t1 = Vector(K[-1][1]), Vector(K[-1][2]); v = (e1 - Vector(K[-2][1])) if len(K) > 1 else Vector((0, 0, 0))
        out.append((T(f1), tuple(e1 + v * 0.08), tuple(_turn(e1, t1, -deg, dip)), K[-1][3]) + tuple(K[-1][4:5]))
    fl = M.Flight(out, name=name, smooth=kw.get('smooth', 2.0))
    fl.bake(f0, f1)
    return fl.obj


def lift_rows(rows, f0, f1, t_up=None, t_down=None, h=1.6, spread=0.35, stagger=0.05, slide=11.0):
    """Exploded view of the front shingle rows: each row floats out along the slope normal (t_up=(a, b)) and/or
    drops back (t_down=(a, b)); higher rows go further (spread) so the rows fan apart."""
    down, across, nrm = slope_basis(-1)
    for i, rw in enumerate(rows):
        loc0 = rw.location.copy(); hh = h * (1 + spread * i / len(rows))
        d = stagger * i
        def off(t, d=d, hh=hh):
            k = 1.0 if t_up is None else ss((t - t_up[0] - d) / (t_up[1] - t_up[0]))
            if t_up is None and t_down is None: k = 0.0
            if t_down is not None:
                k = k * (1 - ss((t - t_down[0] - d) / (t_down[1] - t_down[0])))
            return k * hh
        def pos(t, loc0=loc0, off=off, hh=hh, i=i):
            k = off(t) / hh
            return tuple(loc0 + nrm * (hh * ss(k * 2.5)) + Vector((slide * ss((k - 0.3) / 0.7), 0, 0.15 * i * ss((k - 0.3) / 0.7))))
        M.bake_path(rw, f0, f1, pos=pos)


def board_xray(name='r1_xr_boards'):
    return M.xray(name)
