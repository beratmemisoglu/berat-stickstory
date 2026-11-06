# Builder r2's kit for shots R14-R27 (gutter, snow + cars, sag, trusses, thermal, ice dam, insulation, icicles,
# flashing, golden hero). Wraps the shared house.py (never edits it): house.build('shingles') + the parts below.
import bpy, math, os, random
import numpy as np
from mathutils import Vector
import cz, mega as M, house as H

FPS = 30
W, D, WALL, T, OVER = H.W, H.D, H.WALL, H.T, H.OVER
TANP = math.tan(math.radians(H.PITCH)); COSP = math.cos(math.radians(H.PITCH))
RISE = (D / 2) * TANP
EY = D / 2 + OVER + 0.1                      # |y| of the shingle eave edge
t = lambda f: (f - 1) / FPS                   # frame -> seconds


def surf_z(ay):
    """Top of the shingles (vertical) at |y| = ay."""
    return WALL + RISE - ay * TANP + 0.25


# ------------------------------------------------------------------ world / look
def rim(sc, color=(0.75, 0.85, 1.0), power=1.6, elev=12, rot=140):
    """Back light opposite the key sun: a rim on the house silhouette (the reference's edge highlights)."""
    ld = bpy.data.lights.new('rim', 'SUN'); ld.energy = power; ld.color = color; ld.angle = math.radians(2)
    ob = bpy.data.objects.new('rim', ld); sc.collection.objects.link(ob)
    e, r = math.radians(elev), math.radians(rot)
    d = Vector((math.sin(r) * math.cos(e), -math.cos(r) * math.cos(e), math.sin(e)))
    ob.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()


def world(F1, mode='clear'):
    if mode == 'storm':
        sc = M.setup(F1, sun_disc=False, sun_elev=18, sun_rot=320, sun_power=1.1, sky_strength=0.09, haze=2.5, sky_sat=0.5, exposure=0.35, light_k=1.6)
        try:
            sc.eevee.use_raytracing = True; sc.eevee.ray_tracing_method = 'SCREEN'
        except Exception as e: print('CZ ssr', e)
    elif mode == 'winter':
        sc = M.setup(F1, sun_elev=15, sun_rot=320, sun_power=3.4, sky_strength=0.15, exposure=-0.3, light_k=0.95)
        rim(sc)
    elif mode == 'golden':
        sc = M.setup(F1, sun_elev=4.5, sun_rot=335, sun_power=4.8, sky_strength=0.22, haze=4.5, exposure=0.05, sky_sat=0.9, light_k=0.9)
        s = bpy.data.objects.get('sun')
        if s: s.data.color = (1.0, 0.52, 0.22)
        rim(sc, color=(1.0, 0.75, 0.5), power=1.4)
    elif mode == 'thermal':
        sc = M.setup(F1, sun_disc=False, sun_elev=30, sun_rot=320, sun_power=0.0, sky_strength=0.0)
        nt = sc.world.node_tree; nt.nodes.clear()
        bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs[0].default_value = cz.col('#03040c'); bg.inputs[1].default_value = 1.0
        o = nt.nodes.new('ShaderNodeOutputWorld'); nt.links.new(bg.outputs[0], o.inputs[0])
    else:
        sc = M.setup(F1, sun_elev=17, sun_rot=320, sun_power=3.6, light_k=0.95)
        rim(sc)
    return sc


def mats(winter=False, wet=False):
    mt = H.mats()
    # the shared roof_*.png files came back shifted by one (grass file = shingles, shingle file = wood, wood file =
    # stone): r2 uses fixed copies (r2_shingle / r2_wood) and its own Flow grass (r2_grass)
    tx = lambda n: H.TEX(n) if H.has(n) else None
    mt['wood'] = M.pbr('r2_wood', '#a8774a', rough=0.6, img=tx('r2_wood.png'), scale=0.6, noise=0.3)
    mt['wood_dark'] = M.pbr('r2_wood_dark', '#6b4a30', rough=0.6, img=tx('r2_wood.png'), scale=0.6, tint='#7a5a40')
    mt['floor'] = M.pbr('r2_floor', '#7a5a3c', rough=0.5, img=tx('r2_wood.png'), scale=0.5, tint='#b08a68')
    mt['shingle'] = M.pbr('r2_shingle_m', '#4a4d52', rough=0.8, img=tx('r2_shingle.png'), scale=0.9, tint='#c8c2bc')
    mt['grass'] = M.pbr('r2_grass_m', '#4f7d32', rough=0.9, img=tx('r2_grass.png'), scale=0.3, bump=0.3, bump_scale=30)
    mt['snow'] = M.pbr('r2_snow', '#eef3ff', rough=0.55, img=H.TEX('snow.png') if H.has('snow.png') else None, scale=0.35,
                       bump=0.35, bump_scale=6, tint='#f4f7ff')
    mt['water'] = M.pbr('r2_water', '#1b4a66', rough=0.03, spec=0.9, emit='#3a8ac8', emit_strength=0.25)
    mt['rain'] = rain_mat()
    mt['ice'] = ice_mat()
    mt['red'] = M.emit('r2_red', '#e01008', 2.6)
    mt['blue'] = M.emit('r2_blue', '#5cc8ff', 5.0)
    mt['dark'] = M.pbr('r2_crack', '#120d0a', rough=0.9)
    mt['plaster'] = M.pbr('r2_plaster', '#d9d2c4', rough=0.8, noise=0.15)
    mt['bark'] = M.pbr('r2_bark', '#4a3526', rough=0.9, noise=0.3)
    mt['pine'] = M.pbr('r2_pine', '#24492a', rough=0.8, img=tx('r2_needles.png'), scale=0.9, bump=0.6, bump_scale=30, tint='#b8c8b0')
    mt['pine_snow'] = M.pbr('r2_pine_snow', '#e8eef8', rough=0.6, noise=0.2)
    if wet:      # enrich r14: rain-darkened stone and shingles with a wet sheen
        mt['stone'] = M.pbr('r2_stone_wet', '#8a847a', rough=0.35, img=H.TEX('roof_stone.png'), scale=0.45, bump=0.6, bump_scale=3, tint='#9a948c', coat=0.6)
        mt['shingle'] = M.pbr('r2_shingle_wet', '#3a3d42', rough=0.3, img=tx('r2_shingle.png'), scale=0.9, tint='#a8a29c', coat=0.8)
    if winter: mt['ground'] = mt['snow']
    else: mt['ground'] = mt['grass']
    return mt


