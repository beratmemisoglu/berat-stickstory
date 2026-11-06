"""Step 8 - render every span as its own clip on an ABSOLUTE output frame grid, then concat losslessly (mux.py).

Why per-span: one giant ffmpeg select/setpts expression fails to parse beyond a few hundred cuts, and naive
trim+concat accumulates up to half a frame of rounding error PER cut. Here span i always covers output
frames round(o_i*fps) .. round(o_{i+1}*fps), so error never accumulates (frame counts must match exactly).

Facecam: each span is pulled from the camera clip that covers it, mapped through THAT clip's offset+drift,
so any number of camera files become ONE continuous facecam. Where no camera was recording, frames are black
(reported). Clips ending mid-span are padded with black (reported).
usage: python segrender.py screen   |   python segrender.py cam
"""
import json, subprocess, sys, os
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(__file__)); from common import load, fps_of, fmt
which = sys.argv[1]; p = load(); sy = p.get('sync', {})
tl = json.load(open('timeline.json')); D = tl[-1][2] + (tl[-1][1] - tl[-1][0])
if which == 'screen':
    fps = fps_of(p['screen']['fps']); W, H = p['screen']['width'], p['screen']['height']
else:
    assert sy, 'no synced camera clips'
    fps = fps_of(Counter(p['cams'][k]['fps'] for k in sy).most_common(1)[0][0])
    W, H = max(p['cams'][k]['width'] for k in sy), max(p['cams'][k]['height'] for k in sy)
od = f'seg_{which}'
# segments are cached for resumable renders, but ONLY for the exact same cut + sync: a changed script.md must never
# reuse old segment files (same index, different content = silently wrong video)
import hashlib, shutil
sig = hashlib.sha1((open('timeline.json').read() + json.dumps(sy, sort_keys=True) + which + str(fps)).encode()).hexdigest()
if os.path.isdir(od) and (not os.path.exists(f'{od}/signature') or open(f'{od}/signature').read() != sig):
    shutil.rmtree(od); print('cut or sync changed since the last render: old segments removed')
os.makedirs(od, exist_ok=True); open(f'{od}/signature', 'w').write(sig)

def encoder():
    t = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=256x256:r=30', '-frames:v', '2',
                        '-c:v', 'h264_nvenc', '-f', 'null', '-'], capture_output=True)
    return (['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '18', '-b:v', '0'] if t.returncode == 0
            else ['-c:v', 'libx264', '-preset', 'fast', '-crf', '16'])
ENC = encoder() + ['-g', '120', '-bf', '0', '-pix_fmt', 'yuv420p', '-video_track_timescale', '60000']
print('encoder:', ENC[1], '| fps', fps, f'| {W}x{H}')

jobs = []; notes = []
for i, (a, b, o) in enumerate(tl):
    o_next = tl[i+1][2] if i + 1 < len(tl) else D
    k0, k1 = round(o * fps), round(o_next * fps); n = k1 - k0
    if n <= 0: continue
    s = a + (float(k0 / fps) - o); e = s + n / float(fps)          # screen-time window of this segment
    if which == 'screen':
        jobs.append((i, p['screen']['path'], s, 0.0, n, None)); continue
    best, ov = None, 0
    for k, v in sy.items():
        x = min(e, v['scr_end']) - max(s, v['scr_start'])
        if x > ov: best, ov = k, x
    if best is None:
        jobs.append((i, None, 0, 0, n, None)); notes.append(f'span {i} out {fmt(o)}: no camera -> black'); continue
    v = sy[best]; t = (s - v['c']) / (1 + v['m']); pre = 0.0
    if t < 0: pre, t = -t, 0.0
    if ov < (e - s) - 0.04: notes.append(f'span {i} out {fmt(o)}: {best} covers {ov:.2f}/{e-s:.2f}s -> black padding')
    jobs.append((i, p['cams'][best]['path'], t, pre, n, best))

def run(j):
    i, src, t, pre, n, clip = j
    out = f'{od}/{i:04d}.mp4'
    if os.path.exists(out) and os.path.getsize(out) > 0: return None
    if src is None:
        cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'color=c=black:s={W}x{H}:r={fps.numerator}/{fps.denominator}',
               '-frames:v', str(n)] + ENC + [out + '.tmp.mp4']
    else:
        vf = (f'tpad=start_duration={pre:.6f}:color=black,' if pre > 0 else '') + f'fps={fps.numerator}/{fps.denominator}'
        if which == 'cam': vf += f',scale={W}:{H}:flags=lanczos'
        vf += ',tpad=stop=-1:color=black'
        base = ['-ss', f'{t:.6f}', '-i', src, '-an', '-sn', '-dn', '-vf', vf, '-frames:v', str(n)] + ENC + [out + '.tmp.mp4']
        cmd = ['ffmpeg', '-v', 'error', '-y'] + (['-hwaccel', 'cuda'] if which == 'cam' else []) + base
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode and which == 'cam':
            cmd = ['ffmpeg', '-v', 'error', '-y'] + base
        elif not r.returncode:
            cmd = None
    if cmd:
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode: return f'FAIL span {i}: {r.stderr[-300:]}'
    got = subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'v', '-show_entries', 'stream=nb_read_packets',
                          '-of', 'csv=p=0', out + '.tmp.mp4'], capture_output=True, text=True).stdout.strip()
    os.replace(out + '.tmp.mp4', out)
    return None if got == str(n) else f'SHORT span {i}: {got} of {n} frames'
with ThreadPoolExecutor(6) as ex: errs = [e for e in ex.map(run, jobs) if e]
with open(f'{od}/list.txt', 'w') as f:
    for j in jobs: f.write(f"file '{j[0]:04d}.mp4'\n")
print(f'{which}: {len(jobs)} segments, {sum(j[4] for j in jobs)} frames (expected {round(D * fps)})'
      + ('' if which == 'screen' else f" | sources {dict(Counter(j[5] or 'BLACK' for j in jobs))}"))
for x in notes: print('  note:', x)
for x in errs: print('  !!', x)
if errs: print('Re-run the same command after fixing: finished segments are skipped, failed ones re-render.')
