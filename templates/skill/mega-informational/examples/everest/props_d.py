# Group d props (E28-E32): reactor hall, slab skirt, Alaska terrain, eagle, flag, crowd, confetti, cloud cards.
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix
import cz, mega as M
import common as C

FPS = cz.FPS


def J(name, objs):
    """M.join + apply the result's transform (the active part's rotation must not ride along into instances)."""
    o = M.join(name, objs)
    for x in bpy.context.selected_objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return o


def lathe(name, prof, mat, segs=32, loc=(0, 0, 0)):
    """Surface of revolution from [(r, z)] (bottom to top), capped."""
    verts, faces = [], []
    n = len(prof)
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for r, z in prof: verts.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(segs):
        j = (i + 1) % segs
        for k in range(n - 1): faces.append((i * n + k, j * n + k, j * n + k + 1, i * n + k + 1))
    verts.append((0, 0, prof[0][1])); verts.append((0, 0, prof[-1][1]))
    b, t = len(verts) - 2, len(verts) - 1
    for i in range(segs):
        j = (i + 1) % segs
        faces.append((j * n, i * n, b)); faces.append((i * n + n - 1, j * n + n - 1, t))
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update(); me.shade_smooth()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    me.materials.append(mat)
    return ob


def beam(name, a, b, w, mat):
    a, b = Vector(a), Vector(b); d = b - a
    ob = cz.box(name, (w, w, d.length), loc=(a + b) / 2, mat=mat, bevel=0, ol=0)
    ob.rotation_mode = 'QUATERNION'; ob.rotation_quaternion = d.to_track_quat('Z', 'Y')
    return ob


def instance(src, loc, rot=0.0, scale=1.0, name=None):
    o = src.copy(); o.data = src.data; bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = (0, 0, math.radians(rot)); o.scale = (scale,) * 3
    if name: o.name = name
    return o


def mats_d():
    return dict(
        white=M.pbr('d_white', '#f6f7f8', rough=0.3, metal=0.0, noise=0.05, emit='#ffffff', emit_strength=0.12),
        truss=M.pbr('d_truss', '#3e4248', rough=0.35, metal=0.9, noise=0.25, bump=0.3, bump_scale=40),
        trussd=M.pbr('d_trussd', '#1e2024', rough=0.45, metal=0.8, noise=0.2),
        brass=M.pbr('d_brass', '#c9a15a', rough=0.3, metal=1.0),
        floor=M.pbr('d_floor', '#9aa0a8', rough=0.12, metal=0.6),
        rod=M.pbr('d_rod', '#e0a64a', rough=0.35, metal=0.6),
        sign=M.card_mat('d_sign', C.T('radiation_sign.png'), alpha=False),
        copper=M.pbr('d_cop', '#c8743a', rough=0.32, metal=1.0),
        ring=M.pbr('d_ring', '#4a3a2c', rough=0.55, metal=0.5, noise=0.5, bump=0.4),
        float=M.pbr('d_float', '#5a4634', rough=0.6, metal=0.4, noise=0.5, bump=0.3),
        cable=M.emit('d_cable', '#7dff5a', 3.0),
    )


def grating_mat(name='d_grating', cell=0.9, bar=0.18):
    """See-through steel grating deck: brick-texture mortar = bars (metal), cells = holes (alpha 0); a solid walkway
    band every few cells keeps it reading as a floor."""
    m, n = M._mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'DITHERED'
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick'); br.offset = 0.0; br.squash_frequency = 1
    br.inputs['Scale'].default_value = 1.0 / cell; br.inputs['Mortar Size'].default_value = bar
    br.inputs['Brick Width'].default_value = 1.0; br.inputs['Row Height'].default_value = 1.0
    nt.links.new(tc.outputs['Object'], br.inputs[0])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = cz.col('#5c6168')
    p.inputs['Metallic'].default_value = 0.7; p.inputs['Roughness'].default_value = 0.25
    nt.links.new(br.outputs['Fac'], p.inputs['Alpha'])     # Fac = 1 on mortar (bars)
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def reactor(md):
    """White reactor vessel: bottle body, dome, steam vent, radiation label, brass pipes. Returns one joined mesh."""
    parts = [None, lathe("rv", [(1.2, 0), (1.25, 0.2), (1.2, 0.3), (1.05, 1.6), (1.15, 2.6), (1.1, 2.8), (0.8, 3.3), (0.45, 3.5), (0.45, 3.9), (0.5, 4.0)], md['white'], 40)]
    for z in (0.35, 1.0, 2.5):
        parts.append(cz.cyl('rb', 1.24 if z < 1 else 1.18, 0.08, loc=(0, 0, z), mat=md['trussd'], verts=40, ol=0))
    parts[0] = cz.plane("rl", 0.62, 0.62, loc=(0, -1.15, 1.95), mat=md["sign"], rot=(84, 0, 0), ol=0)
    for k in range(4):
        a = k * math.pi / 2 + 0.4
        parts.append(cz.cyl('rp', 0.12, 1.6, loc=(1.45 * math.cos(a), 1.45 * math.sin(a), 0), mat=md['brass'], verts=12, ol=0))
        parts.append(cz.sphere('rk', 0.25, loc=(1.45 * math.cos(a), 1.45 * math.sin(a), 1.6), mat=md['brass'], segs=12, rings=8, ol=0))
    ob = J('reactor', parts)
    return ob


def tank(md):
    return J('tank', [lathe('tk', [(0.5, 0), (0.55, 0.1), (0.55, 1.0), (0.3, 1.3), (0.0, 1.35)], md['brass'], 20),
                           cz.box('cab', (1.6, 0.8, 0.9), loc=(1.4, 0, 0.45), mat=md['white'], bevel=0.04, ol=0)])