def rain_mat():
    m, n = M._mat('r2_rain')
    if n is None: return m
    nt, o = n
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = cz.col('#cfdcec'); em.inputs[1].default_value = 1.4
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.42
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def clip_mat(name, zclip, color='#d6e6f6', alpha=0.55, strength=1.6):
    """Rain-like streak material that vanishes above world z = zclip (water leaving an edge)."""
    m, n = M._mat(name)
    if n is None: return m
    nt, o = n
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = cz.col(color); em.inputs[1].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = zclip
    nt.links.new(sep.outputs[2], lt.inputs[0])
    mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = alpha; mu.name = 'gate'
    nt.links.new(lt.outputs[0], mu.inputs[0])
    nt.links.new(mu.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def ice_mat():
    m, n = M._mat('r2_ice')
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = cz.col('#a8dcff'); p.inputs['Roughness'].default_value = 0.05
    for k, v in (('Transmission Weight', 0.55), ('Specular IOR Level', 1.0), ('IOR', 1.31), ('Coat Weight', 0.5)):
        try: p.inputs[k].default_value = v
        except Exception: pass
    p.inputs['Emission Color'].default_value = cz.col('#4aa8ff'); p.inputs['Emission Strength'].default_value = 0.35
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 18
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.25
    nt.links.new(nz.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def xfade(mat, fw, hold=30, off=10, peak=1.0, rise=5):
    keys = [(t(fw - rise), 0.0), (t(fw), peak)]
    if hold is not None: keys += [(t(fw + hold), peak), (t(fw + hold + off), 0.0)]
    M.xray_fade(mat, keys)


def xcopy(obs, mat, grow=1.03, lift=0.0):
    """Green X-ray twins of objects (same mesh, object-linked material, slightly bigger)."""
    out = []
    for ob in obs:
        if ob is None or ob.type not in ('MESH', 'CURVE'): continue
        c = ob.copy(); bpy.context.scene.collection.objects.link(c)
        c.parent = ob.parent; c.matrix_world = ob.matrix_world.copy()
        c.scale = tuple(s * grow for s in ob.scale); c.location.z += lift
        if c.animation_data: c.animation_data_clear()
        for sl in c.material_slots: sl.link = 'OBJECT'; sl.material = mat
        if not c.material_slots and c.type == 'MESH':
            c.data = c.data.copy(); c.data.materials.append(mat)
        c.name = ob.name + '_x'; out.append(c)
    return out


def hide(obs):
    for o in obs:
        if o is None: continue
        o.hide_render = True; o.hide_viewport = True
        for c in o.children: hide([c])


def show_from(obs, f, F0, F1):
    for o in obs: M.visible(o, [(t(f), 1e9)], F0, F1)


def show_until(obs, f, F0, F1):
    for o in obs: M.visible(o, [(-1e9, t(f))], F0, F1)


# ------------------------------------------------------------------ meshes
def mesh(name, verts, faces, mat=None, smooth=False, parent=None):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(map(float, v)) for v in verts], [], faces); me.update()
    if smooth: me.shade_smooth()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if mat: me.materials.append(mat)
    if parent: ob.parent = parent
    return ob


def slab(name, w, l, top, nx=48, ny=24, mat=None, smooth=True):
    """Closed slab: local x in [-w/2, w/2], y in [0, l], bottom z=0, top z=top(U, V) (U,V in 0..1 numpy)."""
    U, V = np.meshgrid(np.linspace(0, 1, nx + 1), np.linspace(0, 1, ny + 1))
    Z = np.maximum(top(U, V), 0.002)
    X = (U - 0.5) * w; Y = V * l
    vt = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    vb = np.stack([X.ravel(), Y.ravel(), np.zeros(X.size)], 1)
    n = vt.shape[0]; idx = lambda i, j: j * (nx + 1) + i
    F = []
    for j in range(ny):
        for i in range(nx):
            a, b, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1)
            F.append((a, b, c, d)); F.append((n + d, n + c, n + b, n + a))
    ring = [idx(i, 0) for i in range(nx)] + [idx(nx, j) for j in range(ny)] + [idx(i, ny) for i in range(nx, 0, -1)] + [idx(0, j) for j in range(ny, 0, -1)]
    for k in range(len(ring)):
        a, b = ring[k], ring[(k + 1) % len(ring)]
        F.append((b, a, n + a, n + b))
    return mesh(name, np.vstack([vt, vb]), F, mat, smooth)


def on_slope(ob, s, ay0=EY, lift=0.0):
    """Place a slab built in slope coords (local +y up-slope from the eave) on roof side s (-1 front, +1 back)."""
    ob.location = (0, s * ay0, surf_z(ay0) + lift)
    ob.rotation_euler = (math.radians(H.PITCH), 0, 0 if s < 0 else math.pi)
    return ob


def pipe(name, a, b, r, mat, parent=None, verts=20):
    a, b = Vector(a), Vector(b); d = b - a
    ob = cz.cyl(name, r, d.length, (0, 0, 0), mat, verts=verts, ol=0, parent=parent)
    ob.location = a; ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def trough(name, length, r, mat, parent=None, n=14):
    """Half-round gutter along x (open top), rim at z=0, with a front lip and end caps."""
    prof = [(math.cos(a) * r, math.sin(a) * r) for a in np.linspace(math.pi, 2 * math.pi, n)]
    prof = [(-r - 0.01, 0.015)] + prof + [(r + 0.012, 0.02), (r + 0.012, 0.035)]
    vs, fs = [], []
    for x in (-length / 2, length / 2):
        for (y, z) in prof: vs.append((x, y, z))
    m = len(prof)
    for i in range(m - 1): fs.append((i, i + 1, m + i + 1, m + i))
    ob = mesh(name, vs, fs, mat, smooth=True, parent=parent)
    so = ob.modifiers.new('sol', 'SOLIDIFY'); so.thickness = 0.008
    for k, x in enumerate((-length / 2, length / 2)):
        cap = mesh(f'{name}_cap{k}', [(x, y, z) for (y, z) in prof[1:-2]], [tuple(range(len(prof) - 3))], mat, parent=ob)
    return ob


