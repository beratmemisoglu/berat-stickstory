# Blender toon engine for the lab (Blender 5.2, EEVEE). Imported by engine/run.py inside Blender.
# Look: soft cel-lit colour (diffuse -> Shader to RGB -> lift), inverted-hull ink outlines, white heads with Flow-made
# face sprites projected from the front (upper / mouth / extras atlases, cells keyed per frame), black noodle limbs
# (geometry nodes quadratic bezier between empties), ball hands. Everything animated is a pure function of the frame,
# evaluated in Python and baked to keyframes. Units: metres, Z up, characters face -Y.
import bpy, bmesh, math, json, os
from mathutils import Vector, Matrix, Euler, Quaternion

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
INK = (0.006, 0.004, 0.003, 1)      # near-black, like the reference's line work
SKIN_WHITE = (0.905, 0.9, 0.88, 1)   # #f4f3ef in linear
FACES = json.load(open(os.path.join(LAB, 'assets', 'faces', 'faces.json'), encoding='utf8'))
# The film's own folder (the scene file's): set by use_scene. In the lab it is film/<name>/; in Toon Studio the project folder,
# while LAB is the app's read-only kit. Relative picture paths, props and the narration's words look here first.
PROJECT = None
# Where props draw pictures made from a shot's own words or colours (door signs, headstone text): None = the prop's own tex/
# (the lab); a project outside the lab gets <project>/.suite/btex, so nothing is ever written into the app's kit.
GEN = None
# The film's frame: vertical 1080x1920 (shorts), or 1920x1080 when its project.json says settings.format "landscape". The
# camera's sensor fits the frame's HEIGHT, so a framing shows the same height either way and a wide frame sees more width.
RES = (1080, 1920)


def use_scene(scene_file):
    """Point the engine at a scene file's film folder (run.py / serve.py call this before the scene builds)."""
    global PROJECT, GEN, FACE_DIR, RES
    sf = os.path.abspath(scene_file)
    PROJECT = os.path.dirname(sf)
    RES = (1080, 1920)
    try:
        if json.load(open(os.path.join(PROJECT, 'project.json'), encoding='utf-8-sig')).get('settings', {}).get('format') == 'landscape': RES = (1920, 1080)
    except Exception: pass   # (a lab film: no project.json)
    inside = os.path.normcase(PROJECT).startswith(os.path.normcase(LAB) + os.sep)
    GEN = None if inside else os.path.join(PROJECT, '.suite', 'btex')
    FACE_DIR = os.path.join(PROJECT, 'faces', os.path.splitext(os.path.basename(sf))[0])
    return PROJECT


def py():
    """The Python that runs the helper scripts (face sprites, the props' picture makers; needs Pillow): CZ_PY (Toon Studio
    passes its own), else the lab's venv, else python on PATH."""
    return os.environ.get('CZ_PY') or next((p for p in (os.path.join(LAB, '.venv', 'Scripts', 'python.exe'),
                                                         os.path.join(LAB, '.venv', 'bin', 'python')) if os.path.exists(p)), 'python')


def gen_path(tex_dir, fname):
    """A prop's drawn picture: the shipped one in its tex/ when it exists, else its place in GEN (where the maker draws it)."""
    p = os.path.join(tex_dir, fname)
    if os.path.exists(p) or not GEN: return p
    os.makedirs(GEN, exist_ok=True)
    return os.path.join(GEN, fname)


def made(tex_dir, fname, maker, *args):
    """A picture a prop's maker script (in its tex/) draws: the shipped one, else one drawn before into GEN, else drawn now
    (the maker writes into CZ_TEX_OUT = GEN when that is set). None when it can't be made."""
    for d in (tex_dir, GEN):
        if d and os.path.exists(os.path.join(d, fname)): return os.path.join(d, fname)
    import subprocess
    env = dict(os.environ)
    if GEN: os.makedirs(GEN, exist_ok=True); env['CZ_TEX_OUT'] = GEN
    try:
        subprocess.run([py(), os.path.join(tex_dir, maker), *[str(a) for a in args]], timeout=120, check=True, capture_output=True,
                       env=env, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except Exception as e: print('CZ PICTURE FAILED', fname, repr(e)[:300])
    return next((os.path.join(d, fname) for d in (GEN, tex_dir) if d and os.path.exists(os.path.join(d, fname))), None)


def resolve(rel):
    """A file a scene names relative to its film: the film's own folder first, then the kit (assets/... paths)."""
    if os.path.isabs(rel): return rel
    if PROJECT:
        p = os.path.join(PROJECT, rel)
        if os.path.exists(p) or any(os.path.exists(os.path.splitext(p)[0] + e) for e in ('.png', '.jpg', '.webp')): return p
    return os.path.join(LAB, rel)


def words(path=None):
    """The narration's words with their times in seconds: [{'word', 'start', 'end'}], the shape talk() reads. Default: the
    film's audio/timeline.json (Toon Studio: a list of phrases {s, e, text, words: [{w, s, e}]}), else its words.json /
    talk.json (the transcriber's {"words": [{"word", "start", "end"}]}). An explicit path reads that file."""
    cands = [path] if path else [os.path.join(PROJECT or '', n) for n in ('audio/timeline.json', 'words.json', 'talk.json')]
    for p in cands:
        if not p or not os.path.exists(p): continue
        d = json.load(open(p, encoding='utf8'))
        if isinstance(d, dict): ws = d.get('words', [])
        elif any(isinstance(x, dict) and 'words' in x for x in d): ws = [w for ph in d if isinstance(ph, dict) for w in (ph.get('words') or [])]
        else: ws = d
        return [{'word': w.get('word', w.get('w', '')), 'start': float(w.get('start', w.get('s', 0))), 'end': float(w.get('end', w.get('e', 0)))}
                for w in ws if isinstance(w, dict) and (w.get('word') or w.get('w'))]
    raise FileNotFoundError('no narration words (audio/timeline.json) next to the scene: ' + str(PROJECT))


def at(W, word, n=1, after=0.0):
    """The n-th spoken `word` (case and punctuation ignored) at or after `after` seconds -> its entry from words()."""
    k = ''.join(ch for ch in word.lower() if ch.isalnum())
    hits = [w for w in W if w['start'] >= after - 1e-6 and ''.join(ch for ch in w['word'].lower() if ch.isalnum()) == k]
    if len(hits) < n: raise KeyError(f'"{word}" #{n} is not in the narration after {after:.2f}s')
    return hits[n - 1]


def frame_of(t):
    """Seconds on the film's timeline -> its global frame (30 fps, frame 1 = 0 s)."""
    return int(round(t * FPS)) + 1


def srgb(h, a=1.0):
    """'#rrggbb' -> linear RGBA."""
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x / 12.92) if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c) + (a,)


def col(c): return srgb(c) if isinstance(c, str) else (tuple(c) + (1,) if len(c) == 3 else tuple(c))


# ---------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for b in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.node_groups):
        for x in list(b): b.remove(x)


