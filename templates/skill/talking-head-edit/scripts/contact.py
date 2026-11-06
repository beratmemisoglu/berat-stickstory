"""Step 11 - QUALITY GATE: visual check. Writes contact.png (facecam row over screen row at 4 points across
the edit) and switches.png (facecam 0.5 s before/after every camera-clip switch). READ both images.
Check: facecam present (not black) where expected, same person/framing across switches, screen content
matches what is being said at that moment.
"""
import os, sys, json, subprocess
sys.path.insert(0, os.path.dirname(__file__)); from common import load, fmt, gate, SCREEN_OUT, CAM_OUT
p = load(); tl = json.load(open('timeline.json')); D = tl[-1][2] + (tl[-1][1] - tl[-1][0]); sy = p.get('sync', {})
cam = os.path.exists(CAM_OUT) and bool(p.get('sync'))
def grab(src, t, dst, wdt=480):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', src, '-frames:v', '1', '-vf', f'scale={wdt}:-2', dst])
pts = [1.0, D * 0.33, D * 0.66, D - 2.0]
ins = []
for i, t in enumerate(pts):
    if cam: grab(CAM_OUT, t, f'cs_f{i}.png')
    grab(SCREEN_OUT, t, f'cs_s{i}.png')
args = []; flt = ''
files = ([f'cs_f{i}.png' for i in range(4)] if cam else []) + [f'cs_s{i}.png' for i in range(4)]
for f in files: args += ['-i', f]
rows = len(files) // 4
flt = ';'.join(f'[{r*4}][{r*4+1}][{r*4+2}][{r*4+3}]hstack=4[r{r}]' for r in range(rows))
flt += ';' + ''.join(f'[r{r}]' for r in range(rows)) + (f'vstack={rows}' if rows > 1 else 'copy')
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args + ['-filter_complex', flt, 'contact.png'])
print('contact.png at', [fmt(t) for t in pts])
if cam and len(sy) > 1:
    cl = lambda a: next((k for k, v in sy.items() if v['scr_start'] <= a <= v['scr_end']), None)
    sw = [tl[i][2] for i in range(1, len(tl)) if cl(tl[i][0]) != cl(tl[i-1][0])]
    fs = []
    for j, t in enumerate(sw):
        for d, tag in ((-0.5, 'a'), (0.5, 'b')):
            f = f'sw_{j}{tag}.png'; grab(CAM_OUT, max(0, t + d), f, 360); fs.append(f)
    if fs:
        a2 = []; [a2.extend(['-i', f]) for f in fs]
        subprocess.run(['ffmpeg', '-v', 'error', '-y'] + a2 + ['-filter_complex', f'hstack={len(fs)}' if len(fs) > 1 else 'copy', 'switches.png'])
        print('switches.png: clip switches at', [fmt(t) for t in sw], '(pairs = 0.5 s before | after)')