# ------------------------------------------------------------------ the cottage + its new parts
def cottage(mt, stage='shingles', snow=0.0, ties=False, ceiling=False, gutter=True, snow_cut=False):
    P = H.build(stage, mt)
    root = P['root']
    P['extra'] = []
    if gutter:
        P.update(gutters(mt, root))
    if ties:
        P['myties'] = tie_row(mt, root)
    if ceiling:
        P['ceiling'] = cz.box('ceiling', (W - 2 * T, D - 2 * T, 0.03), (0, 0, WALL + 0.045), mt['plaster'], bevel=0, ol=0, parent=root)
    if snow:
        P['snow'] = [snow_layer(f'snow{"ab"[s > 0]}', s, snow, mt, cut=snow_cut) for s in (-1, 1)]
        if gutter:   # enrich r17/r19: icicles along both gutters + snow drifts against the walls
            for s in (-1, 1):
                ic = icicles(f'gicic{"ab"[s > 0]}', mt['ice'], -W / 2 - OVER + 0.1, W / 2 + OVER - 0.1, s * (EY + 0.12), P['gutter_z'] - 0.08, n=55, lmax=0.35, seed=20 + s)
                P['extra'].append(ic)
            for k, (x, y, w, l, rz) in enumerate(((0, -D / 2, W + 0.4, 0.9, 180), (0, D / 2, W + 0.4, 0.9, 0), (-W / 2, 0, D, 0.9, 90), (W / 2, 0, D, 0.9, 270))):
                dr = slab(f'drift{k}', w, l, lambda U, V: 0.45 * (1 - V) ** 1.5 * (0.8 + 0.4 * M.fbm(U * 8 + k, V * 2, seed=k, octaves=4)) * np.clip(U / 0.1, 0, 1) * np.clip((1 - U) / 0.1, 0, 1), nx=40, ny=8, mat=mt['snow'])
                dr.rotation_euler = (0, 0, math.radians(rz))
                dr.location = (x, y, 0.0)
                P['extra'].append(dr)
    else:
        P['extra'] += dressing(mt)
    # dark underlay under the shingles (no deck wood showing in the shingle gaps)
    for s in (-1, 1):
        P['extra'].append(sloped(f'underlay{"ab"[s > 0]}', s, EY, 0.02, -0.075, 0.015, W + 2 * OVER, mt['membrane']))
    # fascia boards (the eave edge the gutter hangs on)
    for s in (-1, 1):
        P['extra'].append(cz.box(f'fascia{"ab"[s > 0]}', (W + 2 * OVER, 0.03, 0.22), (0, s * (EY - 0.04), surf_z(EY) - 0.2), mt['wood_dark'], bevel=0.005, ol=0, parent=root))
    return P


def gutters(mt, root):
    """Front + back half-round gutters, hangers, a downpipe with swan neck + shoe at the front-right corner."""
    out = {}
    gz = surf_z(EY) - 0.3
    gs = []
    for s in (-1, 1):
        g = trough(f'trough{"ab"[s > 0]}', W + 2 * OVER, 0.1, mt['metal'], parent=root)
        g.location = (0, s * (EY + 0.02), gz)
        if s > 0: g.rotation_euler = (0, 0, math.pi)
        for k in range(10):
            x = -W / 2 - OVER + 0.2 + k * (W + 2 * OVER - 0.4) / 9
            cz.box(f'hanger{"ab"[s > 0]}{k}', (0.03, 0.24, 0.012), (x if s < 0 else -x, 0.02, 0.03), mt['metal'], bevel=0, ol=0, parent=g)
        gs.append(g)
    out['trough'] = gs
    # water inside the front gutter (scale z to fill)
    wtr = cz.box('gwater', (W + 2 * OVER - 0.05, 0.15, 0.07), (0, 0, -0.06), mt['water'], bevel=0.01, ol=0, parent=gs[0])
    wtr.scale = (1, 1, 0.05)
    out['gwater'] = wtr
    # downpipe group (parent empty so it can drop in)
    dp = cz.empty('downpipe_grp', (0, 0, 0), parent=root)
    x = W / 2 + OVER - 0.25
    yg = -(EY + 0.02); yw = -D / 2 - 0.09
    parts = [pipe('dp_out', (x, yg, gz - 0.06), (x, yg, gz - 0.3), 0.045, mt['metal'], dp),
             pipe('dp_neck', (x, yg, gz - 0.3), (x, yw, gz - 0.62), 0.045, mt['metal'], dp),
             pipe('dp_main', (x, yw, gz - 0.62), (x, yw, 0.32), 0.05, mt['metal'], dp),
             pipe('dp_shoe', (x, yw, 0.34), (x, yw - 0.32, 0.12), 0.05, mt['metal'], dp)]
    for k, z in enumerate((0.6, 1.3, 2.0)):
        parts.append(cz.box(f'dp_clip{k}', (0.14, 0.1, 0.04), (x, yw + 0.04, z), mt['metal'], bevel=0.005, ol=0, parent=dp))
    out['downpipe_grp'] = dp; out['downpipe'] = parts
    out['gutter_z'] = gz; out['dp_x'] = x; out['dp_y'] = yw
    return out


def tie_row(mt, root):
    ties = []
    for i in range(9):
        x = -W / 2 + 0.2 + i * (W - 0.4) / 8
        ties.append(cz.box(f'mytie{i}', (0.09, D + 0.3, 0.16), (x + 0.085, 0, WALL + 0.17), mt['wood'], bevel=0.01, ol=0, parent=root))
    return ties


def snow_layer(name, s, depth, mt, seed=3, cut=False):
    L = EY / COSP + 0.05; w = W + 2 * OVER + 0.15
    r = seed + (0 if s < 0 else 7)
    def top(U, V):
        n = M.fbm(U * 6 + r, V * 4 + r * 2, seed=r, octaves=5)
        e = (1.0 if cut else np.clip(U / 0.04, 0, 1)) * np.clip((1 - U) / 0.04, 0, 1)
        lip = 0.55 + 0.45 * np.clip(V / 0.08, 0, 1)        # rounded front lip at the eave
        rid = np.clip((1 - V) / 0.04, 0, 1)
        return depth * (0.8 + 0.4 * n) * (0.3 + 0.7 * e) * lip * (0.4 + 0.6 * rid)
    ob = slab(name, w, L, top, nx=64, ny=28, mat=mt['snow'])
    on_slope(ob, s, EY + 0.05, lift=-0.02)
    return ob


def sloped(name, s, ay_from, ay_to, z_off, th, w, mat):
    """A thin slab lying on the roof slope between |y| = ay_from (low) and ay_to (high). Origin at the low end."""
    L = (ay_from - ay_to) / COSP
    ob = slab(name, w, L, lambda U, V: th + U * 0, nx=2, ny=2, mat=mat, smooth=False)
    on_slope(ob, s, ay_from, lift=z_off)
    return ob