def setup(frame_end, res=None, samples=48, world='#2a2622', world_strength=0.6, gi=False):
    """res: the frame (default RES: the film's format, 1080x1920 or 1920x1080 from its project.json)."""
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = res or RES
    sc.render.resolution_percentage = 100
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = 1, frame_end
    try: sc.display_settings.display_device = 'sRGB'
    except Exception: pass
    for vt in ('Standard',):
        try: sc.view_settings.view_transform = vt
        except Exception as e: print('CZ view transform', e)
    sc.view_settings.look = 'None'
    sc.eevee.taa_render_samples = samples
    sc.eevee.use_shadows = True
    sc.eevee.shadow_ray_count = 2
    sc.eevee.shadow_step_count = 8
    # dressed sets at full size overflowed the default 512 MB pool ("Shadow buffer full" 2600 / 2048 pages: shadows drop)
    try: sc.eevee.shadow_pool_size = '1024'
    except Exception as e: print('CZ shadow pool', e)
    gi = gi if os.environ.get('CZ_GI') is None else os.environ.get('CZ_GI') == '1'   # GI does nothing for emission-based toon shaders (pixel-identical A/B): the AO node in the toon shaders does the contact shading
    sc.eevee.use_raytracing = gi
    # jittered depth of field: the camera aperture is sampled per TAA sample (smooth, physically right bokeh like the
    # reference's creamy backgrounds; the post-process DOF ringed bright edges). CZ_JITTER=0 for A/B.
    try:
        sc.eevee.use_bokeh_jittered = os.environ.get('CZ_JITTER', '1') == '1'; sc.eevee.bokeh_overblur = 5.0
    except Exception as e: print('CZ jitter', e)
    if gi:
        sc.eevee.ray_tracing_options.resolution_scale = '2'
        sc.eevee.use_fast_gi = True
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGB'
    w = bpy.data.worlds.new('world'); sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']; bg.inputs[0].default_value = col(world); bg.inputs[1].default_value = world_strength
    return sc


# ---------------------------------------------------------------- materials
def _nodes(m):
    m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    return nt, nt.nodes, nt.links


def image(path, colorspace='sRGB'):
    path = resolve(path)
    for im in bpy.data.images:
        if bpy.path.abspath(im.filepath) == path: return im
    im = bpy.data.images.load(path); im.colorspace_settings.name = colorspace
    return im


def toon(name, color='#cccccc', lift=0.62, img=None, uv='UV', scale=(1, 1), emit=0.0, emit_color=None, alpha_clip=False, tint=None, sheen=0.0,
         tex=None, tex_scale=1.0, tex_strength=0.06, proj=None, proj_scale=1.0, pattern=None, ramp=None):
    """proj='box': an image wrapped on any mesh without UVs (object-space box projection, proj_scale repeats per metre;
    for Flow-made seamless wall / floor textures). pattern: procedural surface on top of color or img:
    ('tiles', size_m, grout_hex) floor / ceiling tiles, ('planks', length_m, width_m, gap_hex) wood floors or panels,
    ('carpet', size_m, hex2) offset two-tone carpet tiles, ('speckle', density, hex2) terrazzo / lino flecks.
    ramp=(shadow_hex, lit_hex, lo, hi): COLOUR-SCRIPTED light - the colour comes from HOW MUCH light lands (lo..hi on the
    light's brightness, smoothstep), not from the lights' colours multiplied in: base x shadow_hex in the shade, base x
    lit_hex in the light (multipliers, ~1.0 = unchanged). The lottery cork: a blue fill strong enough for lavender
    shadow stripes turned the golden sun stripes salmon (OFFICE); with a ramp both are exactly the reference's."""
    m = bpy.data.materials.get(name)
    if m: return m
    if proj == 'box' or pattern or ramp:
        return _toon_rich(name, color, lift, img, proj_scale, pattern, tex, tex_scale, tex_strength, tint, emit, ramp)
    return _toon_basic(name, color, lift, img, uv, scale, emit, emit_color, alpha_clip, tint, tex, tex_scale, tex_strength, sheen)


AO = {'strength': 0.55, 'dist': 0.35}     # night 2: contact shading (corners, under objects, where things touch)


def _ao(N, L, col_socket):
    """Darken a lit colour by ambient occlusion: our toon shaders end in Emission, so EEVEE's GI/AO never touched them
    (a GI A/B was pixel-identical). The AO node (horizon scan) brings the reference's soft contact shading back.
    CZ_AO=0 turns it off; AO['strength'] 0..1."""
    if os.environ.get('CZ_AO') == '0' or not AO['strength']: return col_socket
    ao = N.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = AO['dist']; ao.samples = 8
    k = N.new('ShaderNodeMapRange'); L.new(ao.outputs['AO'], k.inputs['Value'])
    k.inputs['To Min'].default_value = 1 - AO['strength']; k.inputs['To Max'].default_value = 1.0
    sc = N.new('ShaderNodeVectorMath'); sc.operation = 'SCALE'; L.new(col_socket, sc.inputs[0]); L.new(k.outputs['Result'], sc.inputs['Scale'])
    return sc.outputs[0]


def _toon_rich(name, color, lift, img, proj_scale, pattern, tex, tex_scale, tex_strength, tint, emit, ramp=None):
    m = bpy.data.materials.new(name); nt, N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial')
    dif = N.new('ShaderNodeBsdfDiffuse'); s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs[0], s2r.inputs[0])
    gam = N.new('ShaderNodeGamma'); gam.inputs['Gamma'].default_value = lift; L.new(s2r.outputs['Color'], gam.inputs['Color'])
    tc = N.new('ShaderNodeTexCoord')
    if img:
        mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (proj_scale,) * 3
        L.new(tc.outputs['Object'], mp.inputs['Vector'])
        tx = N.new('ShaderNodeTexImage'); tx.image = image(img) if isinstance(img, str) else img
        tx.projection = 'BOX'; tx.projection_blend = 0.25; tx.interpolation = 'Cubic'
        L.new(mp.outputs[0], tx.inputs['Vector']); base = tx.outputs['Color']
        if tint:
            mt = N.new('ShaderNodeVectorMath'); mt.operation = 'MULTIPLY'; mt.inputs[1].default_value = col(tint)[:3]
            L.new(base, mt.inputs[0]); base = mt.outputs[0]
    else:
        rgb = N.new('ShaderNodeRGB'); rgb.outputs[0].default_value = col(color); base = rgb.outputs[0]
    if pattern:
        kind = pattern[0]
        if kind in ('tiles', 'planks', 'carpet'):
            br = N.new('ShaderNodeTexBrick'); L.new(tc.outputs['Object'], br.inputs['Vector'])
            br.inputs['Scale'].default_value = 1.0
            if kind == 'tiles':
                size, grout = pattern[1], pattern[2]
                br.offset = 0.0; br.inputs['Brick Width'].default_value = size; br.inputs['Row Height'].default_value = size
                br.inputs['Mortar Size'].default_value = 0.006; br.inputs['Mortar'].default_value = col(grout)
                br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (0.93, 0.93, 0.93, 1)
            elif kind == 'planks':
                ln, wd, gap = pattern[1], pattern[2], pattern[3]
                br.offset = 0.5; br.offset_frequency = 1; br.inputs['Brick Width'].default_value = ln; br.inputs['Row Height'].default_value = wd
                br.inputs['Mortar Size'].default_value = 0.004; br.inputs['Mortar'].default_value = col(gap)
                br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (0.86, 0.86, 0.86, 1)
            else:
                size, c2 = pattern[1], pattern[2]
                br.offset = 0.5; br.inputs['Brick Width'].default_value = size; br.inputs['Row Height'].default_value = size
                br.inputs['Mortar Size'].default_value = 0.002; br.inputs['Mortar'].default_value = (0.8, 0.8, 0.8, 1)
                br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = col(c2)
            br.inputs['Bias'].default_value = 0.0
            base = vm(N, L, 'MULTIPLY', base, br.outputs['Color'])
        elif kind == 'speckle':
            dens, c2 = pattern[1], pattern[2]
            vo = N.new('ShaderNodeTexVoronoi'); vo.feature = 'F1'; vo.inputs['Scale'].default_value = 60.0 * dens
            L.new(tc.outputs['Object'], vo.inputs['Vector'])
            fl = mth(N, L, 'LESS_THAN', vo.outputs['Distance'], 0.12)
            mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; L.new(fl, mx.inputs[0]); L.new(base, mx.inputs[6])
            mx.inputs[7].default_value = col(c2); base = mx.outputs[2]
    if tex:
        nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 6.0 * tex_scale; nz.inputs['Detail'].default_value = 4.0
        L.new(tc.outputs['Object'], nz.inputs['Vector'])
        k = mth(N, L, 'MULTIPLY_ADD', nz.outputs['Fac'], 2 * tex_strength, 1 - tex_strength)
        sc_ = N.new('ShaderNodeVectorMath'); sc_.operation = 'SCALE'; L.new(base, sc_.inputs[0]); L.new(k, sc_.inputs['Scale']); base = sc_.outputs[0]
    light = gam.outputs[0]
    if ramp:
        bw = N.new('ShaderNodeRGBToBW'); L.new(light, bw.inputs['Color'])
        k = N.new('ShaderNodeMapRange'); k.interpolation_type = 'SMOOTHSTEP'; L.new(bw.outputs['Val'], k.inputs['Value'])
        k.inputs['From Min'].default_value = ramp[2]; k.inputs['From Max'].default_value = ramp[3]
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; L.new(k.outputs['Result'], mx.inputs[0])
        rc = lambda v: col(v) if isinstance(v, str) else (*v, 1.0)          # hex, or a linear (r, g, b) multiplier > 1 allowed
        mx.inputs[6].default_value = rc(ramp[0]); mx.inputs[7].default_value = rc(ramp[1]); light = mx.outputs[2]
    mul = _ao(N, L, vm(N, L, 'MULTIPLY', base, light))
    em = N.new('ShaderNodeEmission'); L.new(mul, em.inputs['Color']); em.inputs['Strength'].default_value = 1
    sh = em.outputs[0]
    if emit:
        e2 = N.new('ShaderNodeEmission'); e2.inputs['Strength'].default_value = emit; L.new(base, e2.inputs['Color'])
        ad = N.new('ShaderNodeAddShader'); L.new(sh, ad.inputs[0]); L.new(e2.outputs[0], ad.inputs[1]); sh = ad.outputs[0]
    L.new(sh, out.inputs['Surface'])
    return m


