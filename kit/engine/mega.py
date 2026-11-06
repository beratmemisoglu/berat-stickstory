# mega.py - the "megaproject" look (2026-10-27, the Everest rebuild): REALISTIC EEVEE, not toon. Physical sky + sun,
# PBR materials (rock, snow, steel, copper, water), procedural heightfield terrain / mountains, X-ray highlight material,
# continuous spline camera flights with real motion blur, fast render settings.
# Scenes: `import mega as M` inside build(ctx) after cz.reset() (run.py does that). Use cz for primitives (box, cyl,
# text...) with ol=0 (no outlines in this look) and M.* materials.
import bpy, math, os, random, sys
# numpy: Blender's own Python, or the folder the app installed it into (Toon Studio blender/numpy.ts, CZ_PYLIB): the
# official Blender 5.2 build has none
if os.environ.get('CZ_PYLIB') and os.environ['CZ_PYLIB'] not in sys.path: sys.path.append(os.environ['CZ_PYLIB'])
import numpy as np
from mathutils import Vector, Matrix, Euler
import cz
from cz import FPS, clamp, lerp

TEX = os.path.join(cz.LAB, 'assets', 'mega')          # Flow textures for this look (seamless rock, snow, steel ...)


# ---------------------------------------------------------------- scene
def setup(frame_end, sun_elev=28, sun_rot=135, sun_power=3.2, sky_strength=0.16, samples=4, mb=0.5,
          res=None, exposure=-0.2, ao=False, haze=0.0, sky_sat=1.7, light_sat=0.55, light_k=1.3, sun_disc=True):
    """Fast realistic EEVEE: physical sky world (multiple scattering), a matching sun lamp with soft shadows,
    AgX, motion blur (shutter mb, 0 = off). sun_rot: degrees around Z (0 = light from +Y toward -Y)."""
    sc = cz.setup(frame_end, res=res, samples=samples, world='#87a8d8', world_strength=1.0)
    for vt in ('AgX', 'Filmic', 'Standard'):
        try: sc.view_settings.view_transform = vt; break
        except Exception: pass
    try: sc.view_settings.look = 'AgX - Base Contrast' if sc.view_settings.view_transform == 'AgX' else 'None'
    except Exception: pass
    sc.view_settings.exposure = exposure
    ee = sc.eevee
    ee.use_raytracing = False                 # screen-space only: the measured cost driver; AO comes from fast GI below
    try:
        ee.use_fast_gi = ao; ee.fast_gi_distance = 6.0; ee.fast_gi_ray_count = 2; ee.fast_gi_step_count = 6
    except Exception as e: print('CZ fastgi', e)
    ee.shadow_ray_count = 1; ee.shadow_step_count = 6
    try: ee.shadow_resolution_scale = 0.5
    except Exception: pass
    try: ee.use_bokeh_jittered = False
    except Exception: pass
    sc.render.use_motion_blur = mb > 0
    sc.render.motion_blur_shutter = mb or 0.5
    try: ee.motion_blur_steps = 1; ee.motion_blur_max = 64
    except Exception: pass
    # world: physical sky
    w = sc.world; nt = w.node_tree; nt.nodes.clear()
    sky = nt.nodes.new('ShaderNodeTexSky')
    try: sky.sky_type = 'MULTIPLE_SCATTERING'
    except Exception: sky.sky_type = 'SINGLE_SCATTERING'
    sky.sun_elevation = math.radians(sun_elev); sky.sun_rotation = math.radians(sun_rot)
    sky.sun_disc = False; sky.sun_size = math.radians(1.2); sky.sun_intensity = 0.25
    try: sky.air_density = 1.0; sky.aerosol_density = 0.25 + haze; sky.altitude = 6000
    except Exception: pass
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs[1].default_value = sky_strength
    out = nt.nodes.new('ShaderNodeOutputWorld')
    hs = nt.nodes.new('ShaderNodeHueSaturation'); hs.inputs['Saturation'].default_value = sky_sat; hs.inputs['Value'].default_value = 0.85
    nt.links.new(sky.outputs[0], hs.inputs['Color']); nt.links.new(hs.outputs[0], bg.inputs[0])
    # the camera sees the saturated sky; the scene is LIT by a calmer one (a saturated fill turned every shadow deep blue)
    hl = nt.nodes.new('ShaderNodeHueSaturation'); hl.inputs['Saturation'].default_value = light_sat
    nt.links.new(sky.outputs[0], hl.inputs['Color'])
    bl = nt.nodes.new('ShaderNodeBackground'); bl.inputs[1].default_value = sky_strength * light_k
    nt.links.new(hl.outputs[0], bl.inputs[0])
    lp = nt.nodes.new('ShaderNodeLightPath'); mxw = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(lp.outputs['Is Camera Ray'], mxw.inputs[0]); nt.links.new(bl.outputs[0], mxw.inputs[1]); nt.links.new(bg.outputs[0], mxw.inputs[2])
    nt.links.new(mxw.outputs[0], out.inputs[0])
    # sun lamp along the sky's sun direction
    sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = sun_power; sd.angle = math.radians(1.5)
    sd.color = (1.0, 0.96, 0.9)
    try: sd.shadow_jitter = False
    except Exception: pass
    so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so)
    e, r = math.radians(sun_elev), math.radians(sun_rot)
    d = Vector((math.sin(r) * math.cos(e), -math.cos(r) * math.cos(e), math.sin(e)))   # toward the sun
    so.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    # the sky node's own disc sits elsewhere than the lamp: draw the sun as a far glowing ball exactly along the lamp
    # (camera-only: no shadow, not in reflections' lighting)
    if sun_disc:
        dist = 4500.0
        bpy.ops.mesh.primitive_uv_sphere_add(radius=dist * math.tan(math.radians(0.7)), location=d * dist, segments=24, ring_count=12)
        disc = bpy.context.object; disc.name = 'sun_disc'
        disc.data.materials.append(emit('sun_disc_m', '#fff6e8', 40.0))
        try: disc.visible_shadow = False; disc.visible_diffuse = False; disc.visible_glossy = True
        except Exception: pass
    sc.render.film_transparent = False
    return sc


def sun_dir():
    s = bpy.data.objects.get('sun')
    return (s.matrix_world.to_quaternion() @ Vector((0, 0, 1))).normalized() if s else Vector((0, 0, 1))


# ---------------------------------------------------------------- materials
def _mat(name):
    m = bpy.data.materials.get(name)
    if m: return m, None
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    return m, (nt, o)