def dressing(mt, seed=7):
    """Enrich targets (r14/r17/r19): grass clumps + wild flowers round the house, a stone path to the door, a log pile
    against the back wall, a post-and-rail fence on the slope. Joined meshes so EEVEE stays fast."""
    r = random.Random(seed); out = []
    gm = M.pbr('r2_blade', '#4f8a2c', rough=0.7, noise=0.4)
    fl = [M.pbr(f'r2_flower{i}', c, rough=0.6, emit=c, emit_strength=0.15) for i, c in enumerate(('#f4f0e0', '#f2d23a', '#c060d0'))]
    blades, flowers = [], []
    for i in range(420):
        a = r.uniform(0, 2 * math.pi); d = r.uniform(4.6, 11.0); x, y = math.cos(a) * d * 1.15, math.sin(a) * d
        if -0.8 < x < 0.8 and y < -3: continue
        for b in range(5):
            h = r.uniform(0.15, 0.35)
            blades.append(cz.cyl(f'bl{i}_{b}', 0.012, h, (x + r.uniform(-0.08, 0.08), y + r.uniform(-0.08, 0.08), 0), gm,
                                 rot=(r.uniform(-25, 25), r.uniform(-25, 25), 0), verts=3, r2=0.0, ol=0))
        if r.random() < 0.18:
            flowers.append(cz.sphere(f'fl{i}', 0.035, (x, y, 0.3), fl[i % 3], segs=6, rings=4, ol=0))
    out.append(M.join('grass_clumps', blades)); out.append(M.join('flowers', flowers))
    path = [cz.box(f'pv{i}', (r.uniform(0.45, 0.7), r.uniform(0.35, 0.5), 0.06), (r.uniform(-0.25, 0.25), -3.4 - i * 0.62, 0.02), mt['stone'], rot=(0, 0, r.uniform(-20, 20)), bevel=0.02, ol=0) for i in range(9)]
    out.append(M.join('path', path))
    logs = []
    for row in range(4):
        for j in range(7 - row):
            logs.append(cz.cyl(f'log{row}_{j}', 0.12, 1.1, (-2.6 + j * 0.25 + row * 0.12, D / 2 + 0.55, 0.12 + row * 0.22), mt['bark'], rot=(0, 90, 90), verts=12, origin='center', ol=0))
    out.append(M.join('logpile', logs))
    fence = []
    for i in range(16):
        a = math.radians(200 + i * 9); x, y = math.cos(a) * 12, math.sin(a) * 12
        fence.append(cz.box(f'fp{i}', (0.1, 0.1, 1.1), (x, y, 0.55), mt['wood_dark'], bevel=0.01, ol=0))
        if i:
            a0 = math.radians(200 + (i - 1) * 9); x0, y0 = math.cos(a0) * 12, math.sin(a0) * 12
            for zr in (0.45, 0.9):
                fence.append(pipe(f'fr{i}_{zr}', (x0, y0, zr), (x, y, zr), 0.035, mt['wood_dark'], verts=6))
    out.append(M.join('fence', fence))
    return out


# ------------------------------------------------------------------ hill, trees, weather
def hill_z():
    f = M.range_fn(height=10, scale=40, seed=2, ridged=False)
    def z(x, y):
        X, Y = np.array([x], float), np.array([y], float)
        r = np.sqrt(X * X + Y * Y)
        Z = f(X, Y) - 4 + 0.03 * X
        return float(np.where(r < 9, 0.0, Z * np.clip((r - 9) / 25, 0, 1))[0])
    return z


def land(mt, winter=False, trees=True, n=26, avoid=(), clouds=True):
    mm = dict(mt); mm['grass'] = mt['snow'] if winter else mt['grass']
    hl = H.hill(mm)
    out = [hl]
    if clouds and H.has('clouds.png'):
        cm = M.cloud_mat('r2_cloud', H.TEX('clouds.png'), strength=1.4)
        rc = random.Random(12)
        for i in range(9):
            a = rc.uniform(0, 2 * math.pi); d = rc.uniform(110, 160)
            c = cz.plane(f'cloud{i}', rc.uniform(50, 80), rc.uniform(22, 32), (math.cos(a) * d, math.sin(a) * d, rc.uniform(28, 48)), cm,
                         rot=(90, 0, math.degrees(a) + 90))
            try: c.visible_shadow = False
            except Exception: pass
    if trees:
        z = hill_z()
        proto = pine(mt, winter)
        r = random.Random(4)
        k = 0
        while k < n:
            a = r.uniform(0, 2 * math.pi); d = r.uniform(13, 45)
            x, y = math.cos(a) * d, math.sin(a) * d
            if any((x - ax) ** 2 + (y - ay) ** 2 < ar * ar for ax, ay, ar in avoid): continue
            c = proto.copy(); bpy.context.scene.collection.objects.link(c)
            sc = r.uniform(0.8, 1.5); c.scale = (sc, sc, sc * r.uniform(0.9, 1.2))
            c.location = (x, y, z(x, y) - 0.1); c.rotation_euler = (0, 0, r.uniform(0, 6.3)); out.append(c); k += 1
        proto.location = (14, 9, z(14, 9)); out.append(proto)
    return out


def pine(mt, winter=False, name='pine'):
    """Round 3: a real fir - tapered trunk + 8 tiers of drooping needle clusters (Flow needle texture), snow caps in winter."""
    rr = random.Random(hash(name) % 1000)
    parts = [cz.cyl(name + '_trunk', 0.16, 4.2, (0, 0, 0), mt['bark'], verts=10, r2=0.04, ol=0)]
    for i in range(8):
        k = i / 7; r = 1.75 * (1 - k) + 0.25; z = 0.8 + k * 4.3
        nb = max(4, int(9 - i * 0.6))
        for j in range(nb):
            a = (j + rr.uniform(-0.3, 0.3) + 0.5 * (i % 2)) * 2 * math.pi / nb
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0, location=(math.cos(a) * r * 0.5, math.sin(a) * r * 0.5, z - r * 0.12))
            c = bpy.context.object; c.name = f'{name}_b{i}_{j}'
            c.scale = (r * 0.55, r * 0.22, 0.28 + 0.1 * (1 - k)); c.rotation_euler = (0, math.radians(18), a)
            c.data.materials.append(mt['pine']); M.displace(c, 0.12, 0.25)
            parts.append(c)
            if winter and j % 2 == 0:
                s = cz.sphere(f'{name}_s{i}_{j}', 1.0, (math.cos(a) * r * 0.45, math.sin(a) * r * 0.45, z - r * 0.06), mt['pine_snow'], scale=(r * 0.4, r * 0.15, 0.1), ol=0, segs=10, rings=5)
                s.rotation_euler = (0, math.radians(18), a); parts.append(s)
    parts.append(cz.cyl(name + '_tip', 0.28, 0.9, (0, 0, 5.0), mt['pine'], verts=10, r2=0.0, ol=0))
    for p in parts:
        for md in list(p.modifiers):
            bpy.context.view_layer.objects.active = p
            try: bpy.ops.object.modifier_apply(modifier=md.name)
            except Exception: pass
    return M.join(name, parts)


def rain(name, mt, center, size, F0, F1, n=7000, speed=11.0, slant=(1.5, 0.0), h0=8.0, seed=5, avoid=None):
    """Thin streak cards falling (a tall block so no wrap is needed), motion blur stretches them.
    avoid: [(x, y, r)] keep-out circles (the camera path) so no streak fills the lens."""
    dur = (F1 - F0 + 16) / FPS
    hgt = speed * dur + h0 + 2
    r = random.Random(seed); vs, fs = [], []
    for i in range(n * 2):
        if len(fs) >= n: break
        x = center[0] + r.uniform(-size / 2, size / 2); y = center[1] + r.uniform(-size / 2, size / 2)
        if avoid and any((x - ax) ** 2 + (y - ay) ** 2 < ar * ar for ax, ay, ar in avoid): continue
        z = r.uniform(0, hgt); L = r.uniform(0.35, 0.7); wdt = r.uniform(0.006, 0.012)
        a = r.uniform(0, math.pi); dx, dy = math.cos(a) * wdt, math.sin(a) * wdt
        sx, sy = slant[0] / speed * L, slant[1] / speed * L
        b = len(vs)
        vs += [(x - dx, y - dy, z), (x + dx, y + dy, z), (x + dx + sx, y + dy + sy, z + L), (x - dx + sx, y - dy + sy, z + L)]
        fs.append((b, b + 1, b + 2, b + 3))
    ob = mesh(name, vs, fs, mt['rain'])
    M.bake_path(ob, F0, F1, pos=lambda tt: (-slant[0] * (tt - t(F0)), -slant[1] * (tt - t(F0)), -speed * (tt - t(F0)) - 1.0))
    try: ob.visible_shadow = False
    except Exception: pass
    return ob