def _toon_basic(name, color, lift, img, uv, scale, emit, emit_color, alpha_clip, tint, tex, tex_scale, tex_strength, sheen=0.0):
    """Soft cel material: base * light^lift (keeps the light's colour), optional image base, optional glow."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    nt, N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial'); out.location = (900, 0)
    dif = N.new('ShaderNodeBsdfDiffuse'); dif.inputs['Color'].default_value = (1, 1, 1, 1)
    s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs[0], s2r.inputs[0])
    gam = N.new('ShaderNodeGamma'); L.new(s2r.outputs['Color'], gam.inputs['Color']); gam.inputs['Gamma'].default_value = lift
    alpha = None
    if img:
        tx = N.new('ShaderNodeTexImage'); tx.image = image(img) if isinstance(img, str) else img
        tx.interpolation = 'Cubic'
        if uv != 'UV' or scale != (1, 1):
            tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale[0], scale[1], 1)
            L.new(tc.outputs['UV' if uv == 'UV' else uv], mp.inputs['Vector']); L.new(mp.outputs[0], tx.inputs['Vector'])
        base = tx.outputs['Color']; alpha = tx.outputs['Alpha']
        if tint:
            mt = N.new('ShaderNodeVectorMath'); mt.operation = 'MULTIPLY'; mt.inputs[1].default_value = col(tint)[:3]
            L.new(base, mt.inputs[0]); base = mt.outputs[0]
    else:
        rgb = N.new('ShaderNodeRGB'); rgb.outputs[0].default_value = col(color); base = rgb.outputs[0]
    if tex is None and not img: tex, tex_strength = 'grain', min(tex_strength, 0.035)   # every surface gets a little paint
    if tex:
        # painted surface detail: soft mottling ('grain'), wood grain ('wood'), paper fibre ('paper'), hair strands ('hair')
        tc = N.new('ShaderNodeTexCoord')
        if tex == 'hair':
            # night 2 (the owner's reference): smooth glossy hair with a few long, lighter painted streaks that follow
            # the cap's curve across the head (latitude bands, wobbled by noise), strongest on the upper front.
            # (v1 drew 34 radial strands: it read as corduroy.)
            nv = N.new('ShaderNodeVectorMath'); nv.operation = 'NORMALIZE'; L.new(tc.outputs['Object'], nv.inputs[0])
            sp = N.new('ShaderNodeSeparateXYZ'); L.new(nv.outputs[0], sp.inputs[0])
            nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 3.2 * tex_scale; nz.inputs['Detail'].default_value = 1.5
            L.new(tc.outputs['Object'], nz.inputs['Vector'])
            ph_ = mth(N, L, 'MULTIPLY_ADD', nz.outputs['Fac'], 2.6, mth(N, L, 'MULTIPLY', sp.outputs['Z'], 24.0))
            band = mth(N, L, 'SINE', ph_)
            st = N.new('ShaderNodeMapRange'); st.inputs['From Min'].default_value = 0.9; st.inputs['From Max'].default_value = 0.97   # thin crisp streaks (reference)
            st.inputs['To Min'].default_value = 0.0; st.inputs['To Max'].default_value = 1.0; L.new(band, st.inputs['Value'])
            up = N.new('ShaderNodeMapRange'); up.inputs['From Min'].default_value = 0.15; up.inputs['From Max'].default_value = 0.55
            L.new(sp.outputs['Z'], up.inputs['Value'])
            frontk = N.new('ShaderNodeMapRange'); frontk.inputs['From Min'].default_value = 0.6; frontk.inputs['From Max'].default_value = -0.4
            L.new(sp.outputs['Y'], frontk.inputs['Value'])
            msk = mth(N, L, 'MULTIPLY', mth(N, L, 'MULTIPLY', st.outputs['Result'], up.outputs['Result']), mth(N, L, 'MULTIPLY_ADD', frontk.outputs['Result'], 0.6, 0.4))
            hi_ = N.new('ShaderNodeVectorMath'); hi_.operation = 'MULTIPLY_ADD'; L.new(base, hi_.inputs[0])
            hi_.inputs[1].default_value = (1.9, 1.75, 1.6); hi_.inputs[2].default_value = (0.03, 0.024, 0.018)   # small offset: on black hair a big one drew grey stripes
            mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; L.new(mth(N, L, 'MULTIPLY', msk, 0.85), mx.inputs[0])
            L.new(base, mx.inputs[6]); L.new(hi_.outputs[0], mx.inputs[7]); base = mx.outputs[2]
            tex = None
    if tex:
        if tex == 'wood':
            wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'
            wv.inputs['Scale'].default_value = 3.0 * tex_scale; wv.inputs['Distortion'].default_value = 6.0; wv.inputs['Detail'].default_value = 3.0
            L.new(tc.outputs['Object'], wv.inputs['Vector']); f = wv.outputs['Fac']
        else:
            nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = (6.0 if tex == 'grain' else 40.0) * tex_scale
            nz.inputs['Detail'].default_value = 4.0; L.new(tc.outputs['Object'], nz.inputs['Vector']); f = nz.outputs['Fac']
        k = mth(N, L, 'MULTIPLY_ADD', f, 2 * tex_strength, 1 - tex_strength)
        bm2 = N.new('ShaderNodeVectorMath'); bm2.operation = 'SCALE'; L.new(base, bm2.inputs[0]); L.new(k, bm2.inputs['Scale']); base = bm2.outputs[0]
    mul = N.new('ShaderNodeVectorMath'); mul.operation = 'MULTIPLY'
    L.new(base, mul.inputs[0]); L.new(gam.outputs[0], mul.inputs[1])
    lit = _ao(N, L, mul.outputs[0])
    if sheen:
        # a soft plastic highlight (the reference's shirts and hair catch the key light): glossy -> RGB, banded a
        # little so it reads as a painted highlight, added on top
        gl = N.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.32
        g2 = N.new('ShaderNodeShaderToRGB'); L.new(gl.outputs[0], g2.inputs[0])
        bw = N.new('ShaderNodeRGBToBW'); L.new(g2.outputs['Color'], bw.inputs[0])
        mr = N.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 0.3; mr.inputs['From Max'].default_value = 0.9
        L.new(bw.outputs[0], mr.inputs['Value'])
        # the highlight takes the surface's own colour (a white add turned black hair grey, night 2): base * 1.3 + 0.08
        tn = N.new('ShaderNodeVectorMath'); tn.operation = 'MULTIPLY_ADD'; L.new(base, tn.inputs[0])
        tn.inputs[1].default_value = (1.3 * sheen,) * 3; tn.inputs[2].default_value = (0.08 * sheen,) * 3
        add = N.new('ShaderNodeVectorMath'); add.operation = 'MULTIPLY_ADD'
        L.new(mr.outputs['Result'], add.inputs[0]); L.new(tn.outputs[0], add.inputs[1]); L.new(lit, add.inputs[2])
        lit = add.outputs[0]
    em = N.new('ShaderNodeEmission'); L.new(lit, em.inputs['Color']); em.inputs['Strength'].default_value = 1
    sh = em.outputs[0]
    if emit:
        e2 = N.new('ShaderNodeEmission'); e2.inputs['Strength'].default_value = emit
        if emit_color: e2.inputs['Color'].default_value = col(emit_color)
        else: L.new(base, e2.inputs['Color'])
        ad = N.new('ShaderNodeAddShader'); L.new(sh, ad.inputs[0]); L.new(e2.outputs[0], ad.inputs[1]); sh = ad.outputs[0]
    if alpha_clip and alpha is not None:
        tr = N.new('ShaderNodeBsdfTransparent'); mx = N.new('ShaderNodeMixShader')
        gt = N.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = 0.5; L.new(alpha, gt.inputs[0])
        L.new(gt.outputs[0], mx.inputs[0]); L.new(tr.outputs[0], mx.inputs[1]); L.new(sh, mx.inputs[2]); sh = mx.outputs[0]
        m.surface_render_method = 'DITHERED'
    L.new(sh, out.inputs['Surface'])
    return m


def glow(name, color, strength=4.0):
    """Unlit glowing surface (bulbs, screens): pure emission, blooms in post."""
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); nt, N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial'); em = N.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = col(color); em.inputs['Strength'].default_value = strength
    L.new(em.outputs[0], out.inputs['Surface'])
    return m


def screen(name, img, strength=1.6):
    """An image shown on a lit screen (monitors, phones): emission of the picture."""
    m = bpy.data.materials.new(name); nt, N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial'); tx = N.new('ShaderNodeTexImage'); tx.image = image(img) if isinstance(img, str) else img
    em = N.new('ShaderNodeEmission'); em.inputs['Strength'].default_value = strength
    L.new(tx.outputs['Color'], em.inputs['Color']); L.new(em.outputs[0], out.inputs['Surface'])
    return m


def ink():
    m = bpy.data.materials.get('cz_ink')
    if m: return m
    m = glow('cz_ink', INK, 1.0)
    m.use_backface_culling = True
    # the hull must not shadow the object it wraps (that put every head in its own grainy shadow)
    if hasattr(m, 'use_backface_culling_shadow'): m.use_backface_culling_shadow = True
    else: print('CZ WARNING: no use_backface_culling_shadow')
    return m


def outline(obj, t=0.008):
    """Inverted-hull ink line around obj (t metres)."""
    if t <= 0 or obj.type != 'MESH': return obj
    mats = obj.data.materials
    if 'cz_ink' not in [m.name for m in mats if m]: mats.append(ink())
    sol = obj.modifiers.new('cz_outline', 'SOLIDIFY')
    sol.thickness = t; sol.offset = 1; sol.use_flip_normals = True; sol.use_rim = False
    sol.material_offset = len(mats) - 1; sol.use_even_offset = False
    obj['cz_ol'] = t          # the design thickness: cam.bake turns it into a constant on-screen width per frame
    return obj


def ink_weight(obj, lo=0.3, light=(-0.45, -0.35, 0.82), wobble=0.2, seed=0):
    """Brush-like line weight (night 2, the owner: "somewhere it's thicker, somewhere it's slimmer, for the outline of
    the head"): the reference's ink is heavy on the bottom / shadow side of a form and thin where the light hits, and it
    swells and thins a little along the contour like a brush. A vertex group scales the outline hull per vertex:
    weight 1 = full width, `lo` on the lit side (light = the key direction in the object's own space), plus a slow
    wobble along the contour. The hull's base width is raised so the mean line stays as heavy as before."""
    if obj.type != 'MESH' or 'cz_outline' not in obj.modifiers: return obj
    me = obj.data
    vg = obj.vertex_groups.get('cz_inkw') or obj.vertex_groups.new(name='cz_inkw')
    L = Vector(light).normalized()
    import random as _r
    rnd = _r.Random(seed or (hash(obj.name) & 0xffff)); ph = [rnd.uniform(0, 6.28) for _ in range(3)]
    for v in me.vertices:
        n = v.normal; d = n.dot(L)                       # +1 facing the light .. -1 away
        k = smooth((0.55 - d) / 1.1)                     # 0 on the lit side -> 1 in shadow
        p = v.co
        wob = 1 + wobble * math.sin(9 * p.x + ph[0]) * math.cos(7 * p.z + ph[1]) + 0.5 * wobble * math.sin(13 * p.y + ph[2])
        vg.add([v.index], clamp((lo + (1 - lo) * k) * wob, 0.15, 1.0), 'REPLACE')
    sol = obj.modifiers['cz_outline']
    sol.vertex_group = 'cz_inkw'; sol.thickness_vertex_group = 0.0
    obj['cz_ol'] = obj['cz_ol'] * 1.55                    # mean weight ~0.65: keep the mean line as heavy as before
    return obj


# ---------------------------------------------------------------- meshes
def _link(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent: obj.parent = parent
    return obj


def _mesh_obj(name, bm, mat, smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    if smooth: me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    if mat: me.materials.append(mat if not isinstance(mat, str) else toon('c_' + mat.lstrip('#'), mat))
    return bpy.data.objects.new(name, me)


def place(obj, loc=(0, 0, 0), rot=(0, 0, 0), scale=None, parent=None, outline_t=0.0, bevel=0.0, segs=3):
    obj.location = loc; obj.rotation_euler = Euler([math.radians(a) for a in rot])
    if scale: obj.scale = scale
    _link(obj, parent)
    if bevel:
        b = obj.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = segs; b.limit_method = 'ANGLE'; b.harden_normals = True
    if outline_t: outline(obj, outline_t)
    return obj


def box(name, size, loc=(0, 0, 0), mat='#cccccc', rot=(0, 0, 0), bevel=0.01, ol=0.006, parent=None, origin='center'):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
    oz = {'center': 0, 'bottom': 0.5, 'top': -0.5}[origin]
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], (v.co.z + oz) * size[2]))
    return place(_mesh_obj(name, bm, mat, smooth=False), loc, rot, None, parent, ol, bevel)


def cyl(name, r, h, loc=(0, 0, 0), mat='#cccccc', rot=(0, 0, 0), verts=40, bevel=0.0, ol=0.006, parent=None, r2=None, origin='bottom'):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=h)
    if origin == 'bottom':
        for v in bm.verts: v.co.z += h / 2
    o = _mesh_obj(name, bm, mat)
    return place(o, loc, rot, None, parent, ol, bevel)


