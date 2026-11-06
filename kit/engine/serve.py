# The preview frame server (Toon Studio's Blender engine): builds ONE sequence once, then answers JSON commands on stdin,
# one per line, so the app can scrub a shot without Blender ever being visible:
#   blender -b --factory-startup -P engine/serve.py -- <seq.py>
#   {"cmd": "frame", "f": 412, "mode": "solid"|"look", "w": 540, "out": "C:/.../0412.jpg", "samples": 8}
#       -> CZSRV FRAME {"f": 412, "out": ..., "ms": 123}
#   {"cmd": "pick", "f": 412, "x": 0.5, "y": 0.3}    (0..1 across / down the frame)
#       -> CZSRV PICK {"object": "lt_scanner", "owner": "lt_scanner", "char": null, "point": [x, y, z]}
#   {"cmd": "quit"}
# Every answer is one line starting with "CZSRV " (Blender prints its own lines too). Errors: CZSRV ERROR {"msg": ...}.
# Solid = Blender's Workbench engine (flat studio shading, the ink hulls kept with backface culling, the toon base colours
# copied to the viewport colour), Look = EEVEE as the film renders it but small, few samples, no motion blur.
import sys, os, json, time, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
from mathutils import Vector
import cz, char, cam

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
scene_file = os.path.abspath(argv[0])


def say(kind, data):
    sys.stdout.write('CZSRV ' + kind + ' ' + json.dumps(data) + '\n'); sys.stdout.flush()


class Ctx: pass
ctx = Ctx(); ctx.cz = cz; ctx.char = char; ctx.cam = cam; ctx.args = {}; ctx.lab = cz.LAB
t0 = time.time()
try:
    cz.reset()
    ctx.dir = cz.use_scene(scene_file); ctx.words = cz.words
    spec = importlib.util.spec_from_file_location('scene', scene_file); mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, os.path.dirname(scene_file))
    spec.loader.exec_module(mod)
    f0, f1 = mod.build(ctx)
except Exception as e:
    import traceback; traceback.print_exc()
    say('ERROR', {'msg': f'build failed: {e!r}', 'stage': 'build'}); sys.exit(1)
sc = bpy.context.scene
LOOK_ENGINE = sc.render.engine
FULL = (sc.render.resolution_x, sc.render.resolution_y)