def snowfall(name, mt, center, size, F0, F1, n=2500, speed=1.2, seed=9):
    dur = (F1 - F0 + 16) / FPS
    hgt = speed * dur + 14
    r = random.Random(seed); parts = []
    vs, fs = [], []
    for i in range(n):
        x = center[0] + r.uniform(-size / 2, size / 2); y = center[1] + r.uniform(-size / 2, size / 2); z = r.uniform(0, hgt)
        s = r.uniform(0.015, 0.035); b = len(vs)
        vs += [(x - s, y, z - s), (x + s, y, z - s), (x + s, y, z + s), (x - s, y, z + s), (x, y - s, z - s), (x, y + s, z - s), (x, y + s, z + s), (x, y - s, z + s)]
        fs += [(b, b + 1, b + 2, b + 3), (b + 4, b + 5, b + 6, b + 7)]
    ob = mesh(name, vs, fs, M.emit('r2_flake', '#f4f8ff', 1.6))
    M.bake_path(ob, F0, F1, pos=lambda tt: (0.4 * math.sin(tt * 0.9), 0.3 * (tt - t(F0)), -speed * (tt - t(F0)) - 2.0))
    try: ob.visible_shadow = False
    except Exception: pass
    return ob


def stream(name, pts, r, mat, F0, F1, fa, fb):
    """Water ribbon along points growing from frame fa to fb (curve bevel_factor_end)."""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('NURBS'); sp.points.add(len(pts) - 1); sp.use_endpoint_u = True; sp.order_u = 3
    for p, co in zip(sp.points, pts):
        p.co = (co[0], co[1], co[2], 1.0)
    cu.bevel_depth = r * 2.2; cu.bevel_resolution = 4; cu.resolution_u = 24
    try: cu.use_fill_caps = True
    except Exception: pass
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob); cu.materials.append(mat); ob.scale = (1, 1, 0.28)
    cu.bevel_factor_end = 0.0; cu.keyframe_insert('bevel_factor_end', frame=fa)
    cu.bevel_factor_end = 1.0; cu.keyframe_insert('bevel_factor_end', frame=fb)
    return ob


def curtain(name, mt, x0, x1, y, z, drop, F0, F1, n=900, seed=3):
    """Water pouring off an eave: dense streaks falling from a line (looping in a tall block)."""
    speed = 7.0
    dur = (F1 - F0 + 16) / FPS; hgt = speed * dur + z + 1
    r = random.Random(seed); vs, fs = [], []
    for i in range(n):
        x = r.uniform(x0, x1); zz = r.uniform(0, hgt); L = r.uniform(0.25, 0.5); w = r.uniform(0.008, 0.016)
        b = len(vs); yy = y + r.uniform(-0.04, 0.04) - 0.06 * max(0, z - zz) ** 0.5
        vs += [(x - w, yy, zz), (x + w, yy, zz), (x + w, yy, zz + L), (x - w, yy, zz + L)]
        fs.append((b, b + 1, b + 2, b + 3))
    ob = mesh(name, vs, fs, clip_mat(name + '_m', z))
    M.bake_path(ob, F0, F1, pos=lambda tt: (0, 0, -speed * (tt - t(F0 - 8))))
    try: ob.visible_shadow = False
    except Exception: pass
    return ob


# ------------------------------------------------------------------ cars (the weight gag)
def car(mat, name='car'):
    parts = [cz.box(name + '_body', (4.4, 1.8, 0.62), (0, 0, 0.62), mat, bevel=0.18, ol=0),
             cz.box(name + '_cab', (2.3, 1.62, 0.6), (-0.25, 0, 1.18), mat, bevel=0.22, ol=0)]
    for sx in (-1.4, 1.35):
        for sy in (-0.82, 0.82):
            parts.append(cz.cyl(f'{name}_w{sx}{sy}', 0.34, 0.24, (sx, sy - 0.12 * (1 if sy > 0 else -1) * 0, 0.34), mat, rot=(90, 0, 0), verts=24, ol=0, origin='center'))
    for p in parts:
        for md in list(p.modifiers):
            bpy.context.view_layer.objects.active = p
            try: bpy.ops.object.modifier_apply(modifier=md.name)
            except Exception: pass
    return M.join(name, parts)


# ------------------------------------------------------------------ sag (lattice + shape key)
def sag_rig(objs, name='sag', A=0.75, B=0.45):
    lat = bpy.data.lattices.new(name)
    lat.points_u, lat.points_v, lat.points_w = 13, 7, 14
    lat.interpolation_type_u = lat.interpolation_type_v = lat.interpolation_type_w = 'KEY_LINEAR'
    ob = bpy.data.objects.new(name, lat); bpy.context.scene.collection.objects.link(ob)
    ob.location = (0, 0, 3.2); ob.scale = (W + 2 * OVER + 0.6, D + 2 * OVER + 1.0, 7.0)
    ob.shape_key_add(name='Basis'); k = ob.shape_key_add(name='sag', from_mix=False)
    for i, p in enumerate(lat.points):
        x, y, z = p.co
        wx = math.cos(x * math.pi) ** 2                           # 1 mid-span, 0 at the gables
        zw = z * 7.0 + 3.2                                        # world z
        top = max(0.0, min(1.0, (zw - WALL) / RISE))             # 0 at the wall tops, 1 at the ridge
        wallh = max(0.0, min(1.0, zw / WALL)) ** 1.6
        dz = -A * wx * top
        dy = (1 if y > 0 else -1 if y < 0 else 0) * B * wx * wallh * (1 - 0.5 * top) / (D + 2 * OVER + 1.0)
        k.data[i].co = (x, y + dy, z + dz / 7.0)
    for o in objs:
        if o is None or o.type != 'MESH': continue
        if o.dimensions.length > 2.5 and not o.name.startswith('shrow') and not o.name.startswith('snow'):
            sd = o.modifiers.new('sub', 'SUBSURF'); sd.subdivision_type = 'SIMPLE'; sd.levels = sd.render_levels = 3
        md = o.modifiers.new('lat', 'LATTICE'); md.object = ob
    return ob, k


