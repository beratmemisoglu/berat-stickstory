# Group C props (E23-E27): the globe from space (stars, Asia highlight, the crawling swarm + trail + Everest
# marker, the years counter) and the sea set (slab on its steel platform, copper fin ring, yellow beams, ballast
# tanks ring, pump hull, islands, ocean).
import bpy, math, os, random
import numpy as np
from mathutils import Vector, Matrix
import cz, mega as M, common as C
from cz import FPS

G = 100.0                       # globe radius
EV = (28.0, 87.0)               # Everest lat, lon
t = lambda f: (f - 1) / FPS


# ------------------------------------------------------------------ mesh helper
def mesh(name, verts, faces, mat=None, uv=None, smooth=True):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in faces]); me.update()
    if uv is not None:
        lay = me.uv_layers.new(name='UVMap')
        li = np.zeros(len(me.loops), np.int32); me.loops.foreach_get('vertex_index', li)
        lay.data.foreach_set('uv', np.asarray(uv, np.float32)[li].ravel())
    if smooth: me.shade_smooth()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if mat: me.materials.append(mat)
    return ob


def ll(lat, lon, r=G):
    a, b = math.radians(lat), math.radians(lon)
    return Vector((r * math.cos(a) * math.cos(b), r * math.cos(a) * math.sin(b), r * math.sin(a)))


# ------------------------------------------------------------------ space
def space_world():
    w = bpy.context.scene.world; nt = w.node_tree; nt.nodes.clear()
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0.5, 0.2, 1.1)
    nt.links.new(tc.outputs['Generated'], mp.inputs[0])
    env = nt.nodes.new('ShaderNodeTexEnvironment'); env.image = cz.image(C.T('c_milkyway.png')) if C.has('c_milkyway.png') else None
    nt.links.new(mp.outputs[0], env.inputs[0])
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs[1].default_value = 0.35; nt.links.new(env.outputs[0], bg.inputs[0])
    o = nt.nodes.new('ShaderNodeOutputWorld'); nt.links.new(bg.outputs[0], o.inputs[0])


def stars(n=5000, r=2500, seed=4):
    rnd = np.random.default_rng(seed)
    d = rnd.normal(size=(n, 3)); d /= np.linalg.norm(d, axis=1)[:, None]
    verts, faces = [], []
    for i, p in enumerate(d):
        c = Vector(p) * r; s = rnd.uniform(0.6, 2.2)
        u = Vector(p).orthogonal().normalized(); v = Vector(p).cross(u)
        k = len(verts); verts += [c + (u + v) * s, c + (u - v) * s, c + (-u - v) * s, c + (-u + v) * s]
        faces.append((k, k + 1, k + 2, k + 3))
    # milky-way band: denser faint stars along a tilted plane
    return mesh('stars', verts, faces, M.emit('star_m', '#dfe8ff', 6.0), smooth=False)