# the toon materials end in Emission: give every material a viewport colour from its base colour so Workbench shows it
for m in bpy.data.materials:
    if not m.use_nodes or not m.node_tree: continue
    rgb = next((n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeRGB'), None)
    if rgb is not None: m.diffuse_color = tuple(rgb.outputs[0].default_value)
    elif m.name.startswith('cz_ink') or 'outline' in m.name or 'inkline' in m.name: m.diffuse_color = (0.04, 0.035, 0.03, 1)

# see-through objects (glass, smudges, light beams, fog cards: a Transparent BSDF in a material): Workbench draws them
# opaque (a grey wall over the lady behind the prize window), so Solid hides them, and a pick looks through them
def _see_through(o):
    for s in getattr(o, 'material_slots', []):
        m = s.material
        if m and m.use_nodes and m.node_tree and any(n.bl_idname == 'ShaderNodeBsdfTransparent' for n in m.node_tree.nodes): return True
    return False


SEE = {o.name for o in sc.objects if o.type in ('MESH', 'CURVE') and _see_through(o)}
HIDE0 = {n: sc.objects[n].hide_render for n in SEE}
# objects -> who they belong to (a character's parts answer with the character)
CHARS = {c.root.name: c.name for c in char.ALL}


def owner_of(ob):
    o = ob
    while o is not None:
        if o.name in CHARS: return CHARS[o.name], o.name
        if o.parent is None: return None, o.name
        o = o.parent
    return None, ob.name


def set_mode(mode, w, samples):
    sc.render.resolution_percentage = 100
    sc.render.resolution_x = int(w); sc.render.resolution_y = int(round(w * FULL[1] / FULL[0]))
    sc.render.use_motion_blur = False
    if mode == 'solid':
        sc.render.engine = 'BLENDER_WORKBENCH'
        sh = sc.display.shading
        sh.light = 'STUDIO'; sh.color_type = 'TEXTURE'; sh.show_backface_culling = True
        sh.show_object_outline = True; sh.object_outline_color = (0.05, 0.04, 0.04)
        sh.show_shadows = False; sh.show_cavity = False
        sc.display.render_aa = '8'
        for n in SEE: sc.objects[n].hide_render = True
    else:
        sc.render.engine = LOOK_ENGINE
        sc.eevee.taa_render_samples = int(samples)
        for n, h in HIDE0.items(): sc.objects[n].hide_render = h
    sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 88


say('READY', {'f0': f0, 'f1': f1, 'fps': sc.render.fps, 'w': FULL[0], 'h': FULL[1], 'build_s': round(time.time() - t0, 2),
              'chars': sorted(CHARS.values())})
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try: q = json.loads(line)
    except Exception: say('ERROR', {'msg': 'not json', 'line': line[:200]}); continue
    try:
        cmd = q.get('cmd')
        if cmd == 'quit': break
        if cmd == 'frame':
            t = time.time(); f = int(q['f'])
            set_mode(q.get('mode', 'solid'), q.get('w', 540), q.get('samples', 8))
            sc.frame_set(f); sc.render.filepath = q['out']
            bpy.ops.render.render(write_still=True)
            say('FRAME', {'f': f, 'out': q['out'], 'mode': q.get('mode', 'solid'), 'ms': int((time.time() - t) * 1000)})
        elif cmd == 'range':
            # the playback cache: every frame of f0..f1 (step) into dir/NNNN.jpg, one CZSRV CACHED line each (a second server
            # instance does this, so the interactive one keeps answering scrubs)
            t = time.time(); n = 0; step = int(q.get('step', 1))
            set_mode(q.get('mode', 'solid'), q.get('w', 360), q.get('samples', 4))
            os.makedirs(q['dir'], exist_ok=True)
            for f in range(int(q['f0']), int(q['f1']) + 1, step):
                sc.frame_set(f); sc.render.filepath = os.path.join(q['dir'], f'{f:04d}.jpg')
                bpy.ops.render.render(write_still=True); n += 1
                say('CACHED', {'f': f})
            say('RANGE', {'n': n, 'ms': int((time.time() - t) * 1000)})
        elif cmd == 'pick':
            f = int(q['f']); sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get()
            camo = sc.camera; fr = [camo.matrix_world @ v for v in camo.data.view_frame(scene=sc)]
            # view_frame: top-right, bottom-right, bottom-left, top-left (in the camera's own space)
            tr, br, bl, tl = fr; x, y = float(q['x']), float(q['y'])
            top = tl.lerp(tr, x); bot = bl.lerp(br, x); p = top.lerp(bot, y)
            org = camo.matrix_world.to_translation(); d = (p - org).normalized(); passed = []
            for _ in range(12):        # through glass, beams and other see-through things to what the eye lands on
                hit, loc, nrm, idx, ob, M = sc.ray_cast(dg, org, d)
                if not hit or ob.name not in SEE: break
                passed.append(ob.name); org = loc + d * 0.002
            if hit:
                who, root = owner_of(ob)
                say('PICK', {'f': f, 'object': ob.name, 'owner': root, 'char': who, 'point': [round(v, 3) for v in loc], 'through': passed})
            else: say('PICK', {'f': f, 'object': None, 'owner': None, 'char': None, 'point': None})
        else: say('ERROR', {'msg': f'unknown cmd {cmd}'})
    except Exception as e:
        import traceback; traceback.print_exc(); say('ERROR', {'msg': repr(e), 'cmd': q.get('cmd')})
say('BYE', {})