# ------------------------------------------------------------------ thermal
IRON = [(0.0, '#05030f'), (0.18, '#1c0a5a'), (0.35, '#6a0d8a'), (0.5, '#c0186a'), (0.65, '#f2481a'), (0.8, '#ffa51c'), (1.0, '#fff4c4')]


def iron(v):
    v = max(0.0, min(1.0, v))
    for (a, ca), (b, cb) in zip(IRON, IRON[1:]):
        if v <= b:
            k = (v - a) / (b - a); A, B = cz.col(ca), cz.col(cb)
            return tuple(A[i] + (B[i] - A[i]) * k for i in range(3)) + (1,)
    return cz.col(IRON[-1][1])


def thermal_mat(name, v, strength=1.4, soft=False):
    m, n = M._mat(name)
    if n is None: return m
    nt, o = n
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = iron(v); em.inputs[1].default_value = strength; em.name = 'em'
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.5
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 0.25; mx.name = 'mx'
    rgb = nt.nodes.new('ShaderNodeRGB'); rgb.outputs[0].default_value = iron(v); rgb.name = 'rgb'
    nt.links.new(rgb.outputs[0], mx.inputs[6]); nt.links.new(nz.outputs['Color'], mx.inputs[7]); nt.links.new(mx.outputs[2], em.inputs[0])
    if soft:
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
        lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.5
        inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'POWER'; inv.inputs[1].default_value = 2.0
        nt.links.new(lw.outputs['Facing'], inv.inputs[0])
        one = nt.nodes.new('ShaderNodeMath'); one.operation = 'SUBTRACT'; one.inputs[0].default_value = 1.0
        nt.links.new(inv.outputs[0], one.inputs[1])
        g = nt.nodes.new('ShaderNodeMath'); g.operation = 'MULTIPLY'; g.inputs[1].default_value = 0.3; g.name = 'gate'
        nt.links.new(one.outputs[0], g.inputs[0])
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); ms = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(g.outputs[0], ms.inputs[0]); nt.links.new(tr.outputs[0], ms.inputs[1]); nt.links.new(em.outputs[0], ms.inputs[2])
        nt.links.new(ms.outputs[0], o.inputs[0])
    else:
        nt.links.new(em.outputs[0], o.inputs[0])
    return m


def thermal_key(mat, keys):
    """keys [(frame, v)] - animate the iron colour."""
    rgb = mat.node_tree.nodes['rgb'].outputs[0]
    for f, v in keys:
        rgb.default_value = iron(v); rgb.keyframe_insert('default_value', frame=f)


def thermalize(rule):
    """Swap every visible mesh's materials for a thermal one: rule(obj) -> v (or a material, or None = keep)."""
    cache = {}
    for o in list(bpy.context.scene.objects):
        if o.type not in ('MESH', 'CURVE') or o.hide_render: continue
        v = rule(o)
        if v is None: continue
        m = v if isinstance(v, bpy.types.Material) else cache.setdefault(round(v, 2), thermal_mat(f'th_{round(v, 2)}', v))
        if o.material_slots:
            for sl in o.material_slots: sl.link = 'OBJECT'; sl.material = m
        elif o.type == 'MESH':
            o.data.materials.append(m)


# ------------------------------------------------------------------ icicles, flashing, birds, arrows
def icicles(name, mat, x0, x1, y, z, n=60, seed=6, lmax=0.8):
    r = random.Random(seed); parts = []
    for i in range(n):
        x = x0 + (x1 - x0) * (i + r.uniform(-0.3, 0.3)) / n
        L = r.uniform(0.08, lmax) * (0.4 + 0.6 * abs(math.sin(i * 0.37 + 1)))
        rr = r.uniform(0.025, 0.05) * (0.6 + L)
        c = cz.cyl(f'{name}{i}', rr, L, (x, y + r.uniform(-0.03, 0.03), z - L), mat, verts=10, r2=rr * 0.9, ol=0)
        bm_tip = c
        # taper: bottom to a point (cone pointing down)
        me = c.data
        for v in me.vertices:
            if v.co.z < 0.01: v.co.x *= 0.05; v.co.y *= 0.05
        parts.append(c)
    ob = M.join(name, parts)
    from mathutils import Matrix
    off = Vector(ob.location) - Vector((0, y, z))
    ob.data.transform(Matrix.Translation(off)); ob.location = (0, y, z)      # origin on the hanging line
    return ob


def arrow(name, mat, loc, direction, length=1.2, r=0.06):
    d = Vector(direction).normalized()
    sh = cz.cyl(name + '_sh', r, length * 0.65, (0, 0, 0), mat, verts=16, ol=0)
    hd = cz.cyl(name + '_hd', r * 2.6, length * 0.35, (0, 0, length * 0.65), mat, verts=16, r2=0.0, ol=0)
    ob = M.join(name, [sh, hd])
    ob.location = loc; ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    return ob


def pop(ob, fa, F0, F1, dur=6, s1=1.0, out=None):
    """Scale-in with a little overshoot at frame fa (optional pop-out at frame out)."""
    def sc(tt):
        f = tt * FPS + 1
        if out is not None and f > out: return max(0.001, s1 * (1 - (f - out) / 5))
        k = (f - fa) / dur
        if k <= 0: return 0.001
        if k >= 1: return s1
        return s1 * cz.back_out(k)
    M.bake_path(ob, F0, F1, scale=sc)


def bird(name, mat, F0, F1, path, flap=6.0, seed=0, size=1.0):
    body = cz.box(name, (0.12, 0.35, 0.08), (0, 0, 0), mat, bevel=0.03, ol=0)
    wl = cz.box(name + '_wl', (0.55, 0.16, 0.02), (-0.28, 0, 0), mat, bevel=0.01, ol=0)
    wr = cz.box(name + '_wr', (0.55, 0.16, 0.02), (0.28, 0, 0), mat, bevel=0.01, ol=0)
    for w, sgn in ((wl, -1), (wr, 1)):
        w.data.transform(__import__('mathutils').Matrix.Translation((sgn * 0.28, 0, 0)))
        w.location = (0, 0, 0); w.parent = body
        M.bake_path(w, F0, F1, rot=lambda tt, sgn=sgn: (0, sgn * 35 * math.sin(tt * flap * 2 * math.pi + seed), 0))
    M.bake_path(body, F0, F1, pos=path, rot=lambda tt: (0, 0, math.degrees(math.atan2(*(lambda a, b: (-(b[0] - a[0]), b[1] - a[1]))(path(tt), path(tt + 0.05))))))
    body.scale = (size, size, size)
    return body


# ------------------------------------------------------------------ camera with whips
CALM = 0.3