def earth_mat(red_keys, night_keys=()):
    m = bpy.data.materials.new('earth'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.55
    uvn = nt.nodes.new('ShaderNodeTexCoord')
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = cz.image(C.T('earth_day.png')); tx.interpolation = 'Cubic'
    nt.links.new(uvn.outputs['UV'], tx.inputs[0])
    # saturation/brightness lift (the reference's globe is vivid)
    hs = nt.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Hue'].default_value = 0.56; hs.inputs['Saturation'].default_value = 1.35; hs.inputs['Value'].default_value = 1.15   # round 3: hue nudged from tan toward green (ref + enrich)
    nt.links.new(tx.outputs[0], hs.inputs['Color'])
    # snow/whiten the high Asian ground (the reference reads white-lavender snow and bright green there)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.09; nz.inputs['Detail'].default_value = 14; nz.inputs['Roughness'].default_value = 0.7
    gco = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(gco.outputs['Object'], nz.inputs[0])
    nr = nt.nodes.new('ShaderNodeMapRange'); nr.inputs['From Min'].default_value = 0.45; nr.inputs['From Max'].default_value = 0.62; nr.inputs['To Max'].default_value = 0.55
    nt.links.new(nz.outputs['Fac'], nr.inputs['Value'])
    sn = nt.nodes.new('ShaderNodeMix'); sn.data_type = 'RGBA'; nt.links.new(nr.outputs[0], sn.inputs[0]); nt.links.new(hs.outputs[0], sn.inputs[6]); sn.inputs[7].default_value = cz.col('#e6e8f4')
    bb = nt.nodes.new('ShaderNodeBump'); bb.inputs['Strength'].default_value = 0.5; nt.links.new(nz.outputs['Fac'], bb.inputs['Height']); nt.links.new(bb.outputs[0], p.inputs['Normal'])
    # Asia mask: UV box (lon 60..150, lat 5..78) * land (red+green beat blue) with a noisy edge
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(uvn.outputs['UV'], sep.inputs[0])
    def band(sock, a, b, soft=0.012):
        lo = nt.nodes.new('ShaderNodeMapRange'); lo.inputs['From Min'].default_value = a - soft; lo.inputs['From Max'].default_value = a + soft
        nt.links.new(sock, lo.inputs['Value'])
        hi = nt.nodes.new('ShaderNodeMapRange'); hi.inputs['From Min'].default_value = b + soft; hi.inputs['From Max'].default_value = b - soft
        nt.links.new(sock, hi.inputs['Value'])
        mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; nt.links.new(lo.outputs[0], mu.inputs[0]); nt.links.new(hi.outputs[0], mu.inputs[1])
        return mu.outputs[0]
    bu = band(sep.outputs[0], (60 + 180) / 360, (150 + 180) / 360); bv = band(sep.outputs[1], (5 + 90) / 180, (78 + 90) / 180)
    # round 3: the crawl's country (lat 30-60, lon 86-125) reads green + snow in the reference, the Flow map is tan
    # there: push the base toward forest green inside a soft box (the snow noise still whitens it on top)
    gu = band(sep.outputs[0], (86 + 180) / 360, (125 + 180) / 360, 0.03); gv = band(sep.outputs[1], (30 + 90) / 180, (62 + 90) / 180, 0.03)
    gmk = nt.nodes.new('ShaderNodeMath'); gmk.operation = 'MULTIPLY'; nt.links.new(gu, gmk.inputs[0]); nt.links.new(gv, gmk.inputs[1])
    gk = nt.nodes.new('ShaderNodeMath'); gk.operation = 'MULTIPLY'; gk.inputs[1].default_value = 0.6; nt.links.new(gmk.outputs[0], gk.inputs[0])
    gm = nt.nodes.new('ShaderNodeMix'); gm.data_type = 'RGBA'; gm.blend_type = 'MIX'; nt.links.new(gk.outputs[0], gm.inputs[0])
    nt.links.new(hs.outputs[0], gm.inputs[6]); gm.inputs[7].default_value = cz.col('#3d7448'); nt.links.new(gm.outputs[2], sn.inputs[6])
    sc = nt.nodes.new('ShaderNodeSeparateColor'); nt.links.new(tx.outputs[0], sc.inputs[0])
    land = nt.nodes.new('ShaderNodeMath'); land.operation = 'SUBTRACT'
    gsum = nt.nodes.new('ShaderNodeMath'); gsum.operation = 'ADD'; nt.links.new(sc.outputs[0], gsum.inputs[0]); nt.links.new(sc.outputs[1], gsum.inputs[1])
    b2 = nt.nodes.new('ShaderNodeMath'); b2.operation = 'MULTIPLY'; b2.inputs[1].default_value = 1.35; nt.links.new(sc.outputs[2], b2.inputs[0])
    nt.links.new(gsum.outputs[0], land.inputs[0]); nt.links.new(b2.outputs[0], land.inputs[1])
    lm = nt.nodes.new('ShaderNodeMapRange'); lm.inputs['From Min'].default_value = 0.0; lm.inputs['From Max'].default_value = 0.08
    nt.links.new(land.outputs[0], lm.inputs['Value'])
    sm = nt.nodes.new('ShaderNodeMath'); sm.operation = 'MULTIPLY'; nt.links.new(nr.outputs[0], sm.inputs[0]); nt.links.new(lm.outputs[0], sm.inputs[1]); nt.links.new(sm.outputs[0], sn.inputs[0])
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'; nt.links.new(bu, m1.inputs[0]); nt.links.new(bv, m1.inputs[1])
    m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'; nt.links.new(m1.outputs[0], m2.inputs[0]); nt.links.new(lm.outputs[0], m2.inputs[1])
    amt = nt.nodes.new('ShaderNodeValue'); amt.name = 'red'
    m3 = nt.nodes.new('ShaderNodeMath'); m3.operation = 'MULTIPLY'; nt.links.new(m2.outputs[0], m3.inputs[0]); nt.links.new(amt.outputs[0], m3.inputs[1])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MIX'
    nt.links.new(m3.outputs[0], mx.inputs[0]); nt.links.new(sn.outputs[2], mx.inputs[6]); mx.inputs[7].default_value = cz.col('#ff6a6a')
    # night / dark-blue pass (ref 1073-1090): darken + blue-tint the ground, keyed by the 'night' value
    nv = nt.nodes.new('ShaderNodeValue'); nv.name = 'night'
    nm = nt.nodes.new('ShaderNodeMix'); nm.data_type = 'RGBA'; nt.links.new(nv.outputs[0], nm.inputs[0]); nm.inputs[6].default_value = (1, 1, 1, 1); nm.inputs[7].default_value = cz.col('#2436ff')
    nmul = nt.nodes.new('ShaderNodeMix'); nmul.data_type = 'RGBA'; nmul.blend_type = 'MULTIPLY'; nmul.inputs[0].default_value = 1.0
    nt.links.new(mx.outputs[2], nmul.inputs[6]); nt.links.new(nm.outputs[2], nmul.inputs[7])
    nt.links.new(nmul.outputs[2], p.inputs['Base Color'])
    p.inputs['Emission Color'].default_value = cz.col('#ff5060')
    em = nt.nodes.new('ShaderNodeMath'); em.operation = 'MULTIPLY'; em.inputs[1].default_value = 0.9
    nt.links.new(m3.outputs[0], em.inputs[0]); nt.links.new(em.outputs[0], p.inputs['Emission Strength'])
    nt.links.new(p.outputs[0], o.inputs[0])
    for tt, v in red_keys:
        amt.outputs[0].default_value = v; amt.outputs[0].keyframe_insert('default_value', frame=round(tt * FPS) + 1)
    for tt, v in night_keys:
        nv.outputs[0].default_value = v; nv.outputs[0].keyframe_insert('default_value', frame=round(tt * FPS) + 1)
    return m


def globe(red_keys, nu=720, nv=360, night_keys=()):
    lon = np.linspace(-180, 180, nu + 1); lat = np.linspace(-90, 90, nv + 1)
    LO, LA = np.meshgrid(np.radians(lon), np.radians(lat))
    V = np.stack([G * np.cos(LA) * np.cos(LO), G * np.cos(LA) * np.sin(LO), G * np.sin(LA)], -1).reshape(-1, 3)
    UV = np.stack([(np.degrees(LO) + 180) / 360, (np.degrees(LA) + 90) / 180], -1).reshape(-1, 2)
    i = np.arange((nu + 1) * (nv + 1)).reshape(nv + 1, nu + 1)
    F = np.stack([i[:-1, :-1].ravel(), i[:-1, 1:].ravel(), i[1:, 1:].ravel(), i[1:, :-1].ravel()], 1)
    e = mesh('earth', V, F, earth_mat(red_keys, night_keys), uv=UV)
    # atmosphere shell: additive blue fresnel glow
    am = bpy.data.materials.new('atmo'); am.use_nodes = True; nt = am.node_tree; nt.nodes.clear()
    try: am.surface_render_method = 'BLENDED'
    except Exception: pass
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.08
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 2.5; nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = cz.col('#4aa0ff'); em.inputs[1].default_value = 3.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); ad = nt.nodes.new('ShaderNodeAddShader')
    mu = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(pw.outputs[0], mu.inputs[0])
    nt.links.new(tr.outputs[0], mu.inputs[1]); nt.links.new(em.outputs[0], mu.inputs[2])
    nt.links.new(mu.outputs[0], o.inputs[0])
    a = cz.sphere('atmo', G * 1.025, mat=am, ol=0, segs=128, rings=64)
    a.visible_shadow = False
    return e