def sphere(name, r, loc=(0, 0, 0), mat='#cccccc', scale=None, ol=0.006, parent=None, segs=48, rings=24):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    return place(_mesh_obj(name, bm, mat), loc, (0, 0, 0), scale, parent, ol)


def capsule(name, r, h, loc=(0, 0, 0), mat='#cccccc', scale=None, ol=0.006, parent=None):
    """Capsule standing on its base: total height h (>= 2r), origin at the bottom."""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=r)
    mid = max(0, h - 2 * r)
    for v in bm.verts:
        v.co.z += (mid / 2 if v.co.z > 0 else -mid / 2) + h / 2
    return place(_mesh_obj(name, bm, mat), loc, (0, 0, 0), scale, parent, ol)


def plane(name, w, h, loc=(0, 0, 0), mat=None, rot=(90, 0, 0), parent=None, ol=0.0):
    """Upright card facing -Y by default (rot 90 about X), UV 0..1."""
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops: lp[uvl].uv = (lp.vert.co.x + 0.5, lp.vert.co.y + 0.5)
    for v in bm.verts: v.co.x *= w; v.co.y *= h
    return place(_mesh_obj(name, bm, mat, smooth=False), loc, rot, None, parent, ol)


# the 3D text's default face: Arial Black, which Windows and macOS both have (never shipped)
ARIAL_BLACK = [os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts', 'ariblk.ttf'),
               '/System/Library/Fonts/Supplemental/Arial Black.ttf', '/Library/Fonts/Arial Black.ttf',
               os.path.expanduser('~/Library/Fonts/Arial Black.ttf')]


