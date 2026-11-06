# How much the camera MOVES, measured in the picture (measure.py's per-frame tx/ty/rot/zoom), ours vs the reference,
# per shot range (assemble.json + each shot file's F0/F1): pan speed (% of frame per frame), zoom speed (%/f), and the
# cut whips (motion in the 4 frames either side of each cut).
#   .venv/Scripts/python.exe tools/cammotion.py <ours measure.json> <ref measure.json> <film dir>
import json, os, re, sys
import numpy as np

def load(p):
    F = json.load(open(p))['frames']
    pan = np.array([np.hypot(f.get('tx', 0) or 0, f.get('ty', 0) or 0) for f in F])
    zm = np.array([abs(((f.get('zoom', 1) or 1) - 1) * 100) for f in F])
    rot = np.array([abs(f.get('rot', 0) or 0) for f in F])
    ok = np.array([(f.get('inl', 0) or 0) >= 20 for f in F])
    return pan, zm, rot, ok

o, r = load(sys.argv[1]), load(sys.argv[2]); film = sys.argv[3]
A = json.load(open(os.path.join(film, 'assemble.json')))
rows = []
for s in A['shots']:
    m = re.search(r'^F0\s*,\s*F1\s*=\s*(\d+)\s*,\s*(\d+)', open(os.path.join(film, s + '.py'), encoding='utf8').read(), re.M)
    f0, f1 = int(m.group(1)), int(m.group(2))
    def st(d):
        pan, zm, rot, ok = d; sl = slice(f0 - 1, f1)
        k = ok[sl]
        g = lambda x: float(np.median(x[sl][k])) if k.any() else float('nan')
        return g(pan), g(zm), g(rot)
    a, b = st(o), st(r)
    rows.append((s, f0, f1, a, b))
    print(f'{s} {f0:5d}-{f1:5d}  pan ours {a[0]:5.2f} ref {b[0]:5.2f}   zoom ours {a[1]:5.2f} ref {b[1]:5.2f}   rot ours {a[2]:5.2f} ref {b[2]:5.2f}'
          + ('   SLOW' if a[0] + a[1] < 0.5 * (b[0] + b[1]) else ''))
slow = sum(1 for x in rows if x[3][0] + x[3][1] < 0.5 * (x[4][0] + x[4][1]))
print(f'CAMMOTION {len(rows) - slow} of {len(rows)} shots move at least half as much as the reference ({slow} SLOW)')