def frame_at(lat, lon, heading=90.0):
    """Matrix: origin on the surface, Z = up (normal), Y = heading (deg from north toward east)."""
    n = ll(lat, lon).normalized()
    north = Vector((0, 0, 1)) - n * n.z; north.normalize()
    east = north.cross(n)
    h = math.radians(heading)
    fwd = (north * math.cos(h) + east * math.sin(h)).normalized(); side = fwd.cross(n)
    m = Matrix((side, fwd, n)).transposed().to_4x4(); m.translation = ll(lat, lon)
    return m


def path_pt(k):
    """The crawl route Everest -> Pacific coast (k 0..1): lat/lon."""
    return (EV[0] + (60 - EV[0]) * k - 2 * math.sin(k * math.pi), EV[1] + (122 - EV[1]) * k)   # round 3: north over the green Baikal country (ref)


def trail(name, n=200, w=0.3, lift=0.04):
    """Dark ribbon along the crawl route, UV.x = route fraction; material hides UV.x > reveal (keyed)."""
    verts, faces, uv = [], [], []
    for i in range(n + 1):
        k = i / n; la, lo = path_pt(k); la2, lo2 = path_pt(min(1, k + 1e-3))
        p = ll(la, lo, G + lift); q = ll(la2, lo2, G + lift); nrm = p.normalized()
        s = (q - p).cross(nrm).normalized() * w
        verts += [p - s, p + s]; uv += [(k, 0), (k, 1)]
        if i: faces.append((2 * i - 2, 2 * i - 1, 2 * i + 1, 2 * i))
    m = bpy.data.materials.new(name + '_m'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    try: m.surface_render_method = 'DITHERED'
    except Exception: pass
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = cz.col('#101014'); p.inputs['Roughness'].default_value = 0.35
    tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['UV'], sp.inputs[0])
    rv = nt.nodes.new('ShaderNodeValue'); rv.name = 'reveal'
    lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; nt.links.new(sp.outputs[0], lt.inputs[0]); nt.links.new(rv.outputs[0], lt.inputs[1])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lt.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(p.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    ob = mesh(name, verts, faces, m, uv=uv, smooth=False)
    return ob, rv


def swarm(name, n=4200, seed=7):
    """The crawling crowd: thousands of tiny dark-maroon figures (a body + head each) in a comet-shaped blob around
    the origin, heading +Y (they pull the slab), local frame Z = up. One joined mesh."""
    rnd = random.Random(seed)
    verts, faces = [], []
    def boxv(c, sx, sy, sz):
        k = len(verts)
        for dz in (0, sz):
            for dx, dy in ((-sx, -sy), (sx, -sy), (sx, sy), (-sx, sy)): verts.append((c[0] + dx, c[1] + dy, c[2] + dz))
        faces.extend([(k, k + 1, k + 2, k + 3), (k + 4, k + 7, k + 6, k + 5), (k, k + 4, k + 5, k + 1), (k + 1, k + 5, k + 6, k + 2),
                      (k + 2, k + 6, k + 7, k + 3), (k + 3, k + 7, k + 4, k)])
    for i in range(n):
        # comet: dense head ring around the marker, tail streaming behind (-Y) on both sides of the trail
        if rnd.random() < 0.45:
            a = rnd.uniform(0, 2 * math.pi); r = 0.5 + abs(rnd.gauss(0, 0.9))
            x, y = r * math.cos(a) * 1.3, r * math.sin(a) * 0.9 + 0.3
        else:
            y = -rnd.uniform(0, 9) ** 1.1; side = 0
            x = rnd.gauss(0, 0.75 + 0.05 * -y)
        s = rnd.uniform(0.8, 1.25) * 0.2
        boxv((x, y, 0), s * 0.32, s * 0.22, s * 1.25)
        boxv((x, y, s * 1.3), s * 0.25, s * 0.25, s * 0.55)
    m = M.pbr(name + '_m', '#2e161c', rough=0.55, noise=0.45)
    return mesh(name, verts, faces, m, smooth=False)


def marker(name):
    """Everest as seen from orbit: a small glowing green block (the slab, x-rayed)."""
    m = M.emit(name + '_m', '#7dff7a', 9.0)
    b = cz.cyl(name, 0.38, 0.7, mat=m, ol=0, verts=24)
    h = cz.sphere(name + '_halo', 0.85, mat=M.xray(name + '_xr', '#5cff6a', alpha=0.45, strength=3.0), ol=0, parent=b)   # round 3: the enrich's glowing dome
    h.location = (0, 0, 0.1); h.scale = (1, 1, 0.75)
    return b


def counter(cam, keys, f0, f1, show):
    mt = M.emit('years_m', '#ff4a72', 6.0)
    a = M.text3d('years_n', '1281', 0.17, (0, 0.24, -1.6), rot=(0, 0, 0), mat=mt, extrude=0.012)
    b = M.text3d('years_w', 'years', 0.12, (0, 0.1, -1.6), rot=(0, 0, 0), mat=mt, extrude=0.012)
    for o in (a, b): o.parent = cam
    M.count_text(a, '{:.0f}', keys, f0, f1)
    for o in (a, b): M.visible(o, show, f0, f1)
    return a, b


def foam_mat(name='c_foam', density=0.5, scale=1.2):
    """Broken white sea foam (the enrich targets put foam lines where the water meets the steel): noise-thresholded
    alpha, rough white, a touch of emission so it reads in the shade."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = cz.col('#eef4f6'); p.inputs['Roughness'].default_value = 0.8
    p.inputs['Emission Color'].default_value = cz.col('#cfe2ea'); p.inputs['Emission Strength'].default_value = 0.15
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = scale; nz.inputs['Detail'].default_value = 12; nz.inputs['Roughness'].default_value = 0.65
    nt.links.new(tc.outputs['Object'], nz.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 1 - density * 0.5; mr.inputs['From Max'].default_value = 1 - density * 0.5 + 0.08
    nt.links.new(nz.outputs['Fac'], mr.inputs['Value'])
    # fade toward the ring's outer edge (UV.y = 0 inner .. 1 outer)
    sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['UV'], sp.inputs[0])
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; nt.links.new(sp.outputs[1], inv.inputs[1])
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = 1.5; nt.links.new(inv.outputs[0], pw.inputs[0])
    mu = nt.nodes.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'; nt.links.new(mr.outputs[0], mu.inputs[0]); nt.links.new(pw.outputs[0], mu.inputs[1])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mu.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(p.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def foam_ring(name, r0, r1, z, mat, nu=200, loc=(0, 0)):
    verts, faces, uv = [], [], []
    for i in range(nu):
        a = i / nu * 2 * math.pi
        for k, r in enumerate((r0, r1)):
            verts.append((loc[0] + r * math.cos(a), loc[1] + r * math.sin(a), z)); uv.append((i / nu, k))
    for i in range(nu):
        j = (i + 1) % nu; faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    ob = mesh(name, verts, faces, mat, uv=uv, smooth=False); ob.visible_shadow = False
    return ob


def ssr(on=True):
    """Screen-space reflections only (the brief: metal/water shots, frame <= 1.5 s): the slab and sun mirrored in the
    sea like the reference. EEVEE raytracing with the SCREEN method, low resolution, no denoise cost."""
    ee = bpy.context.scene.eevee
    ee.use_raytracing = on
    try:
        ee.ray_tracing_method = 'SCREEN'
        o = ee.ray_tracing_options; o.resolution_scale = '4'; o.screen_trace_quality = 0.3; o.use_denoise = True
    except Exception as e: print('CZ ssr', e)


def _fcurves(idb):
    ad = getattr(idb, 'animation_data', None)
    if not ad or not ad.action: return []
    try: return list(ad.action.fcurves)
    except Exception: pass
    out = []
    for lay in ad.action.layers:
        for st in lay.strips:
            for cb in st.channelbags: out += list(cb.fcurves)
    return out


def hard_cuts(cam, frames):
    """Engine wish workaround: M.Flight's cuts still interpolate LINEARLY between the last frame before a cut and
    the first after it, so motion blur (shutter around the frame) smears the two views together on the cut frame.
    Make the key just before each cut CONSTANT (cam object + its lens) and open the shutter AT the frame (START)
    so no frame's shutter spans a cut."""
    try: bpy.context.scene.render.motion_blur_position = 'START'
    except Exception as e: print('CZ blurpos', e)
    for idb in (cam, cam.data):
        for fc in _fcurves(idb):
            for k in fc.keyframe_points:
                if any(abs(k.co[0] - (f - 1)) < 0.01 for f in frames): k.interpolation = 'CONSTANT'


def fade_card(cam, img, keys, f0, f1, dist=1.0, uv_box=(0.68, 0.58, 0.80, 0.80)):
    """A camera-locked picture card faded by keys [(t, 0..1)]: the reference's cross-dissolve into the next shot
    (E23 1198-1205 dissolves the globe into the coast map). uv_box crops the picture."""
    m = bpy.data.materials.new('fade_card'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
    u0, v0, u1, v1 = uv_box
    mp.inputs['Location'].default_value = (u0, v0, 0); mp.inputs['Scale'].default_value = (u1 - u0, v1 - v0, 1)
    nt.links.new(tc.outputs['UV'], mp.inputs[0])
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = cz.image(img); nt.links.new(mp.outputs[0], tx.inputs[0])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[1].default_value = 0.9; nt.links.new(tx.outputs[0], em.inputs[0])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    av = nt.nodes.new('ShaderNodeValue'); av.name = 'fade'
    nt.links.new(av.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    for tt, v in keys:
        av.outputs[0].default_value = v; av.outputs[0].keyframe_insert('default_value', frame=round(tt * FPS) + 1)
    h = 2 * dist * 12 / 30 * 1.1; w = h * 9 / 16 * 1.05
    c = cz.plane('fade_card', w, h, loc=(0, 0, -dist), mat=m, rot=(0, 0, 0)); c.parent = cam
    c.visible_shadow = False
    M.visible(c, [(keys[0][0], 99)], f0, f1)
    return c


# ------------------------------------------------------------------ sea set
WL = -5.5                       # water level (the steel platform is half under water)
PR = 9.6                        # platform radius


def islands(mt, seed=11):
    """Low snowy rocky islands on the horizon and a few near ones (the reference's foreground floes)."""
    rnd = random.Random(seed); out = []
    spots = [(-80, 140, 22), (90, 170, 26), (-160, 60, 30), (170, -40, 26), (40, 230, 30), (-40, -170, 24),
             (-34, -40, 9), (36, 30, 7), (-30, 60, 10), (22, -186, 9), (-17, -186, 5), (180, 120, 34), (-200, -120, 30)]
    for i, (x, y, r) in enumerate(spots):
        f = M.mountain_fn(peak_h=r * (0.6 if r < 12 else 0.35), radius=r, seed=seed + i, ridge=0.6, sharp=(0.7 if r < 12 else 1.2))
        ob = M.heightfield(f'isle{i}', 2.2 * r, 90, lambda X, Y, f=f, r=r: f(X, Y) - 0.06 * r, mat=mt['snow'], loc=(x, y, WL - 0.3))
        ob.rotation_euler.z = rnd.uniform(0, 6.3); out.append(ob)
    return out


def platform(mt):
    """The steel platform under the slab: paneled steel drum (grid seams), dark belt, copper fin ring under the rock."""
    root = cz.empty('plat')
    grid = M.steel('plat_steel', color='#b9bfc8', rough=0.25, panels=1.0, panel_scale=1.1,
                   img=None, scale=0.6)
    d = cz.cyl('plat_drum', PR, 16, loc=(0, 0, -16), mat=grid, ol=0, verts=160, parent=root)
    # vertical + horizontal frame ribs (the reference's square grid)
    rib = M.steel('rib_steel', color='#8e939b', rough=0.3)
    ribs = []
    for i in range(120):
        a = i / 120 * 2 * math.pi
        ribs.append(cz.box(f'rib{i}', (0.07, 0.12, 16), loc=((PR + 0.05) * math.cos(a), (PR + 0.05) * math.sin(a), -8), rot=(0, 0, math.degrees(a)), mat=rib, ol=0, bevel=0))
    for j in range(15):
        ribs.append(cz.cyl(f'hoop{j}', PR + 0.09, 0.14, loc=(0, 0, -15.6 + j * 1.05), mat=rib, ol=0, verts=160))
    rj = M.join('plat_ribs', ribs); rj.parent = root
    belt = cz.cyl('plat_belt', PR + 0.25, 0.7, loc=(0, 0, -0.75), mat=mt['dark'], ol=0, verts=160, parent=root)
    # copper fins: a dense comb under the rock
    fins = []
    for i in range(300):
        a = i / 300 * 2 * math.pi
        fins.append(cz.box(f'fin{i}', (0.3, 0.07, 1.5), loc=((PR + 0.3) * math.cos(a), (PR + 0.35) * math.sin(a), -0.15), rot=(0, 0, math.degrees(a)), mat=mt['copper'], ol=0, bevel=0.02))
    fj = M.join('plat_fins', fins); fj.parent = root
    ring = cz.cyl('plat_cring', PR + 0.6, 0.18, loc=(0, 0, 0.35), mat=mt['copper'], ol=0, verts=160, parent=root)
    for j, zz in enumerate((-1.7, -3.1)):       # round 3 (enrich): copper scaffold bands round the drum
        cz.cyl(f'plat_band{j}', PR + 0.16, 0.22, loc=(0, 0, zz), mat=mt['copper'], ol=0, verts=160, parent=root)
    return root


def beams(n=44):
    """Yellow radial beams on the water (the reference's 'attach' moment): one joined mesh, scale keyed by caller."""
    ym = M.pbr('beam_y', '#d99a00', rough=0.35, metal=0.0, emit='#c88a00', emit_strength=0.3)
    parts = []
    for i in range(n):
        a = (i + 0.5) / n * 2 * math.pi; L = 12 + (i % 3) * 2.5
        c = (PR + L / 2) ; parts.append(cz.box(f'bm{i}', (L, 0.24, 0.2), loc=(c * math.cos(a), c * math.sin(a), WL + 0.15), rot=(0, 0, math.degrees(a)), mat=ym, ol=0, bevel=0.03))
        # cross teeth along each beam (the comb look)
        for k in range(3):
            r = PR + 2 + k * 3.5
            parts.append(cz.box(f'bt{i}_{k}', (0.22, 0.8, 0.16), loc=(r * math.cos(a), r * math.sin(a), WL + 0.12), rot=(0, 0, math.degrees(a)), mat=ym, ol=0, bevel=0.02))
    return M.join('beams', parts)


def tank_ring(name, mat, n=40, r0=PR + 1.5, L=6.6, rad=0.62, z=WL + 0.05):
    """The ballast tank ring: n horizontal capsules pointing out radially, half sunk."""
    proto = cz.capsule(name + '_p', rad, L, mat=mat, ol=0)
    proto.data.shade_smooth()
    out = []
    for i in range(n):
        a = i / n * 2 * math.pi
        o = proto.copy(); bpy.context.scene.collection.objects.link(o)
        o.rotation_euler = (0, math.radians(90), a)
        o.location = (r0 * math.cos(a), r0 * math.sin(a), z)
        out.append(o)
    bpy.data.objects.remove(proto)
    root = cz.empty(name)
    for o in out: o.parent = root
    return root, out


def deck(mt):
    """Dark steel deck annulus at the water line around the platform + bolts/bollards."""
    inner, outer, nu = PR + 0.1, PR + 3.0, 160
    verts, faces = [], []
    for i in range(nu):
        a = i / nu * 2 * math.pi
        for r in (inner, outer): verts.append((r * math.cos(a), r * math.sin(a), WL + 0.35))
    for i in range(nu):
        j = (i + 1) % nu; faces.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    return mesh('deck', verts, faces, M.pbr('deck_m', '#2b2e33', rough=0.6, metal=0.6, noise=0.3), smooth=False)


def sea_mat():
    """Deep teal sea that stays dark at grazing angles (M.water reflects the near-white horizon sky as white):
    low specular, slight roughness, fresnel-darkened reflection, small ripples for the sun glints."""
    m = bpy.data.materials.get('c_sea3')
    if m: return m
    m = bpy.data.materials.new('c_sea3'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = cz.col('#06263a')
    p.inputs['Roughness'].default_value = 0.09; p.inputs['Specular IOR Level'].default_value = 0.22
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.2; nz.inputs['Detail'].default_value = 10
    nt.links.new(tc.outputs['Object'], nz.inputs[0])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.55
    nt.links.new(nz.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    p.inputs['Specular IOR Level'].default_value = 0.0
    g = nt.nodes.new('ShaderNodeBsdfGlossy'); g.inputs['Color'].default_value = cz.col('#173f50'); g.inputs['Roughness'].default_value = 0.06
    nt.links.new(b.outputs[0], g.inputs['Normal'])
    mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.4
    nt.links.new(p.outputs[0], mx.inputs[1]); nt.links.new(g.outputs[0], mx.inputs[2])
    # round 3 (enrich targets): foam painted into the sea itself where it meets the platform (radius from the slab
    # axis, world coords): dense at the drum, broken over the tank ring, gone by ~2 slab radii
    gc = nt.nodes.new('ShaderNodeNewGeometry'); sp = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(gc.outputs['Position'], sp.inputs[0])
    cx = nt.nodes.new('ShaderNodeCombineXYZ'); nt.links.new(sp.outputs[0], cx.inputs[0]); nt.links.new(sp.outputs[1], cx.inputs[1])
    ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'; nt.links.new(cx.outputs[0], ln.inputs[0])
    fr = nt.nodes.new('ShaderNodeMapRange'); fr.inputs['From Min'].default_value = PR + 0.3; fr.inputs['From Max'].default_value = PR + 7; fr.inputs['To Min'].default_value = 1.0; fr.inputs['To Max'].default_value = 0.0
    nt.links.new(ln.outputs['Value'], fr.inputs['Value'])
    fn = nt.nodes.new('ShaderNodeTexNoise'); fn.inputs['Scale'].default_value = 2.6; fn.inputs['Detail'].default_value = 12; fn.inputs['Roughness'].default_value = 0.68
    nt.links.new(gc.outputs['Position'], fn.inputs[0])
    fm = nt.nodes.new('ShaderNodeMath'); fm.operation = 'MULTIPLY_ADD'; nt.links.new(fn.outputs['Fac'], fm.inputs[0]); nt.links.new(fr.outputs[0], fm.inputs[1]); fm.inputs[2].default_value = 0.0
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; nt.links.new(fr.outputs[0], pw.inputs[0]); pw.inputs[1].default_value = 4.0
    ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'ADD'; nt.links.new(fm.outputs[0], ad.inputs[0]); nt.links.new(pw.outputs[0], ad.inputs[1])
    th = nt.nodes.new('ShaderNodeMapRange'); th.inputs['From Min'].default_value = 0.82; th.inputs['From Max'].default_value = 1.0; nt.links.new(ad.outputs[0], th.inputs['Value'])
    fw = nt.nodes.new('ShaderNodeBsdfPrincipled'); fw.inputs['Base Color'].default_value = cz.col('#e8f0f2'); fw.inputs['Roughness'].default_value = 0.7
    m2 = nt.nodes.new('ShaderNodeMixShader'); nt.links.new(th.outputs[0], m2.inputs[0]); nt.links.new(mx.outputs[0], m2.inputs[1]); nt.links.new(fw.outputs[0], m2.inputs[2])
    nt.links.new(m2.outputs[0], o.inputs[0])
    return m


def sea_set(f0, f1, beams_keys=None, xr_keys=None, tanks_from=None, hulls=False, hull_xr_keys=None, deck_on=True):
    """The whole Pacific set around the slab. beams_keys [(t, scale 0..1)], xr_keys [(t, 0..1)] the green tank
    ring opacity, tanks_from: time the dark tank ring appears. Returns dict."""
    mt = C.mats()
    out = dict(mt=mt)
    out['slab'] = C.slab('slab', mt)
    out['plat'] = platform(mt)
    out['deck'] = deck(mt) if deck_on else None
    sea_m = sea_mat()
    out['sea'] = M.ocean('sea', size=300, res=12, wave=1.3, choppy=1.5, mat=sea_m, f0=f0, f1=f1, loc=(0, 0, WL), spatial=1.0)
    # round 3: a second, fine wave scale on top of the swell (displace mode, 36 m patches): chop + glints near camera
    m2 = out['sea'].modifiers.new('chop', 'OCEAN'); m2.geometry_mode = 'DISPLACE'; m2.spatial_size = 36; m2.resolution = 9
    m2.wave_scale = 0.35; m2.choppiness = 1.4; m2.wind_velocity = 9; m2.random_seed = 7
    m2.time = 0.0; m2.keyframe_insert('time', frame=f0); m2.time = (f1 - f0) / FPS; m2.keyframe_insert('time', frame=f1)
    far = cz.plane('sea_far', 8000, 8000, loc=(0, 0, WL - 1.7), mat=sea_m, rot=(0, 0, 0)); out['far'] = far
    # round 3 (enrich targets): foam where the sea meets the steel, broken foam over the tank ring
    islands(mt)
    if beams_keys:
        b = beams(); out['beams'] = b
        for tt, s in beams_keys:
            b.scale = (max(s, 0.001),) * 2 + (1,); b.keyframe_insert('scale', frame=round(tt * FPS) + 1)
        M.visible(b, [(beams_keys[0][0], beams_keys[-1][0] + 0.01)], f0, f1)
    if xr_keys:
        xm = M.xray('tank_xr', '#3cff4a', alpha=0.6, strength=2.2)
        r, objs = tank_ring('tanks_xr', xm, z=WL + 0.25)
        M.xray_fade(xm, xr_keys); out['xr'] = xm
    if tanks_from is not None:
        tm = M.steel('tank_steel', '#3a3e44', rough=0.35)
        r, objs = tank_ring('tanks', tm, z=WL + 0.1)
        M.visible(r, [(tanks_from, 99)], f0, f1)
    if hulls:
        hx = M.xray('hull_xr', '#3cff4a', alpha=0.6, strength=2.2)
        if hull_xr_keys: M.xray_fade(hx, hull_xr_keys)
        hs = []
        for i, a in enumerate((-90, -40, -140)):
            h, tk = hull(mt, hx)
            ar = math.radians(a); rr = PR + 9.5 + (0 if i == 0 else 4)
            h.location = (rr * math.cos(ar), rr * math.sin(ar), WL + 2.2); h.rotation_euler.z = ar + math.pi
            hs.append(h)
        out['hulls'] = hs
    return out


def hull(mt, xr):
    """The pump hull: a ship-like steel hull under the platform edge (white superstructure, railings, cranes),
    green x-ray ballast tanks inside. Built along +X, bow at +X. Returns root."""
    root = cz.empty('hull')
    Lh, Wh, Dh = 22.0, 7.5, 4.2
    secs = 28; verts = []; faces = []
    prof = [(-1, 1), (-1, 0.25), (-0.8, -0.05), (-0.45, -0.18), (0, -0.2), (0.45, -0.18), (0.8, -0.05), (1, 0.25), (1, 1)]
    for s in range(secs + 1):
        u = s / secs; x = (u - 0.5) * Lh
        wk = 1.0                                   # barge: open U ends (the reference sees the tanks through them)
        for py, pz in prof: verts.append((x, py * Wh / 2, (pz - 1) * Dh + Dh * 0.5))
    n = len(prof)
    for s in range(secs):
        for k in range(n - 1):
            a = s * n + k; faces.append((a, a + 1, a + n + 1, a + n))
    hm = M.pbr('hull_m', '#2f4f78', rough=0.45, metal=0.3, noise=0.2)
    h = mesh('hull_body', verts, faces, hm); h.parent = root
    white = M.pbr('hull_white', '#a7adb5', rough=0.45, metal=0.35, noise=0.2)      # round 3: grey like the reference
    red = M.pbr('hull_red', '#c23a2a', rough=0.5)
    cz.box('hull_deck', (Lh * 0.95, Wh, 0.2), loc=(0, 0, Dh * 0.5), mat=mt['dark'], ol=0, parent=root)
    for sd in (-1, 1): cz.box(f'hull_band{sd}', (Lh * 0.98, 0.08, 0.5), loc=(0, sd * Wh * 0.505, -1.7), mat=red, ol=0, parent=root)
    # superstructure: stacked white blocks with window strips + railings
    win = M.emit('hull_win', '#cfe6ff', 1.2)
    parts = []
    for i, (x, w, hgt, wd) in enumerate([(-5, 11, 1.7, 0.92), (-5.2, 10, 1.6, 0.9), (-5.6, 8.5, 1.5, 0.86), (-6.5, 5, 1.3, 0.8), (3.5, 3.5, 1.2, 0.6)]):   # round 3: wide deckhouse, small setbacks (no cake)
        z0 = Dh * 0.5 + {1: 1.7, 2: 3.3, 3: 4.8}.get(i, 0)
        parts.append(cz.box(f'hs{i}', (w, Wh * wd, hgt), loc=(x, 0, z0 + hgt / 2), mat=white, ol=0, bevel=0.05))
        for k in range(int(w / 0.7)):
            cz.box(f'hw{i}_{k}', (0.35, Wh * wd + 0.02, 0.3), loc=(x - w / 2 + 0.4 + k * 0.7, 0, z0 + hgt * 0.7), mat=win, ol=0, bevel=0, parent=root)
    for o in parts: o.parent = root
    rail = M.steel('hull_rail', '#d8dbe0', rough=0.3)
    rs = []
    for side in (-1, 1):
        for k in range(40):
            rs.append(cz.box(f'rp{side}_{k}', (0.05, 0.05, 0.6), loc=(-Lh * 0.45 + k * Lh * 0.9 / 40, side * Wh * 0.48, Dh * 0.5 + 0.4), mat=rail, ol=0, bevel=0))
        rs.append(cz.box(f'rt{side}', (Lh * 0.9, 0.05, 0.05), loc=(0, side * Wh * 0.48, Dh * 0.5 + 0.7), mat=rail, ol=0, bevel=0))
    for k in range(6):
        rs.append(cz.cyl(f'pipe{k}', 0.25, Wh * 0.9, loc=(-9 + k * 3.2, Wh * 0.45, Dh * 0.5 + 0.5), rot=(90, 0, 0), mat=mt['yellow'], ol=0, verts=16, origin='center'))
    j = M.join('hull_rails', rs, apply=True); j.parent = root
    # ---- superstructure detail (the reference's dense offshore-vessel look): deck-edge railings on every house
    # level, zig-zag stairs, two cranes, pipe racks, vents, radar mast, lifeboats, deck lights
    top = Dh * 0.5
    det = []
    houses = [(-5, 11, 1.7, 0.92, 0), (-5.2, 10, 1.6, 0.9, 1.7), (-5.6, 8.5, 1.5, 0.86, 3.3), (-6.5, 5, 1.3, 0.8, 4.8), (3.5, 3.5, 1.2, 0.6, 0)]
    for hi, (x, w, hgt, wd, zo) in enumerate(houses):
        zt = top + zo + hgt; yw = Wh * wd / 2
        n = int(w / 0.35)
        for k in range(n + 1):
            for sd in (-1, 1):
                det.append(cz.box(f'hp{hi}_{k}_{sd}', (0.035, 0.035, 0.45), loc=(x - w / 2 + k * w / n, sd * (yw - 0.05), zt + 0.22), mat=rail, ol=0, bevel=0))
        for sd in (-1, 1):
            det.append(cz.box(f'hr{hi}_{sd}', (w, 0.04, 0.04), loc=(x, sd * (yw - 0.05), zt + 0.45), mat=rail, ol=0, bevel=0))
            det.append(cz.box(f'hm{hi}_{sd}', (w, 0.03, 0.03), loc=(x, sd * (yw - 0.05), zt + 0.25), mat=rail, ol=0, bevel=0))
        # balcony slab sticking out under each level
        det.append(cz.box(f'hb{hi}', (w + 0.5, Wh * wd + 0.6, 0.08), loc=(x, 0, top + zo + 0.04), mat=white, ol=0, bevel=0))
    # zig-zag stairs on both sides of the main house
    for sd in (-1, 1):
        for fl in range(3):
            z0 = top + fl * 1.9
            for s in range(9):
                det.append(cz.box(f'st{sd}_{fl}_{s}', (0.28, 0.7, 0.06), loc=(-10 + (s * 0.24 if fl % 2 == 0 else 2.0 - s * 0.24), sd * (Wh * 0.42), z0 + s * 0.21), mat=rail, ol=0, bevel=0))
            det.append(cz.box(f'sr{sd}_{fl}', (2.3, 0.03, 0.03), loc=(-9.0, sd * (Wh * 0.42 + 0.36), z0 + 1.2), rot=(0, -math.degrees(math.atan2(1.9, 2.1)) * (1 if fl % 2 == 0 else -1), 0), mat=rail, ol=0, bevel=0))
    # cranes: pedestal, cab, lattice-ish boom, hook cable
    yel = mt['yellow']
    for ci, (cx, cy, ang) in enumerate([(1.5, -2.2, 35), (6.5, 2.0, -140)]):
        det.append(cz.cyl(f'cp{ci}', 0.45, 2.2, loc=(cx, cy, top), mat=yel, ol=0, verts=16))
        det.append(cz.box(f'cc{ci}', (1.0, 0.8, 0.8), loc=(cx, cy, top + 2.6), mat=yel, ol=0, bevel=0.05))
        a = math.radians(ang); L = 7.0
        mx_, my_ = cx + math.cos(a) * L / 2, cy + math.sin(a) * L / 2
        for off in (-0.18, 0.18):
            det.append(cz.box(f'cb{ci}_{off}', (L, 0.1, 0.1), loc=(mx_ - math.sin(a) * off, my_ + math.cos(a) * off, top + 3.4), rot=(0, -18, ang), mat=yel, ol=0, bevel=0))
        for k in range(10):
            u = (k + 0.5) / 10
            det.append(cz.box(f'cl{ci}_{k}', (0.06, 0.4, 0.06), loc=(cx + math.cos(a) * L * u, cy + math.sin(a) * L * u, top + 2.9 + u * L * 0.32), rot=(0, 0, ang), mat=yel, ol=0, bevel=0))
        tx, ty = cx + math.cos(a) * L * 0.95, cy + math.sin(a) * L * 0.95
        det.append(cz.cyl(f'ck{ci}', 0.02, 3.0, loc=(tx, ty, top + 2.6), mat=mt['dark'], ol=0, verts=6))
    # pipe racks along the open deck + vents + lifeboats + radar mast
    for k in range(4):
        det.append(cz.cyl(f'pr{k}', 0.12, 8.0, loc=(-1 + 4, -Wh * 0.3 + k * 0.28, top + 0.35), rot=(0, 90, 0), mat=mt['copper'] if k % 2 else rail, ol=0, verts=10, origin='center'))
    for k in range(6):
        det.append(cz.cyl(f'vt{k}', 0.16, 0.7, loc=(-4 + k * 1.3, Wh * 0.33, top), mat=white, ol=0, verts=12))
        det.append(cz.cyl(f'vc{k}', 0.24, 0.08, loc=(-4 + k * 1.3, Wh * 0.33, top + 0.7), mat=mt['dark'], ol=0, verts=12))
    orange = M.pbr('hull_orange', '#ff6a1a', rough=0.5)
    for sd in (-1, 1):
        for li, lx in enumerate((-9.2, -6.6, -4.0, -1.4)):       # round 3: a row of lifeboats in davits per side
            det.append(cz.capsule(f'lb{sd}_{li}', 0.42, 2.2, mat=orange, ol=0))
            det[-1].rotation_euler = (0, math.radians(90), 0); det[-1].location = (lx - 1.1, sd * (Wh * 0.5 + 0.35), top + 2.4)
            for dx in (-0.8, 0.8):
                det.append(cz.box(f'dv{sd}_{li}_{dx}', (0.08, 0.6, 0.08), loc=(lx + dx, sd * (Wh * 0.5 + 0.1), top + 3.0), mat=rail, ol=0, bevel=0))
    for mi, (mx_, mh) in enumerate(((-3.0, 3.0), (1.0, 2.2))):          # masts with yardarms + lamps
        det.append(cz.cyl(f'mst{mi}', 0.06, mh, loc=(mx_, 0, top + 4.8 if mi == 0 else top + 1.7), mat=rail, ol=0, verts=8))
        det.append(cz.box(f'yd{mi}', (0.06, 1.6, 0.06), loc=(mx_, 0, (top + 4.8 if mi == 0 else top + 1.7) + mh * 0.8), mat=rail, ol=0, bevel=0))
    for k in range(5):                                                    # vertical exhaust / riser pipes up the house faces
        for sd in (-1, 1):
            det.append(cz.cyl(f'rs{k}_{sd}', 0.09, 4.6, loc=(-9.5 + k * 2.2, sd * (Wh * 0.46 + 0.08), top), mat=mt['copper'] if k % 2 else rail, ol=0, verts=8))
    for sd in (-1, 1):                                                    # outside stair towers on the house ends
        for s in range(22):
            det.append(cz.box(f'ts{sd}_{s}', (0.6, 0.26, 0.05), loc=(0.75 + (0.3 if (s // 6) % 2 else 0), sd * (Wh * 0.3 - (s % 6) * 0.26), top + s * 0.27), mat=rail, ol=0, bevel=0))
    det.append(cz.cyl('mast', 0.08, 3.5, loc=(-7.8, 0, top + 6.1), mat=rail, ol=0, verts=8))
    det.append(cz.box('radar', (1.6, 0.12, 0.12), loc=(-7.8, 0, top + 9.4), mat=white, ol=0, bevel=0))
    lamp = M.emit('hull_lamp', '#fff2cc', 6.0)
    for k in range(8):
        det.append(cz.sphere(f'dl{k}', 0.08, loc=(-10 + k * 2.6, (-1) ** k * Wh * 0.45, top + 0.9), mat=lamp, ol=0, segs=8, rings=4))
    # round 3: window rows on every house face (dark glass with a faint sky reflection), a bridge with a sloped
    # glass front and wings, AC units on the roofs
    glass = M.pbr('hull_glass', '#1b2633', rough=0.08, metal=0.6, emit='#9fc4e8', emit_strength=0.15)
    for hi, (x, w, hgt, wd, zo) in enumerate(houses):
        z0 = top + zo; yw = Wh * wd / 2
        rows = max(1, int(hgt / 0.75))
        for r in range(rows):
            zr = z0 + (r + 0.6) * hgt / (rows + 0.2)
            for sd in (-1, 1):
                det.append(cz.box(f'gwy{hi}_{r}_{sd}', (w * 0.86, 0.03, 0.28), loc=(x, sd * (yw + 0.012), zr), mat=glass, ol=0, bevel=0))
            for sx in (-1, 1):
                det.append(cz.box(f'gwx{hi}_{r}_{sx}', (0.03, Wh * wd * 0.8, 0.28), loc=(x + sx * (w / 2 + 0.012), 0, zr), mat=glass, ol=0, bevel=0))
        for k in range(int(w / 1.2)):
            det.append(cz.box(f'ac{hi}_{k}', (0.5, 0.45, 0.3), loc=(x - w / 2 + 0.6 + k * 1.2, (-1) ** k * yw * 0.4, z0 + hgt + 0.15), mat=rail, ol=0, bevel=0.03))
    bz = top + 6.1
    det.append(cz.box('bridge', (2.2, Wh * 1.05, 1.1), loc=(-7.2, 0, bz + 0.55), mat=white, ol=0, bevel=0.04))
    det.append(cz.box('bridge_glass', (0.06, Wh * 1.0, 0.55), loc=(-6.08, 0, bz + 0.7), rot=(0, -18, 0), mat=glass, ol=0, bevel=0))
    for sd in (-1, 1):
        det.append(cz.box(f'bwing{sd}', (1.2, 0.9, 0.12), loc=(-7.0, sd * (Wh * 0.52 + 0.4), bz + 0.1), mat=white, ol=0, bevel=0.02))
    dj = M.join('hull_detail', det, apply=True); dj.parent = root
    # closed far end (toward the platform) + lit ceiling strip and green ballast floor seen through the open end
    cz.box('hull_endplate', (0.15, Wh * 0.98, Dh * 1.15), loc=(Lh / 2 - 0.2, 0, -0.4), mat=hm, ol=0, parent=root)
    cz.box('hull_floor', (Lh * 0.95, Wh * 0.6, 0.3), loc=(0, 0, -2.5), mat=xr, ol=0, parent=root)
    for k in range(7): cz.box(f'hull_cl{k}', (0.5, 0.25, 0.06), loc=(-Lh / 2 + 1.5 + k * 3, (-1) ** k * 1.6, Dh * 0.5 - 0.15), mat=lamp, ol=0, parent=root)
    # green x-ray tanks in the hull
    tk = []
    for k in range(2):
        tk.append(cz.capsule(f'htank{k}', 1.2, 19.0, mat=xr, ol=0))
        tk[-1].rotation_euler = (0, math.radians(90), 0); tk[-1].location = (-9.5, (-1.9, 1.9)[k], -1.4)
        tk[-1].parent = root
    return root, tk
