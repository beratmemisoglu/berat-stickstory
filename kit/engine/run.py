# blender -b -P engine/run.py -- <scene.py> [--frames 1-30 | 1,15,30] [--scale 0.5] [--out dir] [--samples N] [--save file.blend]
# The scene module defines build(ctx) -> (first_frame, last_frame); ctx has cz, char, args. Renders PNG frames.
import sys, os, importlib.util, time, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy
import cz, char, cam

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
scene_file = argv[0]
opt = {}
i = 1
while i < len(argv):
    if argv[i].startswith('--'):
        k = argv[i][2:]; v = argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else '1'
        opt[k] = v; i += 2 if v != '1' or (i + 1 < len(argv) and argv[i + 1] == '1') else 1
    else: i += 1


class Ctx: pass
ctx = Ctx(); ctx.cz = cz; ctx.char = char; ctx.cam = cam; ctx.args = opt; ctx.lab = cz.LAB
t0 = time.time()
cz.reset()
ctx.dir = cz.use_scene(scene_file); ctx.words = cz.words      # the film's folder, its narration's words
spec = importlib.util.spec_from_file_location('scene', scene_file); mod = importlib.util.module_from_spec(spec)
sys.path.insert(0, os.path.dirname(os.path.abspath(scene_file)))
spec.loader.exec_module(mod)
f0, f1 = mod.build(ctx)
sc = bpy.context.scene
print(f'CZ built in {time.time() - t0:.1f}s frames {f0}-{f1}')
# contact check on every render (legs in seats, arms through tables): CZ_CLIPCHECK=0 skips it
if os.environ.get('CZ_CLIPCHECK', '1') != '0' and char.ALL:
    import clipcheck
    t1 = time.time()
    try: clipcheck.clip_check(char.ALL, f0, f1, step=int(os.environ.get('CZ_CLIPSTEP', '4')))
    except Exception as e: print('CZ CLIPCHECK error', e)
    print(f'CZ clipcheck {time.time() - t1:.1f}s')
# --camcheck: build, then measure the SCENE camera frame by frame (whatever made it: mega.Flight or hand keys) - the
# camera smoothness gate of the megaproject look (owner 2026-10-27: "jittery, jaggy ... focal length often bad")
if 'camcheck' in opt:
    import mega
    from mathutils import Vector
    F, E, D, L, seg = [], [], [], [], []
    cam = sc.camera
    lastloc = None
    for f in range(f0, f1 + 1):
        sc.frame_set(f); m = cam.matrix_world
        e = m.to_translation(); d = (m.to_quaternion() @ Vector((0, 0, -1))).normalized()
        # a jump of the camera > 8 m in one frame or a swing > 25 deg = a planned cut, not a jerk
        cut = lastloc is not None and ((e - lastloc).length > 8 * (1 + (e - lastloc).length * 0) and (e - lastloc).length > 8 or (D and math.degrees(d.angle(D[-1])) > 25))
        seg.append((seg[-1] + 1 if cut else seg[-1]) if seg else 0)
        F.append(f); E.append(e.copy()); D.append(d); L.append(cam.data.lens); lastloc = e.copy()
    mega.cam_report(F, E, D, L, seg)
    print(f'CZ CAMCHECKED {os.path.basename(scene_file)} frames {f0}-{f1}'); sys.exit(0)
# --check: build + the contact report only, no frames (Toon Studio's check_shot tool reads the CZ lines)
if 'check' in opt:
    print(f'CZ CHECKED frames {f0}-{f1} in {time.time() - t0:.1f}s'); sys.exit(0)
if 'samples' in opt: sc.eevee.taa_render_samples = int(opt['samples'])
# speed knobs (2026-10-27 benchmark): PNG compression costs ~0.1 s per 1080x1920 frame; fast GI can be switched off
sc.render.image_settings.compression = int(opt.get('compression', os.environ.get('CZ_PNG_COMPRESSION', '0')))
if 'mb' in opt: sc.render.use_motion_blur = opt['mb'] == '1'
if 'fastgi' in opt:
    try: sc.eevee.use_fast_gi = opt['fastgi'] == '1'
    except Exception: pass
sc.render.resolution_percentage = int(float(opt.get('scale', '1')) * 100)
if 'save' in opt: bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(opt['save']))
out = os.path.abspath(opt.get('out', os.path.join(cz.LAB if not cz.GEN else ctx.dir, 'renders', os.path.splitext(os.path.basename(scene_file))[0])))
os.makedirs(out, exist_ok=True)
fr = opt.get('frames', f'{f0}-{f1}')
frames = []
for part in fr.split(','):
    if '-' in part: a, b = part.split('-'); frames += list(range(int(a), int(b) + 1))
    else: frames.append(int(part))
# --anim (2026-10-27 speed pass): the whole contiguous range as ONE animation render with persistent data - EEVEE keeps
# the scene synced between frames instead of rebuilding it per frame (the per-frame render call was ~0.18 s of overhead)
if 'anim' in opt and frames == list(range(frames[0], frames[-1] + 1)):
    sc.render.use_persistent_data = True
    sc.frame_start, sc.frame_end = frames[0], frames[-1]
    sc.render.filepath = os.path.join(out, '####')
    sc.render.use_file_extension = True
    ta = time.time(); bpy.ops.render.render(animation=True)
    print(f'CZ anim {len(frames)} frames {(time.time() - ta) / len(frames):.3f} s/frame')
    for f in frames: print(f'CZ frame {f} 0.00s')                # (the lines tools count)
    print(f'CZ rendered {len(frames)} frames to {out} in {time.time() - t0:.1f}s'); sys.exit(0)
for f in frames:
    tf = time.time()
    sc.frame_set(f); ta = time.time()
    sc.render.filepath = os.path.join(out, f'{f:04d}.png')
    bpy.ops.render.render(write_still=False); tb = time.time()
    bpy.data.images['Render Result'].save_render(sc.render.filepath); tc = time.time()
    print(f'CZ frame {f} {time.time() - tf:.2f}s (set {ta - tf:.2f} render {tb - ta:.2f} write {tc - tb:.2f})')      # the first one includes EEVEE's shader compile (tools/bench.py)
print(f'CZ rendered {len(frames)} frames to {out} in {time.time() - t0:.1f}s')