def flight(keys, F0, F1, whip_in=True, whip_out=True, wf=6, amt=0.5, lens=None, in_up=0.0, cuts=(), smooth=3.0, calm=None):
    """M.Flight v2 only. keys: (frame, eye, target, lens). Whip keys (pan to screen-right) over the first / last wf
    frames; lenses clamped to 18-35 mm; cuts=[frame] hard cuts inside the shot."""
    ks = [(t(f), Vector(e), Vector(g), max(18, min(35, l))) for (f, e, g, l) in keys]
    # calm (round 3): the reference pans ~0.03-0.4 %/frame, ours ran 0.6-2: pull every key toward the shot's mean
    # framing (segments between cuts separately) so the move is a slow continuous drift, not a fly-by
    cf = sorted(t(c) for c in cuts); segs = [[]]
    for k in ks:
        if cf and len(segs) <= len(cf) and k[0] >= cf[len(segs) - 1]: segs.append([])
        segs[-1].append(k)
    ks = []
    for sg in segs:
        if not sg: continue
        me = sum((k[1] for k in sg), Vector()) / len(sg); mg = sum((k[2] for k in sg), Vector()) / len(sg)
        c_ = CALM if calm is None else calm
        ks += [(a, me + (e - me) * c_, mg + (g - mg) * c_, l) for a, e, g, l in sg]
    def right(e, g):
        d = (g - e).normalized(); return d.cross(Vector((0, 0, 1))).normalized() * (g - e).length
    wc = list(cuts)          # whips live in their own spline segments (cuts) so they stay a short spike
    if whip_in:
        f0, e0, g0, l0 = ks[0]
        ks[0] = (t(F0 + wf), e0, g0, l0)
        ks.insert(0, (t(F0 + wf) - 0.001, e0, g0, l0))
        ks.insert(0, (t(F0 - 1), e0, g0 - right(e0, g0) * amt + Vector((0, 0, in_up * (g0 - e0).length)), l0))
        wc.append(F0 + wf)
    if whip_out:
        f1, e1, g1, l1 = ks[-1]
        ks[-1] = (t(F1 - wf) - 0.001, e1, g1, l1)
        ks.append((t(F1 - wf), e1, g1, l1))
        ks.append((t(F1 + 1), e1, g1 + right(e1, g1) * amt, l1))
        wc.append(F1 - wf)
    fl = M.Flight([(a, tuple(b), tuple(c), d) for a, b, c, d in ks], smooth=smooth, cuts=[t(c) for c in wc], lens_range=(18, 35))
    fl.bake(F0, F1)
    return fl


# ------------------------------------------------------------------ round 2: splashes, wisps
def splashes(name, mt, center, size, F0, F1, n=500, z=0.01, seed=4, zf=None, avoid=None):
    """Small drop crowns where rain hits: 3 groups of instanced crowns pulsing out of phase."""
    r = random.Random(seed)
    proto_parts = []
    for j in range(6):
        a = j * math.pi / 3
        proto_parts.append(cz.cyl(f'{name}_p{j}', 0.006, 0.06, (0.03 * math.cos(a), 0.03 * math.sin(a), 0), mt['rain'], rot=(math.degrees(math.sin(a)) * 0.5, -math.degrees(math.cos(a)) * 0.5, 0), verts=5, r2=0.002, ol=0))
    proto = M.join(name + '_crown', proto_parts)
    groups = []
    for g in range(3):
        parts = []
        for i in range(n // 3):
            x = center[0] + r.uniform(-size / 2, size / 2); y = center[1] + r.uniform(-size / 2, size / 2)
            if avoid and avoid(x, y): continue
            c = proto.copy(); bpy.context.scene.collection.objects.link(c)
            c.location = (x, y, zf(x, y) if zf else z); s = r.uniform(0.3, 0.6); c.scale = (s, s, s); parts.append(c)
        for c in parts: c.data = c.data.copy()
        ob = M.join(f'{name}{g}', parts)
        from mathutils import Matrix
        groups.append(ob)
        M.bake_path(ob, F0, F1, scale=lambda tt, g=g: (1, 1, max(0.001, abs(math.sin(((tt * 30) + g * 2.3) * math.pi / 7.0)))))
    proto.hide_render = True
    return groups


def wisp_mat(name, color='#ff8a2a', strength=2.5, alpha=0.6, nscale=3.0):
    """Soft shimmering card: emission with a noise x radial-falloff alpha; the noise scrolls with the card's own Z."""
    m, n = M._mat(name)
    if n is None: return m
    nt, o = n
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = cz.col(color); em.inputs[1].default_value = strength
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (nscale, nscale * 0.5, nscale)
    nt.links.new(tc.outputs['Generated'], mp.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.0; nz.inputs['Detail'].default_value = 4
    try: nz.noise_dimensions = '4D'
    except Exception: pass
    nt.links.new(mp.outputs[0], nz.inputs['Vector'])
    ob_info = nt.nodes.new('ShaderNodeObjectInfo')
    nt.links.new(ob_info.outputs['Random'], nz.inputs['W'])
    # radial falloff from the card centre (UV)
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['UV'], sep.inputs[0])
    fx = nt.nodes.new('ShaderNodeMath'); fx.operation = 'PINGPONG'; fx.inputs[1].default_value = 0.5; nt.links.new(sep.outputs[0], fx.inputs[0])
    fy = nt.nodes.new('ShaderNodeMath'); fy.operation = 'PINGPONG'; fy.inputs[1].default_value = 0.5; nt.links.new(sep.outputs[1], fy.inputs[0])
    mxy = nt.nodes.new('ShaderNodeMath'); mxy.operation = 'MULTIPLY'; nt.links.new(fx.outputs[0], mxy.inputs[0]); nt.links.new(fy.outputs[0], mxy.inputs[1])
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'MULTIPLY'; pw.inputs[1].default_value = 4.0; nt.links.new(mxy.outputs[0], pw.inputs[0])
    cr = nt.nodes.new('ShaderNodeMapRange'); cr.inputs['From Min'].default_value = 0.3; cr.inputs['From Max'].default_value = 0.9
    nt.links.new(nz.outputs['Fac'], cr.inputs['Value'])
    a1 = nt.nodes.new('ShaderNodeMath'); a1.operation = 'MULTIPLY'; nt.links.new(cr.outputs[0], a1.inputs[0]); nt.links.new(pw.outputs[0], a1.inputs[1])
    g = nt.nodes.new('ShaderNodeMath'); g.operation = 'MULTIPLY'; g.inputs[1].default_value = alpha; g.name = 'gate'
    nt.links.new(a1.outputs[0], g.inputs[0])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); ms = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(g.outputs[0], ms.inputs[0]); nt.links.new(tr.outputs[0], ms.inputs[1]); nt.links.new(em.outputs[0], ms.inputs[2])
    nt.links.new(ms.outputs[0], o.inputs[0])
    # scroll the noise upward over time (mapping location keyed)
    for f, z in ((1, 0.0), (2100, -60.0)):
        mp.inputs['Location'].default_value = (0, 0, z); mp.inputs['Location'].keyframe_insert('default_value', frame=f)
    try:
        for fc in m.node_tree.animation_data.action.fcurves:
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    except Exception: pass
    return m