def text(name, body, size=0.1, loc=(0, 0, 0), mat='#ffffff', rot=(90, 0, 0), extrude=0.004, font=None, align='CENTER', parent=None):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude
    cu.align_x = align; cu.align_y = 'CENTER'
    f = resolve(font) if font else next((p for p in ARIAL_BLACK if os.path.exists(p)), None)
    if f and os.path.exists(f): cu.font = bpy.data.fonts.load(f, check_existing=True)
    o = bpy.data.objects.new(name, cu)
    cu.materials.append(mat if not isinstance(mat, str) else toon('c_' + mat.lstrip('#'), mat))
    return place(o, loc, rot, None, parent)


def empty(name, loc=(0, 0, 0), parent=None, size=0.05):
    e = bpy.data.objects.new(name, None); e.empty_display_size = size; e.location = loc
    return _link(e, parent)


def light(name, kind='AREA', loc=(0, 0, 3), rot=(0, 0, 0), color='#fff3e0', power=200, size=1.0, shadow=True, target=None):
    ld = bpy.data.lights.new(name, kind); ld.color = col(color)[:3]; ld.energy = power
    if kind == 'AREA': ld.size = size
    elif kind in ('POINT', 'SPOT'): ld.shadow_soft_size = size
    elif kind == 'SUN': ld.angle = math.radians(size)
    ld.use_shadow = shadow
    o = bpy.data.objects.new(name, ld); o.location = loc; o.rotation_euler = Euler([math.radians(a) for a in rot])
    _link(o)
    if target is not None: aim(o, target)
    return o


def aim(obj, target, up='Y'):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', up).to_euler()


_PROPS = {}


def prop(_kind, name=None, loc=(0, 0, 0), rot=0.0, scale=1.0, parent=None, **kw):
    """Instance of assets/props/<kind>.py at loc, turned rot degrees about Z (a placeholder box if it isn't built yet).
    The film's own props/<kind>.py wins over the kit's (a project's new or changed prop)."""
    import importlib.util
    kind = _kind
    name = name or f'{kind}_{len([o for o in bpy.data.objects if o.name.startswith(kind)])}'
    own = os.path.join(PROJECT, 'props', kind + '.py') if PROJECT else None
    path = own if own and os.path.exists(own) else os.path.join(LAB, 'assets', 'props', kind + '.py')
    root = None
    if os.path.exists(path):
        try:
            if kind not in _PROPS:
                spec = importlib.util.spec_from_file_location('prop_' + kind, path); mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod); _PROPS[kind] = mod
            root = _PROPS[kind].build(sys_mod(), name, **kw)
        except Exception as e:   # a prop being rewritten must not stop a shot render
            import traceback; print('CZ PROP FAILED', kind, repr(e)); traceback.print_exc(limit=2)
            for o in [o for o in bpy.data.objects if o.name.startswith(name)]: bpy.data.objects.remove(o)
    if root is None:
        print('CZ PLACEHOLDER', kind)
        root = empty(name); box(name + '_ph', (0.6, 0.6, 0.8), (0, 0, 0.4), '#ff00ff', parent=root)
    root.location = loc; root.rotation_euler = Euler((0, 0, math.radians(rot))); root.scale = (scale,) * 3
    if parent: root.parent = parent
    return root


def poster(name, img, w, loc, rot=0.0, frame='#2b2622', frame_w=0.025, parent=None, h=None):
    """A framed picture on a wall (wall at the poster's back, facing -Y before rot). Height from the image's aspect."""
    path = resolve(img)
    base = os.path.splitext(path)[0]
    path = next((base + e for e in ('.png', '.jpg', '.webp') if os.path.exists(base + e)), None)
    root = empty(name, loc, parent=parent); root.rotation_euler = Euler((0, 0, math.radians(rot)))
    if not path:
        print('CZ POSTER MISSING', img); h = h or w * 1.3
        box(name + '_blank', (w, 0.01, h), (0, -0.006, 0), '#efe7d4', bevel=0.003, ol=0.004, parent=root); return root
    im = image(path); h = h or w * im.size[1] / max(1, im.size[0])
    box(name + '_frame', (w + 2 * frame_w, 0.02, h + 2 * frame_w), (0, -0.01, 0), toon(name + '_fm', frame), bevel=0.004, ol=0.005, parent=root)
    plane(name + '_pic', w, h, (0, -0.0215, 0), toon(name + '_picm', img=im, lift=0.75), rot=(90, 0, 0), parent=root)
    return root