def steam(name='steam'):
    m = M.pbr('d_steam', '#ffffff', rough=1.0)
    m.surface_render_method = 'BLENDED'
    nt = m.node_tree; p = nt.nodes['Principled BSDF']; p.inputs['Alpha'].default_value = 0.5
    return lathe(name, [(0.4, 0), (0.6, 0.5), (0.9, 1.4), (0.5, 2.0), (0.0, 2.1)], m, 16)


def hall(md, nx=10, ny=10, levels=3, bay=8.0, lh=7.0, rs=1.0, per4=False):
    """Steel truss hall: decks of reactors per level, cross-braced beams, rods on the top deck."""
    R = reactor(md); T = tank(md); S = steam()
    out = dict(reactors=[], xr=[])
    deck = grating_mat()
    for lv in range(levels):
        z = lv * lh
        cz.box('deck%d' % lv, (nx * bay, ny * bay, 0.3), loc=(0, 0, z - 0.15), mat=deck, bevel=0, ol=0)
    # one bay of truss (joined), instanced
    w = 0.05 * bay; parts = []
    for lv in range(levels):
        z = lv * lh
        parts += [beam('b', (0, 0, z + lh - 0.4), (bay, 0, z + lh - 0.4), w, md['truss']),
                  beam('b', (0, 0, z + lh - 0.4), (0, bay, z + lh - 0.4), w, md['truss']),
                  beam('b', (0, 0, z + lh - 0.4), (bay, bay, z + lh - 0.4), w * 0.7, md['truss']),
                  beam('b', (0, 0, z), (0, 0, z + lh), w * 1.3, md['truss']),
                  beam('b', (0, 0, z), (bay, 0, z + lh - 0.4), w * 0.6, md['trussd']),
                  beam('b', (0, 0, z), (0, bay, z + lh - 0.4), w * 0.6, md['trussd'])]
    # enrich e28_1572: lamp panels under every deck + pipe runs on the floor (part of the instanced bay)
    lamp = M.emit('d_lamp', '#fff6e8', 1.4); pipe = md['brass']
    for lv in range(1, levels + 1):
        z = lv * lh
        parts.append(cz.box('lp', (bay * 0.5, 0.35, 0.06), loc=(bay * 0.5, bay * 0.5, z - 0.45), mat=lamp, bevel=0, ol=0))
    for lv in range(levels):
        z = lv * lh
        parts.append(beam('pp', (0, bay * 0.06, z + 0.12), (bay, bay * 0.06, z + 0.12), 0.1, pipe))
        parts.append(beam('pp', (0, bay * 0.1, z + 0.12), (bay, bay * 0.1, z + 0.12), 0.07, md['truss']))
    B = J('bay', parts)
    rnd = random.Random(4)
    x0, y0 = -nx * bay / 2, -ny * bay / 2
    for i in range(nx):
        for j in range(ny):
            instance(B, (x0 + i * bay, y0 + j * bay, 0))
            for lv in range(levels):
              for (a, b) in (((0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)) if per4 else ((0.5, 0.5),)):
                p = (x0 + (i + a) * bay, y0 + (j + b) * bay, lv * lh)
                if per4 and rnd.random() < 0.25:
                    instance(T, p, rnd.uniform(0, 360), 0.9 * rs); continue
                o = instance(R, p, rnd.choice((0, 0, 15, -15)), rs)
                out['reactors'].append(o)
                if rnd.random() < 0.5: instance(S, (p[0], p[1], p[2] + 3.9 * rs), 0, rs * (1.0 + rnd.random() * 0.5))
                if not per4 and rnd.random() < 0.6: instance(T, (p[0] + bay * 0.3, p[1] + bay * 0.3, p[2]), rnd.uniform(0, 360), 0.9 * rs)
    R.location = (0, 0, -500); T.location = (0, 0, -500); S.location = (0, 0, -500); B.location = (0, 0, -500)
    # rods on the roof
    rod = cz.cyl('rod', 0.12, 1, mat=md['rod'], verts=8, ol=0)
    top = levels * lh
    for k in range(1100):
        instance(rod, (rnd.uniform(x0, -x0), rnd.uniform(y0, -y0), top), 0, 1).scale = (1, 1, rnd.uniform(3, 14))
    rod.location = (0, 0, -500)
    cz.box('roof', (nx * bay, ny * bay, 0.4), loc=(0, 0, top - 0.2), mat=md['trussd'], bevel=0, ol=0)
    return out


def skirt(md, r=C.R, z=0.0, n=40):
    """The ring of pontoons + copper band around the floating slab."""
    root = cz.empty('skirt', (0, 0, z))
    band = cz.cyl('band', r * 1.03, 1.0, loc=(0, 0, 0.4), mat=md['copper'], verts=96, ol=0); band.parent = root
    ring = cz.cyl('ringd', r * 1.6, 0.35, loc=(0, 0, -0.1), mat=md['ring'], verts=96, ol=0); ring.parent = root
    p = cz.box('pont', (r * 0.42, 0.9, 0.5), loc=(0, 0, 0), mat=md['float'], bevel=0.12, ol=0)
    for k in range(n):
        a = 2 * math.pi * k / n
        o = instance(p, (r * 1.55 * math.cos(a), r * 1.55 * math.sin(a), 0.1)); o.rotation_euler = (0, 0, a)
        o.parent = root
    p.location = (0, 0, -900)
    return root