def _coord(nt, kind='Object', scale=1.0):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs[kind], mp.inputs[0])
    return mp.outputs[0]


def _img(nt, path, vec, box=True, colorspace='sRGB'):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = cz.image(cz.resolve(path) if not os.path.isabs(path) else path, colorspace)
    if box: t.projection = 'BOX'; t.projection_blend = 0.25
    nt.links.new(vec, t.inputs[0])
    return t


def pbr(name, color='#888888', rough=0.6, metal=0.0, img=None, scale=1.0, bump=0.0, bump_scale=8.0, coord='Object',
        emit=None, emit_strength=0.0, spec=0.5, coat=0.0, tint=None, noise=0.0):
    """Principled BSDF. img: a seamless texture (box-projected in object coords * scale), tint multiplies it.
    bump: procedural noise bump strength (bump_scale its frequency). noise: colour variation 0..1."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled')
    p.inputs['Roughness'].default_value = rough; p.inputs['Metallic'].default_value = metal
    try: p.inputs['Specular IOR Level'].default_value = spec
    except Exception: pass
    if coat:
        try: p.inputs['Coat Weight'].default_value = coat
        except Exception: pass
    vec = _coord(nt, coord, scale)
    colsock = None
    if img:
        t = _img(nt, img, vec)
        colsock = t.outputs[0]
        if tint:
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs[0].default_value = 1.0
            nt.links.new(colsock, mx.inputs[6]); mx.inputs[7].default_value = cz.col(tint); colsock = mx.outputs[2]
    else:
        p.inputs['Base Color'].default_value = cz.col(color)
    if noise and colsock is None:
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.0; nz.inputs['Detail'].default_value = 6
        nt.links.new(vec, nz.inputs[0])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
        mx.inputs[0].default_value = noise
        mx.inputs[6].default_value = cz.col(color); nt.links.new(nz.outputs['Color'], mx.inputs[7])
        colsock = mx.outputs[2]
    if colsock is not None: nt.links.new(colsock, p.inputs['Base Color'])
    if bump:
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = bump_scale; nz.inputs['Detail'].default_value = 8
        nz.inputs['Roughness'].default_value = 0.6
        nt.links.new(vec, nz.inputs[0])
        b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump
        nt.links.new(nz.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    if emit:
        p.inputs['Emission Color'].default_value = cz.col(emit); p.inputs['Emission Strength'].default_value = emit_strength
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def rock(name='rock', color='#4a4b50', dark='#1e1f23', scale=1.0, bump=0.9, img=None, pits=True):
    """Dark pitted basalt (the slab): two-tone voronoi pits + noise, strong bump. img= a Flow rock texture instead."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.85
    vec = _coord(nt, 'Object', scale)
    vo = nt.nodes.new('ShaderNodeTexVoronoi'); vo.inputs['Scale'].default_value = 9.0
    try: vo.feature = 'F1'; vo.distance = 'EUCLIDEAN'
    except Exception: pass
    nt.links.new(vec, vo.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 4.0; nz.inputs['Detail'].default_value = 10
    nz.inputs['Roughness'].default_value = 0.65; nt.links.new(vec, nz.inputs[0])
    # pits: small voronoi distance -> dark holes
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].position = 0.05; ramp.color_ramp.elements[1].position = 0.3
    nt.links.new(vo.outputs['Distance'], ramp.inputs[0])
    if img:
        t = _img(nt, img, vec); base = t.outputs[0]
    else:
        mx0 = nt.nodes.new('ShaderNodeMix'); mx0.data_type = 'RGBA'
        mx0.inputs[6].default_value = cz.col(dark); mx0.inputs[7].default_value = cz.col(color)
        nt.links.new(nz.outputs['Fac'], mx0.inputs[0]); base = mx0.outputs[2]
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'
    mx.inputs[0].default_value = 0.85 if pits else 0.0
    nt.links.new(base, mx.inputs[6]); nt.links.new(ramp.outputs[0], mx.inputs[7])
    nt.links.new(mx.outputs[2], p.inputs['Base Color'])
    h = nt.nodes.new('ShaderNodeMath'); h.operation = 'ADD'
    nt.links.new(ramp.outputs[0], h.inputs[0]); nt.links.new(nz.outputs['Fac'], h.inputs[1])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump; b.inputs['Distance'].default_value = 0.4
    nt.links.new(h.outputs[0], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def snow_rock(name='snowrock', rock_col='#5a5650', snow_col='#f4f7ff', thresh=0.55, scale=1.0, img_rock=None, img_snow=None,
              bump=0.5, snow_noise=0.18):
    """Terrain shader: snow on flat ground (normal.z above thresh, broken by noise), rock on steep faces."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Roughness'].default_value = 0.7
    vec = _coord(nt, 'Object', scale)
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], sep.inputs[0])
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6.0; nz.inputs['Detail'].default_value = 8
    nt.links.new(vec, nz.inputs[0])
    add = nt.nodes.new('ShaderNodeMath'); add.operation = 'MULTIPLY_ADD'
    nt.links.new(nz.outputs['Fac'], add.inputs[0]); add.inputs[1].default_value = snow_noise * 2; add.inputs[2].default_value = -snow_noise
    s2 = nt.nodes.new('ShaderNodeMath'); s2.operation = 'ADD'
    nt.links.new(sep.outputs['Z'], s2.inputs[0]); nt.links.new(add.outputs[0], s2.inputs[1])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = thresh - 0.04; mr.inputs['From Max'].default_value = thresh + 0.04
    nt.links.new(s2.outputs[0], mr.inputs['Value'])
    rc = _img(nt, img_rock, vec).outputs[0] if img_rock else None
    sn = _img(nt, img_snow, vec).outputs[0] if img_snow else None
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    nt.links.new(mr.outputs[0], mx.inputs[0])
    if rc: nt.links.new(rc, mx.inputs[6])
    else:
        rk = nt.nodes.new('ShaderNodeMix'); rk.data_type = 'RGBA'
        rk.inputs[6].default_value = cz.col('#26262a'); rk.inputs[7].default_value = cz.col(rock_col)
        nt.links.new(nz.outputs['Fac'], rk.inputs[0]); nt.links.new(rk.outputs[2], mx.inputs[6])
    if sn: nt.links.new(sn, mx.inputs[7])
    else: mx.inputs[7].default_value = cz.col(snow_col)
    nt.links.new(mx.outputs[2], p.inputs['Base Color'])
    rgh = nt.nodes.new('ShaderNodeMapRange'); rgh.inputs['To Min'].default_value = 0.85; rgh.inputs['To Max'].default_value = 0.45
    nt.links.new(mr.outputs[0], rgh.inputs['Value']); nt.links.new(rgh.outputs[0], p.inputs['Roughness'])
    try:
        p.inputs['Subsurface Weight'].default_value = 0.0
    except Exception: pass
    if bump:
        n2 = nt.nodes.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 30.0; n2.inputs['Detail'].default_value = 6
        nt.links.new(vec, n2.inputs[0])
        b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = bump
        nt.links.new(n2.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def xray(name='xray', color='#22e83a', alpha=0.55, strength=0.9, fresnel=True):
    """The reference's highlight: see-through emissive green (rim brighter). Animate visibility with xray_fade()."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    try: m.surface_render_method = 'BLENDED'
    except Exception: m.blend_method = 'BLEND'
    try: m.use_transparency_overlap = False
    except Exception: pass
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = cz.col(color); em.inputs[1].default_value = strength
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader')
    a = nt.nodes.new('ShaderNodeValue'); a.outputs[0].default_value = alpha; a.name = 'alpha'; a.label = 'alpha'
    if fresnel:
        lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs[0].default_value = 0.35
        ad = nt.nodes.new('ShaderNodeMath'); ad.operation = 'MULTIPLY_ADD'
        nt.links.new(lw.outputs['Facing'], ad.inputs[0]); ad.inputs[1].default_value = 0.5; nt.links.new(a.outputs[0], ad.inputs[2])
        cl = nt.nodes.new('ShaderNodeMath'); cl.operation = 'MINIMUM'; cl.inputs[1].default_value = 1.0
        nt.links.new(ad.outputs[0], cl.inputs[0]); fac = cl.outputs[0]
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
        nt.links.new(fac, mul.inputs[0]); nt.links.new(a.outputs[0], mul.inputs[1]); mul.inputs[1].default_value = 1
        fac2 = nt.nodes.new('ShaderNodeMath'); fac2.operation = 'MULTIPLY'; fac2.name = 'gate'
        nt.links.new(fac, fac2.inputs[0]); fac2.inputs[1].default_value = 1.0
        nt.links.new(fac2.outputs[0], mx.inputs[0])
    else:
        nt.links.new(a.outputs[0], mx.inputs[0])
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def xray_fade(mat, keys, f0=1):
    """keys [(t, 0..1)]: keyframes the material's overall opacity (the 'gate' node, or 'alpha' without fresnel)."""
    nd = mat.node_tree.nodes.get('gate') or mat.node_tree.nodes.get('alpha')
    sock = nd.inputs[1] if nd.name == 'gate' else nd.outputs[0]
    for t, v in keys:
        sock.default_value = v; sock.keyframe_insert('default_value', frame=round(t * FPS) + 1)


def emit(name, color, strength=5.0):
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = cz.col(color); e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def steel(name='steel', color='#b8bcc4', rough=0.22, panels=0.0, panel_scale=4.0, img=None, scale=1.0):
    """Polished steel; panels>0 draws panel seams (brick texture mortar as dark grooves + bump)."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Metallic'].default_value = 1.0; p.inputs['Roughness'].default_value = rough
    vec = _coord(nt, 'Object', scale)
    base = _img(nt, img, vec).outputs[0] if img else None
    if base is None:
        nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 2.0; nt.links.new(vec, nz.inputs[0])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.inputs[0].default_value = 0.25; mx.blend_type = 'MULTIPLY'
        mx.inputs[6].default_value = cz.col(color); nt.links.new(nz.outputs['Color'], mx.inputs[7]); base = mx.outputs[2]
    if panels:
        br = nt.nodes.new('ShaderNodeTexBrick'); br.inputs['Scale'].default_value = panel_scale
        br.inputs['Mortar Size'].default_value = 0.012; br.offset = 0.0
        br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (0.85, 0.87, 0.9, 1)
        br.inputs['Mortar'].default_value = (0.05, 0.05, 0.06, 1)
        nt.links.new(vec, br.inputs[0])
        mx2 = nt.nodes.new('ShaderNodeMix'); mx2.data_type = 'RGBA'; mx2.blend_type = 'MULTIPLY'; mx2.inputs[0].default_value = panels
        nt.links.new(base, mx2.inputs[6]); nt.links.new(br.outputs[0], mx2.inputs[7]); base = mx2.outputs[2]
        b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.4
        nt.links.new(br.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    nt.links.new(base, p.inputs['Base Color'])
    nt.links.new(p.outputs[0], o.inputs[0])
    return m


def water(name='water', color='#0b3a4a', rough=0.04):
    """Deep teal sea. Pair with ocean() geometry for real waves (sun glints come from the sun lamp + low roughness)."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    # a full fresnel reflection turned the sea white at grazing angles (builder C): diffuse teal + 40 % tinted gloss
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = cz.col(color)
    p.inputs['Roughness'].default_value = 0.09
    try: p.inputs['Specular IOR Level'].default_value = 0.0
    except Exception: pass
    vec = _coord(nt, 'Object', 1.0)
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.6; nz.inputs['Detail'].default_value = 8
    nt.links.new(vec, nz.inputs[0])
    b = nt.nodes.new('ShaderNodeBump'); b.inputs['Strength'].default_value = 0.25
    nt.links.new(nz.outputs['Fac'], b.inputs['Height']); nt.links.new(b.outputs[0], p.inputs['Normal'])
    g = nt.nodes.new('ShaderNodeBsdfGlossy'); g.inputs['Color'].default_value = cz.col('#173f50'); g.inputs['Roughness'].default_value = rough + 0.02
    nt.links.new(b.outputs[0], g.inputs['Normal'])
    mx = nt.nodes.new('ShaderNodeMixShader'); mx.inputs[0].default_value = 0.4
    nt.links.new(p.outputs[0], mx.inputs[1]); nt.links.new(g.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def cloud_mat(name='cloud', img=None, strength=1.6):
    """Flow cloud picture on black -> brightness is the alpha (assets/mega/clouds.png). Use on cz.plane cards."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    try: m.surface_render_method = 'BLENDED'
    except Exception: pass
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = cz.image(img or os.path.join(TEX, 'clouds.png'))
    uv = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(uv.outputs['UV'], t.inputs[0])
    bw = nt.nodes.new('ShaderNodeRGBToBW'); nt.links.new(t.outputs[0], bw.inputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.05; mr.inputs['From Max'].default_value = 0.35
    nt.links.new(bw.outputs[0], mr.inputs[0])
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[1].default_value = strength; nt.links.new(t.outputs[0], em.inputs[0])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(mr.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], o.inputs[0])
    return m


def card_mat(name, img, alpha=True, emit_strength=0.0, shadeless=False):
    """A picture on a card (Flow clouds, signs, the ALASKA map...). shadeless: emission only (sky cards)."""
    m, n = _mat(name)
    if n is None: return m
    nt, o = n
    try: m.surface_render_method = 'BLENDED' if alpha else 'DITHERED'
    except Exception: pass
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = cz.image(cz.resolve(img) if not os.path.isabs(img) else img)
    uv = nt.nodes.new('ShaderNodeTexCoord'); nt.links.new(uv.outputs['UV'], t.inputs[0])
    if shadeless:
        sh = nt.nodes.new('ShaderNodeEmission'); sh.inputs[1].default_value = 1.0 if not emit_strength else emit_strength
        nt.links.new(t.outputs[0], sh.inputs[0])
    else:
        sh = nt.nodes.new('ShaderNodeBsdfPrincipled'); sh.inputs['Roughness'].default_value = 0.8
        nt.links.new(t.outputs[0], sh.inputs['Base Color'])
        if emit_strength:
            nt.links.new(t.outputs[0], sh.inputs['Emission Color']); sh.inputs['Emission Strength'].default_value = emit_strength
    if alpha:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(t.outputs[1], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(sh.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], o.inputs[0])
    else:
        nt.links.new(sh.outputs[0], o.inputs[0])
    return m


# ---------------------------------------------------------------- heightfields
def _vnoise(x, y, seed):
    """Value noise on a grid (numpy, vectorised), smooth-step interpolated."""
    rng = np.random.default_rng(seed)
    G = rng.random((257, 257))
    xi, yi = np.floor(x).astype(int), np.floor(y).astype(int)
    xf, yf = x - xi, y - yi
    xi &= 255; yi &= 255
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a, b = G[xi, yi], G[xi + 1, yi]; c, d = G[xi, yi + 1], G[xi + 1, yi + 1]
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v


def fbm(x, y, seed=0, octaves=6, ridged=False, lac=2.0, gain=0.5):
    s, amp, tot = 0.0, 1.0, 0.0
    for o in range(octaves):
        n = _vnoise(x * lac ** o, y * lac ** o, seed + o * 17)
        if ridged: n = 1 - abs(2 * n - 1); n = n * n
        s = s + amp * n; tot += amp; amp *= gain
    return s / tot


def heightfield(name, size, res, fn, mat=None, loc=(0, 0, 0), smooth=True):
    """A grid mesh size=(w, d) with res=(nx, ny) vertices; fn(X, Y) -> Z (numpy arrays, local coords)."""
    w, d = size if isinstance(size, (tuple, list)) else (size, size)
    nx, ny = res if isinstance(res, (tuple, list)) else (res, res)
    xs = np.linspace(-w / 2, w / 2, nx); ys = np.linspace(-d / 2, d / 2, ny)
    X, Y = np.meshgrid(xs, ys); Z = fn(X, Y)
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    i = np.arange(nx * ny).reshape(ny, nx)
    q = np.stack([i[:-1, :-1].ravel(), i[:-1, 1:].ravel(), i[1:, 1:].ravel(), i[1:, :-1].ravel()], 1)
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts)); me.vertices.foreach_set('co', verts.astype(np.float32).ravel())
    me.loops.add(q.size); me.loops.foreach_set('vertex_index', q.astype(np.int32).ravel())
    me.polygons.add(len(q)); me.polygons.foreach_set('loop_start', (np.arange(len(q)) * 4).astype(np.int32))
    me.polygons.foreach_set('loop_total', np.full(len(q), 4, np.int32))
    me.update(calc_edges=True); me.validate()
    if smooth: me.shade_smooth()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    if mat: me.materials.append(mat if not isinstance(mat, str) else pbr(name + '_m', mat))
    return ob


def mountain_fn(peak_h=1.0, radius=1.0, seed=3, ridge=0.55, base=0.0, sharp=1.6, detail=0.04):
    """An Everest-like peak: a radial cone shaped by ridged fbm (sharp arêtes) + small detail."""
    def f(X, Y):
        r = np.sqrt(X * X + Y * Y) / radius
        cone = np.clip(1 - r, 0, 1) ** sharp
        rd = fbm(X / radius * 2.2 + 11, Y / radius * 2.2 + 7, seed, 7, ridged=True)
        det = fbm(X / radius * 9 + 3, Y / radius * 9 + 5, seed + 50, 4)
        return base + peak_h * (cone * (1 - ridge + ridge * rd) + detail * det * np.clip(1.2 - r, 0, 1))
    return f


def range_fn(height=0.3, scale=1.0, seed=5, ridged=True, floor=0.0):
    """Endless snowy ridges for backgrounds (ridged fbm)."""
    def f(X, Y):
        return floor + height * fbm(X / scale + 31, Y / scale + 17, seed, 7, ridged=ridged)
    return f


def displace(ob, strength=0.1, scale=0.5, detail=6, subdiv=0, seed_offset=(0, 0, 0)):
    """Procedural displacement (Blender clouds texture) - roughen a cylinder / box into rock."""
    if subdiv:
        s = ob.modifiers.new('sub', 'SUBSURF'); s.levels = s.render_levels = subdiv; s.subdivision_type = 'SIMPLE'
    tx = bpy.data.textures.new(ob.name + '_dtx', 'CLOUDS'); tx.noise_scale = scale; tx.noise_depth = detail
    dm = ob.modifiers.new('disp', 'DISPLACE'); dm.texture = tx; dm.strength = strength; dm.mid_level = 0.5
    dm.texture_coords = 'GLOBAL'
    return dm


def ocean(name='sea', size=400.0, res=10, scale=1.0, wave=0.6, choppy=1.0, mat=None, f0=1, f1=1800, loc=(0, 0, 0), spatial=1.0):
    """Blender's ocean modifier plane, animated over [f0, f1] (time keyed)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc); ob = bpy.context.object; ob.name = name
    m = ob.modifiers.new('ocean', 'OCEAN')
    m.geometry_mode = 'GENERATE'; m.size = spatial; m.spatial_size = int(size); m.repeat_x = m.repeat_y = 1
    m.resolution = res; m.wave_scale = wave; m.choppiness = choppy; m.wind_velocity = 12 * scale
    m.time = 0.0; m.keyframe_insert('time', frame=f0); m.time = (f1 - f0) / FPS; m.keyframe_insert('time', frame=f1)
    _linear(ob)        # Blender 5 actions are layered: the shared helper reaches their fcurves
    ob.data.materials.append(mat or water())
    ob.data.shade_smooth()
    return ob


# ---------------------------------------------------------------- camera: continuous spline flights
def _cr(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


class Flight:
    """The camera (v2, 2026-10-27: the owner called v1's moves "jittery, jaggy"). keys: (t, eye, target[, lens[, roll]]).
    v1 eased every span in and out on its own, so the camera STOPPED at every key and re-accelerated, and uneven key
    spacing made the speed jump at each key. v2: one time-continuous spline (non-uniform Catmull-Rom on the key TIMES:
    the velocity is continuous through every key), then the baked path is smoothed (gaussian, `smooth` frames sigma),
    the LOOK DIRECTION is smoothed as a unit vector (a near target no longer swings the view), lens and roll too.
    cuts=[t, ...]: hard cuts inside the shot (nothing is smoothed across them, the spline restarts there).
    hold=True on a key (a 6th item, or keys repeated) parks the camera there: velocity 0 at that key only.
    ease: kept for old shot files and IGNORED unless strict_ease=True. Every bake prints `CZ CAM` - the measured
    smoothness (max angular acceleration deg/f^2, max speed change %/f) - and `CZ CAMJERK` frames over the limit."""
    def __init__(self, keys, name='cam', lens=24, clip=(0.05, 5000), sensor=24, dof=None, ease='inout', ease_p=1.6, up=None,
                 smooth=3.0, cuts=(), strict_ease=False, lens_range=(14, 50), push=0.0, push_frames=7, creep=0.0006, retime=True, speed_ease=0.6, keep_cuts=False):
        """up: a vector or a function of t giving the camera's up (default world Z; a globe wants the surface normal).
        lens_range: lenses outside it are clamped (the reference shoots wide: 14-50 mm on a 24 mm vertical sensor)."""
        self.up = up
        self.keys = [(k[0], Vector(k[1]), Vector(k[2]), k[3] if len(k) > 3 else lens, k[4] if len(k) > 4 else 0.0,
                      bool(k[5]) if len(k) > 5 else False) for k in keys]
        self.keys.sort(key=lambda k: k[0])
        lo, hi = lens_range
        self.keys = [(k[0], k[1], k[2], min(hi, max(lo, k[3])), k[4], k[5]) for k in self.keys]
        cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_fit = 'VERTICAL'; cd.sensor_height = sensor
        cd.clip_start, cd.clip_end = clip
        if dof:
            cd.dof.use_dof = True; cd.dof.aperture_fstop = dof[1]
            self.focus = dof[0]
        else: self.focus = None
        self.obj = bpy.data.objects.new(name, cd); bpy.context.scene.collection.objects.link(self.obj)
        bpy.context.scene.camera = self.obj
        self.ease, self.ease_p, self.strict = ease, ease_p, strict_ease
        # cuts inside a shot are OFF (the owner, 2026-10-27: calm and viewable over matching the reference's pace): the shot
        # travels its keys as ONE path; keep_cuts=True restores a hard cut there
        self.smooth, self.cuts = smooth, (sorted(cuts) if keep_cuts else [])
        if cuts and not keep_cuts and not strict_ease:
            # joining two views through one path swooped past (and through) the subject (E24): keep the view the shot
            # spends the longest in, and move calmly inside it for the whole shot
            bounds = [-1e9] + sorted(cuts) + [1e9]
            groups = [[k for k in self.keys if a <= k[0] < b] for a, b in zip(bounds, bounds[1:])]
            span = lambda g: (g[-1][0] - g[0][0]) if len(g) > 1 else 0.0
            best = max((g for g in groups if g), key=lambda g: (len(g) >= 2, span(g), len(g)))
            if len(best) >= 2: self.keys = best
        self.push, self.push_n, self.creep = push, push_frames, creep
        self.retime, self.ease_k = retime, speed_ease

    def _segments(self):
        """Key lists split at the hard cuts."""
        segs, cur = [], []
        cuts = list(self.cuts)
        for k in self.keys:
            while cuts and k[0] >= cuts[0] and cur:
                segs.append((cur, cuts.pop(0))); cur = []
            cur.append(k)
        segs.append((cur, None))
        return segs

    @staticmethod
    def _herm(K, idx, t):
        """Non-uniform Catmull-Rom (tangents from neighbours over TIME) evaluated at time t; hold keys get 0 tangent."""
        n = len(K)
        if n == 1 or t <= K[0][0]: return Vector(K[0][idx]) if idx in (1, 2) else K[0][idx]
        if t >= K[-1][0]: return Vector(K[-1][idx]) if idx in (1, 2) else K[-1][idx]
        i = max(j for j in range(n - 1) if K[j][0] <= t)
        def tan(j):
            if K[j][5]: return K[j][idx] * 0 if idx in (1, 2) else 0.0
            a, b = K[max(0, j - 1)], K[min(n - 1, j + 1)]
            dt = b[0] - a[0]
            return (b[idx] - a[idx]) / dt if dt > 1e-6 else (K[j][idx] * 0 if idx in (1, 2) else 0.0)
        t0, t1 = K[i][0], K[i + 1][0]; h = max(1e-6, t1 - t0); u = (t - t0) / h
        p0, p1, m0, m1 = K[i][idx], K[i + 1][idx], tan(i) * h, tan(i + 1) * h
        h00, h10, h01, h11 = 2 * u**3 - 3 * u**2 + 1, u**3 - 2 * u**2 + u, -2 * u**3 + 3 * u**2, u**3 - u**2
        return p0 * h00 + m0 * h10 + p1 * h01 + m1 * h11

    def _strict_at(self, K, t):
        """v1 behaviour (per-span ease) for shots that ask for it."""
        if t <= K[0][0]: return K[0][1], K[0][2], K[0][3], K[0][4]
        if t >= K[-1][0]: return K[-1][1], K[-1][2], K[-1][3], K[-1][4]
        i = max(j for j in range(len(K) - 1) if K[j][0] <= t)
        k = (t - K[i][0]) / max(1e-6, K[i + 1][0] - K[i][0])
        e = self.ease[i] if isinstance(self.ease, (list, tuple)) and i < len(self.ease) else self.ease
        if e == 'inout': k = 0.5 * (2 * k) ** self.ease_p if k < 0.5 else 1 - 0.5 * (2 * (1 - k)) ** self.ease_p
        g = lambda j, idx: K[max(0, min(len(K) - 1, j))][idx]
        return (_cr(g(i - 1, 1), g(i, 1), g(i + 1, 1), g(i + 2, 1), k), _cr(g(i - 1, 2), g(i, 2), g(i + 1, 2), g(i + 2, 2), k),
                lerp(K[i][3], K[i + 1][3], k), lerp(K[i][4], K[i + 1][4], k))

    def at(self, t):
        for K, cut in self._segments():
            if cut is None or t < cut:
                if self.strict: return self._strict_at(K, t)
                return self._herm(K, 1, t), self._herm(K, 2, t), self._herm(K, 3, t), self._herm(K, 4, t)

    def _samples(self, f0, f1):
        F = list(range(f0 - 1, f1 + 2))
        E, D, L, R, seg, DI = [], [], [], [], [], []
        cuts = self.cuts
        for f in F:
            t = (f - 1) / FPS
            eye, tgt, lens, roll = self.at(t)
            d = (tgt - eye); d = d.normalized() if d.length > 1e-6 else Vector((0, 1, 0))
            E.append(eye); D.append(d); L.append(lens); R.append(roll); DI.append(max(0.05, (tgt - eye).length))
            seg.append(sum(1 for c in cuts if t >= c))
        if self.smooth > 0:
            sig = self.smooth; rad = int(sig * 3)
            w = [math.exp(-0.5 * (i / sig) ** 2) for i in range(-rad, rad + 1)]
            def sm(arr, vec):
                out = []
                for i in range(len(arr)):
                    acc = Vector((0, 0, 0)) if vec else 0.0; ws = 0.0
                    for j, wj in zip(range(i - rad, i + rad + 1), w):
                        if 0 <= j < len(arr) and seg[j] == seg[i]:
                            acc = acc + arr[j] * wj; ws += wj
                    out.append(acc / ws)
                return out
            E, D, L, R, DI = sm(E, True), [d.normalized() for d in sm(D, True)], sm(L, False), sm(R, False), sm(DI, False)
        if self.retime: E, D, L, R, DI = self._retime(E, D, L, R, DI, seg)
        self._edges = self._push_through(F, E, D, L, R, seg, DI)
        return F, E, D, L, R, seg

    def _retime(self, E, D, L, R, DI, seg):
        """THE PATH (v4, 2026-10-27, the owner: "the camera should follow a path, go on that, slow down or speed up, zoom
        in or out, but not be this frantic"). The keys only DRAW the path; the camera travels it with ONE smooth speed
        profile per shot (per segment between cuts): it eases in, cruises, eases out - never stops at a key, never bursts
        because two keys sit close together. Distance travelled = eye movement relative to the subject distance + the turn
        of the view + the lens change, so a pan, a dolly and a zoom share the one profile. ease (0..1): how much slower the
        ends are than the middle."""
        n = len(E); out = [list(E), list(D), list(L), list(R), list(DI)]
        i0 = 0
        for i in range(1, n + 1):
            if i < n and seg[i] == seg[i0]: continue
            a, b = i0, i - 1; i0 = i
            if b - a < 3: continue
            cum = [0.0]
            for j in range(a + 1, b + 1):
                m = (E[j] - E[j - 1]).length / max(DI[j], 1e-3) + D[j].angle(D[j - 1]) + abs(L[j] - L[j - 1]) / 40
                cum.append(cum[-1] + m)
            tot = cum[-1]
            if tot < 1e-6: continue
            N = b - a
            for k in range(N + 1):
                u = k / N
                pu = u + self.ease_k * ((u * u * (3 - 2 * u)) - u)        # linear blended with smoothstep
                target = pu * tot
                lo, hi = 0, N                                             # find the source sample at that distance
                while hi - lo > 1:
                    mid = (lo + hi) // 2
                    if cum[mid] <= target: lo = mid
                    else: hi = mid
                span = cum[hi] - cum[lo]; w = (target - cum[lo]) / span if span > 1e-9 else 0.0
                j0, j1 = a + lo, a + hi
                out[0][a + k] = E[j0].lerp(E[j1], w)
                out[1][a + k] = D[j0].slerp(D[j1], w) if D[j0].angle(D[j1]) > 1e-6 else D[j0]
                out[2][a + k] = lerp(L[j0], L[j1], w); out[3][a + k] = lerp(R[j0], R[j1], w); out[4][a + k] = lerp(DI[j0], DI[j1], w)
        return out[0], [d.normalized() for d in out[1]], out[2], out[3], out[4]

    def _push_through(self, F, E, D, L, R, seg, DI):
        """THE CUT GRAMMAR (v3, 2026-10-27; the owner: "camera cuts are still twitchy ... needs a permanent fix").
        The reference hides every cut inside ONE forward push: the camera accelerates forward into the cut with the
        blur building, the next shot comes out of the same forward push and decelerates. Builders' own edge whips
        (sideways swings of 40 deg in 4 frames) read as twitches. So, in the engine, for EVERY shot edge and every
        hard cut: the first/last `push_frames` frames take the pose of the first/last interior frame (no swing, the
        builder's edge keys are overridden) and travel along the view direction - arriving fast and decelerating
        (entry), accelerating away (exit), `push` x the subject distance. A slow creep toward the subject (`creep`
        per frame of the distance) keeps every shot alive (the reference never holds still). Returns the edge frame
        indices (motion blur opens on them)."""
        n = len(F); edges = set()
        if self.creep:
            i0 = 0
            for i in range(1, n + 1):
                if i == n or seg[i] != seg[i0]:
                    for j in range(i0, i):
                        E[j] = E[j] + D[j] * (DI[j] * self.creep * (j - i0))
                    i0 = i
        if not self.push: return edges
        i0 = 0
        for i in range(1, n + 1):
            if i == n or seg[i] != seg[i0]:
                a, b = i0, i - 1
                N = max(2, min(self.push_n, (b - a + 1) // 4))
                ia, ib = a + N, b - N
                if ia < ib:
                    for j in range(a, ia):                      # entry: from behind, decelerating
                        k = (ia - j) / N
                        E[j] = E[ia] - D[ia] * (DI[ia] * self.push * k * k); D[j] = D[ia]; L[j] = L[ia]; R[j] = R[ia]
                        edges.add(j)
                    for j in range(ib + 1, b + 1):              # exit: forward, accelerating
                        k = (j - ib) / N
                        E[j] = E[ib] + D[ib] * (DI[ib] * self.push * k * k); D[j] = D[ib]; L[j] = L[ib]; R[j] = R[ib]
                        edges.add(j)
                i0 = i
        return edges

    def bake(self, f0, f1, shake=0.0, seed=1):
        ob, cd = self.obj, self.obj.data
        rnd = random.Random(seed); ph = [rnd.uniform(0, 100) for _ in range(6)]
        # edge whips out (the owner: calm, viewable): keys in the first / last 0.2 s of the shot were whip keys swinging the
        # camera toward the next shot; while 2+ keys stay inside, the shot travels only its own path
        t0, t1, edge = (f0 - 1) / FPS, (f1 - 1) / FPS, 0.2
        inner = [k for k in self.keys if t0 + edge < k[0] < t1 - edge]
        if len(inner) >= 2 and not self.strict:
            self.keys = inner
        F, E, D, L, R, seg = self._samples(f0, f1)
        prev = None
        for f, eye, d, lens, roll in zip(F, E, D, L, R):
            t = (f - 1) / FPS
            if shake:     # slow handheld drift only (fast noise read as jitter)
                eye = eye + Vector((math.sin(t * 1.3 + ph[0]), math.sin(t * 1.1 + ph[1]), math.sin(t * 1.7 + ph[2]))) * shake
            if self.up is not None:
                u = Vector(self.up(t) if callable(self.up) else self.up).normalized()
                z = -d; x = u.cross(z).normalized(); y = z.cross(x)
                q = Matrix((x, y, z)).transposed().to_quaternion()
            else:
                q = d.to_track_quat('-Z', 'Y')
            e = (q @ Quat_roll(roll)).to_euler('XYZ', prev) if prev else (q @ Quat_roll(roll)).to_euler('XYZ')
            prev = e
            ob.location = eye; ob.keyframe_insert('location', frame=f)
            ob.rotation_euler = e; ob.keyframe_insert('rotation_euler', frame=f)
            cd.lens = lens; cd.keyframe_insert('lens', frame=f)
            if self.focus is not None:
                fp = self.focus(t) if callable(self.focus) else self.focus
                cd.dof.focus_distance = (Vector(fp) - eye).length; cd.dof.keyframe_insert('focus_distance', frame=f)
        _linear(ob); _linear(cd)
        # a hard cut: the key BEFORE the cut holds (constant), so motion blur on that frame does not smear the two
        # views together across the cut (builder C, E25-E27: the cut frame showed both shots blurred into each other)
        cutf = [F[i - 1] for i in range(1, len(F)) if seg[i] != seg[i - 1]]
        if cutf: _const_at(ob, cutf); _const_at(cd, cutf)
        sc = bpy.context.scene
        if getattr(self, '_edges', None) and sc.render.use_motion_blur:
            base = sc.render.motion_blur_shutter
            for i, f in enumerate(F):
                sc.render.motion_blur_shutter = min(1.0, base * 2.0) if i in self._edges else base
                sc.render.keyframe_insert('motion_blur_shutter', frame=f)
            _interp(sc, 'CONSTANT')
        cam_report(F, E, D, L, seg, skip={F[i] for i in getattr(self, '_edges', ())})   # (the push-through edges move fast on purpose)
        return ob


def cam_report(F, E, D, L, seg, acc_lim=0.6, spd_lim=12.0, skip=()):
    """Measured camera smoothness: angular velocity (deg/f) and its change (deg/f^2), eye speed change (% per frame),
    lens change (mm/f). Prints CZ CAM (maxima) and CZ CAMJERK <frame> ... for frames over the limits (not at cuts)."""
    ang = [0.0] + [math.degrees(D[i].angle(D[i - 1])) if seg[i] == seg[i - 1] else 0.0 for i in range(1, len(D))]
    spd = [0.0] + [(E[i] - E[i - 1]).length if seg[i] == seg[i - 1] else 0.0 for i in range(1, len(E))]
    bad, amax, smax, lmax = [], 0.0, 0.0, 0.0
    for i in range(2, len(F) - 1):
        if seg[i] != seg[i - 1] or seg[i - 1] != seg[i - 2]: continue
        da = abs(ang[i] - ang[i - 1]); amax = max(amax, da)
        ref = max(spd[i], spd[i - 1], 1e-4)
        ds = abs(spd[i] - spd[i - 1]) / ref * 100 if ref > 0.02 else 0.0; smax = max(smax, ds)
        lmax = max(lmax, abs(L[i] - L[i - 1]))
        if (da > acc_lim or ds > spd_lim) and F[i] not in skip and F[i - 1] not in skip: bad.append(F[i])
    print(f'CZ CAM max ang-accel {amax:.2f} deg/f2, max speed change {smax:.1f} %/f, max lens change {lmax:.2f} mm/f, '
          f'peak turn {max(ang):.1f} deg/f, lens {min(L):.0f}-{max(L):.0f} mm, {len(bad)} jerky frames')
    if bad: print('CZ CAMJERK', ','.join(str(f) for f in bad[:60]))


def Quat_roll(deg):
    from mathutils import Quaternion
    return Quaternion((0, 0, 1), math.radians(deg))


def _linear(idb):
    _interp(idb, "LINEAR")


def _fcurves_of(idb):
    ad = getattr(idb, 'animation_data', None)
    if not ad or not ad.action: return []
    try: return list(ad.action.fcurves)
    except Exception:
        out = []
        for lay in ad.action.layers:
            for st in lay.strips:
                for cb in st.channelbags: out += list(cb.fcurves)
        return out


def _const_at(idb, frames):
    """Constant interpolation out of the keys at these frames (hard cuts)."""
    fs = set(frames)
    for fc in _fcurves_of(idb):
        for k in fc.keyframe_points:
            if int(round(k.co[0])) in fs: k.interpolation = 'CONSTANT'


def _interp(idb, mode):
    ad = getattr(idb, 'animation_data', None)
    if not ad or not ad.action: return
    try:
        for fc in cz._fcurves(ad.action, idb, None) if False else ad.action.fcurves:
            for k in fc.keyframe_points: k.interpolation = mode
    except Exception:
        try:
            for lay in ad.action.layers:
                for st in lay.strips:
                    for cb in st.channelbags:
                        for fc in cb.fcurves:
                            for k in fc.keyframe_points: k.interpolation = mode
        except Exception as e: print('CZ linear', e)


# ---------------------------------------------------------------- helpers
def visible(obj, spans, f0, f1, children=True):
    """Show obj only during spans [(t0, t1)] (seconds), keyed hide_render per frame boundaries."""
    def on(t): return any(a <= t < b for a, b in spans)
    last = None
    for f in range(f0 - 1, f1 + 2):
        v = on((f - 1) / FPS)
        if v != last:
            obj.hide_render = not v; obj.keyframe_insert('hide_render', frame=f)
            obj.hide_viewport = not v; obj.keyframe_insert('hide_viewport', frame=f)
            last = v
    if children:
        for c in obj.children: visible(c, spans, f0, f1)


def bake_path(obj, f0, f1, pos=None, rot=None, scale=None, stepped=False):
    """Per-frame keys from functions of time t (seconds): pos(t)->xyz, rot(t)->degrees xyz, scale(t)->xyz or float."""
    for f in range(f0 - 1, f1 + 2):
        t = (f - 1) / FPS
        if pos: obj.location = pos(t); obj.keyframe_insert('location', frame=f)
        if rot: obj.rotation_euler = [math.radians(a) for a in rot(t)]; obj.keyframe_insert('rotation_euler', frame=f)
        if scale:
            s = scale(t); obj.scale = (s, s, s) if isinstance(s, (int, float)) else s; obj.keyframe_insert('scale', frame=f)
    _linear(obj) if not stepped else _interp(obj, "CONSTANT")   # stepped: random per-frame poses must not smear into streaks under motion blur


def join(name, objs, apply=False):
    """Join many meshes into one object (fewer draw calls = faster EEVEE). apply=True also applies the result's
    transform (otherwise the first part's rotation rides along into copies placed later: reactors lay on their side)."""
    objs = [o for o in objs if o and o.type == 'MESH']
    if not objs: return None
    ctx = bpy.context
    for o in ctx.selected_objects: o.select_set(False)
    # bake every part's modifiers (bevels!) into its mesh first: a join keeps only the ACTIVE part's modifier stack,
    # so every other part lost its bevel and came out razor-sharp - the "plastic" look (builder A, 2026-10-27)
    dg = ctx.evaluated_depsgraph_get()
    for o in objs:
        if o.modifiers:
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
            old = o.data; o.modifiers.clear(); o.data = me
            if old.users == 0: bpy.data.meshes.remove(old)
    for o in objs: o.select_set(True)
    ctx.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); objs[0].name = name
    if apply: bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return objs[0]


def scatter(make, n, area, seed=1, z=0.0, rot=True, scale=(0.8, 1.2), avoid=None):
    """Call make(i, (x, y, z), rotZ_deg, s) n times over area ((x0, y0), (x1, y1)); avoid(x, y) -> True skips."""
    r = random.Random(seed); out = []
    tries = 0
    while len(out) < n and tries < n * 20:
        tries += 1
        x, y = r.uniform(area[0][0], area[1][0]), r.uniform(area[0][1], area[1][1])
        if avoid and avoid(x, y): continue
        zz = z(x, y) if callable(z) else z
        out.append(make(len(out), (x, y, zz), r.uniform(0, 360) if rot else 0, r.uniform(*scale)))
    return out


def text3d(name, body, size, loc, rot=(90, 0, 0), mat=None, extrude=0.02, align='CENTER', font=None):
    return cz.text(name, body, size=size, loc=loc, mat=mat or emit(name + '_m', '#ffffff', 2.0), rot=rot, extrude=extrude,
                   font=font, align=align)


def count_text(obj, fmt, keys, f0, f1):
    """Animated number text: a frame-change handler is not available headless in render jobs we bake as separate
    text objects per frame - instead swap the body in a frame_change_pre handler (works in -b renders)."""
    data = dict(obj=obj.name, fmt=fmt, keys=keys)
    _COUNTERS.append(data)
    if _counter_handler not in bpy.app.handlers.frame_change_pre:
        bpy.app.handlers.frame_change_pre.append(_counter_handler)


_COUNTERS = []


def _counter_handler(scene, *a):
    t = (scene.frame_current - 1) / FPS
    for d in _COUNTERS:
        ob = bpy.data.objects.get(d['obj'])
        if not ob: continue
        K = d['keys']; v = K[0][1]
        for (ta, va), (tb, vb) in zip(K, K[1:]):
            if ta <= t <= tb: v = lerp(va, vb, cz.smooth((t - ta) / max(1e-6, tb - ta))); break
            if t > tb: v = vb
        ob.data.body = d['fmt'].format(v)


def column(name, r, h, mat=None, rough=0.06, seed=1, nu=256, nv=96, taper=0.0, loc=(0, 0, 0), top=True, pits=0.5):
    """A rock column (the cut slab): a cylinder mesh whose radius is perturbed by fbm (vertical strata + lumps) and
    pitted. rough = relative radius variation. top=False leaves it open (a cap mesh sits there)."""
    u = np.linspace(0, 2 * np.pi, nu, endpoint=False); v = np.linspace(0, 1, nv)
    U, V = np.meshgrid(u, v)
    cu, su = np.cos(U), np.sin(U)
    n1 = fbm(cu * 3 + 9, su * 3 + V * h / r * 1.5, seed, 6)
    n2 = fbm(cu * 14 + 3, su * 14 + V * h / r * 7, seed + 9, 3, ridged=True)
    rr = r * (1 - taper * V) * (1 + rough * (n1 - 0.5) * 2 + rough * 0.6 * (n2 - 0.5) * pits)
    X, Y, Z = rr * cu, rr * su, V * h
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    i = np.arange(nu * nv).reshape(nv, nu); j = np.roll(i, -1, axis=1)
    q = np.stack([i[:-1].ravel(), j[:-1].ravel(), j[1:].ravel(), i[1:].ravel()], 1)
    faces = [tuple(f) for f in q]
    if top:
        verts = np.vstack([verts, [[0, 0, h]]]); c = len(verts) - 1
        faces += [(i[-1][k], i[-1][(k + 1) % nu], c) for k in range(nu)]
    me = bpy.data.meshes.new(name); me.from_pydata(verts.tolist(), [], faces); me.update(); me.shade_smooth()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); ob.location = loc
    if mat: me.materials.append(mat)
    return ob