def no_shadow(substr=('glass', 'Glass', 'pane', 'sky')):
    """Glass and sky cards must not block the sun (window patches on the floor)."""
    for o in bpy.data.objects:
        if o.type == 'MESH' and any(s in o.name for s in substr): o.visible_shadow = False


def sys_mod():
    import sys
    return sys.modules[__name__]


def find(name):
    return bpy.data.objects.get(name)


# ---------------------------------------------------------------- baking
def bake(obj, path, values, f0, index=-1, interp='LINEAR'):
    """values: list per frame (f0, f0+1, ...) of a scalar or a vector -> keyframes on obj.path."""
    if not values: return
    if obj.animation_data is None: obj.animation_data_create()
    if obj.animation_data.action is None:
        obj.animation_data.action = bpy.data.actions.new(obj.name + '_act')
    first = values[0]
    n = len(first) if hasattr(first, '__len__') else 1
    idxs = range(n) if (index == -1 and n > 1) else [max(0, index)]
    for i in idxs:
        obj.keyframe_insert(path, index=i if n > 1 or index >= 0 else -1, frame=f0)
    act = obj.animation_data.action
    fcs = _fcurves(act, obj, path)
    for k, fc in enumerate(fcs):
        i = fc.array_index if n > 1 else 0
        fc.keyframe_points.clear()
        fc.keyframe_points.add(len(values))
        co = []
        for j, v in enumerate(values): co += [f0 + j, (v[i] if n > 1 else v)]
        fc.keyframe_points.foreach_set('co', co)
        fc.keyframe_points.foreach_set('interpolation', [{'LINEAR': 1, 'CONSTANT': 0}[interp]] * len(values))
        fc.update()


def _fcurves(act, obj, path):
    try:   # 4.4+/5.x layered actions
        fcs = [fc for fc in act.layers[0].strips[0].channelbag(obj.animation_data.action_slot).fcurves if fc.data_path == path]
        if fcs: return fcs
    except Exception: pass
    return [fc for fc in getattr(act, 'fcurves', []) if fc.data_path == path]


# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0): return a if x < a else b if x > b else x
def lerp(a, b, k): return a + (b - a) * k
def vlerp(a, b, k): return Vector(a).lerp(Vector(b), k)
def smooth(k): k = clamp(k); return k * k * (3 - 2 * k)
def in_out_sine(k): k = clamp(k); return 0.5 - 0.5 * math.cos(math.pi * k)
def out_cubic(k): k = clamp(k); return 1 - (1 - k) ** 3
def in_cubic(k): k = clamp(k); return k ** 3
def out_quad(k): k = clamp(k); return 1 - (1 - k) ** 2
def gesture(k): k = clamp(k); return 1 - (1 - k ** 1.5) ** 3      # speed peaks in frame 2 of 5 (MOTION.md)
def back_out(k, s=1.25):
    """Ease-out with an overshoot: passes the target by ~8 % (s 1.25) around 70 % of the way, settles at 1."""
    k = clamp(k); c3 = s + 1; return 1 + c3 * (k - 1) ** 3 + s * (k - 1) ** 2
def snap(k):
    """Gesture v2: fast out, overshoot ~6 %, settle (arms, heads, props: the reference's poses land with a little bounce)."""
    return back_out(k, 1.0)
EASE = {'linear': clamp, 'smooth': smooth, 'sine': in_out_sine, 'out': out_cubic, 'in': in_cubic, 'gesture': gesture, 'outquad': out_quad,
        'back': back_out, 'snap': snap}


class Track:
    """Keys (t, value, ease) -> value at time t; values are floats or tuples. Holds before/after.
    arc: 3D tuples travel on an ARC instead of a straight line (hands: animation's 'arcs' principle) - a bulge of
    arc x the travel distance, up and forward, peaking mid-move."""
    def __init__(self, v0, arc=0.0): self.k = [(-1e9, v0, 'linear')]; self.arc = arc
    def key(self, t, v, dur=0.2, ease='gesture'):
        """Reach v at time t + dur, starting at t from wherever the track is."""
        self.k.append((t, None, None)); self.k.append((t + dur, v, ease)); return self
    def at(self, t):
        prev = self.k[0][1]; i = 1
        while i < len(self.k):
            ts, _, _ = self.k[i]; te, v, e = self.k[i + 1]
            if t < ts: return prev
            if t < te:
                kk = EASE[e]((t - ts) / max(1e-6, te - ts))
                if isinstance(v, tuple):
                    p = tuple(lerp(a, b, kk) for a, b in zip(prev, v))
                    if self.arc and len(v) == 3:
                        L = math.sqrt(sum((b - a) ** 2 for a, b in zip(prev, v)))
                        bump = self.arc * L * math.sin(math.pi * clamp(kk))
                        p = (p[0], p[1] - 0.45 * bump, p[2] + 0.9 * bump)
                    return p
                return lerp(prev, v, kk)
            prev = v; i += 2
        return prev


# ---------------------------------------------------------------- geometry-nodes limb
def limb_group():
    ng = bpy.data.node_groups.get('cz_limb')
    if ng: return ng
    ng = bpy.data.node_groups.new('cz_limb', 'GeometryNodeTree')
    io = ng.interface
    io.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    for n in ('A', 'B', 'C'): io.new_socket(n, in_out='INPUT', socket_type='NodeSocketObject')
    rs = io.new_socket('Radius', in_out='INPUT', socket_type='NodeSocketFloat'); rs.default_value = 0.016
    io.new_socket('Material', in_out='INPUT', socket_type='NodeSocketMaterial')
    N, Lk = ng.nodes, ng.links
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    infos = []
    for n in ('A', 'B', 'C'):
        oi = N.new('GeometryNodeObjectInfo'); oi.transform_space = 'RELATIVE'; Lk.new(gi.outputs[n], oi.inputs['Object']); infos.append(oi)
    # a cubic segment whose handles are the quadratic's degree elevation (identical to the old quadratic curve at
    # sharpness 0) pulled toward the middle point by `k` = (B empty's scale x) - 1: k = 1 puts both handles ON the
    # corner, so a seated leg bends like an L at the knee (night 2: the old curve could not bend and ran through seats)
    def vmath(op, a, b=None, s=None):
        n = N.new('ShaderNodeVectorMath'); n.operation = op
        Lk.new(a, n.inputs[0])
        if b is not None: Lk.new(b, n.inputs[1])
        if s is not None:
            if isinstance(s, (int, float)): n.inputs['Scale'].default_value = s
            else: Lk.new(s, n.inputs['Scale'])
        return n.outputs['Vector']
    sepk = N.new('ShaderNodeSeparateXYZ'); Lk.new(infos[1].outputs['Scale'], sepk.inputs[0])
    kk = N.new('ShaderNodeMath'); kk.operation = 'MULTIPLY_ADD'; Lk.new(sepk.outputs['X'], kk.inputs[0])
    kk.inputs[1].default_value = 1 / 3; kk.inputs[2].default_value = 1 / 3      # (2/3 + (sx-1)/3) = sx/3 + 1/3
    kk2 = N.new('ShaderNodeMath'); kk2.operation = 'MINIMUM'; Lk.new(kk.outputs[0], kk2.inputs[0]); kk2.inputs[1].default_value = 1.0
    A_, B_, C_ = infos[0].outputs['Location'], infos[1].outputs['Location'], infos[2].outputs['Location']
    h1 = vmath('ADD', A_, vmath('SCALE', vmath('SUBTRACT', B_, A_), s=kk2.outputs[0]))
    h2 = vmath('ADD', C_, vmath('SCALE', vmath('SUBTRACT', B_, C_), s=kk2.outputs[0]))
    qb = N.new('GeometryNodeCurvePrimitiveBezierSegment'); qb.mode = 'POSITION'; qb.inputs['Resolution'].default_value = 24
    Lk.new(A_, qb.inputs['Start']); Lk.new(h1, qb.inputs['Start Handle']); Lk.new(h2, qb.inputs['End Handle']); Lk.new(C_, qb.inputs['End'])
    circ = N.new('GeometryNodeCurvePrimitiveCircle'); circ.inputs['Resolution'].default_value = 12
    Lk.new(gi.outputs['Radius'], circ.inputs['Radius'])
    c2m = N.new('GeometryNodeCurveToMesh'); c2m.inputs['Fill Caps'].default_value = True
    Lk.new(qb.outputs[0], c2m.inputs['Curve']); Lk.new(circ.outputs[0], c2m.inputs['Profile Curve'])
    sm = N.new('GeometryNodeSetMaterial'); Lk.new(c2m.outputs[0], sm.inputs['Geometry']); Lk.new(gi.outputs['Material'], sm.inputs['Material'])
    Lk.new(sm.outputs[0], go.inputs['Geometry'])
    return ng


