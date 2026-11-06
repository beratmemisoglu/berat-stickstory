# Try post.py grades on a sample of a film's frames before encoding the whole film: lum / sat / con / sharpness the
# way measure.py computes them (360 px wide, OpenCV), next to the reference's targets.
#   .venv/Scripts/python.exe tools/gradeprobe.py film/jar/frames_final --step 20 --try "sat=0.95,gain=1.18" "sat=1.0,gain=1.25"
import argparse, json, os, subprocess, tempfile
import numpy as np
try: import cv2                          # the lab has OpenCV; Toon Studio members' Python has numpy + Pillow only
except ImportError: cv2 = None

ap = argparse.ArgumentParser(); ap.add_argument('frames'); ap.add_argument('--step', type=int, default=20)
ap.add_argument('--try', dest='tries', nargs='+', default=['sat=1.2,gain=1.0,lift=0.575'])
ap.add_argument('--ref', default=None)   # another film's reference measure.json (Everest)
a = ap.parse_args()
LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R = json.load(open(a.ref or os.path.join(LAB, 'ref', 'measure.json')))['frames']
ref = {k: np.mean([r[k] for r in R]) for k in ('lum', 'sat', 'con', 'sharp')}
pngs = sorted(f for f in os.listdir(a.frames) if f.endswith('.png'))[::a.step]
tmp = tempfile.mkdtemp()
lst = os.path.join(tmp, 'list.txt')
open(lst, 'w').write(''.join(f"file '{os.path.join(os.path.abspath(a.frames), p)}'\nduration 0.0333\n" for p in pngs))


def _stats_pil(path):
    """the same four numbers without OpenCV: BT.601 grey (PIL 'L' = cv2's GRAY), HSV saturation 255*(max-min)/max (PIL
    'HSV' = cv2's), a box-filtered 360 px downscale (~INTER_AREA) and a 4-neighbour Laplacian with reflected borders"""
    from PIL import Image
    im = Image.open(path).convert('RGB'); h = int(im.height * 360 / im.width)
    sm = im.resize((360, h), Image.BOX)
    g = np.asarray(sm.convert('L')).astype(np.float64); s = np.asarray(sm.convert('HSV'))[..., 1].astype(np.float64)
    p = np.pad(g, 1, mode='reflect')
    lap = p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:] - 4 * p[1:-1, 1:-1]
    return g.mean(), s.mean(), g.std(), lap.var()


def stats(dirp):
    out = {k: [] for k in ref}
    for f in sorted(os.listdir(dirp)):
        if cv2 is None:
            lum, sat, con, sharp = _stats_pil(os.path.join(dirp, f))
            out['lum'].append(lum); out['sat'].append(sat); out['con'].append(con); out['sharp'].append(sharp); continue
        img = cv2.imread(os.path.join(dirp, f)); h = int(img.shape[0] * 360 / img.shape[1])
        sm = cv2.resize(img, (360, h), interpolation=cv2.INTER_AREA)
        g = cv2.cvtColor(sm, cv2.COLOR_BGR2GRAY); hsv = cv2.cvtColor(sm, cv2.COLOR_BGR2HSV)
        out['lum'].append(g.mean()); out['sat'].append(hsv[..., 1].mean()); out['con'].append(g.std())
        out['sharp'].append(cv2.Laplacian(g, cv2.CV_64F).var())
    return {k: float(np.mean(v)) for k, v in out.items()}


print(f"{'grade':34s} {'lum':>6s} {'sat':>6s} {'con':>6s} {'sharp':>7s}")
print(f"{'reference':34s} {ref['lum']:6.1f} {ref['sat']:6.1f} {ref['con']:6.1f} {ref['sharp']:7.0f}")
for t in a.tries:
    p = dict(kv.split('=') for kv in t.split(','))
    sat, gain, lift, sharpen = float(p.get('sat', 1.2)), float(p.get('gain', 1.0)), float(p.get('lift', 0.575)), float(p.get('sharpen', 0.9))
    bloom, curve = float(p.get('bloom', 0.5)), p.get('curve', f'0/0 0.5/{lift} 1/1')
    g = f"curves=all='0/0 {1 / gain:.4f}/1 1/1'," if gain > 1.0 else ''
    vf = (f"format=gbrp,split=2[a][b];[b]curves=all='0/0 0.72/0 1/1',gblur=sigma=26[g];[a][g]blend=all_mode=screen:all_opacity={bloom}[c];"
          f"[c]{g}curves=all='{curve}',eq=saturation={sat},unsharp=5:5:{sharpen}:5:5:0.0,vignette=angle=PI/5,format=rgb24")
    od = os.path.join(tmp, 'g%d' % a.tries.index(t)); os.makedirs(od)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', vf, '-fps_mode', 'passthrough',
                    os.path.join(od, '%04d.png')], check=True)
    s = stats(od)
    print('  graded samples:', od)   # LOOK at them: metrics passed while a gain washed bronze out to cream
    flag = lambda k, m: 'ok' if abs(s[k] - ref[k]) <= m * ref[k] else 'FAIL'
    print(f"{t:34s} {s['lum']:6.1f} {s['sat']:6.1f} {s['con']:6.1f} {s['sharp']:7.0f}   "
          f"lum {flag('lum', 0.15)} sat {flag('sat', 0.2)} con {flag('con', 0.2)} sharp {flag('sharp', 0.5)}")
    # distance to the reference in margin units (lower = closer) - tools/final.py picks the grade with this
    d = max(abs(s['lum'] - ref['lum']) / (0.15 * ref['lum']), abs(s['sat'] - ref['sat']) / (0.2 * ref['sat']),
            abs(s['con'] - ref['con']) / (0.2 * ref['con']))
    print('GRADE', json.dumps({'try': t, 'dist': round(d, 3), **{k: round(v, 1) for k, v in s.items()}}))