def wisps(name, mat, spots, F0, F1, n=24, w=(0.5, 0.9), h=(1.2, 2.2), rise=(0.5, 0.9), seed=3, face=(90, 0, 0), life=40):
    """Stretched cards drifting up from points spots(i, rng) -> (x, y, z); they grow, rise and fade (scale)."""
    r = random.Random(seed); out = []
    for i in range(n):
        x, y, z = spots(i, r); fa = F0 - life + r.uniform(0, (F1 - F0) + life); sp = r.uniform(*rise)
        c = cz.plane(f'{name}{i}', r.uniform(*w), r.uniform(*h), (x, y, z), mat, rot=face)
        ph = r.uniform(0, 6)
        def pos(tt, x=x, y=y, z=z, fa=fa, sp=sp, ph=ph):
            d = ((tt * 30 + 1) - fa) / 30
            return (x + 0.25 * math.sin(tt * 1.3 + ph), y, z + sp * max(0.0, d))
        def scl(tt, fa=fa):
            k = ((tt * 30 + 1) - fa) / life
            if k <= 0 or k >= 1: return 0.001
            return math.sin(math.pi * k) ** 0.7 * (0.7 + 0.6 * k)
        M.bake_path(c, F0, F1, pos=pos, scale=scl)
        try: c.visible_shadow = False
        except Exception: pass
        out.append(c)
    return out


# ------------------------------------------------------------------ round 3: sheet curtain, warm clouds, cars
def sheet_curtain(name, x0, x1, y, ztop, F0, F1, color='#d8e8f8', speed=4.0):
    """A streaked transparent water sheet falling off an edge: noise stretched vertically, scrolling down."""
    m, n = M._mat(name + '_m')
    if n is not None:
        nt, o = n
        try: m.surface_render_method = 'BLENDED'
        except Exception: pass
        tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (60.0, 1.0, 1.2)
        nt.links.new(tc.outputs['Object'], mp.inputs[0])
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1.0; nz.inputs['Detail'].default_value = 6
        nt.links.new(mp.outputs[0], nz.inputs['Vector'])
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.5; mr.inputs['From Max'].default_value = 0.75
        nt.links.new(nz.outputs['Fac'], mr.inputs['Value'])
        g = nt.nodes.new('ShaderNodeMath'); g.operation = 'MULTIPLY'; g.inputs[1].default_value = 0.4; g.name = 'gate'
        nt.links.new(mr.outputs[0], g.inputs[0])
        em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = cz.col(color); em.inputs[1].default_value = 1.3
        gl = nt.nodes.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.05
        ad = nt.nodes.new('ShaderNodeAddShader'); nt.links.new(em.outputs[0], ad.inputs[0]); nt.links.new(gl.outputs[0], ad.inputs[1])
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); ms = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(g.outputs[0], ms.inputs[0]); nt.links.new(tr.outputs[0], ms.inputs[1]); nt.links.new(ad.outputs[0], ms.inputs[2])
        nt.links.new(ms.outputs[0], o.inputs[0])
        for f, z in ((F0 - 10, 0.0), (F1 + 10, speed * (F1 - F0 + 20) / FPS * 1.2)):
            mp.inputs['Location'].default_value = (0, 0, z); mp.inputs['Location'].keyframe_insert('default_value', frame=f)
        try:
            for fc in m.node_tree.animation_data.action.fcurves:
                for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
        except Exception: pass
    ob = cz.plane(name, x1 - x0, ztop, ((x0 + x1) / 2, y, ztop / 2), m, rot=(90, 0, 0))
    try: ob.visible_shadow = False
    except Exception: pass
    return ob


def warm_clouds(tint='#ffb27a'):
    m = bpy.data.materials.get('r2_cloud')
    if not m: return
    nt = m.node_tree; em = next(n for n in nt.nodes if n.type == 'EMISSION'); src = em.inputs[0].links[0].from_socket
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1.0
    nt.links.new(src, mx.inputs[6]); mx.inputs[7].default_value = cz.col(tint); nt.links.new(mx.outputs[2], em.inputs[0])


def car_full(name, col, ghost=0.55):
    """A distinct car: coloured translucent body, dark glass cabin, black wheels with silver hubs (joined, 3 materials)."""
    body = M.xray(name + '_body_m', color=col, alpha=ghost, strength=1.6)
    glass = M.xray(name + '_glass_m', color='#203040', alpha=0.7, strength=0.4, fresnel=False)
    tyre = M.xray(name + '_tyre_m', color='#101012', alpha=0.85, strength=0.2, fresnel=False)
    hub = M.xray(name + '_hub_m', color='#e0e4ea', alpha=0.8, strength=1.0, fresnel=False)
    parts = [cz.box(name + '_b', (4.4, 1.8, 0.62), (0, 0, 0.62), body, bevel=0.18, ol=0),
             cz.box(name + '_c', (2.3, 1.62, 0.6), (-0.25, 0, 1.18), glass, bevel=0.22, ol=0),
             cz.box(name + '_lt', (0.1, 1.5, 0.12), (2.2, 0, 0.75), M.emit('r2_headlamp', '#fff4d0', 4), bevel=0.02, ol=0),
             cz.box(name + '_hood', (1.3, 1.7, 0.1), (1.55, 0, 0.98), body, rot=(0, 6, 0), bevel=0.04, ol=0),
             cz.box(name + '_ws', (0.06, 1.5, 0.78), (0.98, 0, 1.2), glass, rot=(0, -52, 0), bevel=0.02, ol=0),
             cz.box(name + '_rw', (0.06, 1.5, 0.7), (-1.45, 0, 1.18), glass, rot=(0, 58, 0), bevel=0.02, ol=0),
             cz.box(name + '_bump', (4.6, 1.75, 0.16), (0, 0, 0.36), tyre, bevel=0.06, ol=0)]
    for sx in (-1.4, 1.35):
        parts.append(cz.cyl(f'{name}_arch{sx}', 0.42, 1.86, (sx, 0, 0.36), body, rot=(90, 0, 0), verts=24, ol=0, origin='center'))
    for sx in (-1.4, 1.35):
        for sy in (-0.86, 0.86):
            parts.append(cz.cyl(f'{name}_w{sx}{sy}', 0.34, 0.24, (sx, sy, 0.34), tyre, rot=(90, 0, 0), verts=24, ol=0, origin='center'))
            parts.append(cz.cyl(f'{name}_h{sx}{sy}', 0.18, 0.26, (sx, sy, 0.34), hub, rot=(90, 0, 0), verts=16, ol=0, origin='center'))
    for p in parts:
        for md in list(p.modifiers):
            bpy.context.view_layer.objects.active = p
            try: bpy.ops.object.modifier_apply(modifier=md.name)
            except Exception: pass
    return M.join(name, parts)