def limb(name, a, b, c, radius, mat, parent):
    me = bpy.data.meshes.new(name); o = bpy.data.objects.new(name, me); _link(o, parent)
    # Blender 5 refuses ID values through modifier properties: each limb gets its own copy of the group with the
    # objects, radius and material set on the nodes themselves
    md = o.modifiers.new('limb', 'NODES'); ng = limb_group().copy(); ng.name = 'cz_limb_' + name; md.node_group = ng
    gi = next(n for n in ng.nodes if n.bl_idname == 'NodeGroupInput')
    for lk in list(ng.links):
        if lk.from_node == gi: ng.links.remove(lk)
    infos = [n for n in ng.nodes if n.bl_idname == 'GeometryNodeObjectInfo']
    for oi, ob in zip(infos, (a, b, c)): oi.inputs['Object'].default_value = ob
    next(n for n in ng.nodes if n.bl_idname == 'GeometryNodeCurvePrimitiveCircle').inputs['Radius'].default_value = radius
    next(n for n in ng.nodes if n.bl_idname == 'GeometryNodeSetMaterial').inputs['Material'].default_value = mat
    return o


# ---------------------------------------------------------------- face material
def face_material(name, skin=SKIN_WHITE, lift=0.55, R=0.24, fu=0.0, fv=0.0, fs=1.0):
    """Head material: lit skin + unlit face layers from the atlases, picked per frame by the head object's custom
    props face (upper cell), mouth (mouth cell), mopen (0 closed .. 1 open: scales the talk mouth), extra (-1 none)."""
    m = bpy.data.materials.new(name); nt, N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial')
    dif = N.new('ShaderNodeBsdfDiffuse'); s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs[0], s2r.inputs[0])
    gam = N.new('ShaderNodeGamma'); gam.inputs['Gamma'].default_value = lift; L.new(s2r.outputs['Color'], gam.inputs['Color'])
    sk = N.new('ShaderNodeRGB'); sk.outputs[0].default_value = col(skin)
    # white heads stay white (the reference's heads read white under any light): most of the light's colour is drained
    # and the shading range is compressed so the shade side is a light grey, never a dark beige
    bw = N.new('ShaderNodeRGBToBW'); L.new(gam.outputs[0], bw.inputs[0])
    dr = N.new('ShaderNodeMix'); dr.data_type = 'RGBA'; dr.inputs[0].default_value = 0.65
    L.new(gam.outputs[0], dr.inputs[6]); L.new(bw.outputs[0], dr.inputs[7])
    cm = N.new('ShaderNodeVectorMath'); cm.operation = 'MULTIPLY_ADD'
    L.new(dr.outputs[2], cm.inputs[0]); cm.inputs[1].default_value = (0.6, 0.6, 0.6); cm.inputs[2].default_value = (0.42, 0.42, 0.42)
    lit = vm(N, L, 'MULTIPLY', sk.outputs[0], cm.outputs[0])
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    span = 2 * R * fs
    u = mth(N, L, 'MULTIPLY_ADD', sep.outputs['X'], 1 / span, 0.5 + fu)
    v = mth(N, L, 'MULTIPLY_ADD', sep.outputs['Z'], 1 / span, 0.5 + fv)
    front = mth(N, L, 'LESS_THAN', sep.outputs['Y'], 0.0)     # only the front half carries the face

    def attr(nm):
        a = N.new('ShaderNodeAttribute'); a.attribute_type = 'OBJECT'; a.attribute_name = nm; return a.outputs['Fac']

    def layer(img, grid, cell_in, uu, vv):
        cols, rows = grid
        cx = mth(N, L, 'FLOORED_MODULO', cell_in, cols); cy = mth(N, L, 'FLOOR', mth(N, L, 'DIVIDE', cell_in, cols))
        inside = mth(N, L, 'MULTIPLY', mth(N, L, 'MULTIPLY', mth(N, L, 'GREATER_THAN', uu, 0.002), mth(N, L, 'LESS_THAN', uu, 0.998)),
                     mth(N, L, 'MULTIPLY', mth(N, L, 'GREATER_THAN', vv, 0.002), mth(N, L, 'LESS_THAN', vv, 0.998)))
        valid = mth(N, L, 'GREATER_THAN', cell_in, -0.5)
        au = mth(N, L, 'DIVIDE', mth(N, L, 'ADD', cx, uu), cols)
        av = mth(N, L, 'DIVIDE', mth(N, L, 'ADD', mth(N, L, 'SUBTRACT', rows - 1, cy), vv), rows)
        cmb = N.new('ShaderNodeCombineXYZ'); L.new(au, cmb.inputs[0]); L.new(av, cmb.inputs[1])
        tx = N.new('ShaderNodeTexImage'); tx.image = image(img); tx.interpolation = 'Linear'; tx.extension = 'CLIP'
        L.new(cmb.outputs[0], tx.inputs['Vector'])
        a = mth(N, L, 'MULTIPLY', mth(N, L, 'MULTIPLY', tx.outputs['Alpha'], inside), mth(N, L, 'MULTIPLY', valid, front))
        return tx.outputs['Color'], a

    G = FACES['grids']
    c_up, a_up = layer('assets/faces/upper.png', G['upper'], attr('face'), u, v)
    # mouth: scaled vertically about its centre (0.5, 0.35) by mopen (talking), never wider than 1
    mo = attr('mopen'); sy = mth(N, L, 'MULTIPLY_ADD', mo, 0.65, 0.35); sx = mth(N, L, 'MULTIPLY_ADD', mo, 0.12, 0.88)
    mu = mth(N, L, 'ADD', mth(N, L, 'DIVIDE', mth(N, L, 'SUBTRACT', u, 0.5), sx), 0.5)
    mv = mth(N, L, 'ADD', mth(N, L, 'DIVIDE', mth(N, L, 'SUBTRACT', v, 0.35), sy), 0.35)
    c_mo, a_mo = layer('assets/faces/mouth.png', G['mouth'], attr('mouth'), mu, mv)
    c_ex, a_ex = layer('assets/faces/extras.png', G['extras'], attr('extra'), u, v)
    # features take a little of the light (an eye white must not glow at night)
    half = N.new('ShaderNodeMix'); half.data_type = 'RGBA'; half.inputs[0].default_value = 0.45
    half.inputs[6].default_value = (1, 1, 1, 1); L.new(gam.outputs[0], half.inputs[7])
    res = lit
    for c, a in ((c_mo, a_mo), (c_up, a_up), (c_ex, a_ex)):
        fl = vm(N, L, 'MULTIPLY', c, half.outputs[2])
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; L.new(a, mx.inputs[0]); L.new(res, mx.inputs[6]); L.new(fl, mx.inputs[7]); res = mx.outputs[2]
    em = N.new('ShaderNodeEmission'); L.new(res, em.inputs['Color']); L.new(em.outputs[0], out.inputs['Surface'])
    return m