def coast(name, size=300, res=300, seed=11, loc=(0, 0, 0), img=None, sea_y=0.0, h=14.0):
    """Snowy coastal terrain: land for y > sea_y (rising mountains), drops under the sea; map texture from above."""
    f = M.range_fn(height=h, scale=40, seed=seed)
    def fn(X, Y):
        e = np.clip((Y - sea_y + 8 * np.sin(X / 23.0) + 5 * np.sin(X / 7.3)) / 25.0, -0.4, 1)
        return f(X, Y) * np.clip(e, 0, 1) + e * 6 - 1.5
    if img:
        mat = M.pbr('d_coastmap', '#ffffff', rough=0.8, img=C.T('alaska_map.png'), coord='Generated')
        for n in mat.node_tree.nodes:
            if n.type == 'TEX_IMAGE': n.projection = 'FLAT'
        return M.heightfield(name, size, res, fn, mat=mat, loc=loc)
    mat = M.snow_rock('d_coast', thresh=0.8, scale=0.06, rock_col='#7a5a3a',
                      img_rock=C.T('alaska_map.png') if img else None, img_snow=C.T('snow.png'), snow_noise=0.3)
    return M.heightfield(name, size, res, fn, mat=mat, loc=loc)


def map_terrain(name, size=200, res=360, sea_rows=0.0, green=0.0):
    """Top-down Alaska map: heightfield driven by the map's brightness (snow = high), map image on it (planar UV)."""
    img = bpy.data.images.load(C.T('alaska_map.png'), check_existing=True)
    W, H = img.size
    px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px)
    px = px.reshape(H, W, 4)[:, :, :3].mean(2)           # bottom row first (Blender order) = Y up
    iy = np.linspace(0, H - 1, res).astype(int); ix = np.linspace(0, W - 1, res).astype(int)
    im = px[iy][:, ix]
    k = np.ones(5) / 5
    im = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 0, im); im = np.apply_along_axis(lambda r: np.convolve(r, k, 'same'), 1, im)
    if sea_rows:
        cols = np.arange(res); cut = (res * (sea_rows + 0.04 * np.sin(cols / 23.0) + 0.02 * np.sin(cols / 7.0))).astype(int)
        rows = np.arange(res)[:, None]; im = np.where(rows < cut[None, :], -1.0, im)
    def fn(X, Y): return im * 6.0 - np.where(im < 0.25, 2, 0)
    ob = M.heightfield(name, size, res, fn, mat=None)
    m = M.pbr('d_map', '#ffffff', rough=0.8, img=C.T('alaska_map.png'), coord='Generated')
    # planar from top: replace box projection with flat
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE': n.projection = 'FLAT'
    if green and not m.get('greened'):
        nt = m.node_tree; tx = next(n for n in nt.nodes if n.type == 'TEX_IMAGE'); p = nt.nodes['Principled BSDF']
        # low, dark-brown tundra -> green/olive (snow and sea stay): mask = 1 - brightness
        bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(tx.outputs[0], bw.inputs[0])
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.5; mr.inputs['From Max'].default_value = 0.08
        mr.inputs['To Max'].default_value = green; nt.links.new(bw.outputs[0], mr.inputs[0])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MIX'
        nt.links.new(mr.outputs[0], mx.inputs[0]); nt.links.new(tx.outputs[0], mx.inputs[6]); mx.inputs[7].default_value = cz.col('#4f6a2c')
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 4; nt.links.new(tx.inputs[0].links[0].from_socket, nz.inputs[0])
        mx2 = nt.nodes.new('ShaderNodeMix'); mx2.data_type = 'RGBA'; mx2.blend_type = 'MULTIPLY'; mx2.inputs[0].default_value = 0.35
        nt.links.new(mx.outputs[2], mx2.inputs[6]); nt.links.new(nz.outputs['Color'], mx2.inputs[7])
        nt.links.new(mx2.outputs[2], p.inputs['Base Color']); m['greened'] = 1
    ob.data.materials.append(m)
    return ob