FACE_DIR = None          # set by run.py: <scene dir>/faces/<scene name>; each character's face frames go in a subfolder


def face_material_seq(name, first_png, frame_end, skin=SKIN_WHITE, lift=0.55, R=0.24, fu=0.0, fv=0.0, fs=1.0):
    """Head material for procedural faces: lit white skin + the character's face image sequence (tools/facegen.py,
    one PNG per global frame) projected from the front, features taking a little of the light."""
    m = bpy.data.materials.new(name); nt, N, L = _nodes(m)
    out = N.new('ShaderNodeOutputMaterial')
    dif = N.new('ShaderNodeBsdfDiffuse'); s2r = N.new('ShaderNodeShaderToRGB'); L.new(dif.outputs[0], s2r.inputs[0])
    gam = N.new('ShaderNodeGamma'); gam.inputs['Gamma'].default_value = lift; L.new(s2r.outputs['Color'], gam.inputs['Color'])
    sk = N.new('ShaderNodeRGB'); sk.outputs[0].default_value = col(skin)
    bw = N.new('ShaderNodeRGBToBW'); L.new(gam.outputs[0], bw.inputs[0])
    dr = N.new('ShaderNodeMix'); dr.data_type = 'RGBA'; dr.inputs[0].default_value = 0.65
    L.new(gam.outputs[0], dr.inputs[6]); L.new(bw.outputs[0], dr.inputs[7])
    cm = N.new('ShaderNodeVectorMath'); cm.operation = 'MULTIPLY_ADD'
    L.new(dr.outputs[2], cm.inputs[0]); cm.inputs[1].default_value = (0.74, 0.74, 0.74); cm.inputs[2].default_value = (0.3, 0.3, 0.3)   # night 2: more modelling (the reference heads shade to grey at the rims)
    lit = vm(N, L, 'MULTIPLY', sk.outputs[0], cm.outputs[0])
    # the reference heads are balls: a soft grey falloff toward the silhouette (facing ratio) on top of the light
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
    rim = mth(N, L, 'MULTIPLY_ADD', mth(N, L, 'POWER', lw.outputs['Facing'], 2.2), -0.2, 1.0)
    lit = vm(N, L, 'MULTIPLY', lit, rim)
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    span = 2 * R * fs
    u = mth(N, L, 'MULTIPLY_ADD', sep.outputs['X'], 1 / span, 0.5 + fu)
    v = mth(N, L, 'MULTIPLY_ADD', sep.outputs['Z'], 1 / span, 0.5 + fv)
    front = mth(N, L, 'LESS_THAN', sep.outputs['Y'], 0.0)
    cmb = N.new('ShaderNodeCombineXYZ'); L.new(u, cmb.inputs[0]); L.new(v, cmb.inputs[1])
    tx = N.new('ShaderNodeTexImage'); im = bpy.data.images.load(first_png); im.source = 'SEQUENCE'
    tx.image = im; tx.extension = 'CLIP'; tx.interpolation = 'Linear'
    iu = tx.image_user; iu.frame_start = 1; iu.frame_offset = 0; iu.frame_duration = frame_end; iu.use_auto_refresh = True
    L.new(cmb.outputs[0], tx.inputs['Vector'])
    a = mth(N, L, 'MULTIPLY', tx.outputs['Alpha'], front)
    half = N.new('ShaderNodeMix'); half.data_type = 'RGBA'; half.inputs[0].default_value = 0.45
    half.inputs[6].default_value = (1, 1, 1, 1); L.new(gam.outputs[0], half.inputs[7])
    fl = vm(N, L, 'MULTIPLY', tx.outputs['Color'], half.outputs[2])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; L.new(a, mx.inputs[0]); L.new(lit, mx.inputs[6]); L.new(fl, mx.inputs[7])
    em = N.new('ShaderNodeEmission'); L.new(mx.outputs[2], em.inputs['Color']); L.new(em.outputs[0], out.inputs['Surface'])
    return m


def brow_overlay(base, first_png, frame_end, R=0.24, fu=0.0, fv=0.0, fs=1.0):
    """A copy of a hair material with the brows-only image sequence (br_####.png) projected from the front like the face:
    the reference's raised brows sit ON the hair cap (they vanished under it before)."""
    m = base.copy(); m.name = base.name + '_brows'; nt = m.node_tree; N, L = nt.nodes, nt.links
    out = next((n for n in N if n.type == 'OUTPUT_MATERIAL'), None)
    if out is None or not out.inputs['Surface'].links: return base
    src = out.inputs['Surface'].links[0].from_socket
    tc = N.new('ShaderNodeTexCoord'); sep = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Object'], sep.inputs[0])
    span = 2 * R * fs
    u = mth(N, L, 'MULTIPLY_ADD', sep.outputs['X'], 1 / span, 0.5 + fu)
    v = mth(N, L, 'MULTIPLY_ADD', sep.outputs['Z'], 1 / span, 0.5 + fv)
    front = mth(N, L, 'LESS_THAN', sep.outputs['Y'], 0.0)
    cmb = N.new('ShaderNodeCombineXYZ'); L.new(u, cmb.inputs[0]); L.new(v, cmb.inputs[1])
    tx = N.new('ShaderNodeTexImage'); im = bpy.data.images.load(first_png); im.source = 'SEQUENCE'
    tx.image = im; tx.extension = 'CLIP'; tx.interpolation = 'Linear'
    iu = tx.image_user; iu.frame_start = 1; iu.frame_offset = 0; iu.frame_duration = frame_end; iu.use_auto_refresh = True
    L.new(cmb.outputs[0], tx.inputs['Vector'])
    a = mth(N, L, 'MULTIPLY', tx.outputs['Alpha'], front)
    em = N.new('ShaderNodeEmission'); L.new(tx.outputs['Color'], em.inputs['Color'])
    mx = N.new('ShaderNodeMixShader'); L.new(a, mx.inputs[0]); L.new(src, mx.inputs[1]); L.new(em.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    return m


def mth(N, L, op, a, b=None, c=None):
    n = N.new('ShaderNodeMath'); n.operation = op
    for i, x in enumerate((a, b, c)):
        if x is None: continue
        if isinstance(x, (int, float)): n.inputs[i].default_value = x
        else: L.new(x, n.inputs[i])
    return n.outputs[0]


def vm(N, L, op, a, b):
    n = N.new('ShaderNodeVectorMath'); n.operation = op
    L.new(a, n.inputs[0]); L.new(b, n.inputs[1]); return n.outputs[0]