def cloud_mat():
    m, n = M._mat('d_cloud')
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'BLENDED'
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = cz.image(C.T('clouds.png'))
    uv = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(uv.outputs['UV'], t.inputs[0])
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(t.outputs[0], bw.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.05; mr.inputs['From Max'].default_value = 0.35
    nt.links.new(bw.outputs[0], mr.inputs[0])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[1].default_value = 1.6; nt.links.new(t.outputs[0], em.inputs[0])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mr.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def cloud(name, w, loc, rot=(90, 0, 0)):
    return cz.plane(name, w, w * 9 / 16, loc=loc, mat=cloud_mat(), rot=rot, ol=0)


def flag_mat():
    """US flag procedurally: 13 stripes + blue canton with star dots (UV)."""
    m, n = M._mat('d_flag')
    if n is None: return m
    nt, o = n
    uv = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(uv.outputs['UV'], sep.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 6.5
    nt.links.new(sep.outputs['Y'], mul.inputs[0])
    fr = nt.nodes.new('ShaderNodeMath'); fr.operation = 'FRACT'; nt.links.new(mul.outputs[0], fr.inputs[0])
    st = nt.nodes.new('ShaderNodeMath'); st.operation = 'GREATER_THAN'; st.inputs[1].default_value = 0.5; nt.links.new(fr.outputs[0], st.inputs[0])
    stripes = nt.nodes.new('ShaderNodeMix'); stripes.data_type = 'RGBA'
    nt.links.new(st.outputs[0], stripes.inputs[0]); stripes.inputs[6].default_value = cz.col('#b22234'); stripes.inputs[7].default_value = cz.col('#ffffff')
    cx = nt.nodes.new('ShaderNodeMath'); cx.operation = 'LESS_THAN'; cx.inputs[1].default_value = 0.4; nt.links.new(sep.outputs['X'], cx.inputs[0])
    cy = nt.nodes.new('ShaderNodeMath'); cy.operation = 'GREATER_THAN'; cy.inputs[1].default_value = 0.46; nt.links.new(sep.outputs['Y'], cy.inputs[0])
    ca = nt.nodes.new('ShaderNodeMath'); ca.operation = 'MULTIPLY'; nt.links.new(cx.outputs[0], ca.inputs[0]); nt.links.new(cy.outputs[0], ca.inputs[1])
    dots = nt.nodes.new('ShaderNodeTexVoronoi'); dots.inputs['Scale'].default_value = 22; dots.inputs['Randomness'].default_value = 0.0
    nt.links.new(uv.outputs['UV'], dots.inputs[0])
    dt = nt.nodes.new('ShaderNodeMath'); dt.operation = 'LESS_THAN'; dt.inputs[1].default_value = 0.18; nt.links.new(dots.outputs['Distance'], dt.inputs[0])
    canton = nt.nodes.new('ShaderNodeMix'); canton.data_type = 'RGBA'
    nt.links.new(dt.outputs[0], canton.inputs[0]); canton.inputs[6].default_value = cz.col('#3c3b6e'); canton.inputs[7].default_value = cz.col('#ffffff')
    fin = nt.nodes.new('ShaderNodeMix'); fin.data_type = 'RGBA'
    nt.links.new(ca.outputs[0], fin.inputs[0]); nt.links.new(stripes.outputs[2], fin.inputs[6]); nt.links.new(canton.outputs[2], fin.inputs[7])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.7
    nt.links.new(fin.outputs[2], p.inputs['Base Color']); nt.links.new(fin.outputs[2], p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = 0.4
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def flag(name, loc, size=1.0, f0=1, f1=1780):
    """Pole + waving flag (grid mesh, wave baked through a displace-like shape: wave modifier)."""
    root = cz.empty(name, loc)
    pole = cz.cyl(name + '_pole', 0.02 * size, 1.6 * size, mat=M.pbr('d_pole', '#d0d0d0', rough=0.3, metal=1), verts=8, ol=0); pole.parent = root
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=24, y_subdivisions=12, size=1)
    fl = bpy.context.object; fl.name = name + '_cloth'
    fl.scale = (0.9 * size, 0.5 * size, 1); fl.rotation_euler = (math.radians(90), 0, 0)
    fl.location = (0.45 * size, 0, 1.33 * size); fl.parent = root
    fl.data.materials.append(flag_mat())
    wv = fl.modifiers.new('wave', 'WAVE'); wv.use_normal = False; wv.use_y = False; wv.height = 0.05; wv.width = 0.35; wv.speed = 0.05
    wv.start_position_x = -0.5; wv.falloff_radius = 0
    wv.use_normal = True
    return root


def eagle(name='eagle'):
    """Bald eagle: brown body, white head + tail, yellow beak, long fingered wings (flap rig = wing objects)."""
    br = M.pbr('d_eb', '#3a2716', rough=0.8, noise=0.4); wh = M.pbr('d_ew', '#efeae0', rough=0.7); ye = M.pbr('d_ey', '#e8b02a', rough=0.5)
    root = cz.empty(name)
    body = cz.sphere(name + '_b', 0.3, mat=br, scale=(0.5, 1.0, 0.45), ol=0); body.parent = root
    head = cz.sphere(name + '_h', 0.13, loc=(0, 0.34, 0.06), mat=wh, ol=0); head.parent = root
    beak = cz.cyl(name + '_k', 0.05, 0.12, loc=(0, 0.45, 0.04), rot=(-90, 0, 0), mat=ye, r2=0.0, verts=10, ol=0); beak.parent = root
    tail = cz.box(name + '_t', (0.22, 0.25, 0.03), loc=(0, -0.38, 0), mat=wh, bevel=0.01, ol=0); tail.parent = root
    wings = []
    for s in (-1, 1):
        piv = cz.empty(name + '_wp%d' % s, (s * 0.08, 0.02, 0.03)); piv.parent = root
        parts = [cz.box('w', (0.95, 0.75, 0.05), loc=(s * 0.45, 0, 0), mat=br, bevel=0.01, ol=0)]
        for k in range(6):   # primaries
            parts.append(cz.box('f', (0.5, 0.11, 0.02), loc=(s * (1.0 + 0.05 * k), 0.25 - 0.1 * k, 0), rot=(0, 0, s * (-8 - 5 * k)), mat=br, bevel=0.005, ol=0))
        w = J(name + '_w%d' % s, parts); w.parent = piv; w.location = (0, 0, 0)
        wings.append((piv, s))
    return root, wings


def person_parts(rnd):
    """One low-poly person (~1.75): legs, torso, arms up, head + hair, varied colours. Returns joined mesh."""
    shirts = ['#2b4c8c', '#9a2a24', '#e8e8e8', '#1c1c22', '#2a2d36', '#5a2020', '#3a3a40', '#3a6ea8', '#141418', '#6b4a3a']
    pants = ['#1f2a44', '#5a2020', '#2a2a2e', '#7a7f88', '#c03030']
    skins = ['#e9c4a8', '#c99a78', '#8a5a3c', '#f2d2bc']
    hairs = ['#2a1c12', '#5a3a1c', '#c9a46a', '#111111']
    sm = M.pbr('d_sh_%s' % rnd.choice(shirts)[1:], rnd.choice(shirts), rough=0.8)
    pm = M.pbr('d_pa_%s' % rnd.choice(pants)[1:], rnd.choice(pants), rough=0.8)
    km = M.pbr('d_sk_%s' % rnd.choice(skins)[1:], rnd.choice(skins), rough=0.6)
    hm = M.pbr('d_hr_%s' % rnd.choice(hairs)[1:], rnd.choice(hairs), rough=0.6)
    p = [cz.capsule('l', 0.07, 0.9, loc=(-0.1, 0, 0), mat=pm, ol=0), cz.capsule('l', 0.07, 0.9, loc=(0.1, 0, 0), mat=pm, ol=0),
         cz.capsule('t', 0.19, 0.62, loc=(0, 0, 0.85), mat=sm, ol=0, scale=(1, 0.65, 1)),
         cz.sphere('h', 0.11, loc=(0, 0, 1.6), mat=km, segs=12, rings=8, ol=0),
         cz.sphere('hr', 0.115, loc=(0, 0.02, 1.63), mat=hm, segs=12, rings=8, ol=0, scale=(1, 1, 0.8))]
    up = rnd.random() < 0.3
    for s in (-1, 1):
        a = beam('a', (s * 0.2, 0, 1.38), (s * (0.32 if up else 0.25), 0.05, 2.0 if up else 0.85), 0.09, sm); p.append(a)
    return J('person', p)


def crowd(n=300, area=((-12, 0), (12, 40)), seed=7, f0=1, f1=1780, kinds=12, walk=(0, 0)):
    rnd = random.Random(seed)
    srcs = [person_parts(rnd) for _ in range(kinds)]
    out = []
    for i in range(n):
        s = rnd.choice(srcs)
        x, y = rnd.uniform(area[0][0], area[1][0]), rnd.uniform(area[0][1], area[1][1])
        o = instance(s, (x, y, 0), rnd.uniform(140, 220), rnd.uniform(0.92, 1.08))
        ph, fr, amp = rnd.uniform(0, 6.28), rnd.uniform(2.0, 3.2), rnd.uniform(0.08, 0.2)
        vx, vy = walk[0] * rnd.uniform(0.5, 1.5), walk[1] * rnd.uniform(0.5, 1.5)
        M.bake_path(o, f0, f1, pos=lambda t, x=x, y=y, ph=ph, fr=fr, amp=amp, vx=vx, vy=vy:
                    (x + vx * (t - f0 / FPS), y + vy * (t - f0 / FPS), abs(math.sin(t * fr * math.pi + ph)) * amp))
        out.append(o)
    for s in srcs: s.location = (0, 0, -900)
    return out


def confetti(n, box, f0, f1, seed=3, size=0.12, fall=1.2):
    """Paper confetti: one joined mesh of small quads per colour, falling + spinning as whole layers."""
    rnd = random.Random(seed)
    cols = ['#d8263a', '#2a4fd0', '#ffffff', '#e84a8a', '#4a7ad8']
    objs = []
    for ci, c in enumerate(cols):
        m = M.pbr('d_conf%d' % ci, c, rough=0.6); m.use_backface_culling = False
        bm = bmesh.new()
        for k in range(n // len(cols)):
            p = Vector((rnd.uniform(box[0][0], box[1][0]), rnd.uniform(box[0][1], box[1][1]), rnd.uniform(box[0][2], box[1][2])))
            q = Matrix.Rotation(rnd.uniform(0, 6.3), 3, Vector((rnd.random(), rnd.random(), rnd.random())).normalized())
            vs = [bm.verts.new(p + q @ Vector(v) * size) for v in ((-0.5, -0.2, 0), (0.5, -0.2, 0), (0.5, 0.2, 0), (-0.5, 0.2, 0))]
            bm.faces.new(vs)
        me = bpy.data.meshes.new('conf%d' % ci); bm.to_mesh(me); me.materials.append(m)
        o = bpy.data.objects.new('conf%d' % ci, me); bpy.context.scene.collection.objects.link(o)
        hz = box[1][2] - box[0][2]
        M.bake_path(o, f0, f1, pos=lambda t, ci=ci: (math.sin(t * 1.3 + ci) * 0.5, 0, -((t * fall + ci * 0.7) % (hz * 0.5))))
        objs.append(o)
    return objs


# ---------------------------------------------------------------- round 2
def keyed_mat(name, img, tint=None, rough=0.7, lo=0.04, hi=0.2, emit=0.0):
    """Picture on a black background -> its brightness is the alpha (feathers, foam)."""
    m, n = M._mat(name)
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'DITHERED'
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = cz.image(img)
    uv = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(uv.outputs['UV'], t.inputs[0])
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(t.outputs[0], bw.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = lo; mr.inputs['From Max'].default_value = hi
    nt.links.new(bw.outputs[0], mr.inputs[0])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = rough
    col = t.outputs[0]
    if tint:
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1
        nt.links.new(col, mx.inputs[6]); mx.inputs[7].default_value = cz.col(tint); col = mx.outputs[2]
    nt.links.new(col, p.inputs['Base Color'])
    if emit: nt.links.new(col, p.inputs['Emission Color']); p.inputs['Emission Strength'].default_value = emit
    nt.links.new(mr.outputs[0], p.inputs['Alpha'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def card(name, w, h, mat, loc=(0, 0, 0), rot=(0, 0, 0), pivot=(0.5, 0.0)):
    """Flat card in the XY plane, w along X, h along Y, origin at uv pivot."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.new('UVMap')
    px, py = pivot
    vs = [bm.verts.new(((u - px) * w, (v - py) * h, 0)) for u, v in ((0, 0), (1, 0), (1, 1), (0, 1))]
    f = bm.faces.new(vs)
    for lp, (u, v) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uvl].uv = (u, v)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); me.materials.append(mat)
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    return o


def eagle2(name='eagle'):
    """Bald eagle with feather-card wings: per side an arm pivot (shoulder) and a hand pivot (wrist); secondaries on
    the arm, 9 fingered primaries on the hand, covert rows on top. Body/head/tail lathed. Returns root, rig list."""
    fm = keyed_mat('d_feath', C.T('d_feather.png'), rough=0.75, lo=0.002, hi=0.012)
    fw = keyed_mat('d_feathw', C.T('d_feather.png'), tint='#ffffff', rough=0.7, lo=0.002, hi=0.012)
    br = M.pbr('d_eb2', '#3b2817', rough=0.85, noise=0.5); wh = M.pbr('d_ew2', '#f2eee6', rough=0.7); ye = M.pbr('d_ey2', '#e8b02a', rough=0.4)
    root = cz.empty(name)
    body = lathe(name + '_b', [(0.0, -0.55), (0.12, -0.45), (0.2, -0.2), (0.22, 0.05), (0.17, 0.3), (0.0, 0.38)], br, 16)
    body.rotation_euler = (math.radians(-90), 0, 0); body.scale = (0.75, 0.62, 1.0); body.parent = root
    head = cz.sphere(name + '_h', 0.13, loc=(0, 0.44, 0.06), mat=wh, scale=(0.9, 1.25, 0.9), segs=16, rings=10, ol=0); head.parent = root
    beak = cz.cyl(name + '_k', 0.05, 0.14, loc=(0, 0.58, 0.03), rot=(-100, 0, 0), mat=ye, r2=0.0, verts=10, ol=0); beak.parent = root
    for k in range(7):     # white tail fan
        tl = card(name + '_t%d' % k, 0.3, 0.46, fw, loc=(0, -0.5, 0.0), rot=(0, 0, 180 + (k - 3) * 9), pivot=(0.5, 0.0)); tl.parent = root
    rig = []
    for s in (-1, 1):
        arm = cz.empty(name + '_arm%d' % s, (s * 0.12, 0.05, 0.05)); arm.parent = root
        hand = cz.empty(name + '_hand%d' % s, (s * 0.85, 0.0, 0.0)); hand.parent = arm
        for k in range(9):   # secondaries along the arm trailing edge, pointing back
            c = card(name + '_s%d%d' % (s, k), 0.36, 0.62, fm, loc=(s * (0.05 + k * 0.1), 0.06, 0), rot=(0, 0, 180 + s * 4), pivot=(0.5, 0.0)); c.parent = arm
        for k in range(6):   # coverts: shorter, on top
            c = card(name + '_c%d%d' % (s, k), 0.42, 0.36, fm, loc=(s * (0.08 + k * 0.13), 0.1, 0.02), rot=(0, 0, 180), pivot=(0.5, 0.0)); c.parent = arm
        for k in range(9):   # primaries fan out from the wrist
            a = s * (-70 + k * 9)
            c = card(name + '_p%d%d' % (s, k), 0.3, 0.9 - abs(k - 5) * 0.04, fm, loc=(0, 0.04 - k * 0.02, 0.005 * k), rot=(0, 0, a + (90 if s > 0 else -90) * 0 - 90 * s + 180 * (s < 0) * 0), pivot=(0.5, 0.0))
            c.rotation_euler = (0, 0, math.radians(-s * (80 + k * 9)))
            c.parent = hand
        rig.append((arm, hand, s))
    return root, rig


def beat(rig, f0, f1, hz=1.5, amp=42, base=8, t0=0.0):
    """Wing beat: shoulder up/down, wrist lags and folds on the upstroke."""
    for arm, hand, s in rig:
        M.bake_path(arm, f0, f1, rot=lambda t, s=s: (0, -s * (base + amp * math.sin((t - t0) * 2 * math.pi * hz)), 0))
        M.bake_path(hand, f0, f1, rot=lambda t, s=s: (0, -s * (12 * math.sin((t - t0) * 2 * math.pi * hz - 0.9)),
                                                      s * 18 * max(0, math.cos((t - t0) * 2 * math.pi * hz))))


PAL = dict(
    shirt=['#1d2a4a', '#9a2a24', '#e8e8e8', '#18181c', '#2a2d36', '#5a2020', '#3a6ea8', '#6b4a3a', '#c8c2b5', '#2f4f7f'],
    pants=['#1f2a44', '#2a2a2e', '#3a3d48', '#7a1e1e', '#5a5f68', '#1a1a1a'],
    skin=['#e9c4a8', '#c99a78', '#8a5a3c', '#f2d2bc', '#a8785a'],
    hair=['#2a1c12', '#5a3a1c', '#c9a46a', '#111111', '#6a4a2a'],
)


def _m(kind, hexc):
    return M.pbr('d_%s_%s' % (kind, hexc[1:]), hexc, rough=0.8 if kind != 'skin' else 0.55, noise=0.15 if kind in ('shirt', 'pants') else 0)


def stripes_mat():
    m, n = M._mat('d_stripes')
    if n is None: return m
    nt, o = n
    tc = nt.nodes.new('ShaderNodeTexCoord'); w = nt.nodes.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = 9
    w.wave_type = 'BANDS'; w.bands_direction = 'Z'
    nt.links.new(tc.outputs['Object'], w.inputs[0])
    r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.interpolation = 'CONSTANT'
    r.color_ramp.elements[0].color = cz.col('#b8222a'); r.color_ramp.elements[1].position = 0.5; r.color_ramp.elements[1].color = cz.col('#f0f0f0')
    nt.links.new(w.outputs['Fac'], r.inputs[0])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.8
    nt.links.new(r.outputs[0], p.inputs['Base Color']); nt.links.new(p.outputs[0], o.inputs[0])
    return m


class Parts:
    """Shared meshes for the walker rig (built once, linked into every person)."""
    def __init__(self):
        g = lambda o: (o.data, o)
        self.src = []
        def mk(o): self.src.append(o); o.location = (0, 0, -900); return o.data
        self.thigh = mk(cz.capsule('pp_thigh', 0.085, 0.46, ol=0))
        self.shin = mk(cz.capsule('pp_shin', 0.07, 0.46, ol=0))
        self.foot = mk(cz.box('pp_foot', (0.11, 0.26, 0.08), loc=(0, 0.06, 0.04), ol=0, bevel=0.02))
        self.torso = mk(cz.capsule('pp_torso', 0.2, 0.62, scale=(1, 0.62, 1), ol=0))
        self.uarm = mk(cz.capsule('pp_uarm', 0.06, 0.32, ol=0))
        self.farm = mk(cz.capsule('pp_farm', 0.05, 0.3, ol=0))
        self.head = mk(cz.sphere('pp_head', 0.11, scale=(0.92, 1.0, 1.12), segs=14, rings=9, ol=0))
        self.hair = mk(cz.sphere('pp_hair', 0.118, scale=(0.95, 1.05, 0.85), segs=14, rings=9, ol=0))
        self.hat = mk(cz.cyl('pp_hat', 0.1, 0.26, verts=16, ol=0))
        self.hand = mk(cz.sphere('pp_hand', 0.05, scale=(0.8, 0.5, 1.2), segs=10, rings=6, ol=0))
        self.eye = mk(cz.sphere('pp_eye', 0.014, segs=8, rings=5, ol=0))
        self.collar = mk(cz.cyl('pp_collar', 0.095, 0.06, verts=16, ol=0))
        for me in (self.thigh, self.shin, self.foot, self.torso, self.uarm, self.farm, self.head, self.hair, self.hat, self.hand, self.eye, self.collar):
            me.materials.clear()


def _obj(name, me, mat, parent, loc=(0, 0, 0), rot=(0, 0, 0), scale=None):
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    if not me.materials:
        me.materials.append(None)
    o.material_slots[0].link = 'OBJECT'; o.material_slots[0].material = mat
    o.parent = parent; o.location = loc; o.rotation_euler = [math.radians(a) for a in rot]
    if scale: o.scale = scale
    return o


def walker(P, rnd, name, loc, heading, f0, f1, speed=1.3, cheer=0.5):
    """One person: hips root, legs (thigh/shin/foot) swing, arms pump up (cheer) or swing, head bob.
    Height 1.55-1.95. Returns root."""
    h = rnd.uniform(0.86, 1.08)
    sh = rnd.choice(PAL['shirt']); smat = stripes_mat() if rnd.random() < 0.1 else _m('shirt', sh)
    pmat = _m('pants', rnd.choice(PAL['pants'])); kmat = _m('skin', rnd.choice(PAL['skin'])); hmat = _m('hair', rnd.choice(PAL['hair']))
    shoe = _m('pants', '#1a1a1a')
    root = cz.empty(name); root.scale = (h, h, h)
    hip = cz.empty(name + '_hip', (0, 0, 0.98), parent=root)
    legs, arms = [], []
    for s in (-1, 1):
        th = cz.empty(name + '_th%d' % s, (s * 0.1, 0, 0), parent=hip); th.rotation_euler = (math.pi, 0, 0)
        _obj(name + '_tm%d' % s, P.thigh, pmat, th)
        kn = cz.empty(name + '_kn%d' % s, (0, 0, 0.46), parent=th)
        _obj(name + '_sm%d' % s, P.shin, pmat, kn)
        ft = cz.empty(name + '_ft%d' % s, (0, 0, 0.46), parent=kn); ft.rotation_euler = (math.pi, 0, 0)
        _obj(name + '_fm%d' % s, P.foot, shoe, ft, loc=(0, 0, -0.06))
        legs.append((th, kn, s))
    tor = _obj(name + '_to', P.torso, smat, hip, loc=(0, 0, -0.04))
    nk = cz.empty(name + '_nk', (0, 0, 0.62), parent=hip)
    _obj(name + '_he', P.head, kmat, nk, loc=(0, 0, 0.12))
    em = _m('pants', '#141414')
    for s in (-1, 1): _obj(name + '_ey%d' % s, P.eye, em, nk, loc=(s * 0.04, 0.095, 0.15))   # painted features
    _obj(name + '_mo', P.eye, _m('pants', '#7a3a32'), nk, loc=(0, 0.1, 0.07), scale=(2.2, 0.6, 0.6))
    _obj(name + '_co', P.collar, smat, nk, loc=(0, 0, -0.04))
    if rnd.random() < 0.08:
        _obj(name + '_ha', P.hat, stripes_mat(), nk, loc=(0, 0, 0.2))
    else:
        _obj(name + '_hr', P.hair, hmat, nk, loc=(0, -0.025, 0.15), scale=(1.05, 1.08, 1.1))
    for s in (-1, 1):
        shd = cz.empty(name + '_sh%d' % s, (s * 0.22, 0, 0.52), parent=hip); shd.rotation_euler = (math.pi, 0, 0)
        _obj(name + '_ua%d' % s, P.uarm, smat, shd)
        el = cz.empty(name + '_el%d' % s, (0, 0, 0.32), parent=shd)
        _obj(name + '_fa%d' % s, P.farm, kmat if rnd.random() < 0.5 else smat, el)
        _obj(name + '_hd%d' % s, P.hand, kmat, el, loc=(0, 0, 0.34))
        arms.append((shd, el, s))
    hz = rnd.uniform(0.9, 1.15) * speed * 0.75   # steps per second / 2
    ph = rnd.uniform(0, 6.3)
    cheers = rnd.random() < cheer
    up_side = rnd.choice((-1, 1, 0))
    dx, dy = math.sin(math.radians(heading)) * speed, math.cos(math.radians(heading)) * speed
    x0, y0 = loc[0], loc[1]
    w = lambda t: (t * 2 * math.pi * hz + ph)
    M.bake_path(root, f0, f1, pos=lambda t: (x0 + dx * (t - f0 / FPS), y0 + dy * (t - f0 / FPS), 0),
                rot=lambda t: (0, 0, -heading))
    M.bake_path(hip, f0, f1, pos=lambda t: (0, 0, 0.98 + 0.035 * abs(math.cos(w(t)))), rot=lambda t: (0, 4 * math.sin(w(t)), 6 * math.sin(w(t))))
    for th, kn, s in legs:
        M.bake_path(th, f0, f1, rot=lambda t, s=s: (180 + 28 * s * math.sin(w(t)), 0, 0))
        M.bake_path(kn, f0, f1, rot=lambda t, s=s: (-max(0.0, 50 * s * math.cos(w(t))) - 6, 0, 0))
    for shd, el, s in arms:
        up = cheers and (up_side == 0 or up_side == s)
        if up:
            M.bake_path(shd, f0, f1, rot=lambda t, s=s: (180 + 150 + 25 * math.sin(w(t) * 2), s * -12, 0))
            M.bake_path(el, f0, f1, rot=lambda t, s=s: (-20 - 25 * max(0, math.sin(w(t) * 2)), 0, 0))
        else:
            M.bake_path(shd, f0, f1, rot=lambda t, s=s: (180 - 24 * s * math.sin(w(t)), s * -6, 0))
            M.bake_path(el, f0, f1, rot=lambda t, s=s: (-25, 0, 0))
    return root


def crowd2(n, area, f0, f1, seed=7, heading=(-25, 25), speed=1.3, cheer=0.5):
    rnd = random.Random(seed); P = Parts(); out = []
    for i in range(n):
        x, y = rnd.uniform(area[0][0], area[1][0]), rnd.uniform(area[0][1], area[1][1])
        out.append(walker(P, rnd, 'pw%d' % i, (x, y, 0), rnd.uniform(*heading), f0, f1, speed * rnd.uniform(0.7, 1.2), cheer))
    return out


def foam_mat():
    m, n = M._mat('d_foam')
    if n is None: return m
    nt, o = n
    m.surface_render_method = 'BLENDED'
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.9; nz.inputs['Detail'].default_value = 12; nz.inputs['Roughness'].default_value = 0.7
    nt.links.new(tc.outputs['Object'], nz.inputs[0])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(tc.outputs['UV'], sep.inputs[0])
    # fade along the wake (V) and toward the sides (U)
    g = nt.nodes.new('ShaderNodeMath'); g.operation = 'SUBTRACT'; g.inputs[0].default_value = 1.0; nt.links.new(sep.outputs['Y'], g.inputs[1])
    u = nt.nodes.new('ShaderNodeMath'); u.operation = 'SUBTRACT'; nt.links.new(sep.outputs['X'], u.inputs[0]); u.inputs[1].default_value = 0.5
    ua = nt.nodes.new('ShaderNodeMath'); ua.operation = 'ABSOLUTE'; nt.links.new(u.outputs[0], ua.inputs[0])
    us = nt.nodes.new('ShaderNodeMath'); us.operation = 'MULTIPLY_ADD'; nt.links.new(ua.outputs[0], us.inputs[0]); us.inputs[1].default_value = -2; us.inputs[2].default_value = 1
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.55; mr.inputs['From Max'].default_value = 0.62
    nt.links.new(nz.outputs['Fac'], mr.inputs[0])
    a1 = nt.nodes.new('ShaderNodeMath'); a1.operation = 'MULTIPLY'; nt.links.new(mr.outputs[0], a1.inputs[0]); nt.links.new(g.outputs[0], a1.inputs[1])
    a2 = nt.nodes.new('ShaderNodeMath'); a2.operation = 'MULTIPLY'; nt.links.new(a1.outputs[0], a2.inputs[0]); nt.links.new(us.outputs[0], a2.inputs[1])
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = cz.col('#f4f8fa'); p.inputs['Roughness'].default_value = 0.6
    nt.links.new(a2.outputs[0], p.inputs['Alpha']); nt.links.new(p.outputs[0], o.inputs[0])
    return m


def wake(parent, r, length=60, width=26, z=0.15):
    """Foam trail behind (-Y local... caller rotates) the moving slab + a bow-wave ring around the skirt."""
    fm = foam_mat()
    tr = card('wake', width, length, fm, loc=(0, 0, z), rot=(0, 0, 0), pivot=(0.5, 0.0)); tr.parent = parent
    for s in (-1, 1):   # two diverging Kelvin arms
        a = card('wakearm%d' % s, 8, length * 1.1, fm, loc=(s * r * 1.2, 0, z + 0.02), rot=(0, 0, s * -14), pivot=(0.5, 0.0)); a.parent = parent
    bow = lathe('bow', [(r * 1.55, 0), (r * 2.1, 0), (r * 2.1, 0.01), (r * 1.55, 0.01)], fm, 64); bow.parent = parent; bow.location = (0, 0, z)
    me = bow.data; uvl = me.uv_layers.new(name='UVMap')
    for lp in me.loops:
        v = me.vertices[lp.vertex_index].co; uvl.data[lp.index].uv = (0.5, 0.2 if (v.x * v.x + v.y * v.y) ** 0.5 < r * 1.8 else 0.7)
    return tr
